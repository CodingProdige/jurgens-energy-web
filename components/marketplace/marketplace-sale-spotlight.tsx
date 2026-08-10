"use client";

import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";
import {
  type CSSProperties,
  type FocusEvent,
  type TouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { MarketplaceCampaignIcon } from "@/components/marketplace/marketplace-campaign-icon";
import type { MarketplaceSaleCampaign } from "@/src/modules/marketplace/sales";
import {
  getReadableSaleCampaignForeground,
  normalizeSaleCampaignColor,
} from "@/src/modules/sales/campaign-presentation";

const campaignRotationIntervalMs = 7_000;
const maximumFeaturedCampaigns = 5;
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  const mediaQuery = window.matchMedia(reducedMotionQuery);

  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionQuery).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function getCampaignHeadline(campaign: MarketplaceSaleCampaign) {
  return campaign.publicHeadline?.trim() || campaign.name;
}

function getCampaignBadge(campaign: MarketplaceSaleCampaign) {
  if (campaign.badgeText?.trim()) {
    return campaign.badgeText.trim();
  }

  const discountPercent = Number(campaign.discountPercent);

  return `${Number.isFinite(discountPercent) ? discountPercent : campaign.discountPercent}% off`;
}

type MarketplaceSaleSpotlightProps = {
  campaigns: readonly MarketplaceSaleCampaign[];
};

export function MarketplaceSaleSpotlight({
  campaigns,
}: MarketplaceSaleSpotlightProps) {
  const featuredCampaigns = useMemo(
    () =>
      [...campaigns]
        .filter((campaign) => campaign.headerVisible)
        .sort(
          (left, right) =>
            right.headerPriority - left.headerPriority ||
            left.name.localeCompare(right.name),
        )
        .slice(0, maximumFeaturedCampaigns),
    [campaigns],
  );
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const campaignCount = featuredCampaigns.length;
  const currentIndex = campaignCount > 0 ? activeIndex % campaignCount : 0;
  const campaign = featuredCampaigns[currentIndex];
  const rotationPaused =
    prefersReducedMotion || isHovered || isFocused || isManuallyPaused;

  useEffect(() => {
    if (campaignCount < 2 || rotationPaused) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % campaignCount);
    }, campaignRotationIntervalMs);

    return () => window.clearInterval(interval);
  }, [campaignCount, rotationPaused]);

  if (!campaign) {
    return (
      <p className="hidden min-w-0 text-[11px] font-bold uppercase tracking-[0.16em] text-[#5c5c57] dark:text-[#c8c8c0] md:block">
        South African online store · Nationwide delivery across South Africa.
      </p>
    );
  }

  const backgroundColor = normalizeSaleCampaignColor(campaign.badgeColor);
  const foregroundColor = getReadableSaleCampaignForeground(backgroundColor);
  const themedStyle = {
    "--campaign-foreground": foregroundColor,
    backgroundColor,
    color: foregroundColor,
  } as CSSProperties;

  function showPreviousCampaign() {
    setActiveIndex((index) =>
      (index - 1 + campaignCount) % campaignCount,
    );
  }

  function showNextCampaign() {
    setActiveIndex((index) => (index + 1) % campaignCount);
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsFocused(false);
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    if (touchStartX.current === null) {
      return;
    }

    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const distance = endX - touchStartX.current;

    touchStartX.current = null;

    if (Math.abs(distance) < 35 || campaignCount < 2) {
      return;
    }

    if (distance > 0) {
      showPreviousCampaign();
    } else {
      showNextCampaign();
    }
  }

  return (
    <section
      aria-label="Featured sales"
      aria-roledescription="carousel"
      className="flex h-8 min-w-0 flex-1 touch-pan-y items-center overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5"
      onBlurCapture={handleBlur}
      onFocusCapture={() => setIsFocused(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      style={themedStyle}
    >
      {campaignCount > 1 ? (
        <button
          aria-label="Show previous sale"
          className="grid size-8 shrink-0 place-items-center border-r border-current/20 transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current"
          onClick={showPreviousCampaign}
          type="button"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}

      <Link
        aria-label={`${getCampaignHeadline(campaign)}. ${getCampaignBadge(campaign)}. ${campaign.ctaLabel || "Shop sale"}.`}
        aria-live={rotationPaused ? "polite" : "off"}
        className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current"
        href={campaign.href}
        prefetch={false}
      >
        <span
          aria-label={`${currentIndex + 1} of ${campaignCount}`}
          aria-roledescription="slide"
          className="flex min-w-0 items-center justify-center gap-2"
          role="group"
        >
          <MarketplaceCampaignIcon
            aria-hidden="true"
            className="size-3.5 shrink-0"
            name={campaign.badgeIcon}
          />
          <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.08em] sm:text-[11px]">
            {getCampaignHeadline(campaign)}
          </span>
          <span className="hidden shrink-0 rounded-full border border-current/30 px-2 py-0.5 text-[9px] font-black uppercase lg:inline-flex">
            {getCampaignBadge(campaign)}
          </span>
          <span className="hidden shrink-0 text-[9px] font-bold opacity-75 xl:inline">
            {campaign.productCount} product
            {campaign.productCount === 1 ? "" : "s"}
          </span>
          <span className="hidden shrink-0 text-[9px] font-black uppercase underline decoration-current/50 underline-offset-2 sm:inline">
            {campaign.ctaLabel?.trim() || "Shop sale"} →
          </span>
        </span>
      </Link>

      {campaignCount > 1 ? (
        <>
          <span
            aria-hidden="true"
            className="hidden shrink-0 text-[9px] font-black tabular-nums opacity-75 sm:inline"
          >
            {currentIndex + 1}/{campaignCount}
          </span>
          {!prefersReducedMotion ? (
            <button
              aria-label={
                isManuallyPaused
                  ? "Resume sale rotation"
                  : "Pause sale rotation"
              }
              aria-pressed={isManuallyPaused}
              className="hidden size-8 shrink-0 place-items-center transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current sm:grid"
              onClick={() => setIsManuallyPaused((paused) => !paused)}
              type="button"
            >
              {isManuallyPaused ? (
                <PlayIcon aria-hidden="true" className="size-3" />
              ) : (
                <PauseIcon aria-hidden="true" className="size-3" />
              )}
            </button>
          ) : null}
          <button
            aria-label="Show next sale"
            className="grid size-8 shrink-0 place-items-center border-l border-current/20 transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current"
            onClick={showNextCampaign}
            type="button"
          >
            <ChevronRightIcon aria-hidden="true" className="size-3.5" />
          </button>
        </>
      ) : null}
    </section>
  );
}
