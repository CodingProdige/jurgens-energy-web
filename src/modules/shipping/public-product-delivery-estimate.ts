import "server-only";

import crypto from "node:crypto";
import { z } from "zod";

import { getRedis } from "@/src/cache/redis";
import { validateCartLines } from "@/src/modules/cart/server";
import { checkoutDeliveryAddressSchema } from "@/src/modules/checkout/contracts";
import type { CurrencyContext } from "@/src/modules/currency";
import {
  getCourierGuyIntegrationConfig,
  getMarketplaceSettings,
} from "@/src/modules/marketplace/settings";
import {
  createCourierGuyClient,
  type CourierGuyRate,
} from "@/src/modules/shipping/courier-guy-client";
import { selectCourierGuyRate } from "@/src/modules/shipping/courier-guy-booking-quote-rules";
import { calculateCustomerShippingPrice } from "@/src/modules/shipping/customer-shipping-policy";
import { checkJurgensDeliveryAvailability } from "@/src/modules/shipping/jurgens-delivery";

const estimateCacheLifetimeSeconds = 10 * 60;

const zarCurrencyContext: CurrencyContext = {
  country: "ZA",
  currency: "ZAR",
  locale: "en-ZA",
  rate: 1,
  rateUpdatedAt: null,
};

export const publicProductDeliveryEstimateInputSchema = z.object({
  deliveryAddress: checkoutDeliveryAddressSchema,
  variantId: z.string().uuid(),
});

export const publicProductDeliveryEstimateResultSchema = z.object({
  available: z.boolean(),
  deliveryFeeLabel: z.string(),
  estimatedDeliveryFrom: z.string().nullable(),
  estimatedDeliveryTo: z.string().nullable(),
  message: z.string(),
  provider: z.enum(["courier_guy", "jurgens_local", "unknown"]),
});

export type PublicProductDeliveryEstimateInput = z.infer<
  typeof publicProductDeliveryEstimateInputSchema
>;
export type PublicProductDeliveryEstimateResult = z.infer<
  typeof publicProductDeliveryEstimateResultSchema
>;

function formatZar(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(amount);
}

function getDeliveryFeeLabel({
  amount,
  freeOverAmount,
}: {
  amount: number;
  freeOverAmount: number | null;
}) {
  if (amount === 0) {
    return "Free delivery";
  }

  return freeOverAmount
    ? `${formatZar(amount)} delivery · Free over ${formatZar(freeOverAmount)}`
    : `${formatZar(amount)} delivery`;
}

function toCourierGuyAddress(
  address: z.infer<typeof checkoutDeliveryAddressSchema>,
) {
  return {
    addressType: "residential" as const,
    city: address.city.trim(),
    company: undefined,
    countryCode: "ZA",
    localArea: address.suburb.trim() || address.city.trim(),
    postalCode: address.postalCode.trim().toUpperCase().replace(/\s+/g, ""),
    streetAddress: [address.addressLine1, address.addressLine2]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", "),
    zone: address.province.trim(),
  };
}

function getCacheKey(
  input: PublicProductDeliveryEstimateInput,
  cacheVersion: Record<string, unknown>,
) {
  const normalized = {
    cacheVersion,
    deliveryAddress: toCourierGuyAddress(input.deliveryAddress),
    variantId: input.variantId,
  };
  const fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");

  return `public-product-delivery-estimate:${fingerprint}`;
}

