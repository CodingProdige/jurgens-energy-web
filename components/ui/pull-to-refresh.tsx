"use client";

import {
  ArrowDownIcon,
  RefreshCwIcon,
  WifiOffIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import {
  getPullGestureIntent,
  getResistedPullDistance,
  isPullToRefreshArmed,
  PULL_TO_REFRESH_HOLD_PX,
  PULL_TO_REFRESH_MAX_VISUAL_PX,
} from "@/src/modules/navigation/pull-to-refresh";

type PullPhase =
  | "armed"
  | "idle"
  | "offline"
  | "pulling"
  | "refreshing";

type ActiveGesture = {
  engaged: boolean;
  rawDistance: number;
  startX: number;
  startY: number;
  tracking: boolean;
};

const initialGesture: ActiveGesture = {
  engaged: false,
  rawDistance: 0,
  startX: 0,
  startY: 0,
  tracking: false,
};

const ignoredTargetSelector = [
  '[data-pull-to-refresh="ignore"]',
  '[data-slot="dialog-content"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="popover-content"]',
  '[data-slot="select-content"]',
  "input",
  "textarea",
  "select",
  "option",
  "button",
  "iframe",
  "video",
  "audio",
  '[contenteditable]:not([contenteditable="false"])',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="slider"]',
].join(",");

const openOverlaySelector = [
  '[data-slot="dialog-content"][data-open]',
  '[data-slot="dropdown-menu-content"][data-open]',
  '[data-slot="popover-content"][data-open]',
  '[data-slot="select-content"][data-open]',
  'dialog[open]',
  '[aria-modal="true"]',
].join(",");

function isDocumentAtTop() {
  const scrollTop = document.scrollingElement?.scrollTop ?? window.scrollY;
  return scrollTop <= 1;
}

function isBodyScrollLocked() {
  const overflowY = window.getComputedStyle(document.body).overflowY;
  return overflowY === "hidden" || overflowY === "clip";
}

function hasScrolledNestedVerticalScroller(event: TouchEvent) {
  const scrollingElement = document.scrollingElement;

  for (const target of event.composedPath()) {
    if (
      !(target instanceof HTMLElement) ||
      target === document.body ||
      target === document.documentElement ||
      target === scrollingElement
    ) {
      continue;
    }

    const { overflowY } = window.getComputedStyle(target);
    const canScrollVertically =
      /^(auto|overlay|scroll)$/.test(overflowY) &&
      target.scrollHeight > target.clientHeight + 1;

    if (canScrollVertically && target.scrollTop > 1) {
      return true;
    }
  }

  return false;
}

function isGestureTargetAllowed(event: TouchEvent) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest(ignoredTargetSelector)) {
    return false;
  }

  if (document.querySelector(openOverlaySelector)) {
    return false;
  }

  if (isBodyScrollLocked() || hasScrolledNestedVerticalScroller(event)) {
    return false;
  }

  const selection = window.getSelection();
  return !selection || selection.isCollapsed;
}

function getVisibleLabel(phase: PullPhase) {
  switch (phase) {
    case "armed":
      return "Release to refresh";
    case "offline":
      return "You’re offline";
    case "refreshing":
      return "Refreshing…";
    default:
      return "Pull to refresh";
  }
}

function getAnnouncement(phase: PullPhase) {
  switch (phase) {
    case "armed":
      return "Release to refresh this page.";
    case "offline":
      return "You are offline. The page was not refreshed.";
    case "refreshing":
      return "Refreshing this page.";
    default:
      return "";
  }
}

