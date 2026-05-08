"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import type { ResetPasswordState } from "@/src/modules/auth/password-reset-types";

const initialState: ResetPasswordState = {};

type ResetPasswordScreenProps = {
  action: (
    state: ResetPasswordState,
    formData: FormData,
  ) => Promise<ResetPasswordState>;
  token: string;
  isTokenValid: boolean;
  accent?: "gold" | "green";
};

const accentStyles = {
  gold: {
    focus: "focus:border-[#ffc400] focus:ring-[#ffc400]/20",
    button:
      "border-[#f0b800] bg-[linear-gradient(180deg,#ffd21b,#ffc400)] text-[#070b16]",
    icon: "text-[#cca137]",
  },
  green: {
    focus: "focus:border-[#58d83f] focus:ring-[#58d83f]/20",
    button:
      "border-[#053f17] bg-[linear-gradient(180deg,#08651f,#06491a)] text-white",
    icon: "text-[#2eb338]",
  },
} as const;

export function ResetPasswordScreen({
  action,
  token,
  isTokenValid,
  accent = "gold",
}: ResetPasswordScreenProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const styles = accentStyles[accent];
  const didResetPassword = Boolean(state.success);

  return (
    <main className="grid min-h-screen place-items-center overflow-x-hidden bg-white px-7 py-10 text-[#070b16] dark:bg-[#0f1114] dark:text-white">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      <form action={formAction} className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <ShieldCheck className={cn("mx-auto size-12", styles.icon)} />
          <h1 className="mt-6 text-[28px] font-extrabold leading-tight">
            Set a new password
          </h1>
          <p className="mx-auto mt-3 max-w-[310px] text-[15px] leading-6 text-[#596176] dark:text-zinc-300">
            Choose a strong password with at least 12 characters.
          </p>
        </div>

        {didResetPassword ? (
          <p className="mt-5 rounded-[6px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            {state.success}
          </p>
        ) : (
          <>
            <input name="token" type="hidden" value={token} />

            {!isTokenValid ? (
              <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                This reset link is invalid or has expired.
              </p>
            ) : null}

            <div className="grid gap-6">
              <label className="grid gap-2">
                <span className="text-[13px] font-bold">New password</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    disabled={!isTokenValid}
                    placeholder="Enter a new password"
                    className={cn(
                      "h-[50px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-11 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:ring-4 disabled:opacity-60 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500",
                      styles.focus,
                    )}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 grid size-5 -translate-y-1/2 place-items-center text-[#596176] transition hover:text-[#070b16] dark:text-zinc-400 dark:hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </span>
              </label>

              <label className="grid gap-2">
                <span className="text-[13px] font-bold">Confirm password</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
                  <input
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    disabled={!isTokenValid}
                    placeholder="Confirm your new password"
                    className={cn(
                      "h-[50px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-4 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:ring-4 disabled:opacity-60 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500",
                      styles.focus,
                    )}
                  />
                </span>
              </label>
            </div>

            {state.error ? (
              <p className="mt-5 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending || !isTokenValid}
              className={cn(
                "mt-8 inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-[6px] text-[14px] font-extrabold transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-70",
                styles.button,
              )}
            >
              <LockKeyhole className="size-4" />
              {pending ? "Updating..." : "Update password"}
            </button>
          </>
        )}

        <Link
          href="/sign-in"
          className="mt-5 inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-[6px] border border-[#d9deea] bg-white text-[14px] font-extrabold text-[#070b16] transition hover:bg-[#fafafa] dark:border-white/12 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10"
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>
      </form>
    </main>
  );
}
