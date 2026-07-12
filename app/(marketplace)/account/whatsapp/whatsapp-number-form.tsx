"use client";

import { useActionState } from "react";
import { CheckCircle2Icon, MessageCircleIcon } from "lucide-react";

import { CountryPhoneInput } from "@/components/phone/country-phone-input";
import { Button } from "@/components/ui/button";
import {
  saveCustomerWhatsappNumber,
  type WhatsappNumberState,
} from "@/app/(marketplace)/account/whatsapp/actions";

const initialState: WhatsappNumberState = {};

export function WhatsappNumberForm({
  currentPhone,
  error,
  nextPath,
}: {
  currentPhone: string | null;
  error?: string;
  nextPath?: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveCustomerWhatsappNumber,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="w-full overflow-hidden rounded-md border border-[#e8e8e2] bg-white shadow-[0_16px_45px_rgba(8,8,8,0.06)] dark:border-white/10 dark:bg-[#101010]"
    >
      <input name="next" type="hidden" value={nextPath ?? ""} />
      <div className="border-b border-[#e8e8e2] px-5 py-5 dark:border-white/10 sm:px-6">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-[#18a957]/10 text-[#18a957]">
          <MessageCircleIcon className="size-5" />
        </span>
        <h1 className="mt-4 text-2xl font-black leading-tight">
          Link your WhatsApp number
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
          We use this to connect WhatsApp orders, delivery updates, invoices,
          and support conversations to your account.
        </p>
      </div>

      <div className="grid gap-4 px-5 py-5 sm:px-6">
        <label className="grid gap-2">
          <span className="text-sm font-bold">WhatsApp number</span>
          <CountryPhoneInput
            defaultValue={currentPhone}
            inputClassName="shadow-none"
            name="whatsappPhone"
            placeholder="82 123 4567"
            required
          />
          <span className="text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
            Select the country code for the WhatsApp number you use.
          </span>
        </label>

        {error || state.error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error ?? state.error}
          </p>
        ) : null}

        {state.success ? (
          <p className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2Icon className="size-4" />
            {state.success}
          </p>
        ) : null}

        <Button
          className="h-11 rounded-md bg-[#ff5a1f] text-sm font-bold text-white hover:bg-[#e84c15]"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving..." : nextPath ? "Save and continue" : "Save WhatsApp number"}
        </Button>
      </div>
    </form>
  );
}
