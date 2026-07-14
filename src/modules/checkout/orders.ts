import crypto from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/src/db";
import {
  jurgensDeliverySchedules,
  orderItems,
  orders,
  payments,
  shippingRateQuotes,
} from "@/src/db/schema";
import { validateCartLines } from "@/src/modules/cart/server";
import {
  createCheckoutOrderRequestSchema,
  type CreateCheckoutOrderRequest,
} from "@/src/modules/checkout/contracts";
import {
  createCheckoutFingerprint,
  getCheckoutDeliveryGroupKey,
} from "@/src/modules/checkout/delivery";
import type { CurrencyContext } from "@/src/modules/currency";
import { validateJurgensDeliveryScheduleSelection } from "@/src/modules/delivery-scheduling/jurgens";
import { getPayFastIntegrationConfig } from "@/src/modules/marketplace/settings";
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

function createOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomBytes(5).toString("hex").toUpperCase();

  return `JE-${date}-${suffix}`;
}

function quoteGroupKey(quote: {
  provider: "manual" | "bobgo" | "piessang_local";
  sellerId: string | null;
}) {
  return quote.provider === "piessang_local"
    ? "jurgens"
    : `seller:${quote.sellerId ?? "missing"}`;
}

function getJurgensZoneId(providerPayload: unknown) {
  if (!providerPayload || typeof providerPayload !== "object") {
    return null;
  }

  const value = (providerPayload as { zoneId?: unknown }).zoneId;

  return typeof value === "string" ? value : null;
}

export async function createHostedCheckoutOrder(
  input: CreateCheckoutOrderRequest,
) {
  const parsed = createCheckoutOrderRequestSchema.parse(input);
  const [session, payFastConfig, cart] = await Promise.all([
    auth(),
    getPayFastIntegrationConfig(),
    validateCartLines({ items: parsed.items }, zarCurrencyContext),
  ]);

  if (!payFastConfig.isConfigured) {
    throw new Error(
      "PayFast hosted checkout is not configured. Add the active merchant credentials in Platform Settings.",
    );
  }

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

  const fingerprint = createCheckoutFingerprint(parsed);
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

  const jurgensQuote = quoteByGroup.get("jurgens");
  const requiresJurgensSchedule = expectedGroupKeys.includes("jurgens");
  const scheduleSelection = requiresJurgensSchedule
    ? await validateJurgensDeliveryScheduleSelection(
        parsed.jurgensDeliverySchedule,
      )
    : null;

  if (scheduleSelection && !scheduleSelection.ok) {
    throw new Error(scheduleSelection.message);
  }

  if (requiresJurgensSchedule && jurgensQuote?.provider !== "piessang_local") {
    throw new Error("Choose a valid Jurgens delivery option before scheduling.");
  }

  const subtotal = roundMoney(
    cart.items.reduce((total, item) => total + item.lineTotalZar, 0),
  );
  const shippingTotal = roundMoney(
    quoteRows.reduce((total, quote) => total + Number(quote.customerAmount), 0),
  );
  const grandTotal = roundMoney(subtotal + shippingTotal);
  const checkoutToken = crypto.randomBytes(32).toString("base64url");
  const checkoutTokenHash = hashCheckoutToken(checkoutToken);
  const orderNumber = createOrderNumber();
  const deliveryAddressSnapshot = {
    addressLine1: parsed.deliveryAddress.addressLine1,
    addressLine2: parsed.deliveryAddress.addressLine2 || null,
    city: parsed.deliveryAddress.city,
    countryCode: parsed.deliveryAddress.countryCode.toUpperCase(),
    postalCode: parsed.deliveryAddress.postalCode,
    province: parsed.deliveryAddress.province,
    suburb: parsed.deliveryAddress.suburb,
  };

  const created = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        checkoutTokenHash,
        currency: "ZAR",
        customerEmail: parsed.customer.email.toLowerCase(),
        customerName: parsed.customer.name,
        customerPhone: parsed.customer.phone,
        deliveryAddressSnapshot,
        grandTotal: grandTotal.toFixed(2),
        orderNumber,
        policyAcceptanceSnapshot: {
          acceptedAt: new Date().toISOString(),
          effectiveDate: parsed.policyAcceptance.version,
          privacyPolicyPath: "/privacy-policy",
          returnsAndRefundsPath: "/returns-and-refunds",
          termsAndConditionsPath: "/terms-and-conditions",
        },
        shippingTotal: shippingTotal.toFixed(2),
        subtotal: subtotal.toFixed(2),
        userId: session?.user?.id || null,
      })
      .returning({ id: orders.id, orderNumber: orders.orderNumber });

    await tx.insert(orderItems).values(
      cart.items.map((item) => {
        const groupKey = getCheckoutDeliveryGroupKey(item);
        const quote = quoteByGroup.get(groupKey)!;

        return {
          brandId: item.brandId,
          categoryId: item.categoryId,
          deliveryLabelSnapshot: quote.serviceName,
          deliveryMethodSnapshot: quote.provider,
          exchangeAcceptedReturnBrandsSnapshot:
            item.exchangeAcceptedReturnBrands,
          exchangeConfirmationTextSnapshot: item.exchangeConfirmationText,
          exchangeEmptyConfirmed: item.exchangeEmptyConfirmed,
          exchangeRequiredEmptyCylinderSize:
            item.exchangeRequiredEmptyCylinderSize,
          orderId: order.id,
          purchaseType: item.purchaseType,
          quantity: item.quantity,
          sellerId: item.sellerId,
          title: `${item.productTitle} - ${item.variantTitle}`,
          unitPrice: item.unitPriceZar.toFixed(2),
          variantId: item.variantId,
        };
      }),
    );

    if (requiresJurgensSchedule && scheduleSelection?.ok && jurgensQuote) {
      await tx.insert(jurgensDeliverySchedules).values({
        deliveryInstructions: scheduleSelection.selection.deliveryInstructions,
        orderId: order.id,
        quoteId: jurgensQuote.id,
        scheduledDate: scheduleSelection.selection.date,
        windowEnd: scheduleSelection.selection.windowEnd,
        windowLabel: scheduleSelection.selection.windowLabel,
        windowStart: scheduleSelection.selection.windowStart,
        zoneId: getJurgensZoneId(jurgensQuote.providerPayload),
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

    await tx
      .update(shippingRateQuotes)
      .set({ orderId: order.id, status: "selected" })
      .where(inArray(shippingRateQuotes.id, quoteIds));

    if (session?.user?.id) {
      try {
        await linkWhatsappNumberToUser({
          database: tx,
          phone: parsed.customer.phone,
          source: "checkout",
          userId: session.user.id,
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

  const [paymentRows, itemRows] = await Promise.all([
    db
      .select({
        providerStatus: payments.providerStatus,
        status: payments.status,
      })
      .from(payments)
      .where(eq(payments.orderId, order.id)),
    db
      .select({
        quantity: orderItems.quantity,
        title: orderItems.title,
        variantId: orderItems.variantId,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id)),
  ]);

  return {
    createdAt: order.createdAt.toISOString(),
    customerEmail: order.customerEmail,
    grandTotal: Number(order.grandTotal),
    items: itemRows,
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentStatus: paymentRows[0]?.status ?? "pending",
    providerStatus: paymentRows[0]?.providerStatus ?? null,
    purchasedVariantIds:
      order.status === "paid" || order.status === "fulfilled"
        ? itemRows.map((item) => item.variantId)
        : [],
    shippingTotal: Number(order.shippingTotal),
    status: order.status,
    subtotal: Number(order.subtotal),
  };
}
