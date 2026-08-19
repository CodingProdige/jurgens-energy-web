"use client";

import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  marketplacePrimaryActionClass,
  marketplaceSecondaryActionClass,
} from "@/components/marketplace/action-styles";
import { cn } from "@/lib/utils";
import type {
  StorefrontButtonAction,
  StorefrontHeroSection,
  StorefrontTitleTag,
} from "@/src/modules/marketplace/storefront-types";

type HeroSettings = StorefrontHeroSection["settings"];
type HeroSlide = HeroSettings["slides"][number];

const heightClasses = {
  compact: "min-h-[280px] sm:min-h-[340px]",
  standard: "min-h-[340px] sm:min-h-[440px] lg:min-h-[520px]",
  tall: "min-h-[420px] sm:min-h-[540px] lg:min-h-[640px]",
} as const;

export function StorefrontHeroCampaign({ settings }: { settings: HeroSettings }) {
  const isCarousel = settings.layout === "carousel" && settings.slides.length > 1;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const slideCount = settings.slides.length;
  const activeSlide = settings.slides[activeIndex] ?? settings.slides[0];

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(query.matches);

    updateMotionPreference();
    query.addEventListener("change", updateMotionPreference);

    return () => query.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!isCarousel || !settings.autoplay || isPaused || reducedMotion) {
      return;
    }

    function pauseWhenHidden() {
      if (document.hidden) {
        setIsPaused(true);
      }
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slideCount);
    }, settings.autoplayInterval * 1000);
    document.addEventListener("visibilitychange", pauseWhenHidden);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
    };
  }, [isCarousel, isPaused, reducedMotion, settings.autoplay, settings.autoplayInterval, slideCount]);

  if (!activeSlide) {
    return null;
  }

  function showSlide(index: number) {
    setActiveIndex((index + slideCount) % slideCount);
    setIsPaused(true);
  }

  const showControls = isCarousel && settings.showControls;

  return (
    <section
      aria-roledescription={isCarousel ? "carousel" : undefined}
      aria-label={isCarousel ? "Featured campaigns" : undefined}
      className={cn(
        "relative isolate min-w-0 max-w-full overflow-hidden border-b border-[#ecece6] dark:border-white/10",
        settings.layout === "split"
          ? "bg-[radial-gradient(circle_at_72%_28%,rgba(255,90,31,0.09),transparent_30%),linear-gradient(110deg,#ffffff_0%,#ffffff_54%,#f4f4ef_100%)] dark:bg-[radial-gradient(circle_at_72%_28%,rgba(255,90,31,0.18),transparent_34%),linear-gradient(110deg,#101010_0%,#101010_54%,#1a1a1a_100%)]"
          : "bg-[#191919]",
        heightClasses[settings.height],
      )}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsPaused(false);
        }
      }}
      onFocusCapture={() => setIsPaused(true)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {settings.layout === "split" ? (
        <SplitHeroSlide slide={activeSlide} />
      ) : (
        <BannerHeroSlides activeIndex={activeIndex} settings={settings} />
      )}

      {showControls ? (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 px-4 pb-4 sm:px-8 sm:pb-6 lg:px-12">
          <div className="flex gap-1.5" role="tablist" aria-label="Select campaign">
            {settings.slides.map((slide, index) => (
              <button
                aria-label={`Show campaign ${index + 1}${slide.heading ? `: ${slide.heading}` : ""}`}
                aria-selected={index === activeIndex}
                className={cn(
                  "h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#101010]",
                  index === activeIndex ? "w-8 bg-[#ff5a1f]" : "w-3 bg-white/60 hover:bg-white",
                )}
                key={`${slide.desktopImageUrl}-${index}`}
                onClick={() => showSlide(index)}
                role="tab"
                type="button"
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {settings.autoplay ? (
              <button
                aria-label={isPaused ? "Resume automatic slide rotation" : "Pause automatic slide rotation"}
                className="grid size-9 place-items-center rounded-full border border-white/35 bg-black/25 text-white backdrop-blur transition hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                onClick={() => setIsPaused((value) => !value)}
                type="button"
              >
                {isPaused ? <PlayIcon className="size-4" /> : <PauseIcon className="size-4" />}
              </button>
            ) : null}
            <button
              aria-label="Previous campaign"
              className="grid size-9 place-items-center rounded-full border border-white/35 bg-black/25 text-white backdrop-blur transition hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={() => showSlide(activeIndex - 1)}
              type="button"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            <button
              aria-label="Next campaign"
              className="grid size-9 place-items-center rounded-full border border-white/35 bg-black/25 text-white backdrop-blur transition hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={() => showSlide(activeIndex + 1)}
              type="button"
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SplitHeroSlide({ slide }: { slide: HeroSlide }) {
  return (
    <div className="relative grid min-h-[inherit] min-w-0 max-w-full gap-5 px-4 py-5 sm:gap-8 sm:px-10 sm:py-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-16 lg:py-12">
      {slide.href ? (
        <HeroLink
          ariaLabel={slide.heading || "Open campaign"}
          className="absolute inset-0 z-0"
          href={slide.href}
        />
      ) : null}
      <HeroCopy
        className={cn(
          "relative z-10 min-w-0 max-w-[650px]",
          slide.href && "pointer-events-none",
        )}
        slide={slide}
        slideIndex={0}
      />
      <div
        className={cn(
          "relative z-10 aspect-[1672/941] min-w-0 max-w-full overflow-hidden lg:overflow-visible",
          slide.href && "pointer-events-none",
        )}
      >
        <HeroImage
          alt={slide.imageAlt}
          fit="contain"
          mobileSrc={slide.mobileImageUrl}
          priority
          src={slide.desktopImageUrl}
        />
      </div>
    </div>
  );
}

function BannerHeroSlides({ activeIndex, settings }: { activeIndex: number; settings: HeroSettings }) {
  return (
    <div className="relative min-h-[inherit]">
      {settings.slides.map((slide, index) => {
        const isActive = index === activeIndex;
        const contentPosition =
          slide.contentPosition === "center"
            ? "items-center text-center"
            : slide.contentPosition === "right"
              ? "items-end text-right"
              : "items-start text-left";

        return (
          <article
            aria-hidden={!isActive}
            aria-label={slide.heading || `Campaign ${index + 1}`}
            className={cn(
              "absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none",
              isActive ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0",
            )}
            key={`${slide.desktopImageUrl}-${index}`}
            role="group"
          >
            {slide.href ? (
              <HeroLink
                ariaLabel={slide.heading || `Open campaign ${index + 1}`}
                className="absolute inset-0 z-10"
                href={slide.href}
              />
            ) : null}
            <HeroImage
              alt={isActive ? slide.imageAlt : ""}
              className="absolute inset-0"
              fit={slide.imageFit}
              priority={index === 0}
              src={slide.desktopImageUrl}
              mobileSrc={slide.mobileImageUrl}
            />
            <div className={cn("absolute inset-0", overlayClass(slide.overlay))} />
            <div
              className={cn(
                "relative z-20 flex min-h-[inherit] px-5 py-10 sm:px-12 sm:py-14 lg:px-16",
                slide.href && "pointer-events-none",
                contentPosition,
              )}
            >
              <HeroCopy
                className={cn(
                  "w-full max-w-[650px] text-white",
                  slide.contentPosition === "center" && "mx-auto",
                  slide.contentPosition === "right" && "ml-auto",
                )}
                slide={slide}
                slideIndex={index}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function HeroCopy({ className, slide, slideIndex }: { className?: string; slide: HeroSlide; slideIndex: number }) {
  const Heading = (slide.headingTag === "h1" && slideIndex > 0 ? "h2" : slide.headingTag) as StorefrontTitleTag;

  return (
    <div className={cn("min-w-0 max-w-full", className)}>
      {slide.heading ? (
        <Heading
          className="max-w-full break-words font-black uppercase leading-[1.08] tracking-normal [overflow-wrap:anywhere]"
          style={{ fontSize: `clamp(2rem, 4vw, ${slide.headingSize}px)` }}
        >
          {renderAccentHeading(slide.heading, slide.accentText)}
        </Heading>
      ) : null}
      {slide.copy ? <p className="mt-5 max-w-[380px] break-words text-[16px] font-semibold leading-7 text-current/90 [overflow-wrap:anywhere]">{slide.copy}</p> : null}
      {slide.actions.length > 0 ? <HeroActionList actions={slide.actions} className="mt-7" /> : null}
    </div>
  );
}

function HeroImage({ alt, className, fit, mobileSrc, priority = false, src }: { alt: string; className?: string; fit: HeroSlide["imageFit"]; mobileSrc?: string; priority?: boolean; src: string }) {
  return (
    <picture className={cn("block size-full min-w-0 max-w-full", className)}>
      {mobileSrc ? <source media="(max-width: 639px)" srcSet={mobileSrc} /> : null}
      {/* The media library may return remote URLs, so this responsive source pair deliberately uses picture rather than Next Image. */}
      <img
        alt={alt}
        className={cn(
          "size-full",
          fit === "contain"
            ? "object-contain object-center drop-shadow-[0_26px_42px_rgba(8,8,8,0.22)]"
            : "object-cover object-center",
        )}
        fetchPriority={priority ? "high" : "auto"}
        loading={priority ? "eager" : "lazy"}
        src={src}
      />
    </picture>
  );
}

function HeroActionList({ actions, className }: { actions: StorefrontButtonAction[]; className?: string }) {
  return (
    <div className={cn("pointer-events-auto flex flex-wrap gap-3 sm:gap-4", className)}>
      {actions.map((action, index) => (
        <HeroLink
          className={cn(
            action.variant === "secondary" ? marketplaceSecondaryActionClass : marketplacePrimaryActionClass,
            "min-h-10 px-4 py-2 text-sm",
          )}
          href={action.href}
          key={`${action.label}-${action.href}-${index}`}
        >
          {action.label}
        </HeroLink>
      ))}
    </div>
  );
}

function HeroLink({ ariaLabel, children, className, href }: { ariaLabel?: string; children?: ReactNode; className?: string; href: string }) {
  const isExternal = href.startsWith("http://") || href.startsWith("https://");

  if (isExternal) {
    return <a aria-label={ariaLabel} className={className} href={href} rel="noopener noreferrer" target="_blank">{children}</a>;
  }

  return <Link aria-label={ariaLabel} className={className} href={href} prefetch={false}>{children}</Link>;
}

function overlayClass(overlay: HeroSlide["overlay"]) {
  if (overlay === "dark_center") {
    return "bg-[radial-gradient(ellipse_at_center,rgba(8,8,8,0.68)_0%,rgba(8,8,8,0.18)_70%)]";
  }

  if (overlay === "dark_left") {
    return "bg-[linear-gradient(90deg,rgba(8,8,8,0.78)_0%,rgba(8,8,8,0.5)_38%,rgba(8,8,8,0.08)_76%)]";
  }

  return "bg-transparent";
}

function renderAccentHeading(heading: string, accentText: string) {
  const accentWords = new Set(accentText.split("|").map((word) => word.trim().toLowerCase()).filter(Boolean));

  return heading.split(/(\s+)/).map((part, index) => {
    const normalized = part.replace(/[^a-z0-9]/gi, "").toLowerCase();

    return accentWords.has(normalized) ? <span className="text-[#ff5a1f]" key={`${part}-${index}`}>{part}</span> : part;
  });
}
