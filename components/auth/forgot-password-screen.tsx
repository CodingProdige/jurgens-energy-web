"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import {
  ArrowLeft,
  Mail,
  MailCheck,
  Send,
  ShieldCheck,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import type { ForgotPasswordState } from "@/src/modules/auth/password-reset-types";

const initialState: ForgotPasswordState = {};

type ForgotPasswordScreenProps = {
  action: (
    state: ForgotPasswordState,
    formData: FormData,
  ) => Promise<ForgotPasswordState>;
  accent?: "gold" | "green";
  titleLead?: string;
  titleAccent?: string;
  description?: string;
};

const accentStyles = {
  gold: {
    highlight: "text-primary",
    focus: "focus:border-primary focus:ring-primary/20",
    button:
      "border-primary bg-[linear-gradient(180deg,#ff6b35,#ff5a1f)] text-white shadow-[0_10px_24px_rgba(255,90,31,0.24)]",
    glow: "rgba(255,90,31,0.18)",
    icon: "text-primary",
    iconBg: "bg-primary/12",
  },
  green: {
    highlight: "text-[#58d83f]",
    focus: "focus:border-[#58d83f] focus:ring-[#58d83f]/20",
    button:
      "border-[#053f17] bg-[linear-gradient(180deg,#08651f,#06491a)] text-white shadow-[0_10px_24px_rgba(6,73,26,0.22)]",
    glow: "rgba(88,216,63,0.18)",
    icon: "text-[#2eb338]",
    iconBg: "bg-[#58d83f]/16",
  },
} as const;

function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo/jurgens-icon.png"
      alt="Jurgens Energy"
      width={164}
      height={30}
      priority
      className={cn("h-auto w-[142px]", className)}
    />
  );
}

export function ForgotPasswordScreen({
  action,
  accent = "gold",
  titleLead = "No worries,",
  titleAccent = "it happens",
  description = "Enter your email address and we'll send you a link to reset your password.",
}: ForgotPasswordScreenProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const styles = accentStyles[accent];

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-white dark:bg-[#0f1114] lg:grid lg:grid-cols-2">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      <section className="relative hidden min-h-screen min-w-0 overflow-hidden bg-[#101214] px-10 py-10 lg:block xl:px-12">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 72% 76%, ${styles.glow}, transparent 38%), radial-gradient(circle at 82% 12%, rgba(255,255,255,0.07), transparent 31%), linear-gradient(180deg, rgba(255,255,255,0.035), transparent)`,
          }}
        />
        <div className="absolute left-[34%] top-8 h-[540px] w-[540px] rounded-full border border-white/[0.045]" />
        <div className="absolute -bottom-36 left-[38%] h-[540px] w-[540px] rounded-full border border-white/[0.045]" />

        <BrandMark className="relative z-20 w-[136px]" />

        <div className="relative z-20 mt-[112px]">
          <h2 className="max-w-[360px] text-[34px] font-extrabold leading-[1.08] xl:text-[36px]">
            {titleLead}
            <br />
            <span className={styles.highlight}>{titleAccent}</span>!
          </h2>
          <p className="mt-5 max-w-[365px] text-[14px] font-medium leading-6 text-white/88">
            {description}
          </p>
        </div>

        <Image
          src="/brand/backgrounds/forgot-password-mockup.png"
          alt=""
          width={701}
          height={561}
          priority
          className="absolute bottom-0 left-6 z-10 w-[min(420px,calc(100%-48px))] xl:left-9 xl:w-[min(455px,calc(100%-72px))]"
        />
      </section>

      <section className="grid min-h-screen min-w-0 place-items-center bg-white px-7 py-10 dark:bg-[#0f1114] sm:px-12 lg:px-16">
        <form action={formAction} className="w-full max-w-[400px] lg:translate-y-[-8px]">
          <div className="mb-8 text-center lg:text-left">
            <BrandMark className="mx-auto mb-9 w-[126px] lg:hidden" />
            <div
              className={cn(
                "mx-auto mb-8 grid size-[110px] place-items-center rounded-full lg:mx-0",
                styles.iconBg,
              )}
            >
              <MailCheck className={cn("size-12", styles.icon)} />
            </div>
            <h1 className="m-0 text-[28px] font-extrabold leading-tight text-[#070b16] dark:text-white">
              Forgot password?
            </h1>
            <p className="mx-auto mt-3 max-w-[310px] text-[15px] leading-6 text-[#596176] dark:text-zinc-300 lg:mx-0">
              No problem! Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          <label className="grid gap-2">
            <span className="text-[13px] font-bold text-[#070b16] dark:text-white">
              Email address
            </span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="youremail@example.com"
                className={cn(
                  "h-[50px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-4 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:ring-4 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500",
                  styles.focus,
                )}
              />
            </span>
          </label>

          {state.error ? (
            <p className="mt-5 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {state.error}
            </p>
          ) : null}

          {state.success ? (
            <div className="mt-5 rounded-[6px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              <p>{state.success}</p>
              {state.devResetUrl ? (
                <a
                  className="mt-2 block break-all text-xs underline underline-offset-4"
                  href={state.devResetUrl}
                >
                  Dev reset link: {state.devResetUrl}
                </a>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className={cn(
              "mt-8 inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-[6px] text-[14px] font-extrabold transition hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-70",
              styles.button,
            )}
          >
            <Send className="size-4" />
            {pending ? "Preparing link..." : "Send reset link"}
          </button>

          <div className="my-8 flex items-center gap-4">
            <span className="h-px flex-1 bg-[#e2e6ef] dark:bg-white/12" />
            <span className="text-xs font-bold uppercase text-[#596176] dark:text-zinc-400">
              OR
            </span>
            <span className="h-px flex-1 bg-[#e2e6ef] dark:bg-white/12" />
          </div>

          <Link
            href="/sign-in"
            className="inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-[6px] border border-[#d9deea] bg-white text-[14px] font-extrabold text-[#070b16] transition hover:bg-[#fafafa] dark:border-white/12 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10"
          >
            <ArrowLeft className="size-4" />
            Back to sign in
          </Link>

          <div className="mt-10 flex gap-5 rounded-[8px] bg-[#f6f7f9] p-6 text-left dark:bg-white/[0.05]">
            <ShieldCheck className="mt-0.5 size-7 shrink-0 text-[#070b16] dark:text-white" />
            <div>
              <p className="text-[14px] font-extrabold text-[#070b16] dark:text-white">
                Secure & Safe
              </p>
              <p className="mt-2 text-[13px] leading-5 text-[#596176] dark:text-zinc-300">
                We&apos;ll never share your email with anyone. Your security is our
                priority.
              </p>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