export function PullToRefresh() {
  const [phase, setPhase] = useState<PullPhase>("idle");
  const [pullDistance, setPullDistance] = useState(0);
  const phaseRef = useRef<PullPhase>("idle");
  const gestureRef = useRef<ActiveGesture>({ ...initialGesture });
  const isRefreshingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const pendingDistanceRef = useRef(0);
  const reloadFrameRef = useRef<number | null>(null);
  const reloadCommitFrameRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  const updatePhase = useCallback((nextPhase: PullPhase) => {
    if (phaseRef.current === nextPhase) {
      return;
    }

    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const cancelAnimationFrame = useCallback(() => {
    if (animationFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  const updatePullDistance = useCallback((nextDistance: number) => {
    pendingDistanceRef.current = nextDistance;

    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      setPullDistance(pendingDistanceRef.current);
    });
  }, []);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const cancelReloadFrames = useCallback(() => {
    if (reloadFrameRef.current !== null) {
      window.cancelAnimationFrame(reloadFrameRef.current);
      reloadFrameRef.current = null;
    }

    if (reloadCommitFrameRef.current !== null) {
      window.cancelAnimationFrame(reloadCommitFrameRef.current);
      reloadCommitFrameRef.current = null;
    }
  }, []);

  const returnToIdle = useCallback(() => {
    cancelAnimationFrame();
    cancelReloadFrames();
    clearSettleTimer();
    gestureRef.current = { ...initialGesture };
    isRefreshingRef.current = false;
    pendingDistanceRef.current = 0;
    setPullDistance(0);
    updatePhase("idle");
  }, [
    cancelAnimationFrame,
    cancelReloadFrames,
    clearSettleTimer,
    updatePhase,
  ]);

  const settleAfterMessage = useCallback(
    (delay: number) => {
      clearSettleTimer();
      settleTimerRef.current = window.setTimeout(returnToIdle, delay);
    },
    [clearSettleTimer, returnToIdle],
  );

  const refresh = useCallback(() => {
    if (
      isRefreshingRef.current ||
      phaseRef.current === "offline"
    ) {
      return;
    }

    cancelAnimationFrame();
    gestureRef.current = { ...initialGesture };
    pendingDistanceRef.current = PULL_TO_REFRESH_HOLD_PX;
    setPullDistance(PULL_TO_REFRESH_HOLD_PX);

    if (!navigator.onLine) {
      updatePhase("offline");
      settleAfterMessage(1_600);
      return;
    }

    isRefreshingRef.current = true;
    updatePhase("refreshing");

    reloadFrameRef.current = window.requestAnimationFrame(() => {
      reloadFrameRef.current = null;
      reloadCommitFrameRef.current = window.requestAnimationFrame(() => {
        reloadCommitFrameRef.current = null;
        window.location.reload();
      });
    });
  }, [
    cancelAnimationFrame,
    settleAfterMessage,
    updatePhase,
  ]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-pull-to-refresh-enabled",
      "true",
    );

    return () => {
      document.documentElement.removeAttribute(
        "data-pull-to-refresh-enabled",
      );
    };
  }, []);

  useEffect(() => {
    let activeTouchListenersAttached = false;

    const detachActiveTouchListeners = () => {
      if (!activeTouchListenersAttached) {
        return;
      }

      activeTouchListenersAttached = false;
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchCancel);
    };

    const resetTrackedGesture = () => {
      detachActiveTouchListeners();
      cancelAnimationFrame();
      gestureRef.current = { ...initialGesture };
      pendingDistanceRef.current = 0;
      setPullDistance(0);

      if (!isRefreshingRef.current) {
        updatePhase("idle");
      }
    };

    function handleTouchStart(event: TouchEvent) {
      if (gestureRef.current.tracking) {
        resetTrackedGesture();
      }

      if (
        isRefreshingRef.current ||
        phaseRef.current !== "idle" ||
        event.touches.length !== 1 ||
        !isDocumentAtTop() ||
        !isGestureTargetAllowed(event)
      ) {
        return;
      }

      const touch = event.touches[0];
      gestureRef.current = {
        engaged: false,
        rawDistance: 0,
        startX: touch.clientX,
        startY: touch.clientY,
        tracking: true,
      };

      activeTouchListenersAttached = true;
      document.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleTouchEnd, { passive: true });
      document.addEventListener("touchcancel", handleTouchCancel, {
        passive: true,
      });
    }

    function handleTouchMove(event: TouchEvent) {
      const gesture = gestureRef.current;

      if (!gesture.tracking) {
        return;
      }

      if (event.touches.length !== 1 || (!gesture.engaged && !isDocumentAtTop())) {
        resetTrackedGesture();
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;
      const intent = getPullGestureIntent({ deltaX, deltaY });

      if (intent === "pending") {
        return;
      }

      if (intent === "cancel") {
        resetTrackedGesture();
        return;
      }

      gesture.engaged = true;
      gesture.rawDistance = deltaY;

      if (event.cancelable) {
        event.preventDefault();
      }

      updatePullDistance(getResistedPullDistance(deltaY));
      updatePhase(isPullToRefreshArmed(deltaY) ? "armed" : "pulling");
    }

    function handleTouchEnd(event: TouchEvent) {
      const gesture = gestureRef.current;

      if (!gesture.tracking) {
        return;
      }

      const shouldRefresh =
        event.touches.length === 0 &&
        gesture.engaged &&
        isPullToRefreshArmed(gesture.rawDistance);

      cancelAnimationFrame();
      detachActiveTouchListeners();
      gestureRef.current = { ...initialGesture };

      if (shouldRefresh) {
        refresh();
        return;
      }

      pendingDistanceRef.current = 0;
      setPullDistance(0);
      updatePhase("idle");
    }

    function handleTouchCancel() {
      if (!gestureRef.current.tracking) {
        return;
      }

      resetTrackedGesture();
    }

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      detachActiveTouchListeners();
    };
  }, [
    cancelAnimationFrame,
    refresh,
    updatePhase,
    updatePullDistance,
  ]);

  useEffect(
    () => () => {
      cancelAnimationFrame();
      cancelReloadFrames();
      clearSettleTimer();
    },
    [cancelAnimationFrame, cancelReloadFrames, clearSettleTimer],
  );

  const isVisible = phase !== "idle";
  const indicatorOffset = isVisible ? Math.min(0, pullDistance - 44) : -64;
  const indicatorOpacity = isVisible
    ? Math.min(1, pullDistance / 24)
    : 0;
  const visibleLabel = getVisibleLabel(phase);

  return (
    <>
      <button
        className="sr-only focus:not-sr-only focus:fixed focus:left-1/2 focus:top-[max(env(safe-area-inset-top),0.75rem)] focus:z-[110] focus:-translate-x-1/2 focus:rounded-md focus:bg-popover focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-popover-foreground focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        disabled={phase !== "idle"}
        onClick={refresh}
        type="button"
      >
        Refresh page
      </button>

      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed left-1/2 top-[max(env(safe-area-inset-top),0.75rem)] z-[100] flex min-h-10 items-center gap-2 rounded-full border border-border bg-popover/95 px-3 py-2 text-xs font-semibold text-popover-foreground shadow-xl backdrop-blur-md will-change-transform motion-reduce:transition-none",
          phase === "pulling" || phase === "armed"
            ? "transition-opacity duration-100"
            : "transition-[opacity,transform] duration-200 ease-out",
        )}
        data-slot="pull-to-refresh-indicator"
        data-state={phase}
        style={{
          opacity: indicatorOpacity,
          transform: `translate3d(-50%, ${indicatorOffset}px, 0)`,
        }}
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
          {phase === "refreshing" ? (
            <RefreshCwIcon className="size-3.5 animate-spin motion-reduce:animate-none" />
          ) : phase === "offline" ? (
            <WifiOffIcon className="size-3.5" />
          ) : (
            <ArrowDownIcon
              className="size-3.5 transition-transform duration-150 motion-reduce:transition-none"
              style={{
                transform: `rotate(${phase === "armed" ? 180 : Math.min(90, (pullDistance / PULL_TO_REFRESH_MAX_VISUAL_PX) * 90)}deg)`,
              }}
            />
          )}
        </span>
        <span>{visibleLabel}</span>
      </div>

      <span aria-atomic="true" aria-live="polite" className="sr-only" role="status">
        {getAnnouncement(phase)}
      </span>
    </>
  );
}
