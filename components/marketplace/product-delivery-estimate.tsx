"use client";

import { LoaderCircleIcon, MapPinIcon, TruckIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import {
  GooglePlacesAddressAutocomplete,
  type GooglePlacesResolvedAddress,
} from "@/components/address/google-places-address-autocomplete";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getMarketplaceDeliveryLocation,
  subscribeToMarketplaceDeliveryLocation,
} from "@/src/modules/shipping/browser-delivery-location";

type DeliveryAddress = Omit<GooglePlacesResolvedAddress, "formattedAddress" | "placeId">;

type DeliveryEstimate = {
  available: boolean;
  deliveryFeeLabel: string;
  estimatedDeliveryFrom: string | null;
  estimatedDeliveryTo: string | null;
  message: string;
  provider: "courier_guy" | "jurgens_local" | "unknown";
};

type DeliveryEstimateResponse = DeliveryEstimate | { message?: string };

function isDeliveryEstimate(value: DeliveryEstimateResponse): value is DeliveryEstimate {
  return (
    "available" in value &&
    typeof value.available === "boolean" &&
    "deliveryFeeLabel" in value &&
    typeof value.deliveryFeeLabel === "string" &&
    "message" in value &&
    typeof value.message === "string"
  );
}

function isCompleteAddress(address: DeliveryAddress | null) {
  return Boolean(
    address?.addressLine1 &&
      address.city &&
      address.countryCode === "ZA" &&
      address.postalCode &&
      address.province,
  );
}

function formatEstimateDate(value: string) {
  const datePart = value.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Johannesburg",
    weekday: "short",
  }).format(new Date(`${datePart}T12:00:00+02:00`));
}

function getEstimateHeadline(estimate: DeliveryEstimate) {
  if (!estimate.estimatedDeliveryFrom && !estimate.estimatedDeliveryTo) {
    return estimate.available ? "Delivery available" : "Delivery unavailable";
  }

  if (
    estimate.estimatedDeliveryFrom &&
    estimate.estimatedDeliveryFrom === estimate.estimatedDeliveryTo
  ) {
    return `Expected by ${formatEstimateDate(estimate.estimatedDeliveryTo)}`;
  }

  if (!estimate.estimatedDeliveryFrom) {
    return `Expected by ${formatEstimateDate(estimate.estimatedDeliveryTo!)}`;
  }

  if (!estimate.estimatedDeliveryTo) {
    return `Expected from ${formatEstimateDate(estimate.estimatedDeliveryFrom)}`;
  }

  return `Expected ${formatEstimateDate(estimate.estimatedDeliveryFrom)} – ${formatEstimateDate(estimate.estimatedDeliveryTo)}`;
}

