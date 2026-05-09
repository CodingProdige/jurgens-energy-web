"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  LockKeyhole,
  Mail,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Tag,
} from "lucide-react";

import {
  joinMarketplaceWaitlist,
  unlockMarketplacePreview,
  type ComingSoonState,
  type WaitlistState,
} from "@/app/coming-soon/actions";
import {
  PlatformSocialLinks,
  type PlatformSocialLinks as PlatformSocialLinksType,
} from "@/components/brand/social-links";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const initialAccessState: ComingSoonState = {};
const initialWaitlistState: WaitlistState = {};

const comingSoonVideoSrc =
  "/brand/video/show_people_in_amazement_all_s_Kling_30__31439%20%281%29.mp4";

const features = [
  {
    title: "Trusted Sellers",
    description: "Verified and reliable",
    icon: ShieldCheck,
  },
  {
    title: "Best Deals",
    description: "Unbeatable prices",
    icon: Tag,
  },
  {
    title: "Wide Variety",
    description: "Everything you need",
    icon: PackageCheck,
  },
  {
    title: "Secure Shopping",
    description: "Safe and protected",
    icon: Lock,
  },
] as const;

function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo/Piessang Logo Full - Clipped.png"
      alt="Piessang"
      width={164}
      height={30}
      priority
      className={cn("h-auto w-[142px]", className)}
    />
  );
}

function ComingSoonVisual() {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [didVideoEnd, setDidVideoEnd] = useState(false);

  return (
    <section className="relative min-h-[430px] min-w-0 overflow-hidden bg-[#0c0d0b] px-7 py-8 text-white lg:min-h-screen lg:px-10 xl:px-12">
      <video
        aria-hidden="true"
        autoPlay
        muted
        onCanPlay={() => setIsVideoReady(true)}
        onLoadedData={() => setIsVideoReady(true)}
        onEnded={() => setDidVideoEnd(true)}
        onError={() => {
          setIsVideoReady(true);
          setDidVideoEnd(true);
        }}
        onPlaying={() => setIsVideoReady(true)}
        playsInline
        preload="auto"
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out",
          isVideoReady ? "opacity-100" : "opacity-0",
        )}
      >
        <source src={comingSoonVideoSrc} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_24%,rgba(255,196,0,0.18),transparent_30%),radial-gradient(circle_at_48%_90%,rgba(255,196,0,0.14),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent)]" />
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-[82%] bg-[linear-gradient(90deg,rgba(0,0,0,0.9),rgba(0,0,0,0.68)_42%,rgba(0,0,0,0.3)_72%,transparent)] transition-opacity duration-1000 ease-out",
          didVideoEnd ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "relative z-20 transition-all duration-1000 ease-out",
          didVideoEnd ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0",
        )}
      >
        <BrandMark className="w-[136px]" />

        <div className="mt-16 max-w-[390px] lg:mt-[92px]">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.22em] text-[#ffc400]">
            Coming soon
          </p>
          <h1 className="mt-5 text-[36px] font-extrabold leading-[1.05] sm:text-[42px] lg:text-[48px]">
            Something{" "}
            <span className="text-[#ffc400]">Amazing</span>
            <br />
            is on the way.
          </h1>
          <p className="mt-5 max-w-[360px] text-[14px] font-medium leading-6 text-white/86">
            Piessang Marketplace is almost here. Your one-stop destination for
            everything you love - from trusted sellers.
          </p>
        </div>
      </div>
    </section>
  );
}

