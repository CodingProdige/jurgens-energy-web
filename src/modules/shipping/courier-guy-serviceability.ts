import "server-only";

import type { CheckoutDeliveryAddress } from "@/src/modules/checkout/contracts";
import { getCourierGuyIntegrationConfig } from "@/src/modules/marketplace/settings";
import {
  createCourierGuyClient,
  type CourierGuyParcel,
} from "@/src/modules/shipping/courier-guy-client";
import { MAX_COURIER_GUY_UNITS_PER_ORDER } from "@/src/modules/shipping/courier-guy-limits";

const RATE_CHECK_CONCURRENCY = 4;
const RATE_CHECK_DEADLINE_MS = 12_000;
const RATE_REQUEST_TIMEOUT_MS = 5_000;

export type CourierGuyServiceabilityItem = {
  description: string;
  heightMm: number;
  lengthMm: number;
  weightGrams: number;
  widthMm: number;
};

export type CourierGuyServiceabilityResult =
  | { eligible: true }
  | { eligible: false; unavailableReason: string };

function toCourierGuyDeliveryAddress(address: CheckoutDeliveryAddress) {
  return {
    addressType: "residential" as const,
    city: address.city.trim(),
    company: undefined,
    countryCode: "ZA",
    localArea: address.suburb.trim() || address.city.trim(),
    postalCode: address.postalCode.trim(),
    streetAddress: [address.addressLine1, address.addressLine2]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", "),
    zone: address.province.trim(),
  };
}

function uniqueParcels(items: CourierGuyServiceabilityItem[]) {
  const parcelsByMeasurements = new Map<string, CourierGuyParcel>();

  for (const item of items) {
    const key = [
      item.heightMm,
      item.lengthMm,
      item.weightGrams,
      item.widthMm,
    ].join(":");

    if (!parcelsByMeasurements.has(key)) {
      parcelsByMeasurements.set(key, {
        description: item.description,
        heightMm: item.heightMm,
        itemCount: 1,
        lengthMm: item.lengthMm,
        weightGrams: item.weightGrams,
        widthMm: item.widthMm,
      });
    }
  }

  return Array.from(parcelsByMeasurements.values());
}

export async function checkCourierGuyServiceability({
  deliveryAddress,
  items,
}: {
  deliveryAddress: CheckoutDeliveryAddress;
  items: CourierGuyServiceabilityItem[];
}): Promise<CourierGuyServiceabilityResult> {
  if (items.length === 0) {
    return { eligible: true };
  }

  if (items.length > MAX_COURIER_GUY_UNITS_PER_ORDER) {
    return {
      eligible: false,
      unavailableReason: `Courier delivery supports up to ${MAX_COURIER_GUY_UNITS_PER_ORDER} parcels per online order.`,
    };
  }

  const config = await getCourierGuyIntegrationConfig();

  if (
    !config.isConfigured ||
    !config.accountCode ||
    !config.apiKey ||
    !config.dropoffPickupPointId
  ) {
    return {
      eligible: false,
      unavailableReason: "Nationwide courier delivery is temporarily unavailable.",
    };
  }

  const collectionOrigin = {
    kind: "pickup_point" as const,
    pickupPointId: config.dropoffPickupPointId,
    provider: config.dropoffProvider,
  };
  const courierDeliveryAddress = toCourierGuyDeliveryAddress(deliveryAddress);
  const parcels = uniqueParcels(items);
  const deadlineAt = Date.now() + RATE_CHECK_DEADLINE_MS;

  try {
    for (let index = 0; index < parcels.length; index += RATE_CHECK_CONCURRENCY) {
      const remainingMs = deadlineAt - Date.now();

      if (remainingMs < 100) {
        throw new Error("Courier serviceability check exceeded its deadline.");
      }

      const client = createCourierGuyClient({
        apiBaseUrl: config.apiBaseUrl,
        apiKey: config.apiKey,
        timeoutMs: Math.min(RATE_REQUEST_TIMEOUT_MS, remainingMs),
      });
      const batch = parcels.slice(index, index + RATE_CHECK_CONCURRENCY);
      const responses = await Promise.all(
        batch.map((parcel) =>
          client.getRates({
            collectionOrigin,
            deliveryAddress: courierDeliveryAddress,
            parcels: [parcel],
          }),
        ),
      );
      const hasUnavailableParcel = responses.some(({ rates }) => {
        if (!config.defaultServiceCode) {
          return rates.length === 0;
        }

        return !rates.some(
          (rate) =>
            rate.serviceCode.toLowerCase() ===
            config.defaultServiceCode?.toLowerCase(),
        );
      });

      if (hasUnavailableParcel) {
        return {
          eligible: false,
          unavailableReason:
            "The selected courier products cannot be delivered to this address.",
        };
      }
    }
  } catch {
    return {
      eligible: false,
      unavailableReason:
        "We could not confirm courier delivery to this address. Please check the address or try again.",
    };
  }

  return { eligible: true };
}
