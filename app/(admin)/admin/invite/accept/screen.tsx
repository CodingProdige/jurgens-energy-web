"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

import type { AcceptAdminInviteState } from "@/app/(admin)/admin/invite/actions";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import {
  adminStaffRoleLabels,
} from "@/src/modules/admin/staff-constants";
import type { AdminStaffRole } from "@/src/db/schema";

const initialState: AcceptAdminInviteState = {};

type AdminInviteAcceptScreenProps = {
  action: (
    state: AcceptAdminInviteState,
    formData: FormData,
  ) => Promise<AcceptAdminInviteState>;
  email: string | null;
  isTokenValid: boolean;
  name: string | null;
  roles: AdminStaffRole[];
  token: string;
};

export function AdminInviteAcceptScreen({
  action,
  email,
  isTokenValid,
  name,
  roles,
  token,
}: AdminInviteAcceptScreenProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="grid min-h-screen place-items-center bg-white px-7 py-10 text-[#070b16] dark:bg-[#0f1114] dark:text-white">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      <form action={formAction} className="w-full max-w-[410px]">
        <Image
          src="/brand/logo/jurgens-icon.png"
          alt="Jurgens Energy"
          width={164}
          height={30}
          priority
          className="mx-auto mb-8 h-auto w-[142px]"
        />
        <div className="mb-8 text-center">
          <ShieldCheck className="mx-auto size-12 text-[#cca137]" />
          <h1 className="mt-6 text-[28px] font-extrabold leading-tight">
            Accept admin invite
          </h1>
          <p className="mx-auto mt-3 max-w-[330px] text-[15px] leading-6 text-[#596176] dark:text-zinc-300">
            {email && roles.length > 0
              ? `Set credentials for ${email} with ${roles
                  .map((role) => adminStaffRoleLabels[role])
                  .join(", ")} access.`
              : "This invitation link is invalid or has expired."}
          </p>
        </div>

        <input name="token" type="hidden" value={token} />

        {!isTokenValid ? (
          <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            This invitation link is invalid or has expired.
          </p>
        ) : (
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-[13px] font-bold">Name</span>
              <input
                name="name"
                defaultValue={name ?? ""}
                placeholder="Your name"
                className="h-[50px] w-full rounded-[6px] border border-[#d9deea] bg-white px-4 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:border-[#ffc400] focus:ring-4 focus:ring-[#ffc400]/20 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500"
              />
            </label>

            {["password", "confirmPassword"].map((field) => (
              <label key={field} className="grid gap-2">
                <span className="text-[13px] font-bold">
                  {field === "password" ? "Password" : "Confirm password"}
                </span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
                  <input
                    name={field}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    placeholder="At least 12 characters"
                    className="h-[50px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-11 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:border-[#ffc400] focus:ring-4 focus:ring-[#ffc400]/20 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500"
                  />
                  {field === "password" ? (
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
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        )}

        {state.error ? (
          <p className="mt-5 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !isTokenValid}
          className={cn(
            "mt-8 inline-flex h-[50px] w-full items-center justify-center gap-3 rounded-[6px] border border-[#f0b800] bg-[linear-gradient(180deg,#ffd21b,#ffc400)] text-[14px] font-extrabold text-[#070b16] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-70",
          )}
        >
          {pending ? "Accepting..." : "Accept invitation"}
        </button>

        <Link
          href="/sign-in"
          className="mt-5 inline-flex h-[50px] w-full items-center justify-center rounded-[6px] border border-[#d9deea] bg-white text-[14px] font-extrabold text-[#070b16] transition hover:bg-[#fafafa] dark:border-white/12 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10"
        >
          Back to sign in
        </Link>
      </form>
    </main>
  );
}
