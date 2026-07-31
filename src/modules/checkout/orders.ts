import crypto from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, like, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/src/db";
import {
  jurgensDeliverySchedules,
  invoices,
  orderItems,
  orders,
  payments,
  productVariants,
  shippingRateQuotes,
} from "@/src/db/schema";
import { validateCartLines } from "@/src/modules/cart/server";
import {
  createCheckoutOrderRequestSchema,
  type CheckoutAddressPrefill,
  type CheckoutDeliveryAddress,
  type CheckoutCustomer,
  type CreateCheckoutOrderRequest,
} from "@/src/modules/checkout/contracts";
import { isCheckoutPaymentConfirmed } from "@/src/modules/checkout/payment-confirmation";
import {
  createCheckoutFingerprint,
  getCheckoutFulfillmentProvider,
  getCheckoutDeliveryGroupKey,
} from "@/src/modules/checkout/delivery";
import { hasCourierGuySandboxCheckoutAccess } from "@/src/modules/checkout/sandbox-access";
import type { CurrencyContext } from "@/src/modules/currency";
import { validateJurgensDeliveryScheduleSelection } from "@/src/modules/delivery-scheduling/jurgens";
import {
  createCustomerAddress,
  CustomerAddressNotFoundError,
  getCheckoutAddressBook,
  markCustomerAddressUsed,
  updateCustomerAddress,
} from "@/src/modules/marketplace/account/addresses";
import { getPayFastIntegrationConfig } from "@/src/modules/marketplace/settings";
import type { CampaignAttributionSnapshot } from "@/src/modules/marketing/campaign-attribution";
import { ensureInvoiceForPaidOrder } from "@/src/modules/invoices/service";
import {
  createPendingCheckoutExpiry,
  isPendingCheckoutOpen,
} from "@/src/modules/inventory/lifecycle";
import { reserveOrderInventory } from "@/src/modules/inventory/reservations";
import { notifyAdminsOfCreatedOrder } from "@/src/modules/orders/paid-order-notifications";
import { evaluateCustomerDelivery } from "@/src/modules/shipping/customer-delivery-evaluation";
import { customerShippingSnapshotMatchesCart } from "@/src/modules/shipping/customer-shipping-snapshot";
import {
  linkWhatsappNumberToUser,
  WhatsappNumberLinkedToAnotherUserError,
} from "@/src/modules/whatsapp-ordering/customer-links";

const zarCurrencyContext: CurrencyContext = {
  country: "ZA",
  currency: "ZAR",
  locale: "en-ZA",
  rate: 1,
  rateUpdatedAt: null,
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function hashCheckoutToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createStableCheckoutToken(checkoutRequestId: string) {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is required.");
  }

  return crypto
    .createHmac("sha256", secret)
    .update(`hosted-checkout:${checkoutRequestId}`)
    .digest("base64url");
}

function createCheckoutRequestFingerprint(
  input: CreateCheckoutOrderRequest,
  userId: string | null,
) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ input, userId }))
    .digest("hex");
}

