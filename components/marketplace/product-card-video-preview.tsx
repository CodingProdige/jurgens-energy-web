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
import {
  PRODUCT_CARD_VIDEO_ANALYTICS_DELAY_MS,
  PRODUCT_CARD_VIDEO_HOVER_DELAY_MS,
  canAutoplayProductCardVideo,
  isPointerInsideProductCardVideo,
} from "@/src/modules/marketplace/product-card-video-preview";

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

type PlaybackIntent = "hover" | "touch";
type PlaybackStatus = "error" | "idle" | "loading" | "paused" | "playing";

type BrowserNetworkConnection = EventTarget & {
  effectiveType?: string;
  saveData?: boolean;
};

type ActiveProductCardVideoPreview = {
  stop: () => void;
  token: symbol;
};

let activeProductCardVideoPreview: ActiveProductCardVideoPreview | null = null;
const trackedProductVideoPreviewIds = new Set<string>();

function getBrowserNetworkConnection() {
  return (
    navigator as Navigator & {
      connection?: BrowserNetworkConnection;
      mozConnection?: BrowserNetworkConnection;
      webkitConnection?: BrowserNetworkConnection;
    }
  ).connection ??
    (
      navigator as Navigator & {
        mozConnection?: BrowserNetworkConnection;
      }
    ).mozConnection ??
    (
      navigator as Navigator & {
        webkitConnection?: BrowserNetworkConnection;
      }
    ).webkitConnection ??
    null;
}

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
  const hoverDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackAttemptRef = useRef(0);
  const playbackIntentRef = useRef<PlaybackIntent | null>(null);
  const sourceAttachedRef = useRef(false);
  const hasErroredRef = useRef(false);
  const isMountedRef = useRef(false);
  const previewTokenRef = useRef(Symbol("product-card-video-preview"));

  const clearHoverDelay = useCallback(() => {
    if (!hoverDelayRef.current) {
      return;
    }

    clearTimeout(hoverDelayRef.current);
    hoverDelayRef.current = null;
  }, []);

  const clearAnalyticsDelay = useCallback(() => {
    if (!analyticsDelayRef.current) {
      return;
    }

    clearTimeout(analyticsDelayRef.current);
    analyticsDelayRef.current = null;
  }, []);

  const releaseActivePreview = useCallback(() => {
    if (
      activeProductCardVideoPreview?.token === previewTokenRef.current
    ) {
      activeProductCardVideoPreview = null;
    }
  }, []);

  const stopAndUnload = useCallback(() => {
    clearAnalyticsDelay();
    clearHoverDelay();
    playbackAttemptRef.current += 1;
    playbackIntentRef.current = null;

    const video = videoRef.current;

    if (video) {
      video.pause();

      if (sourceAttachedRef.current) {
        try {
          video.currentTime = 0;
        } catch {
          // Some browsers reject seeking while metadata is still loading.
        }

        video.removeAttribute("src");
        video.load();
      }
    }

    sourceAttachedRef.current = false;
    releaseActivePreview();

    if (isMountedRef.current) {
      setPlaybackStatus("idle");
    }
  }, [clearAnalyticsDelay, clearHoverDelay, releaseActivePreview]);

  const pauseExplicitPlayback = useCallback(() => {
    clearAnalyticsDelay();
    clearHoverDelay();
    playbackAttemptRef.current += 1;
    playbackIntentRef.current = null;
    videoRef.current?.pause();
    releaseActivePreview();

    if (isMountedRef.current) {
      setPlaybackStatus("paused");
    }
  }, [clearAnalyticsDelay, clearHoverDelay, releaseActivePreview]);

  const startPlayback = useCallback(
    (intent: PlaybackIntent) => {
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
        stop: stopAndUnload,
        token: previewTokenRef.current,
      };
      playbackIntentRef.current = intent;

      if (!sourceAttachedRef.current) {
        video.src = preview.url;
        sourceAttachedRef.current = true;
        video.load();
      } else if (intent === "hover") {
        try {
          video.currentTime = 0;
        } catch {
          // A touch preview can be paused before its metadata has loaded.
        }
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
            playbackIntentRef.current === intent
          ) {
            stopAndUnload();
          }
        });
      } catch {
        stopAndUnload();
      }
    },
    [preview.url, stopAndUnload],
  );

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
      stopAndUnload();
    };
  }, [stopAndUnload]);

  useEffect(() => {
    const container = containerRef.current;
    const article = container?.closest<HTMLElement>("article");

    if (!container || !article) {
      return;
    }

    const fineHoverQuery = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    );
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const connection = getBrowserNetworkConnection();
    let isInsidePreview = false;
    let isPreviewInAutoplayBand =
      typeof IntersectionObserver === "undefined";
    let hoverAutoplayAllowed = false;

    const stopHoverPlayback = () => {
      clearHoverDelay();

      if (playbackIntentRef.current === "hover") {
        stopAndUnload();
      }
    };

    const updateHoverAutoplayEligibility = () => {
      hoverAutoplayAllowed = canAutoplayProductCardVideo({
        effectiveConnectionType:
          connection?.effectiveType?.toLowerCase() ?? null,
        prefersReducedMotion: reducedMotionQuery.matches,
        saveData: connection?.saveData === true,
        supportsFineHover: fineHoverQuery.matches,
      });

      if (!hoverAutoplayAllowed) {
        isInsidePreview = false;
        stopHoverPlayback();
      }
    };

    const scheduleHoverPlayback = () => {
      if (
        !hoverAutoplayAllowed ||
        !isPreviewInAutoplayBand ||
        hasErroredRef.current ||
        playbackIntentRef.current === "touch" ||
        hoverDelayRef.current
      ) {
        return;
      }

      hoverDelayRef.current = setTimeout(() => {
        hoverDelayRef.current = null;

        if (
          isInsidePreview &&
          hoverAutoplayAllowed &&
          isPreviewInAutoplayBand
        ) {
          startPlayback("hover");
        }
      }, PRODUCT_CARD_VIDEO_HOVER_DELAY_MS);
    };

    const autoplayBandObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              isPreviewInAutoplayBand = Boolean(entry?.isIntersecting);

              if (!isPreviewInAutoplayBand) {
                stopHoverPlayback();
                return;
              }

              if (isInsidePreview) {
                scheduleHoverPlayback();
              }
            },
            {
              rootMargin: "-35% 0px -35% 0px",
            },
          );

    const evaluatePointerPosition = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return;
      }

      const isNowInsidePreview = isPointerInsideProductCardVideo(
        event,
        container.getBoundingClientRect(),
      );

      if (isNowInsidePreview === isInsidePreview) {
        return;
      }

      isInsidePreview = isNowInsidePreview;

      if (isInsidePreview) {
        scheduleHoverPlayback();
      } else {
        stopHoverPlayback();
      }
    };

    const handlePointerLeave = () => {
      isInsidePreview = false;
      stopHoverPlayback();
    };

    updateHoverAutoplayEligibility();
    article.addEventListener("pointerenter", evaluatePointerPosition);
    article.addEventListener("pointermove", evaluatePointerPosition);
    article.addEventListener("pointerleave", handlePointerLeave);
    autoplayBandObserver?.observe(container);
    fineHoverQuery.addEventListener("change", updateHoverAutoplayEligibility);
    reducedMotionQuery.addEventListener(
      "change",
      updateHoverAutoplayEligibility,
    );
    connection?.addEventListener("change", updateHoverAutoplayEligibility);

    return () => {
      clearHoverDelay();
      article.removeEventListener("pointerenter", evaluatePointerPosition);
      article.removeEventListener("pointermove", evaluatePointerPosition);
      article.removeEventListener("pointerleave", handlePointerLeave);
      autoplayBandObserver?.disconnect();
      fineHoverQuery.removeEventListener(
        "change",
        updateHoverAutoplayEligibility,
      );
      reducedMotionQuery.removeEventListener(
        "change",
        updateHoverAutoplayEligibility,
      );
      connection?.removeEventListener(
        "change",
        updateHoverAutoplayEligibility,
      );
    };
  }, [clearHoverDelay, startPlayback, stopAndUnload]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAndUnload();
      }
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            if (entry && !entry.isIntersecting) {
              stopAndUnload();
            }
          });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    observer?.observe(container);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      observer?.disconnect();
    };
  }, [stopAndUnload]);

  function handleTouchControlClick(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const video = videoRef.current;
    const playbackRequested = playbackIntentRef.current !== null;

    if (playbackRequested || (video && !video.paused)) {
      pauseExplicitPlayback();
      return;
    }

    startPlayback("touch");
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
    stopAndUnload();

    if (isMountedRef.current) {
      setPlaybackStatus("error");
    }
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
              "marketplace-product-card-media absolute inset-0 size-full bg-[#f7f7f2] object-cover opacity-0 transition-opacity duration-200 motion-reduce:transition-none dark:bg-[#1a1a1a]",
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
            preload="none"
            ref={videoRef}
            tabIndex={-1}
          />

          <button
            aria-label={`${isPlaybackRequested ? "Pause" : "Play"} video preview for ${analytics.productName}`}
            aria-pressed={isPlaybackRequested}
            className="pointer-events-auto absolute bottom-1.5 left-1.5 z-[3] grid size-6 place-items-center rounded-full bg-[#080808]/78 text-white shadow-md backdrop-blur-sm transition hover:bg-[#080808] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] focus-visible:ring-offset-2 sm:bottom-2 sm:left-2 sm:size-7"
            onClick={handleTouchControlClick}
            title={`${isPlaybackRequested ? "Pause" : "Play"} video preview`}
            type="button"
          >
            {isPlaybackRequested ? (
              <PauseIcon aria-hidden="true" className="size-3 fill-current sm:size-3.5" />
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
