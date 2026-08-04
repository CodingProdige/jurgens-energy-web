"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { trackCustomGoogleEvent } from "@/src/modules/analytics/google";
import { PRODUCT_CARD_VIDEO_ANALYTICS_DELAY_MS } from "@/src/modules/marketplace/product-card-video-preview";

type ProductCardVideoPreviewData = {
  durationMs: number | null;
  posterUrl: string | null;
  url: string;
};

type ProductCardVideoAnalytics = {
  brandName: string | null;
  categoryName: string | null;
  productId: string;
  productName: string;
};

type ProductCardVideoPreviewProps = {
  analytics: ProductCardVideoAnalytics;
  children: ReactNode;
  preview: ProductCardVideoPreviewData;
};

type PlaybackIntent = "manual";
type PlaybackStatus = "error" | "idle" | "loading" | "paused" | "playing";

type ActiveProductCardVideoPreview = {
  stop: () => void;
  token: symbol;
};

let activeProductCardVideoPreview: ActiveProductCardVideoPreview | null = null;
const trackedProductVideoPreviewIds = new Set<string>();

export function ProductCardVideoPreview({
  analytics,
  children,
  preview,
}: ProductCardVideoPreviewProps) {
  const [playbackStatus, setPlaybackStatus] =
    useState<PlaybackStatus>("idle");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analyticsDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackAttemptRef = useRef(0);
  const playbackIntentRef = useRef<PlaybackIntent | null>(null);
  const sourceAttachedRef = useRef(false);
  const hasErroredRef = useRef(false);
  const isMountedRef = useRef(false);
  const previewTokenRef = useRef(Symbol("product-card-video-preview"));

  const clearAnalyticsDelay = useCallback(() => {
    if (!analyticsDelayRef.current) {
      return;
    }

    clearTimeout(analyticsDelayRef.current);
    analyticsDelayRef.current = null;
  }, []);

  const releaseActivePreview = useCallback(() => {
    if (activeProductCardVideoPreview?.token === previewTokenRef.current) {
      activeProductCardVideoPreview = null;
    }
  }, []);

  const pausePlayback = useCallback(
    (nextStatus: PlaybackStatus = "paused") => {
      clearAnalyticsDelay();
      playbackAttemptRef.current += 1;
      playbackIntentRef.current = null;
      videoRef.current?.pause();
      releaseActivePreview();

      if (isMountedRef.current) {
        setPlaybackStatus(nextStatus);
      }
    },
    [clearAnalyticsDelay, releaseActivePreview],
  );

  const startPlayback = useCallback(() => {
    const video = videoRef.current;

    if (hasErroredRef.current || !video || document.hidden) {
      return;
    }

    if (
      activeProductCardVideoPreview &&
      activeProductCardVideoPreview.token !== previewTokenRef.current
    ) {
      const previousPreview = activeProductCardVideoPreview;
      activeProductCardVideoPreview = null;
      previousPreview.stop();
    }

    activeProductCardVideoPreview = {
      stop: () => pausePlayback("idle"),
      token: previewTokenRef.current,
    };
    playbackIntentRef.current = "manual";

    if (!sourceAttachedRef.current) {
      video.src = preview.url;
      sourceAttachedRef.current = true;
      video.load();
    }

    if (isMountedRef.current) {
      setPlaybackStatus("loading");
    }

    const attempt = playbackAttemptRef.current + 1;
    playbackAttemptRef.current = attempt;

    try {
      const playRequest = video.play();

      void playRequest?.catch(() => {
        if (
          playbackAttemptRef.current === attempt &&
          playbackIntentRef.current === "manual"
        ) {
          pausePlayback("idle");
        }
      });
    } catch {
      pausePlayback("idle");
    }
  }, [pausePlayback, preview.url]);

  const trackGenuinePlayback = useCallback(
    (intent: PlaybackIntent) => {
      if (
        window.jurgensGoogleConsent?.analytics !== "granted" ||
        trackedProductVideoPreviewIds.has(analytics.productId)
      ) {
        return;
      }

      trackedProductVideoPreviewIds.add(analytics.productId);
      trackCustomGoogleEvent("product_video_preview_start", {
        interaction_type: intent,
        item_brand: analytics.brandName ?? undefined,
        item_category: analytics.categoryName ?? undefined,
        item_id: analytics.productId,
        item_list_id: window.location.pathname,
        item_name: analytics.productName,
        video_duration_ms: preview.durationMs ?? undefined,
      });
    },
    [analytics, preview.durationMs],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearAnalyticsDelay();
      playbackAttemptRef.current += 1;
      playbackIntentRef.current = null;
      videoRef.current?.pause();
      releaseActivePreview();
    };
  }, [clearAnalyticsDelay, releaseActivePreview]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && playbackIntentRef.current) {
        pausePlayback("paused");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [pausePlayback]);

  function handleControlClick(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const video = videoRef.current;
    const playbackRequested = playbackIntentRef.current !== null;

    if (playbackRequested || (video && !video.paused)) {
      pausePlayback("paused");
      return;
    }

    startPlayback();
  }

  function handlePlaying() {
    const intent = playbackIntentRef.current;

    if (!intent) {
      videoRef.current?.pause();
      return;
    }

    setPlaybackStatus("playing");
    clearAnalyticsDelay();
    analyticsDelayRef.current = setTimeout(() => {
      analyticsDelayRef.current = null;

      const video = videoRef.current;
      const currentIntent = playbackIntentRef.current;

      if (
        !video ||
        !currentIntent ||
        video.paused ||
        video.ended ||
        video.seeking ||
        video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
      ) {
        return;
      }

      trackGenuinePlayback(currentIntent);
    }, PRODUCT_CARD_VIDEO_ANALYTICS_DELAY_MS);
  }

  function handlePlaybackInterruption() {
    clearAnalyticsDelay();
  }

  function handleVideoError() {
    if (hasErroredRef.current) {
      return;
    }

    hasErroredRef.current = true;
    pausePlayback("error");
  }

  const isPlaybackRequested =
    playbackStatus === "loading" || playbackStatus === "playing";
  const previewUnavailable = playbackStatus === "error";

  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-product-card-video-preview=""
      ref={containerRef}
    >
      <div className="absolute inset-0">{children}</div>

      {!previewUnavailable ? (
        <>
          <video
            aria-hidden="true"
            className={cn(
              "marketplace-product-card-media absolute inset-0 size-full bg-[#f7f7f2] object-cover opacity-0 dark:bg-[#1a1a1a]",
              playbackStatus === "playing" && "opacity-100",
            )}
            disablePictureInPicture
            disableRemotePlayback
            loop
            muted
            onEmptied={handlePlaybackInterruption}
            onEnded={handlePlaybackInterruption}
            onError={handleVideoError}
            onPause={handlePlaybackInterruption}
            onPlaying={handlePlaying}
            onSeeking={handlePlaybackInterruption}
            onStalled={handlePlaybackInterruption}
            onWaiting={handlePlaybackInterruption}
            playsInline
            preload="metadata"
            ref={videoRef}
            tabIndex={-1}
          />

          <button
            aria-label={`${isPlaybackRequested ? "Pause" : "Play"} video preview for ${analytics.productName}`}
            aria-pressed={isPlaybackRequested}
            className="pointer-events-auto absolute bottom-1.5 left-1.5 z-[3] grid size-6 place-items-center rounded-full bg-[#080808]/78 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-[#080808] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] focus-visible:ring-offset-2 sm:bottom-2 sm:left-2 sm:size-7"
            onClick={handleControlClick}
            title={`${isPlaybackRequested ? "Pause" : "Play"} video preview`}
            type="button"
          >
            {isPlaybackRequested ? (
              <PauseIcon
                aria-hidden="true"
                className="size-3 fill-current sm:size-3.5"
              />
            ) : (
              <PlayIcon
                aria-hidden="true"
                className="ml-0.5 size-3 fill-current sm:size-3.5"
              />
            )}
          </button>
        </>
      ) : null}
    </div>
  );
}
