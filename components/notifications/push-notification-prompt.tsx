"use client";

import Image from "next/image";
import { BellIcon, Loader2Icon, XIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PushNotificationStatus =
  | "allowed"
  | "checking"
  | "denied"
  | "disabled"
  | "enabled"
  | "saving"
  | "unconfigured"
  | "unsupported";

type PushNotificationPromptProps = {
  accent?: "amber" | "green" | "marketplace";
  className?: string;
  onDismiss?: () => void;
  onEnable: (event: MouseEvent<HTMLButtonElement>) => void;
  status: PushNotificationStatus;
  variant?: "floating" | "popover";
};

const accentStyles = {
  amber: {
    button:
      "bg-[#f4c315] text-zinc-950 hover:bg-[#ffd330] shadow-[#f4c315]/20",
  },
  green: {
    button:
      "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20",
  },
  marketplace: {
    button:
      "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20",
  },
} as const;

export function PushNotificationPrompt({
  accent = "amber",
  className,
  onDismiss,
  onEnable,
  status,
  variant = "floating",
}: PushNotificationPromptProps) {
  const [showUnblockHelp, setShowUnblockHelp] = useState(false);

  if (status === "enabled" || status === "unsupported") {
    return null;
  }

  const styles = accentStyles[accent];
  const isBusy = status === "checking" || status === "saving";
  const isBlocked = status === "denied";
  const isUnavailable = status === "unconfigured";
  const ctaLabel = getCtaLabel(status);
  const message = getMessage(status);

  return (
    <section
      className={cn(
        "relative overflow-hidden border border-slate-200 bg-white text-zinc-950 shadow-2xl shadow-zinc-950/10 dark:border-white/10 dark:bg-[#10151b] dark:text-white dark:shadow-black/50",
        variant === "floating"
          ? "fixed bottom-4 right-4 z-[95] w-[min(420px,calc(100vw-1.5rem))] rounded-2xl p-4"
          : "rounded-xl p-3",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.08),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(244,195,21,0.08),transparent_28%)] dark:block" />
      {onDismiss ? (
        <Button
          aria-label="Dismiss notification prompt"
          className={cn(
            "absolute right-3 top-3 z-10 rounded-full text-slate-500 hover:bg-slate-100 hover:text-zinc-950 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
            variant === "floating" ? "size-8" : "size-7",
          )}
          onClick={onDismiss}
          size="icon"
          type="button"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      ) : null}

      <div
        className={cn(
          "relative grid items-center",
          variant === "floating"
            ? "grid-cols-[86px_1fr] gap-4 pr-8"
            : "grid-cols-[56px_1fr] gap-3",
        )}
      >
        <div className="shrink-0">
          <Image
            alt=""
            className={cn(
              "object-contain",
              variant === "floating" ? "size-[86px]" : "size-14",
            )}
            height={variant === "floating" ? 112 : 72}
            priority={variant === "floating"}
            src="/brand/general-images/enable-notifications.png"
            width={variant === "floating" ? 112 : 72}
          />
        </div>

        <div>
          <h2
            className={cn(
              "font-bold tracking-normal",
              variant === "floating" ? "text-xl leading-tight" : "text-sm",
            )}
          >
            {isBlocked
              ? "Notifications are off"
              : isUnavailable
                ? "Notifications need setup"
                : status === "allowed"
                  ? "Notifications are allowed"
                : "Stay in the loop"}
          </h2>
          <p
            className={cn(
              "mt-3 text-slate-600 dark:text-white/70",
              variant === "floating"
                ? "max-w-[28ch] text-sm leading-6"
                : "text-xs leading-5",
            )}
          >
            {message}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "relative mt-4 grid gap-2 border-t border-slate-200 pt-3 dark:border-white/10",
          variant === "floating" ? "grid-cols-2" : "",
        )}
      >
        {onDismiss ? (
          <Button
            className={cn(
              "border-slate-200 bg-slate-100 font-semibold text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/75 dark:hover:bg-white/10",
              variant === "floating" ? "h-10 text-sm" : "h-9 text-xs",
            )}
            onClick={onDismiss}
            type="button"
            variant="outline"
          >
            Not now
          </Button>
        ) : null}
        <Button
          className={cn(
            "font-semibold shadow-xl",
            styles.button,
            variant === "floating" ? "h-10 text-sm" : "h-9 text-xs",
            !onDismiss && "w-full",
          )}
          disabled={isBusy || isUnavailable}
          onClick={
            isBlocked ? () => setShowUnblockHelp((current) => !current) : onEnable
          }
          type="button"
        >
          {status === "saving" ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <BellIcon className="size-4" />
          )}
          {ctaLabel}
        </Button>
      </div>

      {isBlocked && showUnblockHelp ? (
        <div
          className={cn(
            "relative mt-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/75",
            variant === "floating" ? "p-3 text-xs" : "p-2.5 text-[11px]",
          )}
        >
          <p className="font-semibold text-zinc-950 dark:text-white">
            How to enable notifications
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 leading-5">
            <li>Click the notification or site settings icon in the address bar.</li>
            <li>Change notifications from Block to Allow.</li>
            <li>Refresh Piessang, then enable notifications again.</li>
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function getCtaLabel(status: PushNotificationStatus) {
  switch (status) {
    case "checking":
      return "Checking...";
    case "allowed":
      return "Complete setup";
    case "denied":
      return "Enable notifications";
    case "saving":
      return "Turning on...";
    case "unconfigured":
      return "Unavailable";
    default:
      return "Enable notifications";
  }
}

function getMessage(status: PushNotificationStatus) {
  switch (status) {
    case "denied":
      return "Notifications are turned off in your browser settings. We can show you how to turn them back on.";
    case "unconfigured":
      return "Push notifications need the VAPID keys to be loaded before they can be enabled.";
    case "allowed":
      return "Browser notifications are allowed. Complete setup so Piessang can deliver updates to this device.";
    default:
      return "Enable notifications to get important updates about your store, orders and messages.";
  }
}
