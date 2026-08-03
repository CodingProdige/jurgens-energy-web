"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type StorefrontCarouselProps = {
  children: ReactNode;
  className?: string;
  label?: string;
  trackClassName: string;
};

type ScrollState = {
  hasOverflow: boolean;
  next: boolean;
  previous: boolean;
};

const initialScrollState: ScrollState = {
  hasOverflow: false,
  next: false,
  previous: false,
};

export function StorefrontCarousel({
  children,
  className,
  label = "Storefront carousel",
  trackClassName,
}: StorefrontCarouselProps) {
  const trackId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState(initialScrollState);

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const maxScrollLeft = track.scrollWidth - track.clientWidth;

    setScrollState({
      hasOverflow: maxScrollLeft > 4,
      next: track.scrollLeft < maxScrollLeft - 4,
      previous: track.scrollLeft > 4,
    });
  }, []);

  useEffect(() => {
    updateScrollState();

    const track = trackRef.current;

    if (!track) {
      return;
    }

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateScrollState);

    resizeObserver?.observe(track);
    track.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      resizeObserver?.disconnect();
      track.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [children, updateScrollState]);

  function scrollByPage(direction: -1 | 1) {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    track.scrollBy({
      behavior: "smooth",
      left: direction * Math.max(track.clientWidth * 0.82, 260),
    });

    window.setTimeout(updateScrollState, 260);
  }

  const showControls = scrollState.hasOverflow;

  return (
    <div className={cn("relative", className)}>
      <div
        aria-label={label}
        className={trackClassName}
        id={trackId}
        ref={trackRef}
        role="group"
      >
        {children}
      </div>

      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 hidden w-12 bg-gradient-to-r from-white via-white/88 to-transparent dark:from-[#080808] dark:via-[#080808]/88 lg:block",
          (!showControls || !scrollState.previous) && "opacity-0",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 hidden w-12 bg-gradient-to-l from-white via-white/88 to-transparent dark:from-[#080808] dark:via-[#080808]/88 lg:block",
          (!showControls || !scrollState.next) && "opacity-0",
        )}
      />

      <button
        aria-controls={trackId}
        aria-label="Previous items"
        className={cn(
          "absolute left-1 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-[#e8e8e2] bg-white text-[#080808] shadow-[0_10px_28px_rgba(8,8,8,0.16)] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/25 dark:border-white/15 dark:bg-[#151515] dark:text-[#f7f7f2] lg:grid",
          (!showControls || !scrollState.previous) &&
            "pointer-events-none opacity-0",
        )}
        onClick={() => scrollByPage(-1)}
        type="button"
      >
        <ChevronLeftIcon className="size-5" />
      </button>
      <button
        aria-controls={trackId}
        aria-label="Next items"
        className={cn(
          "absolute right-1 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-[#e8e8e2] bg-white text-[#080808] shadow-[0_10px_28px_rgba(8,8,8,0.16)] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/25 dark:border-white/15 dark:bg-[#151515] dark:text-[#f7f7f2] lg:grid",
          (!showControls || !scrollState.next) &&
            "pointer-events-none opacity-0",
        )}
        onClick={() => scrollByPage(1)}
        type="button"
      >
        <ChevronRightIcon className="size-5" />
      </button>
    </div>
  );
}
