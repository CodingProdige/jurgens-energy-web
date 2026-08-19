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
import { getPublicDeliveryTiming } from "@/src/modules/marketplace/public-delivery-copy";
import {
  CourierGuyApiError,
  createCourierGuyClient,
  type CourierGuyRate,
} from "@/src/modules/shipping/courier-guy-client";
import { selectCourierGuyRate } from "@/src/modules/shipping/courier-guy-booking-quote-rules";
import { checkJurgensDeliveryAvailability } from "@/src/modules/shipping/jurgens-delivery";

const estimateCacheLifetimeSeconds = 10 * 60;
const courierGuyEstimateProbeParcel = {
  description: "Delivery time estimate",
  heightMm: 200,
  itemCount: 1,
  lengthMm: 300,
  weightGrams: 1_000,
  widthMm: 300,
} as const;

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

export const publicDeliveryWindowInputSchema = z.object({
  deliveryAddress: checkoutDeliveryAddressSchema,
});

export const publicProductDeliveryEstimateResultSchema = z.object({
  available: z.boolean(),
  estimatedDeliveryFrom: z.string().nullable(),
  estimatedDeliveryTo: z.string().nullable(),
  message: z.string(),
  provider: z.enum([
    "courier_guy",
    "jurgens_local",
    "standard_delivery",
    "unknown",
  ]),
});

export type PublicProductDeliveryEstimateInput = z.infer<
  typeof publicProductDeliveryEstimateInputSchema
>;
export type PublicDeliveryWindowInput = z.infer<
  typeof publicDeliveryWindowInputSchema
>;
export type PublicProductDeliveryEstimateResult = z.infer<
  typeof publicProductDeliveryEstimateResultSchema
>;

