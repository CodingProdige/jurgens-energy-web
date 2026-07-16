"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import {
  CheckCircle2Icon,
  HomeIcon,
  LoaderCircleIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import {
  makeCustomerAddressDefault,
  removeCustomerAddress,
  saveCustomerAddress,
  type CustomerAddressActionState,
} from "@/app/(marketplace)/account/addresses/actions";
import { CountryPhoneInput } from "@/components/phone/country-phone-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SOUTH_AFRICAN_PROVINCES } from "@/src/modules/marketplace/account/address-options";
import type { CustomerAddress } from "@/src/modules/marketplace/account/addresses";

export type SavedAddressView = Pick<
  CustomerAddress,
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "countryCode"
  | "id"
  | "isDefault"
  | "label"
  | "postalCode"
  | "province"
  | "recipientName"
  | "recipientPhone"
  | "suburb"
>;

type AddressEditor =
  | { address: SavedAddressView; mode: "edit" }
  | { address: null; mode: "create" };

const initialActionState: CustomerAddressActionState = {};
const fieldClass =
  "h-11 rounded-md border-[#d8d8d1] bg-white px-3 shadow-none focus-visible:border-[#ff5a1f] focus-visible:ring-[#ff5a1f]/15 dark:border-white/12 dark:bg-white/[0.04]";

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-500">
      *
    </span>
  );
}

function FieldError({
  errors,
  name,
}: {
  errors: CustomerAddressActionState["fieldErrors"];
  name: string;
}) {
  const message = errors?.[name]?.[0];

  return message ? (
    <span className="text-xs font-semibold text-red-600 dark:text-red-300">
      {message}
    </span>
  ) : null;
}

