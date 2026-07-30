import crypto from "node:crypto";

import type { CartLineInput } from "@/src/modules/cart/contracts";
import { validateCartLines } from "@/src/modules/cart/server";
import {
  checkoutQuoteRequestSchema,
  type CheckoutDeliveryAddress,
  type CheckoutDeliveryGroup,
  type CheckoutQuoteRequest,
  type CheckoutQuoteResponse,
} from "@/src/modules/checkout/contracts";
import { CHECKOUT_DELIVERY_GROUP_KEY } from "@/src/modules/checkout/flow";
import type { CurrencyContext } from "@/src/modules/currency";
import { getJurgensDeliveryScheduleAvailability } from "@/src/modules/delivery-scheduling/jurgens";
import { evaluateCustomerDelivery } from "@/src/modules/shipping/customer-delivery-evaluation";
import { createCustomerShippingQuote } from "@/src/modules/shipping/customer-shipping-quote";

const zarCurrencyContext: CurrencyContext = {
  country: "ZA",
  currency: "ZAR",
  locale: "en-ZA",
  rate: 1,
  rateUpdatedAt: null,
};

function normalizeAddress(address: CheckoutDeliveryAddress) {
  return {
    addressLine1: address.addressLine1.trim(),
    addressLine2: address.addressLine2.trim(),
    city: address.city.trim(),
    countryCode: address.countryCode.trim().toUpperCase(),
    postalCode: address.postalCode.trim().toUpperCase().replace(/\s+/g, ""),
    province: address.province.trim(),
    suburb: address.suburb.trim(),
  };
}

export function createCheckoutFingerprint({
  deliveryAddress,
  items,
}: {
  deliveryAddress: CheckoutDeliveryAddress;
  items: CartLineInput[];
}) {
  const normalizedItems = [...items]
    .map((item) => ({
      purchaseType: item.purchaseType,
      quantity: item.quantity,
      variantId: item.variantId,
    }))
    .sort((first, second) => first.variantId.localeCompare(second.variantId));

  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        deliveryAddress: normalizeAddress(deliveryAddress),
        items: normalizedItems,
      }),
    )
    .digest("hex");
}

function toProviderAddress(address: CheckoutDeliveryAddress) {
  const normalized = normalizeAddress(address);

  return {
    city: normalized.city,
    code: normalized.postalCode,
    country: normalized.countryCode,
    local_area: normalized.suburb || normalized.city,
    street_address: [normalized.addressLine1, normalized.addressLine2]
      .filter(Boolean)
      .join(", "),
    zone: normalized.province,
  };
}

export function getCheckoutFulfillmentProvider(item: {
  fulfillmentMode: "seller_fulfilled" | "jurgens_fulfilled";
}) {
  return item.fulfillmentMode === "jurgens_fulfilled"
    ? ("jurgens_local" as const)
    : ("courier_guy" as const);
}

export async function getCheckoutDeliveryQuotes(
  input: CheckoutQuoteRequest,
): Promise<CheckoutQuoteResponse> {
  const parsed = checkoutQuoteRequestSchema.parse(input);
  const cart = await validateCartLines({ items: parsed.items }, zarCurrencyContext);

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
  const normalizedAddress = normalizeAddress(parsed.deliveryAddress);
  const unavailable = (reason: string): CheckoutQuoteResponse => ({
    expiresAt: null,
    fingerprint,
    groups: [
      {
        groupKey: CHECKOUT_DELIVERY_GROUP_KEY,
        label: "Delivery",
        options: [],
        scheduling: null,
        sellerId: null,
        unavailableReason: reason,
      },
    ],
  });

  const evaluation = await evaluateCustomerDelivery({
    deliveryAddress: {
      ...parsed.deliveryAddress,
      countryCode: normalizedAddress.countryCode,
      postalCode: normalizedAddress.postalCode,
    },
    items: cart.items,
    orderSubtotal: cart.subtotalZar,
  });

  if (!evaluation.eligible) {
    return unavailable(evaluation.unavailableReason);
  }

  try {
    const quote = await createCustomerShippingQuote({
      checkoutFingerprint: fingerprint,
      deliveryAddress: {
        ...toProviderAddress(parsed.deliveryAddress),
        country: "ZA",
      },
      items: cart.items.map((item) => ({
        description: `${item.productTitle} - ${item.variantTitle}`,
        fulfillmentMode: getCheckoutFulfillmentProvider(item),
        heightMm: item.heightMm ?? undefined,
        lengthMm: item.lengthMm ?? undefined,
        price: item.unitPriceZar,
        quantity: item.quantity,
        sellerId: item.sellerId,
        variantId: item.variantId,
        weightGrams: item.weightGrams ?? undefined,
        widthMm: item.widthMm ?? undefined,
      })),
      jurgensZoneId: evaluation.jurgensZoneId,
      price: evaluation.price,
    });
    const scheduleAvailability = evaluation.hasJurgensItems
      ? await getJurgensDeliveryScheduleAvailability()
      : null;
    const groups: CheckoutDeliveryGroup[] = [
      {
        groupKey: CHECKOUT_DELIVERY_GROUP_KEY,
        label: "Delivery",
        options: [quote.option],
        scheduling: scheduleAvailability
          ? {
              cutoffTime: scheduleAvailability.cutoffTime,
              cutoffTimeZone: scheduleAvailability.cutoffTimeZone,
              nextPolicyChangeAt: scheduleAvailability.nextPolicyChangeAt,
              options: scheduleAvailability.options,
              required: false,
            }
          : null,
        sellerId: null,
        unavailableReason: null,
      },
    ];

    return {
      expiresAt: quote.expiresAt.toISOString(),
      fingerprint,
      groups,
    };
  } catch {
    return unavailable("Delivery is temporarily unavailable. Please try again.");
  }
}

export function getCheckoutDeliveryGroupKey(item: {
  fulfillmentMode: "seller_fulfilled" | "jurgens_fulfilled";
}) {
  void item;
  return CHECKOUT_DELIVERY_GROUP_KEY;
}
