"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type StorefrontCarouselProps = {
  children: ReactNode;
  className?: string;
  label?: string;
  trackClassName: string;
};

export function StorefrontCarousel({
  children,
  className,
  label = "Storefront carousel",
  trackClassName,
}: StorefrontCarouselProps) {
  const trackId = useId();
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByPage(direction: -1 | 1) {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    track.scrollBy({
      behavior: "smooth",
      left: direction * Math.max(track.clientWidth * 0.82, 260),
    });
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        aria-label={label}
        className={trackClassName}
        id={trackId}
        ref={trackRef}
        role="group"
      >
        {children}
      </div>

      <button
        aria-controls={trackId}
        aria-label="Previous items"
        className="absolute left-2 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-[#e8e8e2] bg-white text-[#080808] shadow-[0_10px_28px_rgba(8,8,8,0.16)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/25 dark:border-white/15 dark:bg-[#151515] dark:text-[#f7f7f2] md:grid"
        onClick={() => scrollByPage(-1)}
        type="button"
      >
        <ChevronLeftIcon className="size-5" />
      </button>
      <button
        aria-controls={trackId}
        aria-label="Next items"
        className="absolute right-2 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-[#e8e8e2] bg-white text-[#080808] shadow-[0_10px_28px_rgba(8,8,8,0.16)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/25 dark:border-white/15 dark:bg-[#151515] dark:text-[#f7f7f2] md:grid"
        onClick={() => scrollByPage(1)}
        type="button"
      >
        <ChevronRightIcon className="size-5" />
      </button>
    </div>
  );
}
