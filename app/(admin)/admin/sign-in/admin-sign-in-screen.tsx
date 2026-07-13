"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import type { SignInState } from "@/app/sign-in/actions";
import { JurgensEnergyLogo } from "@/components/brand/jurgens-energy-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const initialState: SignInState = {};

type AdminSignInScreenProps = {
  action: (state: SignInState, formData: FormData) => Promise<SignInState>;
  googleAction: () => Promise<void>;
  rememberedEmail?: string;
  ssoError?: string;
};

const adminVisualVideoSrc =
  "/brand/video/show_this_truck_switching_on_i_Seedance_20_13976.mp4";

function GoogleGlyph() {
  return (
    <span
      aria-hidden="true"
      className="grid size-5 place-items-center text-[18px] font-bold leading-none"
    >
      <span className="bg-[conic-gradient(from_-35deg,#4285f4_0_25%,#34a853_0_50%,#fbbc05_0_75%,#ea4335_0)] bg-clip-text text-transparent">
        G
      </span>
    </span>
  );
}

function AdminSignInForm({
  action,
  googleAction,
  rememberedEmail,
  ssoError,
}: AdminSignInScreenProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-[390px]">
      <Link
        aria-label="Jurgens Energy admin home"
        className="mb-10 inline-flex w-fit"
        href="/"
      >
        <JurgensEnergyLogo className="scale-[0.92] origin-left" />
      </Link>
      <form action={formAction}>
      <div className="mb-9 text-center lg:text-left">
        <h1 className="m-0 text-[22px] font-extrabold leading-tight text-[#070b16] dark:text-white">
          Sign in to your account
        </h1>
        <p className="mx-auto mt-3 max-w-[310px] text-[14px] leading-5 text-[#596176] dark:text-zinc-300 lg:mx-0">
          Enter your credentials to access the admin dashboard
        </p>
      </div>

      <div className="grid gap-6">
        <label className="grid gap-2">
          <span className="text-[13px] font-bold text-[#070b16] dark:text-white">Email address</span>
          <span className="relative block">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={rememberedEmail}
              placeholder="admin@jurgensenergy.com"
              className="h-[45px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-4 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:border-primary focus:ring-4 focus:ring-primary/20 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500"
            />
          </span>
        </label>

        <label className="grid gap-2">
          <span className="flex items-center justify-between gap-4 text-[13px] font-bold text-[#070b16] dark:text-white">
            Password
            <a
              href="/forgot-password"
              className="text-[12px] font-semibold text-primary transition hover:text-[#d94514]"
            >
              Forgot password?
            </a>
          </span>
          <span className="relative block">
            <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              minLength={8}
              placeholder="Enter your password"
              className="h-[45px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-11 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:border-primary focus:ring-4 focus:ring-primary/20 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-4 top-1/2 grid size-5 -translate-y-1/2 place-items-center text-[#596176] transition hover:text-[#070b16] dark:text-zinc-400 dark:hover:text-white"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>
      </div>

      <div className="mt-7">
        <label className="flex items-center gap-3 text-[13px] font-medium text-[#596176] dark:text-zinc-300">
          <Checkbox
            name="remember"
            defaultChecked={Boolean(rememberedEmail)}
            className="size-4 rounded-[4px] border-[#cbd2df] bg-white data-checked:border-primary data-checked:bg-primary data-checked:text-white"
          />
          Keep me signed in for 30 days
        </label>
        <p className="mt-2 pl-7 text-[12px] leading-5 text-[#7a8297] dark:text-zinc-400">
          Leave unchecked to require sign-in again after this browser session.
        </p>
      </div>

      {ssoError === "admin_access_required" ? (
        <p className="mt-5 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          This Google account does not have admin access. Use an approved admin
          account or contact a platform superadmin.
        </p>
      ) : null}

      {state.error ? (
        <p className="mt-5 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-7 inline-flex h-[45px] w-full items-center justify-center gap-3 rounded-[6px] border border-primary bg-[linear-gradient(180deg,#ff6b35,#ff5a1f)] text-[13px] font-extrabold text-white shadow-[0_10px_24px_rgba(255,90,31,0.26)] transition hover:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <LockKeyhole className="size-4" />
        {pending ? "Signing in..." : "Sign in"}
      </button>
      </form>

      <div className="my-8 flex items-center gap-4">
        <span className="h-px flex-1 bg-[#e2e6ef]" />
        <span className="text-xs font-bold uppercase text-[#596176]">OR</span>
        <span className="h-px flex-1 bg-[#e2e6ef]" />
      </div>

      <form action={googleAction}>
        <button
          type="submit"
          className="inline-flex h-[45px] w-full items-center justify-center gap-3 rounded-[6px] border border-[#d9deea] bg-white text-[13px] font-extrabold text-[#070b16] transition hover:bg-[#fafafa] dark:border-white/12 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10"
        >
          <GoogleGlyph />
          <span className="text-[#070b16] dark:text-white">Sign in with Google</span>
        </button>
      </form>

      <div className="mt-13 text-center">
        <ShieldCheck className="mx-auto size-9 text-primary" />
        <p className="mt-4 text-[13px] font-extrabold text-[#070b16] dark:text-white">
          Secure admin access
        </p>
        <p className="mx-auto mt-2 max-w-[260px] text-[13px] leading-5 text-[#596176] dark:text-zinc-300">
          All connections are encrypted and secure
        </p>
      </div>
    </div>
  );
}

export function AdminSignInScreen({
  action,
  googleAction,
  rememberedEmail,
  ssoError,
}: AdminSignInScreenProps) {
  const [isVideoReady, setIsVideoReady] = useState(false);

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-white dark:bg-[#0f1114] lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(430px,1fr)]">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <section className="relative min-h-[430px] min-w-0 overflow-hidden bg-[#101214] px-7 py-8 lg:min-h-screen lg:px-10 xl:px-12">
        <video
          aria-hidden="true"
          autoPlay
          muted
          onCanPlay={() => setIsVideoReady(true)}
          onLoadedData={() => setIsVideoReady(true)}
          onError={() => setIsVideoReady(true)}
          onPlaying={() => setIsVideoReady(true)}
          playsInline
          preload="auto"
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out",
            isVideoReady ? "opacity-100" : "opacity-0",
          )}
        >
          <source src={adminVisualVideoSrc} type="video/mp4" />
        </video>
      </section>

      <section className="grid min-h-[calc(100vh-430px)] min-w-0 place-items-center bg-white px-7 py-10 dark:bg-[#0f1114] sm:px-12 lg:min-h-screen lg:px-16">
        <div className="w-full max-w-[390px] lg:translate-y-[-8px]">
          <AdminSignInForm
            action={action}
            googleAction={googleAction}
            rememberedEmail={rememberedEmail}
            ssoError={ssoError}
          />
        </div>
      </section>
    </main>
  );
}
