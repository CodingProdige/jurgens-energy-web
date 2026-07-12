"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  LockKeyhole,
  Mail,
  User,
} from "lucide-react";

import { JurgensEnergyLogo } from "@/components/brand/jurgens-energy-logo";
import { CountryPhoneInput } from "@/components/phone/country-phone-input";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

type MarketplaceAuthState = {
  error?: string;
};

type MarketplaceAuthScreenProps = {
  action: (
    state: MarketplaceAuthState,
    formData: FormData,
  ) => Promise<MarketplaceAuthState>;
  googleAction: () => Promise<void>;
  rememberedEmail?: string;
  mode: "sign-in" | "register";
  whatsappDraftToken?: string | null;
  whatsappPhoneDefault?: string | null;
  whatsappPhoneLocked?: boolean;
};

const initialState: MarketplaceAuthState = {};
const authVisualVideoSrc =
  "/brand/video/zoom_in_slowly_and_show_cars_p_Gemini_Omni_Flash_43068.mp4";

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

function GoogleButton({
  action,
  label,
}: {
  action: () => Promise<void>;
  label: string;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="inline-flex h-[45px] w-full items-center justify-center gap-3 rounded-[6px] border border-[#d9deea] bg-white px-3 text-[13px] font-extrabold text-[#070b16] transition hover:bg-[#fafafa] dark:border-white/12 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10"
      >
        <GoogleGlyph />
        <span className="text-[#070b16] dark:text-white">{label}</span>
      </button>
    </form>
  );
}

function MarketplaceVisual() {
  const [isVideoReady, setIsVideoReady] = useState(false);

  return (
    <section className="relative min-h-[430px] min-w-0 overflow-hidden bg-[#0c0d0b] text-white lg:min-h-screen">
      <video
        aria-hidden="true"
        autoPlay
        muted
        onCanPlay={() => setIsVideoReady(true)}
        onLoadedData={() => setIsVideoReady(true)}
        onPlaying={() => setIsVideoReady(true)}
        playsInline
        preload="metadata"
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out",
          isVideoReady ? "opacity-100" : "opacity-0",
        )}
      >
        <source src={authVisualVideoSrc} type="video/mp4" />
      </video>
    </section>
  );
}

