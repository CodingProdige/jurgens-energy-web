"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getMarketplaceDeliveryAddressKey,
  getMarketplaceDeliveryLocation,
  subscribeToMarketplaceDeliveryLocation,
  type MarketplaceDeliveryAddress,
} from "@/src/modules/shipping/browser-delivery-location";

const deliveryWindowStorageKey = "jurgens-energy:delivery-window:v1";

export type MarketplaceDeliveryWindow = {
  available: boolean;
  estimatedDeliveryFrom: string | null;
  estimatedDeliveryTo: string | null;
  message: string;
  provider: "courier_guy" | "jurgens_local" | "standard_delivery" | "unknown";
};

type StoredDeliveryWindow = {
  addressKey: string;
  estimate: MarketplaceDeliveryWindow | null;
};

const MarketplaceDeliveryWindowContext =
  createContext<MarketplaceDeliveryWindow | null>(null);

function isCompleteAddress(
  address: MarketplaceDeliveryAddress | null,
): address is MarketplaceDeliveryAddress {
  return Boolean(
    address?.addressLine1 &&
      address.city &&
      address.countryCode === "ZA" &&
      address.postalCode &&
      address.province,
  );
}

function isDeliveryWindow(value: unknown): value is MarketplaceDeliveryWindow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const estimate = value as Partial<MarketplaceDeliveryWindow>;

  return (
    typeof estimate.available === "boolean" &&
    (typeof estimate.estimatedDeliveryFrom === "string" ||
      estimate.estimatedDeliveryFrom === null) &&
    (typeof estimate.estimatedDeliveryTo === "string" ||
      estimate.estimatedDeliveryTo === null) &&
    typeof estimate.message === "string" &&
    (estimate.provider === "courier_guy" ||
      estimate.provider === "jurgens_local" ||
      estimate.provider === "standard_delivery" ||
      estimate.provider === "unknown")
  );
}

function readStoredDeliveryWindow(addressKey: string): StoredDeliveryWindow | null {
  try {
    const storedValue = window.sessionStorage.getItem(deliveryWindowStorageKey);

    if (!storedValue) {
      return null;
    }

    const stored: unknown = JSON.parse(storedValue);

    if (!stored || typeof stored !== "object") {
      return null;
    }

    const record = stored as Partial<StoredDeliveryWindow>;

    if (record.addressKey !== addressKey) {
      return null;
    }

    return record.estimate === null || isDeliveryWindow(record.estimate)
      ? { addressKey, estimate: record.estimate }
      : null;
  } catch {
    return null;
  }
}

function storeDeliveryWindow(value: StoredDeliveryWindow) {
  try {
    window.sessionStorage.setItem(deliveryWindowStorageKey, JSON.stringify(value));
  } catch {
    // The lookup still works when private browsing blocks session storage.
  }
}

export function MarketplaceDeliveryWindowProvider({
  children,
  defaultDeliveryAddress = null,
}: {
  children: ReactNode;
  defaultDeliveryAddress?: MarketplaceDeliveryAddress | null;
}) {
  const [estimate, setEstimate] = useState<MarketplaceDeliveryWindow | null>(null);
  const requestRef = useRef<{ addressKey: string; id: number } | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function updateDeliveryWindow() {
      const location = getMarketplaceDeliveryLocation();
      const address = location ? location.address : defaultDeliveryAddress;

      if (!isCompleteAddress(address)) {
        requestRef.current = null;
        if (isCurrent) {
          setEstimate(null);
        }
        return;
      }

      const addressKey = getMarketplaceDeliveryAddressKey(address);
      const stored = readStoredDeliveryWindow(addressKey);

      if (stored) {
        requestRef.current = null;
        if (isCurrent) {
          setEstimate(stored.estimate);
        }
        return;
      }

      if (requestRef.current?.addressKey === addressKey) {
        return;
      }

      const request = {
        addressKey,
        id: (requestRef.current?.id ?? 0) + 1,
      };
      requestRef.current = request;

      if (isCurrent) {
        setEstimate(null);
      }

      let resolvedEstimate: MarketplaceDeliveryWindow | null = null;

      try {
        const response = await fetch("/api/shipping/delivery-window", {
          body: JSON.stringify({ deliveryAddress: address }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload: unknown = await response.json().catch(() => null);

        if (response.ok && isDeliveryWindow(payload)) {
          resolvedEstimate = payload;
        }
      } catch {
        // Keep the settings-based card copy if the address-level lookup fails.
      }

      if (
        !isCurrent ||
        requestRef.current?.addressKey !== request.addressKey ||
        requestRef.current.id !== request.id
      ) {
        return;
      }

      requestRef.current = null;
      storeDeliveryWindow({ addressKey, estimate: resolvedEstimate });

      setEstimate(resolvedEstimate);
    }

    void updateDeliveryWindow();

    const unsubscribe = subscribeToMarketplaceDeliveryLocation(() => {
      void updateDeliveryWindow();
    });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [defaultDeliveryAddress]);

  const value = useMemo(() => estimate, [estimate]);

  return (
    <MarketplaceDeliveryWindowContext.Provider value={value}>
      {children}
    </MarketplaceDeliveryWindowContext.Provider>
  );
}

export function useMarketplaceDeliveryWindow() {
  return useContext(MarketplaceDeliveryWindowContext);
}