function getCacheKey(
  deliveryAddress: z.infer<typeof checkoutDeliveryAddressSchema>,
  cacheVersion: Record<string, unknown>,
) {
  const normalized = {
    cacheVersion,
    deliveryAddress: toCourierGuyAddress(deliveryAddress),
  };
  const fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");

  return `public-product-delivery-estimate:${fingerprint}`;
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
  message: string,
): PublicProductDeliveryEstimateResult {
  return {
    available: false,
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

function getEarliestDispatchDate(cutoffTime: string, now = new Date()) {
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

function addBusinessDays(startDate: string, businessDays: number) {
  const date = new Date(`${startDate}T12:00:00Z`);
  let remainingDays = businessDays;

  while (remainingDays > 0) {
    date.setUTCDate(date.getUTCDate() + 1);

    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) {
      remainingDays -= 1;
    }
  }

  return date.toISOString().slice(0, 10);
}

function getDeliveryWindow(settings: Awaited<ReturnType<typeof getMarketplaceSettings>>) {
  const timing = getPublicDeliveryTiming(settings);
  const dispatchDate = getEarliestDispatchDate(settings.jurgensDeliveryCutoffTime);

  return {
    estimatedDeliveryFrom: addBusinessDays(
      dispatchDate,
      timing.totalMinBusinessDays,
    ),
    estimatedDeliveryTo: addBusinessDays(
      dispatchDate,
      timing.totalMaxBusinessDays,
    ),
  };
}

function getCourierCollectionDate(
  settings: Awaited<ReturnType<typeof getMarketplaceSettings>>,
) {
  const timing = getPublicDeliveryTiming(settings);

  return addBusinessDays(
    getEarliestDispatchDate(settings.jurgensDeliveryCutoffTime),
    timing.handlingMaxBusinessDays,
  );
}

async function getCourierGuyDeliveryWindow({
  courierConfig,
  deliveryAddress,
  settings,
}: {
  courierConfig: Awaited<ReturnType<typeof getCourierGuyIntegrationConfig>>;
  deliveryAddress: z.infer<typeof checkoutDeliveryAddressSchema>;
  settings: Awaited<ReturnType<typeof getMarketplaceSettings>>;
}): Promise<PublicProductDeliveryEstimateResult> {
  const deliveryWindow = getDeliveryWindow(settings);
  const collectionMinDate = getCourierCollectionDate(settings);
  const cacheKey = getCacheKey(deliveryAddress, {
    estimateStrategy: "courier_guy_address_delivery_window_v1",
    courier: {
      defaultServiceCode: courierConfig.defaultServiceCode,
      dropoffPickupPointId: courierConfig.dropoffPickupPointId,
      dropoffProvider: courierConfig.dropoffProvider,
      enabled: courierConfig.enabled,
      mode: courierConfig.mode,
    },
    shipping: {
      cutoffTime: settings.jurgensDeliveryCutoffTime,
      collectionMinDate,
      enabled: settings.shippingEnabled,
      handlingMaximum: settings.shippingHandlingMaxBusinessDays,
      handlingMinimum: settings.shippingHandlingMinBusinessDays,
      transitMaximum: settings.shippingTransitMaxBusinessDays,
      transitMinimum: settings.shippingTransitMinBusinessDays,
    },
  });
  const cached = await readCachedEstimate(cacheKey);

  if (cached) {
    return cached;
  }

  if (
    courierConfig.isConfigured &&
    courierConfig.enabled &&
    courierConfig.mode === "live" &&
    courierConfig.apiKey &&
    courierConfig.dropoffPickupPointId
  ) {
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
        deliveryAddress: toCourierGuyAddress(deliveryAddress),
        // Courier Guy requires a parcel to calculate its ETA. This fixed probe
        // is used only for the public delivery-time lookup—never for pricing,
        // checkout validation, shipment booking, or product parcel data.
        parcels: [courierGuyEstimateProbeParcel],
      });
      const rate = selectedCourierRate(
        rateResponse.rates,
        courierConfig.defaultServiceCode,
      );

      if (rate?.estimatedDeliveryFrom || rate?.estimatedDeliveryTo) {
        const result: PublicProductDeliveryEstimateResult = {
          available: true,
          estimatedDeliveryFrom: rate.estimatedDeliveryFrom,
          estimatedDeliveryTo: rate.estimatedDeliveryTo,
          message: "Courier Guy estimated delivery to your selected address.",
          provider: "courier_guy",
        };

        await cacheEstimate(cacheKey, result);
        return result;
      }
      console.warn("Courier Guy public ETA returned no dated service", {
        addressPostalCode: deliveryAddress.postalCode,
        preferredServiceCode: courierConfig.defaultServiceCode,
        rateCount: rateResponse.rates.length,
        serviceCodes: rateResponse.rates.map((candidate) => candidate.serviceCode),
      });
    } catch (error) {
      const courierError =
        error instanceof CourierGuyApiError
          ? {
              code: error.code,
              operation: error.operation,
              status: error.status,
            }
          : { code: "unknown", operation: "get Courier Guy rates", status: null };

      console.error("Courier Guy public ETA lookup failed", {
        ...courierError,
        addressPostalCode: deliveryAddress.postalCode,
      });
    }
  }

  // Do not cache the fallback. The carrier can recover at any time, and a
  // previous failed lookup must never suppress a fresh Courier Guy ETA.
  return {
    available: true,
    ...deliveryWindow,
    message: "Typical delivery window. Courier Guy's live estimate is temporarily unavailable.",
    provider: "standard_delivery",
  };
}

export async function getPublicDeliveryWindow(
  input: PublicDeliveryWindowInput,
): Promise<PublicProductDeliveryEstimateResult> {
  const parsed = publicDeliveryWindowInputSchema.parse(input);
  const [settings, courierConfig] = await Promise.all([
    getMarketplaceSettings(),
    getCourierGuyIntegrationConfig(),
  ]);

  if (!settings.shippingEnabled) {
    return unavailableEstimate("Online delivery is temporarily unavailable.");
  }

  return getCourierGuyDeliveryWindow({
    courierConfig,
    deliveryAddress: parsed.deliveryAddress,
    settings,
  });
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
  if (!settings.shippingEnabled) {
    return unavailableEstimate(
      "Online delivery is temporarily unavailable.",
    );
  }

  if (!item?.available) {
    return unavailableEstimate(
      "This option is no longer available for delivery.",
    );
  }

  if (item.fulfillmentMode === "jurgens_fulfilled") {
    const deliveryWindow = getDeliveryWindow(settings);
    const localDelivery = await checkJurgensDeliveryAvailability({
      postalCode: parsed.deliveryAddress.postalCode,
    });
    const result: PublicProductDeliveryEstimateResult = localDelivery.eligible
      ? {
          available: true,
          ...deliveryWindow,
          message:
            "Estimated delivery to your selected address.",
          provider: "jurgens_local",
        }
      : unavailableEstimate(
          localDelivery.unavailableReason ??
            "Delivery is not available to this address.",
        );

    return result;
  }

  return getCourierGuyDeliveryWindow({
    courierConfig,
    deliveryAddress: parsed.deliveryAddress,
    settings,
  });
}
