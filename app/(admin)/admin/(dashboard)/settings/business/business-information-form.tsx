"use client";

import { Building2Icon, SaveIcon, TruckIcon } from "lucide-react";
import { useActionState, useState } from "react";

import {
  saveBusinessInformation,
  type BusinessInformationState,
} from "@/app/(admin)/admin/(dashboard)/settings/business/actions";
import {
  GooglePlacesAddressAutocomplete,
  type GooglePlacesResolvedAddress,
} from "@/components/address/google-places-address-autocomplete";
import { CountryPhoneInput } from "@/components/phone/country-phone-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BusinessInformation } from "@/src/modules/business-information";

const initialState: BusinessInformationState = {};

function Field({
  autoComplete,
  defaultValue,
  id,
  label,
  onValueChange,
  placeholder,
  required = false,
  value,
}: {
  autoComplete?: string;
  defaultValue?: string | null;
  id: string;
  label: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value?: string;
}) {
  const isControlled = onValueChange !== undefined;

  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{required ? `${label} *` : label}</Label>
      <Input
        autoComplete={autoComplete}
        defaultValue={isControlled ? undefined : (defaultValue ?? "")}
        id={id}
        name={id}
        onChange={
          onValueChange
            ? (event) => onValueChange(event.target.value)
            : undefined
        }
        placeholder={placeholder}
        required={required}
        value={isControlled ? (value ?? "") : undefined}
      />
    </div>
  );
}

type AddressDraft = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  countryCode: string;
  postalCode: string;
  province: string;
  suburb: string;
};

function addressDraftFromGoogle(
  suggestion: GooglePlacesResolvedAddress,
): AddressDraft {
  return {
    addressLine1: suggestion.addressLine1,
    addressLine2: suggestion.addressLine2,
    city: suggestion.city,
    countryCode: suggestion.countryCode,
    postalCode: suggestion.postalCode,
    province: suggestion.province,
    suburb: suggestion.suburb,
  };
}

