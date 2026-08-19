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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SOUTH_AFRICAN_PROVINCES } from "@/src/modules/marketplace/account/address-options";
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
const deliveryAddressFieldClass =
  "h-10 rounded-md border-[#d8d8d1] bg-white px-3 text-sm shadow-none focus-visible:border-[#ff5a1f] focus-visible:ring-[#ff5a1f]/15 dark:border-white/12 dark:bg-[#101010]";

const emptyDeliveryAddress: MarketplaceDeliveryAddress = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  countryCode: "ZA",
  postalCode: "",
  province: "",
  suburb: "",
};

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

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-500">
      *
    </span>
  );
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

  function updateDraft(patch: Partial<MarketplaceDeliveryAddress>) {
    setDraftAddress((current) => ({
      ...(current ?? emptyDeliveryAddress),
      ...patch,
      countryCode: "ZA",
    }));
  }

  function openDeliveryLocationDialog() {
    const savedAddress = location?.address ?? null;

    setDraftAddress(savedAddress);
    setAddressInput(savedAddress?.addressLine1 ?? "");
    setRememberFullAddress(Boolean(savedAddress));
    setOpen(true);
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

  const locationLabel = location?.label ?? "Set delivery address";

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <Button
        aria-label={location
          ? `Delivery area: ${location.label}. Change delivery area`
          : "Set delivery address for more accurate delivery estimates"}
        className={cn(
          "h-8 min-w-0 max-w-[9.5rem] rounded-full border border-[#e8e8e2] bg-white/80 px-2 text-[#353530] shadow-none hover:border-[#ff5a1f]/40 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f7f7f2] dark:hover:bg-white/[0.08] sm:h-9 sm:max-w-[13rem] sm:px-3",
          className,
        )}
        onClick={openDeliveryLocationDialog}
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

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Where should we deliver?</DialogTitle>
          <DialogDescription>
            Add a full delivery address for accurate delivery information while you shop.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <p className="text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
            Search for an address to fill the fields automatically, or complete them manually.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={`marketplace-delivery-location-${inputId}`}>
                Street address <RequiredMark />
              </Label>
              <GooglePlacesAddressAutocomplete
                countryCode="ZA"
                disabled={isResolvingAddress}
                id={`marketplace-delivery-location-${inputId}`}
                inputClassName={deliveryAddressFieldClass}
                leadingIcon={<MapPinIcon className="size-4 text-[#ff5a1f]" />}
                onAddressSelect={(address) => {
                  setDraftAddress(toDeliveryAddress(address));
                }}
                onResolvingChange={setIsResolvingAddress}
                onValueChange={(addressLine1) => {
                  setAddressInput(addressLine1);
                  setDraftAddress({
                    ...emptyDeliveryAddress,
                    addressLine1,
                  });
                }}
                placeholder="Street number and name"
                required
                value={addressInput}
              />
            </div>

            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={`marketplace-delivery-address-line-2-${inputId}`}>
                Complex, unit or building
              </Label>
              <Input
                autoComplete="address-line2"
                className={deliveryAddressFieldClass}
                id={`marketplace-delivery-address-line-2-${inputId}`}
                maxLength={240}
                onChange={(event) => updateDraft({ addressLine2: event.currentTarget.value })}
                value={draftAddress?.addressLine2 ?? ""}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`marketplace-delivery-suburb-${inputId}`}>
                Suburb (optional)
              </Label>
              <Input
                autoComplete="address-level3"
                className={deliveryAddressFieldClass}
                id={`marketplace-delivery-suburb-${inputId}`}
                maxLength={120}
                onChange={(event) => updateDraft({ suburb: event.currentTarget.value })}
                value={draftAddress?.suburb ?? ""}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`marketplace-delivery-city-${inputId}`}>
                City <RequiredMark />
              </Label>
              <Input
                autoComplete="address-level2"
                className={deliveryAddressFieldClass}
                id={`marketplace-delivery-city-${inputId}`}
                maxLength={120}
                onChange={(event) => updateDraft({ city: event.currentTarget.value })}
                required
                value={draftAddress?.city ?? ""}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`marketplace-delivery-province-${inputId}`}>
                Province <RequiredMark />
              </Label>
              <select
                autoComplete="address-level1"
                className={cn(deliveryAddressFieldClass, "border outline-none")}
                id={`marketplace-delivery-province-${inputId}`}
                onChange={(event) => updateDraft({ province: event.currentTarget.value })}
                required
                value={draftAddress?.province ?? ""}
              >
                <option value="">Select province</option>
                {SOUTH_AFRICAN_PROVINCES.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`marketplace-delivery-postal-code-${inputId}`}>
                Postal code <RequiredMark />
              </Label>
              <Input
                autoComplete="postal-code"
                className={deliveryAddressFieldClass}
                id={`marketplace-delivery-postal-code-${inputId}`}
                inputMode="numeric"
                maxLength={40}
                onChange={(event) => updateDraft({ postalCode: event.currentTarget.value })}
                required
                value={draftAddress?.postalCode ?? ""}
              />
            </div>
          </div>

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
            Save delivery address
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
