import crypto from "node:crypto";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import { sellerFulfillmentProfiles, sellers } from "@/src/db/schema";
import type { CartLineInput } from "@/src/modules/cart/contracts";
import { validateCartLines } from "@/src/modules/cart/server";
import {
  checkoutQuoteRequestSchema,
  type CheckoutDeliveryAddress,
  type CheckoutDeliveryGroup,
  type CheckoutQuoteRequest,
  type CheckoutQuoteResponse,
} from "@/src/modules/checkout/contracts";
import type { CurrencyContext } from "@/src/modules/currency";
import { getJurgensDeliveryScheduleOptions } from "@/src/modules/delivery-scheduling/jurgens";
import { getBobGoCheckoutRates } from "@/src/modules/shipping/bobgo-client";
import { getJurgensDeliveryCheckoutRates } from "@/src/modules/shipping/jurgens-delivery";

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
      exchangeEmptyConfirmed: item.exchangeEmptyConfirmed,
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
    local_area: normalized.suburb,
    street_address: [normalized.addressLine1, normalized.addressLine2]
      .filter(Boolean)
      .join(", "),
    zone: normalized.province,
  };
}

function getGroupKey(item: {
  fulfillmentMode: "seller_fulfilled" | "piessang_fulfilled";
  sellerId: string | null;
}) {
  return item.fulfillmentMode === "piessang_fulfilled"
    ? "jurgens"
    : `seller:${item.sellerId ?? "missing"}`;
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
  const itemsByGroup = new Map<string, typeof cart.items>();

  for (const item of cart.items) {
    const groupKey = getGroupKey(item);
    const groupItems = itemsByGroup.get(groupKey) ?? [];
    groupItems.push(item);
    itemsByGroup.set(groupKey, groupItems);
  }

  const sellerIds = Array.from(
    new Set(
      cart.items
        .filter((item) => item.fulfillmentMode === "seller_fulfilled")
        .map((item) => item.sellerId)
        .filter((sellerId): sellerId is string => Boolean(sellerId)),
    ),
  );
  const sellerRows =
    sellerIds.length > 0
      ? await db
          .select({
            addressLine1: sellerFulfillmentProfiles.addressLine1,
            addressLine2: sellerFulfillmentProfiles.addressLine2,
            city: sellerFulfillmentProfiles.city,
            collectionInstructions:
              sellerFulfillmentProfiles.collectionInstructions,
            countryCode: sellerFulfillmentProfiles.countryCode,
            displayName: sellers.displayName,
            isVerified: sellerFulfillmentProfiles.isVerified,
            postalCode: sellerFulfillmentProfiles.postalCode,
            province: sellerFulfillmentProfiles.province,
            sellerId: sellers.id,
            suburb: sellerFulfillmentProfiles.suburb,
          })
          .from(sellers)
          .leftJoin(
            sellerFulfillmentProfiles,
            eq(sellerFulfillmentProfiles.sellerId, sellers.id),
          )
          .where(inArray(sellers.id, sellerIds))
      : [];
  const sellerById = new Map(sellerRows.map((seller) => [seller.sellerId, seller]));
  const groups: CheckoutDeliveryGroup[] = [];
  const expiryTimes: number[] = [];

  for (const [groupKey, groupItems] of itemsByGroup) {
    if (groupKey === "jurgens") {
      try {
        const result = await getJurgensDeliveryCheckoutRates({
          checkoutFingerprint: fingerprint,
          declaredValue: groupItems.reduce(
            (total, item) => total + item.lineTotalZar,
            0,
          ),
          deliveryAddress: toProviderAddress(parsed.deliveryAddress),
          items: groupItems.map((item) => ({
            description: `${item.productTitle} - ${item.variantTitle}`,
            heightMm: item.heightMm ?? undefined,
            lengthMm: item.lengthMm ?? undefined,
            price: item.unitPriceZar,
            quantity: item.quantity,
            weightGrams: item.weightGrams ?? undefined,
            widthMm: item.widthMm ?? undefined,
          })),
          sellerId: null,
        });

        if (result.expiresAt) {
          expiryTimes.push(new Date(result.expiresAt).getTime());
        }

        groups.push({
          groupKey,
          label: "Jurgens Energy delivery",
          options: result.rates.flatMap((rate) =>
            rate.quoteId
              ? [
                  {
                    amountZar: rate.customerAmount,
                    deliveryInformation: rate.deliveryInformation,
                    label: rate.serviceName,
                    provider: "piessang_local" as const,
                    quoteId: rate.quoteId,
                    serviceLevel: rate.serviceLevel,
                  },
                ]
              : [],
          ),
          scheduling: result.eligible
            ? {
                options: await getJurgensDeliveryScheduleOptions(),
                required: true,
              }
            : null,
          sellerId: null,
          unavailableReason: result.eligible
            ? null
            : (result.unavailableReason ?? "Local delivery is unavailable."),
        });
      } catch (error) {
        groups.push({
          groupKey,
          label: "Jurgens Energy delivery",
          options: [],
          scheduling: null,
          sellerId: null,
          unavailableReason:
            error instanceof Error ? error.message : "Local delivery is unavailable.",
        });
      }

      continue;
    }

    const sellerId = groupItems[0]?.sellerId ?? null;
    const seller = sellerId ? sellerById.get(sellerId) : null;
    const label = seller?.displayName
      ? `Courier delivery from ${seller.displayName}`
      : "Courier delivery";

    if (
      !seller ||
      !seller.addressLine1 ||
      !seller.city ||
      !seller.postalCode ||
      !seller.province ||
      !seller.suburb
    ) {
      groups.push({
        groupKey,
        label,
        options: [],
        scheduling: null,
        sellerId,
        unavailableReason:
          "The seller collection address is not ready for courier quoting.",
      });
      continue;
    }

    const missingParcel = groupItems.some(
      (item) =>
        !item.heightMm ||
        !item.lengthMm ||
        !item.weightGrams ||
        !item.widthMm,
    );

    if (missingParcel) {
      groups.push({
        groupKey,
        label,
        options: [],
        scheduling: null,
        sellerId,
        unavailableReason:
          "A selected product is missing parcel measurements required for courier delivery.",
      });
      continue;
    }

    try {
      const result = await getBobGoCheckoutRates({
        checkoutFingerprint: fingerprint,
        collectionAddress: {
          city: seller.city,
          code: seller.postalCode,
          company: seller.displayName,
          country: seller.countryCode ?? "ZA",
          local_area: seller.suburb,
          street_address: [seller.addressLine1, seller.addressLine2]
            .filter(Boolean)
            .join(", "),
          zone: seller.province,
        },
        declaredValue: groupItems.reduce(
          (total, item) => total + item.lineTotalZar,
          0,
        ),
        deliveryAddress: toProviderAddress(parsed.deliveryAddress),
        handlingTime: 2,
        items: groupItems.map((item) => ({
          description: `${item.productTitle} - ${item.variantTitle}`,
          heightMm: item.heightMm!,
          lengthMm: item.lengthMm!,
          price: item.unitPriceZar,
          quantity: item.quantity,
          weightGrams: item.weightGrams!,
          widthMm: item.widthMm!,
        })),
        sellerId,
      });

      expiryTimes.push(new Date(result.expiresAt).getTime());
      groups.push({
        groupKey,
        label,
        options: result.rates
          .flatMap((rate) =>
            rate.quoteId
              ? [
                  {
                    amountZar: rate.customerAmount,
                    deliveryInformation: null,
                    label: rate.serviceName,
                    provider: "bobgo" as const,
                    quoteId: rate.quoteId,
                    serviceLevel: rate.serviceLevel,
                  },
                ]
              : [],
          )
          .sort((first, second) => first.amountZar - second.amountZar),
        sellerId,
        unavailableReason:
          result.rates.length > 0
            ? null
            : "No courier rates are available for this address.",
        scheduling: null,
      });
    } catch (error) {
      groups.push({
        groupKey,
        label,
        options: [],
        scheduling: null,
        sellerId,
        unavailableReason:
          error instanceof Error ? error.message : "Courier delivery is unavailable.",
      });
    }
  }

  return {
    expiresAt:
      expiryTimes.length > 0
        ? new Date(Math.min(...expiryTimes)).toISOString()
        : null,
    fingerprint,
    groups,
  };
}

export function getCheckoutDeliveryGroupKey(item: {
  fulfillmentMode: "seller_fulfilled" | "piessang_fulfilled";
  sellerId: string | null;
}) {
  return getGroupKey(item);
}
