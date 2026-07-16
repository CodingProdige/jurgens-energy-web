"use client";

import { Building2Icon, SaveIcon, TruckIcon } from "lucide-react";
import { useActionState, useState } from "react";

import {
  saveBusinessInformation,
  type BusinessInformationState,
} from "@/app/(admin)/admin/(dashboard)/settings/business/actions";
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
  placeholder,
  required = false,
}: {
  autoComplete?: string;
  defaultValue?: string | null;
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{required ? `${label} *` : label}</Label>
      <Input
        autoComplete={autoComplete}
        defaultValue={defaultValue ?? ""}
        id={id}
        name={id}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

export function BusinessInformationForm({
  information,
}: {
  information: BusinessInformation;
}) {
  const [sameAddress, setSameAddress] = useState(
    information.collectionAddressSameAsRegistered,
  );
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
            placeholder="10-digit VAT number"
            required
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
      </section>

      <section className="grid gap-5 border-t border-slate-200 pt-7 dark:border-white/10">
        <div>
          <h2 className="font-bold text-zinc-950 dark:text-white">
            Registered business address
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
            Printed on every VAT invoice.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field
              autoComplete="street-address"
              defaultValue={information.addressLine1}
              id="addressLine1"
              label="Street address"
              required
            />
          </div>
          <div className="md:col-span-2">
            <Field
              defaultValue={information.addressLine2}
              id="addressLine2"
              label="Complex, unit or building"
            />
          </div>
          <Field defaultValue={information.suburb} id="suburb" label="Suburb" />
          <Field
            defaultValue={information.city}
            id="city"
            label="City"
            required
          />
          <Field
            defaultValue={information.province}
            id="province"
            label="Province"
            required
          />
          <Field
            autoComplete="postal-code"
            defaultValue={information.postalCode}
            id="postalCode"
            label="Postal code"
            required
          />
          <Field
            defaultValue={information.countryCode}
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
              Bob Go uses this origin when requesting courier rates.
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
              <Field
                defaultValue={information.collectionAddressLine1}
                id="collectionAddressLine1"
                label="Collection street address"
                required
              />
            </div>
            <div className="md:col-span-2">
              <Field
                defaultValue={information.collectionAddressLine2}
                id="collectionAddressLine2"
                label="Collection complex, unit or building"
              />
            </div>
            <Field
              defaultValue={information.collectionSuburb}
              id="collectionSuburb"
              label="Collection suburb"
            />
            <Field
              defaultValue={information.collectionCity}
              id="collectionCity"
              label="Collection city"
              required
            />
            <Field
              defaultValue={information.collectionProvince}
              id="collectionProvince"
              label="Collection province"
              required
            />
            <Field
              defaultValue={information.collectionPostalCode}
              id="collectionPostalCode"
              label="Collection postal code"
              required
            />
            <Field
              defaultValue={information.collectionCountryCode ?? "ZA"}
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