async function readCachedEstimate(cacheKey: string) {
  try {
    const redis = await getRedis();
    const cached = await redis.get(cacheKey);

    if (!cached) {
      return null;
    }

    const parsed = publicProductDeliveryEstimateResultSchema.safeParse(
      JSON.parse(cached),
    );

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function cacheEstimate(
  cacheKey: string,
  estimate: PublicProductDeliveryEstimateResult,
) {
  try {
    const redis = await getRedis();
    await redis.set(cacheKey, JSON.stringify(estimate), {
      EX: estimateCacheLifetimeSeconds,
    });
  } catch {
    // A delivery estimate is useful without Redis; never fail the customer flow
    // because the short-lived provider-response cache is unavailable.
  }
}

function unavailableEstimate(
  deliveryFeeLabel: string,
  message: string,
): PublicProductDeliveryEstimateResult {
  return {
    available: false,
    deliveryFeeLabel,
    estimatedDeliveryFrom: null,
    estimatedDeliveryTo: null,
    message,
    provider: "unknown",
  };
}

function selectedCourierRate(
  rates: CourierGuyRate[],
  defaultServiceCode: string | null,
) {
  return selectCourierGuyRate(rates, defaultServiceCode);
}

function getEarliestCourierCollectionDate(cutoffTime: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Johannesburg",
    year: "numeric",
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hours = Number(byType.hour);
  const minutes = Number(byType.minute);
  const cutoffMatch = cutoffTime.match(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
  const [cutoffHours, cutoffMinutes] = (cutoffMatch ? cutoffTime : "14:00")
    .split(":")
    .map(Number);
  const currentDate = new Date(
    Date.UTC(Number(byType.year), Number(byType.month) - 1, Number(byType.day)),
  );
  const afterCutoff =
    hours > cutoffHours || (hours === cutoffHours && minutes >= cutoffMinutes);

  if (afterCutoff) {
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  while (currentDate.getUTCDay() === 0 || currentDate.getUTCDay() === 6) {
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return currentDate.toISOString().slice(0, 10);
}

export async function getPublicProductDeliveryEstimate(
  input: PublicProductDeliveryEstimateInput,
): Promise<PublicProductDeliveryEstimateResult> {
  const parsed = publicProductDeliveryEstimateInputSchema.parse(input);
  const [cart, settings, courierConfig] = await Promise.all([
    validateCartLines(
      {
        items: [
          {
            exchangeEmptyConfirmed: false,
            purchaseType: "standard",
            quantity: 1,
            variantId: parsed.variantId,
          },
        ],
      },
      zarCurrencyContext,
    ),
    getMarketplaceSettings(),
    getCourierGuyIntegrationConfig(),
  ]);
  const item = cart.items[0];
  const deliveryPrice = calculateCustomerShippingPrice({
    flatRate: settings.shippingFlatRate,
    freeOverAmount: settings.shippingFreeOverAmount,
    orderSubtotal: item?.unitPriceZar ?? 0,
  });
  const deliveryFeeLabel = getDeliveryFeeLabel(deliveryPrice);

  if (!settings.shippingEnabled) {
    return unavailableEstimate(
      deliveryFeeLabel,
      "Online delivery is temporarily unavailable.",
    );
  }

  if (!item?.available) {
    return unavailableEstimate(
      deliveryFeeLabel,
      "This option is no longer available for delivery.",
    );
  }

  if (item.fulfillmentMode === "jurgens_fulfilled") {
    const localDelivery = await checkJurgensDeliveryAvailability({
      postalCode: parsed.deliveryAddress.postalCode,
    });
    const result: PublicProductDeliveryEstimateResult = localDelivery.eligible
      ? {
          available: true,
          deliveryFeeLabel,
          estimatedDeliveryFrom: null,
          estimatedDeliveryTo: null,
          message:
            "Delivery is available to this address. Choose your delivery date at checkout.",
          provider: "jurgens_local",
        }
      : unavailableEstimate(
          deliveryFeeLabel,
          localDelivery.unavailableReason ??
            "Delivery is not available to this address.",
        );

    return result;
  }

  if (
    !courierConfig.isConfigured ||
    !courierConfig.enabled ||
    courierConfig.mode !== "live" ||
    !courierConfig.apiKey ||
    !courierConfig.dropoffPickupPointId
  ) {
    return unavailableEstimate(
      deliveryFeeLabel,
      "Courier delivery estimates are temporarily unavailable. Delivery is confirmed at checkout.",
    );
  }

  const collectionMinDate = getEarliestCourierCollectionDate(
    settings.jurgensDeliveryCutoffTime,
  );
  const cacheKey = getCacheKey(parsed, {
    courier: {
      defaultServiceCode: courierConfig.defaultServiceCode,
      dropoffPickupPointId: courierConfig.dropoffPickupPointId,
      dropoffProvider: courierConfig.dropoffProvider,
      enabled: courierConfig.enabled,
      mode: courierConfig.mode,
    },
    product: {
      available: item.available,
      fulfillmentMode: item.fulfillmentMode,
      heightMm: item.heightMm,
      lengthMm: item.lengthMm,
      price: item.unitPriceZar,
      weightGrams: item.weightGrams,
      widthMm: item.widthMm,
    },
    shipping: {
      cutoffTime: settings.jurgensDeliveryCutoffTime,
      collectionMinDate,
      enabled: settings.shippingEnabled,
      flatRate: settings.shippingFlatRate,
      freeOverAmount: settings.shippingFreeOverAmount,
    },
  });
  const cached = await readCachedEstimate(cacheKey);

  if (cached) {
    return cached;
  }

  if (
    !item.heightMm ||
    !item.lengthMm ||
    !item.weightGrams ||
    !item.widthMm
  ) {
    return unavailableEstimate(
      deliveryFeeLabel,
      "This item needs a delivery check. Please contact support for help.",
    );
  }

  try {
    const client = createCourierGuyClient({
      apiBaseUrl: courierConfig.apiBaseUrl,
      apiKey: courierConfig.apiKey,
      timeoutMs: 5_000,
    });
    const rateResponse = await client.getRates({
      collectionMinDate,
      collectionOrigin: {
        kind: "pickup_point",
        pickupPointId: courierConfig.dropoffPickupPointId,
        provider: courierConfig.dropoffProvider,
      },
      deliveryAddress: toCourierGuyAddress(parsed.deliveryAddress),
      parcels: [
        {
          description: `${item.productTitle} - ${item.variantTitle}`.slice(0, 255),
          heightMm: item.heightMm,
          itemCount: 1,
          lengthMm: item.lengthMm,
          weightGrams: item.weightGrams,
          widthMm: item.widthMm,
        },
      ],
    });
    const rate = selectedCourierRate(
      rateResponse.rates,
      courierConfig.defaultServiceCode,
    );

    const result: PublicProductDeliveryEstimateResult = rate
      ? {
          available: true,
          deliveryFeeLabel,
          estimatedDeliveryFrom: rate.estimatedDeliveryFrom,
          estimatedDeliveryTo: rate.estimatedDeliveryTo,
          message:
            rate.estimatedDeliveryFrom || rate.estimatedDeliveryTo
              ? "Courier Guy estimated delivery window."
              : "Courier delivery is available to this address. Your delivery timing is confirmed at checkout.",
          provider: "courier_guy",
        }
      : unavailableEstimate(
          deliveryFeeLabel,
          "This item cannot be delivered to the selected address.",
        );

    await cacheEstimate(cacheKey, result);
    return result;
  } catch {
    return unavailableEstimate(
      deliveryFeeLabel,
      "We could not confirm a Courier Guy estimate right now. Please try again or continue to checkout.",
    );
  }
}
