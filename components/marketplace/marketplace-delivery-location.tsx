"use client";

import { MapPinIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import {
  GooglePlacesAddressAutocomplete,
  type GooglePlacesResolvedAddress,
} from "@/components/address/google-places-address-autocomplete";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  clearMarketplaceDeliveryLocation,
  formatMarketplaceDeliveryLocation,
  getMarketplaceDeliveryLocation,
  setMarketplaceDeliveryLocation,
  type MarketplaceDeliveryAddress,
  type MarketplaceDeliveryLocation,
  subscribeToMarketplaceDeliveryLocation,
} from "@/src/modules/shipping/browser-delivery-location";

const deliveryLocationNudgeStorageKey =
  "jurgens-energy:delivery-location-nudge:v1";

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

function toDeliveryAddress(
  address: GooglePlacesResolvedAddress,
): MarketplaceDeliveryAddress {
  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    countryCode: address.countryCode,
    postalCode: address.postalCode,
    province: address.province,
    suburb: address.suburb,
  };
}

export function MarketplaceDeliveryLocationControl({
  className,
  hasDefaultDeliveryAddress,
}: {
  className?: string;
  hasDefaultDeliveryAddress: boolean;
}) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState<MarketplaceDeliveryLocation | null>(
    null,
  );
  const [draftAddress, setDraftAddress] =
    useState<MarketplaceDeliveryAddress | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [rememberFullAddress, setRememberFullAddress] = useState(false);
  const [shouldNudgeLocation, setShouldNudgeLocation] = useState(false);

  useEffect(() => {
    setLocation(getMarketplaceDeliveryLocation());

    return subscribeToMarketplaceDeliveryLocation(setLocation);
  }, []);

  useEffect(() => {
    if (location || hasDefaultDeliveryAddress) {
      setShouldNudgeLocation(false);
      return;
    }

    try {
      if (window.sessionStorage.getItem(deliveryLocationNudgeStorageKey)) {
        return;
      }

      window.sessionStorage.setItem(deliveryLocationNudgeStorageKey, "1");
      setShouldNudgeLocation(true);
    } catch {
      setShouldNudgeLocation(false);
    }
  }, [hasDefaultDeliveryAddress, location]);

  function resetDraft() {
    setDraftAddress(null);
    setAddressInput("");
    setIsResolvingAddress(false);
    setRememberFullAddress(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      resetDraft();
    }
  }

  function saveLocation() {
    if (!isCompleteAddress(draftAddress)) {
      return;
    }

    setMarketplaceDeliveryLocation({
      address: rememberFullAddress ? draftAddress : null,
      label: formatMarketplaceDeliveryLocation(draftAddress),
    });
    setOpen(false);
    resetDraft();
  }

  function clearLocation() {
    clearMarketplaceDeliveryLocation();
    setOpen(false);
    resetDraft();
  }

  const locationLabel = location?.label ?? "Set delivery area";

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <Button
        aria-label={location
          ? `Delivery area: ${location.label}. Change delivery area`
          : "Set delivery area for more accurate delivery estimates"}
        className={cn(
          "h-8 min-w-0 max-w-[9.5rem] rounded-full border border-[#e8e8e2] bg-white/80 px-2 text-[#353530] shadow-none hover:border-[#ff5a1f]/40 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f7f7f2] dark:hover:bg-white/[0.08] sm:h-9 sm:max-w-[13rem] sm:px-3",
          className,
        )}
        onClick={() => setOpen(true)}
        type="button"
        variant="ghost"
      >
        <MapPinIcon
          className={cn(
            "size-3.5 shrink-0 text-[#ff5a1f] sm:size-4",
            shouldNudgeLocation && "marketplace-delivery-location-nudge",
          )}
        />
        <span className="hidden min-w-0 truncate text-[10px] font-bold sm:inline">
          {location ? `Deliver to ${locationLabel}` : locationLabel}
        </span>
        <span className="sr-only sm:hidden">{locationLabel}</span>
      </Button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Where should we deliver?</DialogTitle>
          <DialogDescription>
            Set your area for clearer delivery information while you shop.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <GooglePlacesAddressAutocomplete
            countryCode="ZA"
            disabled={isResolvingAddress}
            id={`marketplace-delivery-location-${inputId}`}
            inputClassName="h-11 bg-white dark:bg-[#101010]"
            leadingIcon={<MapPinIcon className="size-4 text-[#ff5a1f]" />}
            onAddressSelect={(address) => {
              setDraftAddress(toDeliveryAddress(address));
            }}
            onResolvingChange={setIsResolvingAddress}
            onValueChange={(value) => {
              setAddressInput(value);
              setDraftAddress(null);
            }}
            placeholder="Start typing your delivery address"
            value={addressInput}
          />

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[#e4e4de] bg-[#f7f7f2] p-3 text-left dark:border-white/10 dark:bg-white/[0.035]">
            <Checkbox
              checked={rememberFullAddress}
              className="mt-0.5 border-[#bcbcb5] data-checked:border-[#ff5a1f] data-checked:bg-[#ff5a1f]"
              onCheckedChange={(checked) =>
                setRememberFullAddress(checked === true)
              }
            />
            <span className="min-w-0">
              <span className="block text-xs font-bold text-[#1a1a1a] dark:text-[#f7f7f2]">
                Remember this address on this device
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-[#666660] dark:text-[#aaa9a1]">
                This lets product pages prefill a more accurate Courier Guy estimate. Without it, we only save your area.
              </span>
            </span>
          </label>

          {location ? (
            <p className="text-[11px] leading-4 text-[#777770] dark:text-[#aaa9a1]">
              Currently delivering to {location.label}. You can clear this saved location below.
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter className="gap-2 sm:justify-between">
          {location ? (
            <Button
              className="text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-200 dark:hover:bg-rose-500/10"
              onClick={clearLocation}
              type="button"
              variant="ghost"
            >
              Clear location
            </Button>
          ) : <span />}
          <Button
            className="bg-[#ff5a1f] text-white hover:bg-[#e64b15]"
            disabled={!isCompleteAddress(draftAddress) || isResolvingAddress}
            onClick={saveLocation}
            type="button"
          >
            Set delivery area
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