function AddressForm({
  address,
  defaultRecipientName,
  onCancel,
  onSaved,
}: {
  address: SavedAddressView | null;
  defaultRecipientName: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveCustomerAddress,
    initialActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      onSaved(state.message ?? "Address saved.");
    }
  }, [onSaved, state.message, state.status]);

  const errors = state.fieldErrors;
  const title = address ? "Edit saved address" : "Add a delivery address";

  return (
    <form
      action={formAction}
      className="overflow-hidden rounded-md border border-[#deded7] bg-white shadow-[0_16px_45px_rgba(8,8,8,0.06)] dark:border-white/10 dark:bg-[#101010]"
    >
      <input name="addressId" type="hidden" value={address?.id ?? ""} />

      <div className="flex items-start justify-between gap-4 border-b border-[#e8e8e2] px-5 py-5 dark:border-white/10">
        <div className="min-w-0">
          <span className="grid size-10 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f]">
            {address ? (
              <PencilIcon className="size-5" />
            ) : (
              <PlusIcon className="size-5" />
            )}
          </span>
          <h2 className="mt-3 text-xl font-black tracking-tight">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-[#666660] dark:text-[#aaa9a1]">
            Fields marked with an asterisk are required.
          </p>
        </div>
        <Button
          aria-label="Close address form"
          className="size-9 rounded-full"
          onClick={onCancel}
          size="icon-lg"
          type="button"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="saved-address-label">
            Address label <RequiredMark />
          </Label>
          <Input
            aria-invalid={Boolean(errors?.label)}
            className={fieldClass}
            defaultValue={address?.label ?? "Home"}
            id="saved-address-label"
            maxLength={80}
            name="label"
            placeholder="Home or work"
            required
          />
          <FieldError errors={errors} name="label" />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="saved-address-recipient">
            Recipient name <RequiredMark />
          </Label>
          <Input
            aria-invalid={Boolean(errors?.recipientName)}
            autoComplete="name"
            className={fieldClass}
            defaultValue={address?.recipientName ?? defaultRecipientName}
            id="saved-address-recipient"
            maxLength={160}
            name="recipientName"
            required
          />
          <FieldError errors={errors} name="recipientName" />
        </div>

        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="saved-address-phone">
            Recipient phone <RequiredMark />
          </Label>
          <CountryPhoneInput
            defaultValue={address?.recipientPhone}
            id="saved-address-phone"
            inputClassName={cn(fieldClass, "min-w-0")}
            name="recipientPhone"
            placeholder="82 123 4567"
            required
            selectClassName={fieldClass}
          />
          <FieldError errors={errors} name="recipientPhone" />
        </div>

        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="saved-address-line-1">
            Street address <RequiredMark />
          </Label>
          <Input
            aria-invalid={Boolean(errors?.addressLine1)}
            autoComplete="address-line1"
            className={fieldClass}
            defaultValue={address?.addressLine1}
            id="saved-address-line-1"
            maxLength={240}
            name="addressLine1"
            placeholder="Street number and name"
            required
          />
          <FieldError errors={errors} name="addressLine1" />
        </div>

        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="saved-address-line-2">
            Complex, unit or building
          </Label>
          <Input
            aria-invalid={Boolean(errors?.addressLine2)}
            autoComplete="address-line2"
            className={fieldClass}
            defaultValue={address?.addressLine2 ?? ""}
            id="saved-address-line-2"
            maxLength={240}
            name="addressLine2"
          />
          <FieldError errors={errors} name="addressLine2" />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="saved-address-suburb">Suburb (optional)</Label>
          <Input
            aria-invalid={Boolean(errors?.suburb)}
            autoComplete="address-level3"
            className={fieldClass}
            defaultValue={address?.suburb}
            id="saved-address-suburb"
            maxLength={120}
            name="suburb"
          />
          <FieldError errors={errors} name="suburb" />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="saved-address-city">
            City <RequiredMark />
          </Label>
          <Input
            aria-invalid={Boolean(errors?.city)}
            autoComplete="address-level2"
            className={fieldClass}
            defaultValue={address?.city}
            id="saved-address-city"
            maxLength={120}
            name="city"
            required
          />
          <FieldError errors={errors} name="city" />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="saved-address-province">
            Province <RequiredMark />
          </Label>
          <select
            aria-invalid={Boolean(errors?.province)}
            autoComplete="address-level1"
            className={cn(fieldClass, "border text-sm outline-none")}
            defaultValue={address?.province ?? ""}
            id="saved-address-province"
            name="province"
            required
          >
            <option value="">Select province</option>
            {SOUTH_AFRICAN_PROVINCES.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="province" />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="saved-address-postal-code">
            Postal code <RequiredMark />
          </Label>
          <Input
            aria-invalid={Boolean(errors?.postalCode)}
            autoComplete="postal-code"
            className={fieldClass}
            defaultValue={address?.postalCode}
            id="saved-address-postal-code"
            inputMode="numeric"
            maxLength={40}
            name="postalCode"
            required
          />
          <FieldError errors={errors} name="postalCode" />
        </div>

        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[#e5e5de] bg-[#f8f8f4] p-3 dark:border-white/10 dark:bg-white/[0.04]">
            <Checkbox
              className="mt-0.5"
              defaultChecked={address?.isDefault ?? false}
              name="isDefault"
            />
            <span>
              <span className="block text-sm font-bold">
                Use as my default delivery address
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
                This will be selected first whenever saved addresses are available.
              </span>
            </span>
          </label>
        </div>

        {state.status === "error" ? (
          <p
            aria-live="polite"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 sm:col-span-2"
          >
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-[#e8e8e2] pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
          <Button
            className="h-11 rounded-md px-5 font-bold"
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="h-11 rounded-md bg-[#ff5a1f] px-5 font-bold text-white hover:bg-[#e84c15]"
            disabled={pending}
            type="submit"
          >
            {pending ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : address ? (
              <CheckCircle2Icon className="size-4" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            {pending
              ? "Saving..."
              : address
                ? "Save changes"
                : "Save address"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function AddressCard({
  address,
  onEdit,
}: {
  address: SavedAddressView;
  onEdit: () => void;
}) {
  const [defaultState, defaultAction, settingDefault] = useActionState(
    makeCustomerAddressDefault,
    initialActionState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    removeCustomerAddress,
    initialActionState,
  );
  const errorMessage =
    defaultState.status === "error"
      ? defaultState.message
      : deleteState.status === "error"
        ? deleteState.message
        : null;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-md border bg-white p-5 shadow-[0_10px_30px_rgba(8,8,8,0.04)] dark:bg-[#101010]",
        address.isDefault
          ? "border-[#ff5a1f]/55 ring-1 ring-[#ff5a1f]/10 dark:border-[#ff5a1f]/50"
          : "border-[#deded7] dark:border-white/10",
      )}
    >
      {address.isDefault ? (
        <span className="absolute inset-y-0 left-0 w-1 bg-[#ff5a1f]" />
      ) : null}

      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            address.isDefault
              ? "bg-[#ff5a1f]/10 text-[#ff5a1f]"
              : "bg-[#f1f1ec] text-[#64645e] dark:bg-white/[0.07] dark:text-[#c2c2ba]",
          )}
        >
          <HomeIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-black">{address.label}</h2>
            {address.isDefault ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ff5a1f]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#d94711] dark:text-[#ff9b75]">
                <StarIcon className="size-3 fill-current" />
                Default
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-bold">{address.recipientName}</p>
          <p className="mt-0.5 text-xs text-[#74746e] dark:text-[#aaa9a1]">
            {address.recipientPhone}
          </p>
        </div>
      </div>

      <address className="mt-4 border-t border-[#e8e8e2] pt-4 text-sm not-italic leading-6 text-[#555550] dark:border-white/10 dark:text-[#c1c1ba]">
        <span className="block">{address.addressLine1}</span>
        {address.addressLine2 ? (
          <span className="block">{address.addressLine2}</span>
        ) : null}
        <span className="block">
          {[address.suburb, address.city].filter(Boolean).join(", ")}
        </span>
        <span className="block">
          {address.province}, {address.postalCode}
        </span>
        <span className="block">South Africa</span>
      </address>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-[#e8e8e2] pt-4 dark:border-white/10">
        <Button
          className="h-9 rounded-md font-bold"
          disabled={deleting || settingDefault}
          onClick={onEdit}
          type="button"
          variant="outline"
        >
          <PencilIcon className="size-4" />
          Edit
        </Button>

        {!address.isDefault ? (
          <form action={defaultAction}>
            <input name="addressId" type="hidden" value={address.id} />
            <Button
              className="h-9 rounded-md font-bold"
              disabled={deleting || settingDefault}
              type="submit"
              variant="outline"
            >
              {settingDefault ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <StarIcon className="size-4" />
              )}
              Set as default
            </Button>
          </form>
        ) : null}

        <form
          action={deleteAction}
          className="sm:ml-auto"
          onSubmit={(event) => {
            if (
              !window.confirm(
                `Delete the saved address “${address.label}”?`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input name="addressId" type="hidden" value={address.id} />
          <Button
            className="h-9 rounded-md font-bold"
            disabled={deleting || settingDefault}
            type="submit"
            variant="destructive"
          >
            {deleting ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <Trash2Icon className="size-4" />
            )}
            Delete
          </Button>
        </form>
      </div>

      {errorMessage ? (
        <p
          aria-live="polite"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
        >
          {errorMessage}
        </p>
      ) : null}
    </article>
  );
}

function AddressBenefits({ onAdd }: { onAdd: () => void }) {
  return (
    <aside className="rounded-md border border-[#ff5a1f]/25 bg-[#fff8f4] p-5 text-[#080808] shadow-[0_16px_45px_rgba(8,8,8,0.06)] dark:border-[#ff5a1f]/20 dark:bg-[#1a120f] dark:text-[#f7f7f2] sm:p-6">
      <span className="grid size-11 place-items-center rounded-full bg-[#ff5a1f] text-white">
        <ShieldCheckIcon className="size-5" />
      </span>
      <h2 className="mt-4 text-xl font-black">Make delivery details easier</h2>
      <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#bdb5ae]">
        Keep frequently used addresses together and choose the one you want to
        use by default.
      </p>
      <ul className="mt-5 grid gap-3 text-sm font-semibold text-[#343430] dark:text-[#e5ddd7]">
        <li className="flex gap-2">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-[#ff5a1f]" />
          Save home, work, and delivery locations.
        </li>
        <li className="flex gap-2">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-[#ff5a1f]" />
          Update recipient details whenever they change.
        </li>
        <li className="flex gap-2">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-[#ff5a1f]" />
          Keep one clear default address.
        </li>
      </ul>
      <Button
        className="mt-6 h-11 w-full rounded-md bg-[#ff5a1f] font-black text-white hover:bg-[#e84c15]"
        onClick={onAdd}
        type="button"
      >
        <PlusIcon className="size-4" />
        Add an address
      </Button>
    </aside>
  );
}

export function AddressManager({
  addresses,
  defaultRecipientName,
}: {
  addresses: SavedAddressView[];
  defaultRecipientName: string;
}) {
  const [editor, setEditor] = useState<AddressEditor | null>(() =>
    addresses.length === 0 ? { address: null, mode: "create" } : null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const closeEditor = useCallback(() => {
    setEditor(null);
  }, []);
  const handleSaved = useCallback((message: string) => {
    setNotice(message);
    setEditor(null);
  }, []);

  function addAddress() {
    setNotice(null);
    setEditor({ address: null, mode: "create" });
  }

  function editAddress(address: SavedAddressView) {
    setNotice(null);
    setEditor({ address, mode: "edit" });
  }

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black">
            {addresses.length} saved address{addresses.length === 1 ? "" : "es"}
          </p>
          <p className="mt-1 text-xs text-[#6c6c66] dark:text-[#aaa9a1]">
            Your address book is private to your account.
          </p>
        </div>
        {editor?.mode !== "create" ? (
          <Button
            className="h-11 rounded-md bg-[#ff5a1f] px-5 font-black text-white hover:bg-[#e84c15]"
            onClick={addAddress}
            type="button"
          >
            <PlusIcon className="size-4" />
            Add address
          </Button>
        ) : null}
      </div>

      {notice ? (
        <p
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          <CheckCircle2Icon className="size-4 shrink-0" />
          {notice}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:items-start">
        <section aria-label="Saved addresses" className="grid min-w-0 gap-4">
          {addresses.length > 0 ? (
            addresses.map((address) => (
              <AddressCard
                address={address}
                key={address.id}
                onEdit={() => editAddress(address)}
              />
            ))
          ) : (
            <div className="grid min-h-64 place-items-center rounded-md border border-dashed border-[#cecec7] bg-white px-6 py-10 text-center dark:border-white/15 dark:bg-[#101010]">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f]">
                  <MapPinIcon className="size-6" />
                </span>
                <h2 className="mt-4 text-lg font-black">No saved addresses yet</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
                  Add the delivery location you use most often. Your first
                  address becomes the default automatically.
                </p>
              </div>
            </div>
          )}
        </section>

        <div className="lg:sticky lg:top-36">
          {editor ? (
            <AddressForm
              address={editor.address}
              defaultRecipientName={defaultRecipientName}
              key={editor.address?.id ?? "new-address"}
              onCancel={closeEditor}
              onSaved={handleSaved}
            />
          ) : (
            <AddressBenefits onAdd={addAddress} />
          )}
        </div>
      </div>
    </div>
  );
}