export function ProductDeliveryEstimate({
  className,
  deliveryFeeDescription,
  variantId,
}: {
  className?: string;
  deliveryFeeDescription: string;
  variantId: string | null;
}) {
  const inputId = useId();
  const [address, setAddress] = useState<DeliveryAddress | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingSavedAddress, setIsUsingSavedAddress] = useState(false);

  useEffect(() => {
    function applyStoredLocation() {
      const storedLocation = getMarketplaceDeliveryLocation();

      if (!storedLocation?.address) {
        setIsUsingSavedAddress(false);
        return;
      }

      setAddress(storedLocation.address);
      setAddressInput(storedLocation.address.addressLine1);
      setEstimate(null);
      setError(null);
      setIsUsingSavedAddress(true);
    }

    applyStoredLocation();

    return subscribeToMarketplaceDeliveryLocation(applyStoredLocation);
  }, []);

  useEffect(() => {
    setEstimate(null);
    setError(null);
  }, [variantId]);

  async function checkDeliveryEstimate() {
    if (!variantId || !isCompleteAddress(address)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setEstimate(null);

    try {
      const response = await fetch("/api/shipping/product-delivery-estimate", {
        body: JSON.stringify({ deliveryAddress: address, variantId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as DeliveryEstimateResponse | null;

      if (!response.ok || !payload) {
        setError(
          payload && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "We could not check delivery right now. Please try again.",
        );
        return;
      }

      if (!isDeliveryEstimate(payload)) {
        setError("We could not read the delivery estimate. Please try again.");
        return;
      }

      setEstimate(payload);
    } catch {
      setError("We could not check delivery right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAddressSelect(selectedAddress: GooglePlacesResolvedAddress) {
    setAddress({
      addressLine1: selectedAddress.addressLine1,
      addressLine2: selectedAddress.addressLine2,
      city: selectedAddress.city,
      countryCode: selectedAddress.countryCode,
      postalCode: selectedAddress.postalCode,
      province: selectedAddress.province,
      suburb: selectedAddress.suburb,
    });
    setEstimate(null);
    setError(null);
    setIsUsingSavedAddress(false);
  }

  return (
    <section
      aria-label="Delivery estimate"
      className={cn(
        "grid min-w-0 gap-2.5 rounded-md border border-[#e4e4de] bg-[#f7f7f2] p-3 dark:border-white/10 dark:bg-white/[0.035]",
        className,
      )}
    >
      <div className="grid min-w-0 grid-cols-[1.1rem_minmax(0,1fr)] gap-2">
        <TruckIcon className="mt-0.5 size-4 text-[#ff5a1f]" />
        <div className="min-w-0">
          <h2 className="text-xs font-black text-[#080808] dark:text-[#f7f7f2]">
            Check delivery to your area
          </h2>
          <p className="mt-0.5 text-[11px] leading-4 text-[#666660] dark:text-[#aaa9a1]">
            {deliveryFeeDescription}
          </p>
        </div>
      </div>

      <GooglePlacesAddressAutocomplete
        countryCode="ZA"
        disabled={isSubmitting}
        id={`product-delivery-address-${inputId}`}
        inputClassName="h-10 rounded-md border-[#d8d8d1] bg-white text-sm dark:bg-[#101010]"
        leadingIcon={<MapPinIcon className="size-4 text-[#ff5a1f]" />}
        onAddressSelect={handleAddressSelect}
        onResolvingChange={setIsResolvingAddress}
        onValueChange={(value) => {
          setAddressInput(value);
          setAddress(null);
          setEstimate(null);
          setError(null);
          setIsUsingSavedAddress(false);
        }}
        placeholder="Start typing your delivery address"
        value={addressInput}
      />

      <Button
        className="h-10 w-full bg-[#080808] text-xs font-black text-white hover:bg-[#262626] dark:bg-[#f7f7f2] dark:text-[#080808] dark:hover:bg-white"
        disabled={!variantId || !isCompleteAddress(address) || isResolvingAddress || isSubmitting}
        onClick={() => void checkDeliveryEstimate()}
        type="button"
      >
        {isSubmitting || isResolvingAddress ? (
          <>
            <LoaderCircleIcon className="size-4 animate-spin" />
            Checking delivery…
          </>
        ) : (
          "Check delivery estimate"
        )}
      </Button>

      <p className="text-[10px] leading-4 text-[#777770] dark:text-[#aaa9a1]">
        {isUsingSavedAddress
          ? "Using the address saved on this device. Change or clear it from the delivery button in the header."
          : "Your address is used only to calculate this estimate and is not saved here."}
      </p>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] leading-4 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      {estimate ? (
        <div
          className={cn(
            "rounded-md border px-2.5 py-2",
            estimate.available
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/10"
              : "border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-500/10",
          )}
        >
          <p
            className={cn(
              "text-[11px] font-black leading-4",
              estimate.available
                ? "text-emerald-800 dark:text-emerald-200"
                : "text-rose-700 dark:text-rose-200",
            )}
          >
            {getEstimateHeadline(estimate)}
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-[#666660] dark:text-[#c8c8c0]">
            {estimate.deliveryFeeLabel} · {estimate.message}
          </p>
          {estimate.available && estimate.provider === "courier_guy" ? (
            <p className="mt-1 text-[10px] leading-4 text-[#777770] dark:text-[#aaa9a1]">
              This is a Courier Guy estimate, not a guaranteed delivery appointment.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