function ComingSoonPanel({
  socialLinks,
}: {
  socialLinks: PlatformSocialLinksType;
}) {
  const [showAccessPassword, setShowAccessPassword] = useState(false);
  const [accessState, unlockAction, isUnlockPending] = useActionState(
    unlockMarketplacePreview,
    initialAccessState,
  );
  const [waitlistState, waitlistAction, isWaitlistPending] = useActionState(
    joinMarketplaceWaitlist,
    initialWaitlistState,
  );

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-8 text-center lg:text-left">
        <BrandMark className="mx-auto mb-10 w-[126px] lg:hidden" />
        <div className="mx-auto mb-6 grid size-[74px] place-items-center rounded-full bg-[#fbe694]/35 text-[#cca137] lg:hidden">
          <Sparkles className="size-9" />
        </div>
        <p className="text-[12px] font-extrabold uppercase tracking-[0.22em] text-[#c4982d]">
          Coming soon
        </p>
        <h2 className="mt-4 text-[30px] font-extrabold leading-[1.08] text-[#070b16] dark:text-white sm:text-[34px]">
          Something{" "}
          <span className="text-[#f0b800]">Amazing</span>
          <br />
          is on the way.
        </h2>
        <p className="mx-auto mt-4 max-w-[360px] text-[14px] leading-6 text-[#596176] dark:text-zinc-300 lg:mx-0">
          Piessang Marketplace is almost here. Your one-stop destination for
          everything you love - from trusted sellers.
        </p>
      </div>

      <form action={waitlistAction}>
        <p className="mb-3 text-center text-[13px] font-extrabold text-[#070b16] dark:text-white lg:text-left">
          Be the first to know when we go live!
        </p>
        <label className="relative block">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            className="h-[45px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-4 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:border-[#ffc400] focus:ring-4 focus:ring-[#ffc400]/20 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500"
          />
        </label>
        <button
          type="submit"
          disabled={isWaitlistPending}
          className="mt-4 inline-flex h-[45px] w-full items-center justify-center gap-3 rounded-[6px] border border-[#f0b800] bg-[linear-gradient(180deg,#ffd21b,#ffc400)] text-[13px] font-extrabold text-[#070b16] shadow-[0_10px_24px_rgba(255,196,0,0.22)] transition hover:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isWaitlistPending ? "Saving..." : "Notify Me"}
        </button>
        {waitlistState.message ? (
          <p
            className={cn(
              "mt-3 rounded-[6px] px-3 py-2 text-sm font-semibold",
              waitlistState.ok
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-red-200 bg-red-50 text-red-700",
            )}
          >
            {waitlistState.message}
          </p>
        ) : null}
      </form>

      <div className="my-8 flex items-center gap-4">
        <span className="h-px flex-1 bg-[#e2e6ef] dark:bg-white/12" />
        <span className="text-xs font-bold uppercase text-[#596176]">
          Or enter access code
        </span>
        <span className="h-px flex-1 bg-[#e2e6ef] dark:bg-white/12" />
      </div>

      <form action={unlockAction}>
        <label className="relative block">
          <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#596176]" />
          <input
            name="password"
            type={showAccessPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter access password"
            className="h-[45px] w-full rounded-[6px] border border-[#d9deea] bg-white pl-11 pr-11 text-[14px] font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:border-[#ffc400] focus:ring-4 focus:ring-[#ffc400]/20 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500"
          />
          <button
            type="button"
            aria-label={
              showAccessPassword
                ? "Hide access password"
                : "Show access password"
            }
            onClick={() => setShowAccessPassword((current) => !current)}
            className="absolute right-4 top-1/2 grid size-5 -translate-y-1/2 place-items-center text-[#596176] transition hover:text-[#070b16] dark:text-zinc-400 dark:hover:text-white"
          >
            {showAccessPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </label>
        <button
          type="submit"
          disabled={isUnlockPending}
          className="mt-4 inline-flex h-[45px] w-full items-center justify-center gap-3 rounded-[6px] border border-[#111315] bg-[linear-gradient(180deg,#202124,#121315)] text-[13px] font-extrabold text-white shadow-[0_10px_24px_rgba(18,19,21,0.2)] transition hover:brightness-[1.08] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <LockKeyhole className="size-4" />
          {isUnlockPending ? "Checking..." : "View Marketplace"}
        </button>
        {accessState.error ? (
          <p className="mt-3 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {accessState.error}
          </p>
        ) : null}
      </form>

      <div className="mt-9 grid grid-cols-4 overflow-hidden">
        {features.map((feature, index) => {
          const Icon = feature.icon;

          return (
            <div
              key={feature.title}
              className={cn(
                "px-2 text-center",
                index > 0 && "border-l border-[#e2e6ef] dark:border-white/12",
              )}
            >
              <div className="mx-auto grid size-10 place-items-center rounded-full bg-[#fbe694]/38 text-[#cca137]">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-3 text-[11px] font-extrabold leading-tight text-[#070b16] dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-1 hidden text-[12px] leading-4 text-[#596176] dark:text-zinc-400 sm:block">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>

      <footer className="mt-10 border-t border-[#e2e6ef] pt-7 text-center dark:border-white/12">
        <p className="text-[12px] leading-5 text-[#596176] dark:text-zinc-400">
          © 2024 Piessang Marketplace. All rights reserved.
        </p>
        <PlatformSocialLinks
          className="mt-5 text-[#070b16] dark:text-white"
          links={socialLinks}
        />
      </footer>
    </div>
  );
}

export function ComingSoonScreen({
  socialLinks,
}: {
  socialLinks: PlatformSocialLinksType;
}) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-[#070b16] dark:bg-[#0f1114] lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(430px,1fr)]">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <ComingSoonVisual />
      <section className="grid min-h-[calc(100vh-430px)] min-w-0 place-items-center bg-white px-7 py-10 dark:bg-[#0f1114] sm:px-12 lg:min-h-screen lg:px-16">
        <ComingSoonPanel socialLinks={socialLinks} />
      </section>
    </main>
  );
}
