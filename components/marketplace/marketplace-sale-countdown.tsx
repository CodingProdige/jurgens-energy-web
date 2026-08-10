"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Clock3Icon } from "lucide-react";
import { useRouter } from "next/navigation";

import { getMarketplaceSaleCountdownDisplay } from "@/components/marketplace/marketplace-sale-countdown-format";
import { cn } from "@/lib/utils";

type MarketplaceSaleCountdownProps = {
  className?: string;
  endsAt: string | null;
  label?: string;
  variant?: "compact" | "menu" | "prominent";
};

type ExpiryRefreshState = {
  delayedRefreshCompleted: boolean;
  delayedRefreshTimer: ReturnType<typeof setTimeout> | null;
  immediateRefreshCompleted: boolean;
  refreshListeners: Set<() => void>;
};

const clockListeners = new Set<() => void>();
const expiryRefreshByDeadline = new Map<number, ExpiryRefreshState>();
let clockNow: number | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

function emitClockTick() {
  clockNow = Date.now();

  for (const listener of clockListeners) {
    listener();
  }
}

function subscribeToClock(listener: () => void) {
  clockListeners.add(listener);

  if (!clockTimer) {
    clockNow = Date.now();
    clockTimer = setInterval(emitClockTick, 1_000);
  }

  return () => {
    clockListeners.delete(listener);

    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
      clockNow = null;
    }
  };
}

function getClockSnapshot() {
  return clockNow;
}

function getServerClockSnapshot() {
  return null;
}

function registerExpiredCampaign(
  deadline: number,
  refreshRoute: () => void,
) {
  const state = expiryRefreshByDeadline.get(deadline) ?? {
    delayedRefreshCompleted: false,
    delayedRefreshTimer: null,
    immediateRefreshCompleted: false,
    refreshListeners: new Set<() => void>(),
  };

  state.refreshListeners.add(refreshRoute);
  expiryRefreshByDeadline.set(deadline, state);

  if (!state.immediateRefreshCompleted) {
    state.immediateRefreshCompleted = true;
    refreshRoute();
  }

  if (!state.delayedRefreshCompleted && !state.delayedRefreshTimer) {
    state.delayedRefreshTimer = setTimeout(() => {
      state.delayedRefreshTimer = null;

      const [mountedRefresh] = state.refreshListeners;

      if (!mountedRefresh) {
        return;
      }

      state.delayedRefreshCompleted = true;
      mountedRefresh();
    }, 10_000);
  }

  return () => {
    state.refreshListeners.delete(refreshRoute);

    if (state.refreshListeners.size === 0 && state.delayedRefreshTimer) {
      clearTimeout(state.delayedRefreshTimer);
      state.delayedRefreshTimer = null;
    }
  };
}

function parseDeadline(endsAt: string | null) {
  if (!endsAt) {
    return null;
  }

  const deadline = Date.parse(endsAt);

  return Number.isFinite(deadline) ? deadline : null;
}

export function MarketplaceSaleCountdown({
  className,
  endsAt,
  label = "Sale",
  variant = "compact",
}: MarketplaceSaleCountdownProps) {
  const router = useRouter();
  const now = useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );
  const deadline = parseDeadline(endsAt);
  const hasExpired = deadline !== null && now !== null && now >= deadline;

  useEffect(() => {
    if (!hasExpired || deadline === null) {
      return;
    }

    return registerExpiredCampaign(deadline, () => router.refresh());
  }, [deadline, hasExpired, router]);

  if (deadline === null || now === null) {
    return null;
  }

  if (hasExpired) {
    return (
      <span
        aria-live="polite"
        className={cn(
          "inline-flex items-center gap-1 font-black uppercase text-[#ff5a1f]",
          variant === "compact"
            ? "text-[8px] sm:text-[9px]"
            : variant === "menu"
              ? "text-[10px]"
              : "text-xs",
          className,
        )}
        role="status"
      >
        <Clock3Icon aria-hidden="true" className="size-3 shrink-0" />
        {label} ending now
      </span>
    );
  }

  const display = getMarketplaceSaleCountdownDisplay(deadline - now);

  return (
    <span
      aria-label={`${label} ends in ${display.accessible}`}
      className={cn(
        "inline-flex max-w-full items-center font-black uppercase tabular-nums",
        variant === "compact"
          ? "gap-1 rounded-[3px] bg-[#080808] px-1.5 py-1 text-[8px] leading-none text-white shadow-sm dark:bg-[#f7f7f2] dark:text-[#080808] sm:text-[9px]"
          : variant === "menu"
            ? "gap-1.5 rounded-md border border-white/15 bg-white/[0.07] px-2 py-1.5 text-[10px] leading-none text-white"
          : "gap-2 rounded-md border border-[#ff5a1f]/25 bg-[#fff2ec] px-3 py-2 text-xs leading-none text-[#080808] shadow-sm dark:bg-[#ff5a1f]/12 dark:text-[#f7f7f2]",
        className,
      )}
      role="timer"
    >
      <Clock3Icon
        aria-hidden="true"
        className={cn(
          "shrink-0 text-[#ff5a1f]",
          variant === "compact" ? "size-3" : "size-3.5",
        )}
      />
      <span aria-hidden="true" className="truncate">
        {label} ends in {display.visual}
      </span>
    </span>
  );
}
