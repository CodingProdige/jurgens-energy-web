"use client";

import { ExternalLinkIcon, LoaderCircleIcon, ShieldCheckIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import type { PayFastField } from "@/src/modules/checkout/payfast";

export function PayFastRedirectForm({
  fields,
  orderNumber,
  processUrl,
}: {
  fields: PayFastField[];
  orderNumber: string;
  processUrl: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => formRef.current?.submit(), 350);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f2] px-4 py-10 text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
      <section className="w-full max-w-md rounded-md border border-[#e3e3dc] bg-white px-5 py-8 text-center shadow-sm dark:border-white/10 dark:bg-[#101010] sm:px-8">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f]">
          <LoaderCircleIcon className="size-6 animate-spin" />
        </span>
        <h1 className="mt-5 text-xl font-black">Opening secure payment</h1>
        <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
          Order {orderNumber} is ready. You are being redirected to PayFast to
          complete payment.
        </p>

        <form action={processUrl} method="post" ref={formRef}>
          {fields.map((field) => (
            <input key={field.name} name={field.name} type="hidden" value={field.value} />
          ))}
          <button
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#ff5a1f] px-4 text-sm font-bold text-white transition hover:bg-[#e84c15]"
            type="submit"
          >
            Continue to PayFast
            <ExternalLinkIcon className="size-4" />
          </button>
        </form>

        <p className="mt-4 inline-flex items-center gap-2 text-[11px] text-[#666660] dark:text-[#aaa9a1]">
          <ShieldCheckIcon className="size-4 text-emerald-600" />
          Payment details are entered on PayFast, not on this site.
        </p>
      </section>
    </main>
  );
}