async function getIdempotentCheckoutReplay({
  checkoutRequestFingerprint,
  checkoutRequestId,
  userId,
}: {
  checkoutRequestFingerprint: string;
  checkoutRequestId: string;
  userId: string | null;
}) {
  const [order] = await db
    .select({
      checkoutRequestFingerprint: orders.checkoutRequestFingerprint,
      checkoutTokenHash: orders.checkoutTokenHash,
      id: orders.id,
      orderNumber: orders.orderNumber,
      paymentExpiresAt: orders.paymentExpiresAt,
      status: orders.status,
      userId: orders.userId,
    })
    .from(orders)
    .where(eq(orders.checkoutRequestId, checkoutRequestId))
    .limit(1);

  if (!order) {
    return null;
  }

  if (
    order.checkoutRequestFingerprint !== checkoutRequestFingerprint ||
    order.userId !== userId
  ) {
    throw new Error(
      "This checkout attempt was already used for different order details. Refresh checkout and try again.",
    );
  }

  if (
    order.status !== "pending" ||
    !isPendingCheckoutOpen(order.paymentExpiresAt)
  ) {
    throw new Error(
      "This checkout attempt is no longer awaiting payment. Return to your cart and start a new checkout.",
    );
  }

  const checkoutToken = createStableCheckoutToken(checkoutRequestId);

  if (order.checkoutTokenHash !== hashCheckoutToken(checkoutToken)) {
    throw new Error(
      "This checkout attempt cannot be reopened safely. Return to your cart and start a new checkout.",
    );
  }

  const [payment] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.orderId, order.id),
        eq(payments.provider, "payfast"),
        eq(payments.status, "pending"),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

  if (!payment) {
    throw new Error(
      "This checkout attempt no longer has a pending payment. Return to your cart and start a new checkout.",
    );
  }

  return {
    checkoutToken,
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentId: payment.id,
    redirectUrl: `/checkout/payfast/${order.id}?token=${encodeURIComponent(checkoutToken)}`,
  };
}

function createOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomBytes(5).toString("hex").toUpperCase();

  return `JE-${date}-${suffix}`;
}

function quoteGroupKey(quote: {
  provider: "manual" | "bobgo" | "courier_guy" | "jurgens_local";
}) {
  void quote;
  return "delivery";
}

function getJurgensZoneId(providerPayload: unknown) {
  if (!providerPayload || typeof providerPayload !== "object") {
    return null;
  }

  const value = (providerPayload as { zoneId?: unknown }).zoneId;

  return typeof value === "string" ? value : null;
}

function customerPolicyPayloadMatches({
  flatRate,
  freeOverAmount,
  providerPayload,
  rule,
}: {
  flatRate: number;
  freeOverAmount: number | null;
  providerPayload: unknown;
  rule: "flat_rate" | "free_shipping_over";
}) {
  if (!providerPayload || typeof providerPayload !== "object") {
    return false;
  }

  const payload = providerPayload as {
    customerPriceRule?: unknown;
    flatRate?: unknown;
    freeOverAmount?: unknown;
    merchantCountry?: unknown;
    providerRatesVisibleToCustomer?: unknown;
  };
  const payloadFreeOverAmount =
    payload.freeOverAmount === null ? null : Number(payload.freeOverAmount);

  return (
    payload.merchantCountry === "ZA" &&
    payload.providerRatesVisibleToCustomer === false &&
    payload.customerPriceRule === rule &&
    Number(payload.flatRate) === flatRate &&
    payloadFreeOverAmount === freeOverAmount
  );
}

function toCheckoutDeliveryAddress(address: {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  countryCode: string;
  postalCode: string;
  province: string;
  suburb: string;
}): CheckoutDeliveryAddress {
  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? "",
    city: address.city,
    countryCode: address.countryCode,
    postalCode: address.postalCode,
    province: address.province,
    suburb: address.suburb,
  };
}

async function resolveCheckoutAddressBookSelection({
  input,
  userId,
}: {
  input: CreateCheckoutOrderRequest;
  userId: string | null;
}): Promise<{
  customer: CheckoutCustomer;
  deliveryAddress: CheckoutDeliveryAddress;
}> {
  const intent = input.addressBookIntent;

  if (intent.kind === "none") {
    return {
      customer: input.customer,
      deliveryAddress: input.deliveryAddress,
    };
  }

  if (!userId) {
    throw new Error("Sign in before using or saving a delivery address.");
  }

  if (intent.kind === "save_new") {
    return {
      customer: input.customer,
      deliveryAddress: input.deliveryAddress,
    };
  }

  const addressBook = await getCheckoutAddressBook(userId);
  const selectedAddress = addressBook.addresses.find(
    (address) => address.id === intent.addressId,
  );

  if (!selectedAddress) {
    throw new CustomerAddressNotFoundError();
  }

  if (intent.kind === "update_existing") {
    return {
      customer: input.customer,
      deliveryAddress: input.deliveryAddress,
    };
  }

  return {
    customer: {
      ...input.customer,
      name: selectedAddress.recipientName,
      phone: selectedAddress.recipientPhone,
    },
    deliveryAddress: toCheckoutDeliveryAddress(selectedAddress),
  };
}

