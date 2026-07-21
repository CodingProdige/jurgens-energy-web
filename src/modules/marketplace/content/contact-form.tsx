"use client";

import { LoaderCircleIcon, SendIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ContactInquiryActionState } from "@/app/(marketplace)/(content)/contact/actions";

const initialState: ContactInquiryActionState = {};

export type ContactInquiryAction = (
  state: ContactInquiryActionState,
  formData: FormData,
) => Promise<ContactInquiryActionState>;

export function ContactForm({ action }: { action: ContactInquiryAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success" && state.submissionId) {
      formRef.current?.reset();
    }
  }, [state.status, state.submissionId]);

  const nameError = state.fieldErrors?.name?.[0];
  const emailError = state.fieldErrors?.email?.[0];
  const messageError = state.fieldErrors?.message?.[0];

  return (
    <form action={formAction} className="mt-7 grid gap-5" ref={formRef}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[10000px] h-px w-px overflow-hidden"
      >
        <label htmlFor="contact-company">Company website</label>
        <input
          autoComplete="off"
          id="contact-company"
          name="company"
          tabIndex={-1}
          type="text"
        />
      </div>

      <div className="grid gap-2">
        <Label className="text-[12px] font-black uppercase tracking-[0.08em]" htmlFor="contact-name">
          Name *
        </Label>
        <Input
          aria-describedby={nameError ? "contact-name-error" : undefined}
          aria-invalid={Boolean(nameError)}
          autoComplete="name"
          className="h-12 rounded-md px-4 text-[15px] md:text-[15px]"
          id="contact-name"
          maxLength={120}
          name="name"
          placeholder="Your name"
          required
        />
        {nameError ? (
          <p className="text-sm font-medium text-destructive" id="contact-name-error">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label className="text-[12px] font-black uppercase tracking-[0.08em]" htmlFor="contact-email">
          Email *
        </Label>
        <Input
          aria-describedby={emailError ? "contact-email-error" : undefined}
          aria-invalid={Boolean(emailError)}
          autoComplete="email"
          className="h-12 rounded-md px-4 text-[15px] md:text-[15px]"
          id="contact-email"
          maxLength={254}
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
        {emailError ? (
          <p className="text-sm font-medium text-destructive" id="contact-email-error">
            {emailError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label className="text-[12px] font-black uppercase tracking-[0.08em]" htmlFor="contact-message">
          Message *
        </Label>
        <Textarea
          aria-describedby={messageError ? "contact-message-error" : undefined}
          aria-invalid={Boolean(messageError)}
          className="min-h-36 resize-y rounded-md px-4 py-3 text-[15px] leading-6 md:text-[15px]"
          id="contact-message"
          maxLength={4_000}
          name="message"
          placeholder="How can we help?"
          required
          rows={6}
        />
        {messageError ? (
          <p className="text-sm font-medium text-destructive" id="contact-message-error">
            {messageError}
          </p>
        ) : null}
      </div>

      <Button
        className="h-12 w-full rounded-md bg-[#ff5a1f] text-[13px] font-black uppercase tracking-[0.08em] text-white shadow-[0_10px_24px_rgba(255,90,31,0.18)] hover:bg-[#e94c14]"
        disabled={pending}
        size="lg"
        type="submit"
      >
        {pending ? (
          <LoaderCircleIcon className="size-4 animate-spin" />
        ) : (
          <SendIcon className="size-4" />
        )}
        {pending ? "Sending…" : "Send message"}
      </Button>

      {state.message ? (
        <p
          aria-live="polite"
          className={cn(
            "rounded-md border px-4 py-3 text-sm font-semibold leading-6",
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200",
          )}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
