"use client";

import type { GooglePlacesResolvedAddress } from "@/components/address/google-places-address-autocomplete";

const deliveryLocationStorageKey = "jurgens-energy:delivery-location:v1";
const deliveryLocationChangeEvent = "jurgens-energy:delivery-location-change";

export type MarketplaceDeliveryAddress = Omit<
  GooglePlacesResolvedAddress,
  "formattedAddress" | "placeId"
>;

export type MarketplaceDeliveryLocation = {
  address: MarketplaceDeliveryAddress | null;
  label: string;
};

function isDeliveryAddress(value: unknown): value is MarketplaceDeliveryAddress {
  if (!value || typeof value !== "object") {
    return false;
  }

  const address = value as Partial<MarketplaceDeliveryAddress>;

  return (
    typeof address.addressLine1 === "string" &&
    typeof address.addressLine2 === "string" &&
    typeof address.city === "string" &&
    typeof address.countryCode === "string" &&
    typeof address.postalCode === "string" &&
    typeof address.province === "string" &&
    typeof address.suburb === "string"
  );
}

function isDeliveryLocation(value: unknown): value is MarketplaceDeliveryLocation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const location = value as Partial<MarketplaceDeliveryLocation>;

  return (
    typeof location.label === "string" &&
    location.label.trim().length > 0 &&
    (location.address === null || isDeliveryAddress(location.address))
  );
}

export function formatMarketplaceDeliveryLocation(
  address: Pick<MarketplaceDeliveryAddress, "city" | "postalCode" | "suburb">,
) {
  const place = address.suburb.trim() || address.city.trim();
  const postalCode = address.postalCode.trim();

  return [place, postalCode].filter(Boolean).join(", ");
}

export function getMarketplaceDeliveryLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(deliveryLocationStorageKey);

    if (!storedValue) {
      return null;
    }

    const location: unknown = JSON.parse(storedValue);

    return isDeliveryLocation(location) ? location : null;
  } catch {
    return null;
  }
}

export function setMarketplaceDeliveryLocation(
  location: MarketplaceDeliveryLocation,
) {
  window.localStorage.setItem(deliveryLocationStorageKey, JSON.stringify(location));
  window.dispatchEvent(new Event(deliveryLocationChangeEvent));
}

export function clearMarketplaceDeliveryLocation() {
  window.localStorage.removeItem(deliveryLocationStorageKey);
  window.dispatchEvent(new Event(deliveryLocationChangeEvent));
}

export function subscribeToMarketplaceDeliveryLocation(
  listener: (location: MarketplaceDeliveryLocation | null) => void,
) {
  const notify = () => listener(getMarketplaceDeliveryLocation());
  const handleStorage = (event: StorageEvent) => {
    if (event.key === deliveryLocationStorageKey) {
      notify();
    }
  };

  window.addEventListener(deliveryLocationChangeEvent, notify);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(deliveryLocationChangeEvent, notify);
    window.removeEventListener("storage", handleStorage);
  };
}
