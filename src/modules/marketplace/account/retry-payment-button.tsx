"use client";

import { CreditCardIcon, LoaderCircleIcon } from "lucide-react";
import { useActionState } from "react";

import {
  retryPayFastPaymentAction,
  type RetryPaymentActionState,
} from "@/app/(marketplace)/account/orders/[orderId]/actions";

const initialState: RetryPaymentActionState = { error: null };

export function RetryPaymentButton({ orderId }: { orderId: string }) {
  const action = retryPayFastPaymentAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-2">
      <button
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#ff5a1f] px-4 text-sm font-black text-white transition hover:bg-[#e84c15] disabled:cursor-wait disabled:opacity-70"
        disabled={pending}
        type="submit"
      >
        {pending ? (
          <LoaderCircleIcon className="size-4 animate-spin" />
        ) : (
          <CreditCardIcon className="size-4" />
        )}
        {pending ? "Opening PayFast…" : "Try payment again"}
      </button>
      {state.error ? (
        <p
          aria-live="polite"
          className="text-xs leading-5 text-red-600 dark:text-red-300"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