export async function getLatestOwnedCheckoutAddress(
  userId: string,
): Promise<CheckoutAddressPrefill | null> {
  const [order] = await db
    .select({
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      deliveryAddressSnapshot: orders.deliveryAddressSnapshot,
    })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        inArray(orders.status, ["paid", "fulfilled"]),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (!order) {
    return null;
  }

  return {
    ...toCheckoutDeliveryAddress(order.deliveryAddressSnapshot),
    recipientName: order.customerName,
    recipientPhone: order.customerPhone,
  };
}

export async function createHostedCheckoutOrder(
  input: CreateCheckoutOrderRequest,
  context: {
    campaignAttribution?: CampaignAttributionSnapshot | null;
  } = {},
) {
  const parsed = createCheckoutOrderRequestSchema.parse(input);
  const [session, payFastConfig] = await Promise.all([
    auth(),
    getPayFastIntegrationConfig(),
  ]);

  if (!payFastConfig.isConfigured) {
    throw new Error(
      "PayFast hosted checkout is not configured. Add the active merchant credentials in Platform Settings.",
    );
  }

  const userId = session?.user?.id ?? null;
  const checkoutRequestFingerprint = createCheckoutRequestFingerprint(
    parsed,
    userId,
  );
  const replay = await getIdempotentCheckoutReplay({
    checkoutRequestFingerprint,
    checkoutRequestId: parsed.checkoutRequestId,
    userId,
  });

  if (replay) {
    return replay;
  }

  const cart = await validateCartLines(
    { items: parsed.items },
    zarCurrencyContext,
  );

  if (
    cart.invalidVariantIds.length > 0 ||
    cart.items.length !== parsed.items.length ||
    cart.items.some((item) => !item.checkoutEligible)
  ) {
    throw new Error(
      "One or more selected products changed. Return to your cart and review them.",
    );
  }

  const requestedQuantityByVariantId = new Map(
    parsed.items.map((item) => [item.variantId, item.quantity]),
  );

  if (
    cart.items.some(
      (item) => requestedQuantityByVariantId.get(item.variantId) !== item.quantity,
    )
  ) {
    throw new Error(
      "Available quantities changed. Return to your cart and review the quantities.",
    );
  }

  const checkoutDetails = await resolveCheckoutAddressBookSelection({
    input: parsed,
    userId,
  });

  const fingerprint = createCheckoutFingerprint({
    deliveryAddress: checkoutDetails.deliveryAddress,
    items: parsed.items,
  });
  const selectionByGroup = new Map(
    parsed.deliverySelections.map((selection) => [selection.groupKey, selection]),
  );

  if (selectionByGroup.size !== parsed.deliverySelections.length) {
    throw new Error("Choose one delivery option for each delivery group.");
  }

  const expectedGroupKeys = Array.from(
    new Set(cart.items.map((item) => getCheckoutDeliveryGroupKey(item))),
  );

  if (
    expectedGroupKeys.length !== selectionByGroup.size ||
    expectedGroupKeys.some((groupKey) => !selectionByGroup.has(groupKey))
  ) {
    throw new Error("Choose a valid delivery option for every selected product.");
  }

  const quoteIds = parsed.deliverySelections.map((selection) => selection.quoteId);
  const quoteRows = await db
    .select()
    .from(shippingRateQuotes)
    .where(
      and(
        inArray(shippingRateQuotes.id, quoteIds),
        eq(shippingRateQuotes.status, "quoted"),
        eq(shippingRateQuotes.checkoutFingerprint, fingerprint),
        gt(shippingRateQuotes.expiresAt, new Date()),
      ),
    );

  if (quoteRows.length !== quoteIds.length) {
    throw new Error("Delivery rates expired. Request fresh rates and try again.");
  }

  const quoteByGroup = new Map(
    quoteRows.map((quote) => [quoteGroupKey(quote), quote]),
  );

  if (
    expectedGroupKeys.some(
      (groupKey) =>
        quoteByGroup.get(groupKey)?.id !== selectionByGroup.get(groupKey)?.quoteId,
    )
  ) {
    throw new Error("A selected delivery option does not match the current cart.");
  }

  const deliveryQuote = quoteByGroup.get("delivery");

  if (
    !deliveryQuote ||
    deliveryQuote.provider !== "manual" ||
    !deliveryQuote.providerRateId?.startsWith("customer-shipping-policy-")
  ) {
    throw new Error(
      "The delivery policy changed. Request a fresh delivery quote and try again.",
    );
  }

  const subtotal = roundMoney(
    cart.items.reduce((total, item) => total + item.lineTotalZar, 0),
  );
  const deliveryEvaluation = await evaluateCustomerDelivery({
    allowCourierGuySandboxCheckout:
      hasCourierGuySandboxCheckoutAccess(session?.user),
    deliveryAddress: checkoutDetails.deliveryAddress,
    items: cart.items,
    orderSubtotal: subtotal,
  });

  if (!deliveryEvaluation.eligible) {
    throw new Error(deliveryEvaluation.unavailableReason);
  }

  if (
    !customerShippingSnapshotMatchesCart(
      deliveryQuote.parcelSnapshot,
      cart.items,
    ) ||
    roundMoney(Number(deliveryQuote.customerAmount)) !==
      deliveryEvaluation.price.amount ||
    getJurgensZoneId(deliveryQuote.providerPayload) !==
      deliveryEvaluation.jurgensZoneId ||
    !customerPolicyPayloadMatches({
      flatRate: deliveryEvaluation.price.flatRate,
      freeOverAmount: deliveryEvaluation.price.freeOverAmount,
      providerPayload: deliveryQuote.providerPayload,
      rule: deliveryEvaluation.price.rule,
    })
  ) {
    throw new Error(
      "The delivery policy or selected products changed. Request a fresh delivery quote and try again.",
    );
  }

  const hasJurgensDelivery = cart.items.some(
    (item) => item.fulfillmentMode === "jurgens_fulfilled",
  );
  const scheduleSelection = parsed.jurgensDeliverySchedule
    ? await validateJurgensDeliveryScheduleSelection(
        parsed.jurgensDeliverySchedule,
      )
    : null;

  if (scheduleSelection && !scheduleSelection.ok) {
    throw new Error(scheduleSelection.message);
  }

  if (scheduleSelection && !hasJurgensDelivery) {
    throw new Error(
      "Jurgens Energy delivery can only be scheduled for Jurgens-fulfilled products.",
    );
  }

  const shippingTotal = roundMoney(
    quoteRows.reduce((total, quote) => total + Number(quote.customerAmount), 0),
  );
  const grandTotal = roundMoney(subtotal + shippingTotal);
  const checkoutToken = createStableCheckoutToken(parsed.checkoutRequestId);
  const checkoutTokenHash = hashCheckoutToken(checkoutToken);
  const orderNumber = createOrderNumber();
  const paymentExpiresAt = createPendingCheckoutExpiry();
  const deliveryAddressSnapshot = {
    addressLine1: checkoutDetails.deliveryAddress.addressLine1,
    addressLine2: checkoutDetails.deliveryAddress.addressLine2 || null,
    city: checkoutDetails.deliveryAddress.city,
    countryCode: checkoutDetails.deliveryAddress.countryCode.toUpperCase(),
    postalCode: checkoutDetails.deliveryAddress.postalCode,
    province: checkoutDetails.deliveryAddress.province,
    suburb: checkoutDetails.deliveryAddress.suburb,
  };
  const billingAddress = parsed.billingDetails?.sameAsDelivery
    ? deliveryAddressSnapshot
    : parsed.billingDetails?.address
      ? {
          addressLine1: parsed.billingDetails.address.addressLine1,
          addressLine2: parsed.billingDetails.address.addressLine2 || null,
          city: parsed.billingDetails.address.city,
          countryCode: parsed.billingDetails.address.countryCode.toUpperCase(),
          postalCode: parsed.billingDetails.address.postalCode,
          province: parsed.billingDetails.address.province,
          suburb: parsed.billingDetails.address.suburb || null,
        }
      : deliveryAddressSnapshot;
  const billingDetailsSnapshot = {
    ...billingAddress,
    businessName: parsed.billingDetails?.businessName?.trim() || null,
    name: parsed.billingDetails?.name.trim() || checkoutDetails.customer.name,
    suburb: billingAddress.suburb || null,
    vatRegistrationNumber:
      parsed.billingDetails?.vatRegistrationNumber?.trim() || null,
  };

  const created = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${parsed.checkoutRequestId}))`,
    );

    const [existingOrder] = await tx
      .select({
        checkoutRequestFingerprint: orders.checkoutRequestFingerprint,
        id: orders.id,
        orderNumber: orders.orderNumber,
        paymentExpiresAt: orders.paymentExpiresAt,
        status: orders.status,
        userId: orders.userId,
      })
      .from(orders)
      .where(eq(orders.checkoutRequestId, parsed.checkoutRequestId))
      .limit(1);

    if (existingOrder) {
      if (
        existingOrder.checkoutRequestFingerprint !==
          checkoutRequestFingerprint ||
        existingOrder.userId !== userId ||
        existingOrder.status !== "pending" ||
        !isPendingCheckoutOpen(existingOrder.paymentExpiresAt)
      ) {
        throw new Error(
          "This checkout attempt cannot be replayed safely. Refresh checkout and try again.",
        );
      }

      const [existingPayment] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.orderId, existingOrder.id),
            eq(payments.provider, "payfast"),
            eq(payments.status, "pending"),
          ),
        )
        .orderBy(desc(payments.createdAt))
        .limit(1);

      if (!existingPayment) {
        throw new Error(
          "This checkout attempt no longer has a pending payment.",
        );
      }

      return {
        id: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        paymentId: existingPayment.id,
      };
    }

    const claimedQuotes = await tx
      .update(shippingRateQuotes)
      .set({ status: "selected" })
      .where(
        and(
          inArray(shippingRateQuotes.id, quoteIds),
          eq(shippingRateQuotes.status, "quoted"),
          isNull(shippingRateQuotes.orderId),
          eq(shippingRateQuotes.checkoutFingerprint, fingerprint),
          eq(shippingRateQuotes.provider, "manual"),
          like(
            shippingRateQuotes.providerRateId,
            "customer-shipping-policy-%",
          ),
          gt(shippingRateQuotes.expiresAt, new Date()),
        ),
      )
      .returning({ id: shippingRateQuotes.id });

    if (claimedQuotes.length !== quoteIds.length) {
      throw new Error(
        "This delivery quote was already used or expired. Request a fresh quote and try again.",
      );
    }

    if (userId) {
      const addressInput = {
        ...checkoutDetails.deliveryAddress,
        isDefault:
          parsed.addressBookIntent.kind === "save_new" ||
          parsed.addressBookIntent.kind === "update_existing"
            ? parsed.addressBookIntent.isDefault
            : false,
        label:
          parsed.addressBookIntent.kind === "save_new" ||
          parsed.addressBookIntent.kind === "update_existing"
            ? parsed.addressBookIntent.label
            : "Delivery address",
        recipientName: checkoutDetails.customer.name,
        recipientPhone: checkoutDetails.customer.phone,
      };

      if (parsed.addressBookIntent.kind === "use_saved") {
        await markCustomerAddressUsed(
          userId,
          parsed.addressBookIntent.addressId,
          tx,
        );
      } else if (parsed.addressBookIntent.kind === "save_new") {
        const savedAddress = await createCustomerAddress(
          userId,
          addressInput,
          tx,
        );
        await markCustomerAddressUsed(userId, savedAddress.id, tx);
      } else if (parsed.addressBookIntent.kind === "update_existing") {
        const savedAddress = await updateCustomerAddress(
          userId,
          parsed.addressBookIntent.addressId,
          addressInput,
          tx,
        );
        await markCustomerAddressUsed(userId, savedAddress.id, tx);
      }
    }

    const [order] = await tx
      .insert(orders)
      .values({
        billingDetailsSnapshot,
        campaignAttributionSnapshot: context.campaignAttribution ?? null,
        checkoutRequestFingerprint,
        checkoutRequestId: parsed.checkoutRequestId,
        checkoutTokenHash,
        currency: "ZAR",
        customerEmail: checkoutDetails.customer.email.toLowerCase(),
        customerName: checkoutDetails.customer.name,
        customerPhone: checkoutDetails.customer.phone,
        deliveryAddressSnapshot,
        grandTotal: grandTotal.toFixed(2),
        orderNumber,
        paymentExpiresAt,
        policyAcceptanceSnapshot: {
          acceptedAt: new Date().toISOString(),
          deliveryInformationPath: "/delivery-information",
          effectiveDate: parsed.policyAcceptance.version,
          privacyPolicyPath: "/privacy-policy",
          returnsAndRefundsPath: "/returns-and-refunds",
          termsAndConditionsPath: "/terms-and-conditions",
        },
        shippingTotal: shippingTotal.toFixed(2),
        subtotal: subtotal.toFixed(2),
        userId,
      })
      .returning({ id: orders.id, orderNumber: orders.orderNumber });

    const exchangeBrandRows = await tx
      .select({
        exchangeAcceptedReturnBrands:
          productVariants.exchangeAcceptedReturnBrands,
        variantId: productVariants.id,
      })
      .from(productVariants)
      .where(
        inArray(
          productVariants.id,
          cart.items.map((item) => item.variantId),
        ),
      );
    const exchangeAcceptedReturnBrandsByVariantId = new Map(
      exchangeBrandRows.map((row) => [
        row.variantId,
        row.exchangeAcceptedReturnBrands,
      ]),
    );

    await tx.insert(orderItems).values(
      cart.items.map((item) => {
        const fulfillmentProvider = getCheckoutFulfillmentProvider(item);

        return {
          brandId: item.brandId,
          categoryId: item.categoryId,
          deliveryLabelSnapshot:
            fulfillmentProvider === "jurgens_local"
              ? "Jurgens Energy delivery"
              : "The Courier Guy",
          deliveryMethodSnapshot: fulfillmentProvider,
          exchangeAcceptedReturnBrandsSnapshot:
            exchangeAcceptedReturnBrandsByVariantId.get(item.variantId) ?? [],
          exchangeConfirmationTextSnapshot: item.exchangeConfirmationText,
          exchangeEmptyConfirmed: item.exchangeEmptyConfirmed,
          exchangeRequiredEmptyCylinderSize:
            item.exchangeRequiredEmptyCylinderSize,
          orderId: order.id,
          purchaseType: item.purchaseType,
          quantity: item.quantity,
          sellerId: item.sellerId,
          skuSnapshot: item.sku,
          taxRateBps: item.taxRateBps,
          title: `${item.productTitle} - ${item.variantTitle}`,
          unitPrice: item.unitPriceZar.toFixed(2),
          variantId: item.variantId,
        };
      }),
    );

    await reserveOrderInventory({
      expiresAt: paymentExpiresAt,
      lines: cart.items.map((item) => ({
        quantity: item.quantity,
        variantId: item.variantId,
      })),
      orderId: order.id,
      transaction: tx,
    });

    if (scheduleSelection?.ok && deliveryQuote) {
      await tx.insert(jurgensDeliverySchedules).values({
        deliveryInstructions: scheduleSelection.selection.deliveryInstructions,
        orderId: order.id,
        quoteId: deliveryQuote.id,
        scheduledDate: scheduleSelection.selection.date,
        zoneId: getJurgensZoneId(deliveryQuote.providerPayload),
      });
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        amount: grandTotal.toFixed(2),
        orderId: order.id,
        provider: "payfast",
      })
      .returning({ id: payments.id });

    const linkedQuotes = await tx
      .update(shippingRateQuotes)
      .set({ orderId: order.id })
      .where(
        and(
          inArray(shippingRateQuotes.id, quoteIds),
          eq(shippingRateQuotes.status, "selected"),
          isNull(shippingRateQuotes.orderId),
        ),
      )
      .returning({ id: shippingRateQuotes.id });

    if (linkedQuotes.length !== quoteIds.length) {
      throw new Error(
        "The delivery quote could not be linked to this order. Request a fresh quote and try again.",
      );
    }

    if (userId) {
      try {
        await linkWhatsappNumberToUser({
          database: tx,
          phone: checkoutDetails.customer.phone,
          source: "checkout",
          userId,
          verified: false,
        });
      } catch (error) {
        if (!(error instanceof WhatsappNumberLinkedToAnotherUserError)) {
          throw error;
        }
      }
    }

    return { ...order, paymentId: payment.id };
  });

  await notifyAdminsOfCreatedOrder(created.id).catch((error) => {
    console.error("[checkout] order-created admin notification failed", {
      error: error instanceof Error ? error.message : "unknown_error",
      orderId: created.id,
    });
  });

  return {
    checkoutToken,
    orderId: created.id,
    orderNumber: created.orderNumber,
    paymentId: created.paymentId,
    redirectUrl: `/checkout/payfast/${created.id}?token=${encodeURIComponent(checkoutToken)}`,
  };
}

export async function getCheckoutOrderWithToken(orderId: string, token: string) {
  if (!token) {
    return null;
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order?.checkoutTokenHash) {
    return null;
  }

  const actualHash = hashCheckoutToken(token);
  const expectedBuffer = Buffer.from(order.checkoutTokenHash, "hex");
  const actualBuffer = Buffer.from(actualHash, "hex");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  return order;
}

export async function getCheckoutOrderSummary(orderId: string, token: string) {
  const order = await getCheckoutOrderWithToken(orderId, token);

  if (!order) {
    return null;
  }

  if (order.status === "paid" || order.status === "fulfilled") {
    await ensureInvoiceForPaidOrder(order.id).catch(() => null);
  }

  const [paymentRows, itemRows, invoiceRows] = await Promise.all([
    db
      .select({
        providerStatus: payments.providerStatus,
        status: payments.status,
      })
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(desc(payments.createdAt)),
    db
      .select({
        quantity: orderItems.quantity,
        title: orderItems.title,
        variantId: orderItems.variantId,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id)),
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        renderStatus: invoices.renderStatus,
      })
      .from(invoices)
      .where(eq(invoices.orderId, order.id))
      .limit(1),
  ]);

  const payment = paymentRows[0];
  const paymentConfirmation = {
    paymentStatus: payment?.status ?? "pending",
    providerStatus: payment?.providerStatus ?? null,
    status: order.status,
  };

  return {
    createdAt: order.createdAt.toISOString(),
    customerEmail: order.customerEmail,
    grandTotal: Number(order.grandTotal),
    invoice: invoiceRows[0] ?? null,
    items: itemRows,
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentExpiresAt: order.paymentExpiresAt?.toISOString() ?? null,
    paymentWindowOpen:
      order.status === "pending" &&
      isPendingCheckoutOpen(order.paymentExpiresAt),
    paymentStatus: paymentConfirmation.paymentStatus,
    providerStatus: paymentConfirmation.providerStatus,
    purchasedVariantIds: isCheckoutPaymentConfirmed(paymentConfirmation)
      ? itemRows.map((item) => item.variantId)
      : [],
    shippingTotal: Number(order.shippingTotal),
    status: order.status,
    subtotal: Number(order.subtotal),
  };
}