function MarketplaceAuthForm({
  action,
  googleAction,
  rememberedEmail,
  mode,
  whatsappDraftToken,
  whatsappPhoneDefault,
  whatsappPhoneLocked = false,
}: MarketplaceAuthScreenProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === "register";
  const alternateHref = isRegister
    ? `/sign-in${whatsappDraftToken ? `?whatsappDraft=${encodeURIComponent(whatsappDraftToken)}` : ""}`
    : `/register${whatsappDraftToken ? `?whatsappDraft=${encodeURIComponent(whatsappDraftToken)}` : ""}`;

  return (
    <div className="w-full max-w-[420px]">
      <Link
        aria-label="Jurgens Energy home"
        className="mb-10 inline-flex w-fit"
        href="/"
      >
        <JurgensEnergyLogo className="scale-[0.92] origin-left" />
      </Link>
      <form action={formAction}>
      {whatsappDraftToken ? (
        <input name="whatsappDraft" type="hidden" value={whatsappDraftToken} />
      ) : null}
      <div className="mb-8">
        <h2 className="text-[28px] font-extrabold leading-tight text-[#070b16] dark:text-white">
          {isRegister ? "Create account" : "Sign in"}
        </h2>
        <p className="mt-3 max-w-[320px] text-[14px] leading-6 text-[#596176] dark:text-zinc-300">
          {isRegister
            ? "Fill in the details below to get started."
            : "Enter your email and password to access your account."}
        </p>
      </div>

      <div className="grid gap-5">
        {isRegister ? (
          <label className="grid gap-2">
            <span className="text-[13px] font-bold text-[#070b16] dark:text-white">
              Full name
            </span>
            <span className="relative block">
              <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
              <input
                name="name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                placeholder="Enter your full name"
                className="h-[45px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-4 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:border-[#ffc400] focus:ring-4 focus:ring-[#ffc400]/20 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500"
              />
            </span>
          </label>
        ) : null}

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
              defaultValue={rememberedEmail}
              placeholder="youremail@example.com"
              className="h-[45px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-4 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:border-[#ffc400] focus:ring-4 focus:ring-[#ffc400]/20 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500"
            />
          </span>
        </label>

        {isRegister ? (
          <label className="grid gap-2">
            <span className="text-[13px] font-bold text-[#070b16] dark:text-white">
              WhatsApp number
            </span>
            <CountryPhoneInput
              className="grid-cols-[8.25rem_minmax(0,1fr)]"
              defaultValue={whatsappPhoneDefault}
              inputClassName={cn(
                "h-[45px] rounded-[6px] border-[#d9deea] text-[14px] focus:border-[#ffc400] focus:ring-[#ffc400]/20 dark:border-white/12 dark:bg-[#151719]",
                whatsappPhoneLocked &&
                  "bg-[#f7f7f2] text-[#596176] dark:bg-white/[0.06]",
              )}
              name="whatsappPhone"
              placeholder="82 123 4567"
              readOnly={whatsappPhoneLocked}
              required
              selectClassName="h-[45px] rounded-[6px] border-[#d9deea] text-[13px] focus:border-[#ffc400] focus:ring-[#ffc400]/20 dark:border-white/12 dark:bg-[#151719]"
            />
            <span className="text-[12px] font-medium text-[#596176] dark:text-zinc-400">
              {whatsappPhoneLocked
                ? "Linked from the WhatsApp order that brought you here."
                : "Used for delivery updates and WhatsApp gas support."}
            </span>
          </label>
        ) : null}

        <label className="grid gap-2">
          <span className="flex items-center justify-between gap-4 text-[13px] font-bold text-[#070b16] dark:text-white">
            Password
            {!isRegister ? (
              <Link
                href="/forgot-password"
                className="text-[12px] font-semibold text-[#070b16] transition hover:text-[#c4982d] dark:text-zinc-300 dark:hover:text-[#ffc400]"
              >
                Forgot password?
              </Link>
            ) : null}
          </span>
          <span className="relative block">
            <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={8}
              placeholder={isRegister ? "Enter your password" : "Password"}
              className="h-[45px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-11 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:border-[#ffc400] focus:ring-4 focus:ring-[#ffc400]/20 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500"
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
          {isRegister ? (
            <span className="text-[12px] font-medium text-[#596176] dark:text-zinc-400">
              Password must be at least 8 characters
            </span>
          ) : null}
        </label>
      </div>

      {state.error ? (
        <p className="mt-5 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-7 inline-flex h-[45px] w-full items-center justify-center gap-3 rounded-[6px] border border-[#f0b800] bg-[linear-gradient(180deg,#ffd21b,#ffc400)] text-[13px] font-extrabold text-[#070b16] shadow-[0_10px_24px_rgba(255,196,0,0.22)] transition hover:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <LockKeyhole className="size-4" />
        {pending ? "Working..." : isRegister ? "Create account" : "Sign in"}
      </button>
      </form>

      <div className="my-7 flex items-center gap-4">
        <span className="h-px flex-1 bg-[#e2e6ef] dark:bg-white/12" />
        <span className="text-xs font-semibold text-[#596176] dark:text-zinc-400">
          {isRegister ? "or sign up with" : "or continue with"}
        </span>
        <span className="h-px flex-1 bg-[#e2e6ef] dark:bg-white/12" />
      </div>

      <GoogleButton
        action={googleAction}
        label={isRegister ? "Sign up with Google" : "Sign in with Google"}
      />

      <p className="mt-7 text-center text-[14px] font-medium text-[#070b16] dark:text-zinc-300">
        {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
        <Link
          href={alternateHref}
          className="font-semibold text-[#c4982d] transition hover:text-[#a77e1d] dark:text-[#ffc400]"
        >
          {isRegister ? "Sign in" : "Create account"}
        </Link>
      </p>
    </div>
  );
}

export function MarketplaceAuthScreen(props: MarketplaceAuthScreenProps) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-[#070b16] dark:bg-[#0f1114] lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(430px,1fr)]">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <MarketplaceVisual />
      <section className="grid min-h-[calc(100vh-430px)] min-w-0 place-items-center bg-white px-7 py-10 dark:bg-[#0f1114] sm:px-12 lg:min-h-screen lg:px-16">
        <MarketplaceAuthForm {...props} />
      </section>
    </main>
  );
}
