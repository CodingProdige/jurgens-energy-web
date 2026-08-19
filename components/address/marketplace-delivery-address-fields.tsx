"use client";

import { MapPinIcon } from "lucide-react";

import {
  GooglePlacesAddressAutocomplete,
  type GooglePlacesResolvedAddress,
} from "@/components/address/google-places-address-autocomplete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SOUTH_AFRICAN_PROVINCES } from "@/src/modules/marketplace/account/address-options";
import type { MarketplaceDeliveryAddress } from "@/src/modules/shipping/browser-delivery-location";

const emptyDeliveryAddress: MarketplaceDeliveryAddress = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  countryCode: "ZA",
  postalCode: "",
  province: "",
  suburb: "",
};

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

export function MarketplaceDeliveryAddressFields({
  address,
  addressInput,
  className,
  disabled = false,
  idPrefix,
  inputClassName,
  onAddressChange,
  onAddressInputChange,
  onResolvingChange,
}: {
  address: MarketplaceDeliveryAddress | null;
  addressInput: string;
  className?: string;
  disabled?: boolean;
  idPrefix: string;
  inputClassName?: string;
  onAddressChange: (address: MarketplaceDeliveryAddress) => void;
  onAddressInputChange: (value: string) => void;
  onResolvingChange?: (resolving: boolean) => void;
}) {
  const fieldClass = cn(
    "h-10 rounded-md border-[#d8d8d1] bg-white px-3 text-sm shadow-none focus-visible:border-[#ff5a1f] focus-visible:ring-[#ff5a1f]/15 dark:border-white/12 dark:bg-[#101010]",
    inputClassName,
  );

  function updateAddress(patch: Partial<MarketplaceDeliveryAddress>) {
    onAddressChange({
      ...(address ?? emptyDeliveryAddress),
      ...patch,
      countryCode: "ZA",
    });
  }

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-line-1`}>
          Street address <RequiredMark />
        </Label>
        <GooglePlacesAddressAutocomplete
          countryCode="ZA"
          disabled={disabled}
          id={`${idPrefix}-line-1`}
          inputClassName={fieldClass}
          leadingIcon={<MapPinIcon className="size-4 text-[#ff5a1f]" />}
          onAddressSelect={(selectedAddress) => {
            onAddressChange(toDeliveryAddress(selectedAddress));
          }}
          onResolvingChange={onResolvingChange}
          onValueChange={(addressLine1) => {
            onAddressInputChange(addressLine1);
            onAddressChange({ ...emptyDeliveryAddress, addressLine1 });
          }}
          placeholder="Street number and name"
          required
          value={addressInput}
        />
      </div>

      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-line-2`}>Complex, unit or building</Label>
        <Input
          autoComplete="address-line2"
          className={fieldClass}
          disabled={disabled}
          id={`${idPrefix}-line-2`}
          maxLength={240}
          onChange={(event) => updateAddress({ addressLine2: event.currentTarget.value })}
          value={address?.addressLine2 ?? ""}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-suburb`}>Suburb (optional)</Label>
        <Input
          autoComplete="address-level3"
          className={fieldClass}
          disabled={disabled}
          id={`${idPrefix}-suburb`}
          maxLength={120}
          onChange={(event) => updateAddress({ suburb: event.currentTarget.value })}
          value={address?.suburb ?? ""}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-city`}>
          City <RequiredMark />
        </Label>
        <Input
          autoComplete="address-level2"
          className={fieldClass}
          disabled={disabled}
          id={`${idPrefix}-city`}
          maxLength={120}
          onChange={(event) => updateAddress({ city: event.currentTarget.value })}
          required
          value={address?.city ?? ""}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-province`}>
          Province <RequiredMark />
        </Label>
        <select
          autoComplete="address-level1"
          className={cn(fieldClass, "border outline-none")}
          disabled={disabled}
          id={`${idPrefix}-province`}
          onChange={(event) => updateAddress({ province: event.currentTarget.value })}
          required
          value={address?.province ?? ""}
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
        <Label htmlFor={`${idPrefix}-postal-code`}>
          Postal code <RequiredMark />
        </Label>
        <Input
          autoComplete="postal-code"
          className={fieldClass}
          disabled={disabled}
          id={`${idPrefix}-postal-code`}
          inputMode="numeric"
          maxLength={40}
          onChange={(event) => updateAddress({ postalCode: event.currentTarget.value })}
          required
          value={address?.postalCode ?? ""}
        />
      </div>
    </div>
  );
}