export function BusinessInformationForm({
  information,
}: {
  information: BusinessInformation;
}) {
  const [sameAddress, setSameAddress] = useState(
    information.collectionAddressSameAsRegistered,
  );
  const [registeredAddress, setRegisteredAddress] = useState<AddressDraft>({
    addressLine1: information.addressLine1,
    addressLine2: information.addressLine2 ?? "",
    city: information.city,
    countryCode: information.countryCode || "ZA",
    postalCode: information.postalCode,
    province: information.province,
    suburb: information.suburb ?? "",
  });
  const [collectionAddress, setCollectionAddress] = useState<AddressDraft>({
    addressLine1: information.collectionAddressLine1 ?? "",
    addressLine2: information.collectionAddressLine2 ?? "",
    city: information.collectionCity ?? "",
    countryCode: information.collectionCountryCode ?? "ZA",
    postalCode: information.collectionPostalCode ?? "",
    province: information.collectionProvince ?? "",
    suburb: information.collectionSuburb ?? "",
  });
  const [state, formAction, pending] = useActionState(
    saveBusinessInformation,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-8">
      <section className="grid gap-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-admin-primary/10 text-admin-primary">
            <Building2Icon className="size-5" />
          </span>
          <div>
            <h2 className="font-bold text-zinc-950 dark:text-white">
              Legal and invoice identity
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              These values are frozen onto each issued invoice, so later changes
              do not rewrite historical documents.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            defaultValue={information.legalName}
            id="legalName"
            label="Registered legal name"
            placeholder="Registered company or proprietor name"
            required
          />
          <Field
            defaultValue={information.tradingName}
            id="tradingName"
            label="Trading name"
            required
          />
          <Field
            defaultValue={information.companyRegistrationNumber}
            id="companyRegistrationNumber"
            label="Company registration number"
          />
          <Field
            defaultValue={information.vatRegistrationNumber}
            id="vatRegistrationNumber"
            label="VAT registration number"
            placeholder="Optional 10-digit VAT number"
          />
          <Field
            autoComplete="email"
            defaultValue={information.invoiceEmail}
            id="invoiceEmail"
            label="Invoice email"
            required
          />
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="invoicePhone">Invoice phone *</Label>
            <CountryPhoneInput
              defaultValue={information.invoicePhone}
              id="invoicePhone"
              name="invoicePhone"
              required
            />
          </div>
        </div>
        <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
          Public support email and phone numbers are managed under Footer and
          public details. If those fields are blank, the invoice contacts above
          are used as the customer-support fallback.
        </p>

        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <Checkbox
            defaultChecked={information.publicRegistrationDetailsEnabled}
            id="publicRegistrationDetailsEnabled"
            name="publicRegistrationDetailsEnabled"
          />
          <div>
            <Label htmlFor="publicRegistrationDetailsEnabled">
              Show business registration details on the storefront
            </Label>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              Controls the public legal name, company registration number, and
              VAT number in the footer, policy pages, and structured data.
              Registered address, customer support email, and phone numbers
              stay public.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 border-t border-slate-200 pt-7 dark:border-white/10">
        <div>
          <h2 className="font-bold text-zinc-950 dark:text-white">
            Registered business address
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
            Used automatically on VAT invoices and public trust surfaces such
            as the contact page, footer, policy disclosures, and structured
            business data. It is not presented as a walk-in shop or returns
            counter.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="addressLine1">Street address *</Label>
              <GooglePlacesAddressAutocomplete
                autoComplete="address-line1"
                countryCode="ZA"
                id="addressLine1"
                name="addressLine1"
                onAddressSelect={(suggestion) =>
                  setRegisteredAddress(addressDraftFromGoogle(suggestion))
                }
                onValueChange={(addressLine1) =>
                  setRegisteredAddress((current) => ({
                    ...current,
                    addressLine1,
                  }))
                }
                placeholder="Start typing a South African street address"
                required
                value={registeredAddress.addressLine1}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Field
              value={registeredAddress.addressLine2}
              onValueChange={(addressLine2) =>
                setRegisteredAddress((current) => ({
                  ...current,
                  addressLine2,
                }))
              }
              id="addressLine2"
              label="Complex, unit or building"
            />
          </div>
          <Field
            value={registeredAddress.suburb}
            onValueChange={(suburb) =>
              setRegisteredAddress((current) => ({ ...current, suburb }))
            }
            id="suburb"
            label="Suburb"
          />
          <Field
            value={registeredAddress.city}
            onValueChange={(city) =>
              setRegisteredAddress((current) => ({ ...current, city }))
            }
            id="city"
            label="City"
            required
          />
          <Field
            value={registeredAddress.province}
            onValueChange={(province) =>
              setRegisteredAddress((current) => ({ ...current, province }))
            }
            id="province"
            label="Province"
            required
          />
          <Field
            autoComplete="postal-code"
            value={registeredAddress.postalCode}
            onValueChange={(postalCode) =>
              setRegisteredAddress((current) => ({
                ...current,
                postalCode,
              }))
            }
            id="postalCode"
            label="Postal code"
            required
          />
          <Field
            value={registeredAddress.countryCode}
            onValueChange={(countryCode) =>
              setRegisteredAddress((current) => ({
                ...current,
                countryCode,
              }))
            }
            id="countryCode"
            label="Country code"
            required
          />
        </div>
      </section>

      <section className="grid gap-5 border-t border-slate-200 pt-7 dark:border-white/10">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-admin-primary/10 text-admin-primary">
            <TruckIcon className="size-5" />
          </span>
          <div>
            <h2 className="font-bold text-zinc-950 dark:text-white">
              Courier collection details
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              Courier Guy bookings use these dispatch contact details. The
              drop-off point itself is configured in shipping settings.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
          <Checkbox
            checked={sameAddress}
            id="collectionAddressSameAsRegistered"
            name="collectionAddressSameAsRegistered"
            onCheckedChange={(checked) => setSameAddress(checked === true)}
          />
          <div>
            <Label htmlFor="collectionAddressSameAsRegistered">
              Collect parcels from the registered business address
            </Label>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
              Turn this off only when couriers collect from a different depot.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            defaultValue={information.collectionContactName}
            id="collectionContactName"
            label="Collection contact name"
            required
          />
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="collectionContactPhone">
              Collection contact phone *
            </Label>
            <CountryPhoneInput
              defaultValue={information.collectionContactPhone}
              id="collectionContactPhone"
              name="collectionContactPhone"
              required
            />
          </div>
        </div>

        {!sameAddress ? (
          <div className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2 dark:border-white/10">
            <div className="md:col-span-2">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="collectionAddressLine1">
                  Collection street address *
                </Label>
                <GooglePlacesAddressAutocomplete
                  autoComplete="address-line1"
                  countryCode="ZA"
                  id="collectionAddressLine1"
                  name="collectionAddressLine1"
                  onAddressSelect={(suggestion) =>
                    setCollectionAddress(addressDraftFromGoogle(suggestion))
                  }
                  onValueChange={(addressLine1) =>
                    setCollectionAddress((current) => ({
                      ...current,
                      addressLine1,
                    }))
                  }
                  placeholder="Start typing a South African collection address"
                  required
                  value={collectionAddress.addressLine1}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <Field
                value={collectionAddress.addressLine2}
                onValueChange={(addressLine2) =>
                  setCollectionAddress((current) => ({
                    ...current,
                    addressLine2,
                  }))
                }
                id="collectionAddressLine2"
                label="Collection complex, unit or building"
              />
            </div>
            <Field
              value={collectionAddress.suburb}
              onValueChange={(suburb) =>
                setCollectionAddress((current) => ({ ...current, suburb }))
              }
              id="collectionSuburb"
              label="Collection suburb"
            />
            <Field
              value={collectionAddress.city}
              onValueChange={(city) =>
                setCollectionAddress((current) => ({ ...current, city }))
              }
              id="collectionCity"
              label="Collection city"
              required
            />
            <Field
              value={collectionAddress.province}
              onValueChange={(province) =>
                setCollectionAddress((current) => ({
                  ...current,
                  province,
                }))
              }
              id="collectionProvince"
              label="Collection province"
              required
            />
            <Field
              autoComplete="postal-code"
              value={collectionAddress.postalCode}
              onValueChange={(postalCode) =>
                setCollectionAddress((current) => ({
                  ...current,
                  postalCode,
                }))
              }
              id="collectionPostalCode"
              label="Collection postal code"
              required
            />
            <Field
              value={collectionAddress.countryCode}
              onValueChange={(countryCode) =>
                setCollectionAddress((current) => ({
                  ...current,
                  countryCode,
                }))
              }
              id="collectionCountryCode"
              label="Collection country code"
              required
            />
          </div>
        ) : null}
      </section>

      {state.message ? (
        <p
          className={
            state.ok
              ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
              : "rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button disabled={pending} type="submit">
          <SaveIcon className="size-4" />
          {pending ? "Saving…" : "Save business information"}
        </Button>
      </div>
    </form>
  );
}
