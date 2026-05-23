"use client";

import Link from "next/link";
import {
  BellIcon,
  CheckCheckIcon,
  ChevronRightIcon,
  InboxIcon,
} from "lucide-react";
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
} from "react";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/components/notifications/actions";
import {
  PushNotificationPrompt,
  type PushNotificationStatus,
} from "@/components/notifications/push-notification-prompt";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  NotificationCenterItem,
  NotificationCenterState,
} from "@/src/modules/notifications/in-app";
import type { InAppNotificationSurface } from "@/src/db/schema";

type NotificationBellProps = {
  accent?: "amber" | "green" | "marketplace";
  className?: string;
  initialState: NotificationCenterState;
  surface: InAppNotificationSurface;
};

const accentStyles = {
  amber: {
    badge: "bg-[#c4982d] text-white",
    unreadDot: "bg-[#c4982d]",
    action: "text-[#8a641f] dark:text-[#f0c760]",
  },
  green: {
    badge: "bg-emerald-600 text-white",
    unreadDot: "bg-emerald-500",
    action: "text-emerald-700 dark:text-emerald-300",
  },
  marketplace: {
    badge: "bg-primary text-primary-foreground",
    unreadDot: "bg-primary",
    action: "text-primary",
  },
} as const;

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

export function NotificationBell({
  accent = "amber",
  className,
  initialState,
  surface,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pushStatus, setPushStatus] =
    useState<PushNotificationStatus>("checking");
  const [showSessionPrompt, setShowSessionPrompt] = useState(false);
  const [state, setState] = useState(initialState);
  const [, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const styles = accentStyles[accent];

  const refreshPushStatus = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }

    const publicKey = await getPushPublicKey();

    if (!publicKey) {
      setPushStatus("unconfigured");
      return;
    }

    if (Notification.permission === "denied") {
      setPushStatus("denied");
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();

    setPushStatus(
      subscription
        ? "enabled"
        : Notification.permission === "granted"
          ? "allowed"
          : "disabled",
    );
  }, []);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  useEffect(() => {
    let isMounted = true;

    async function checkPushStatus() {
      if (isMounted) {
        await refreshPushStatus();
      }
    }

    void checkPushStatus();

    return () => {
      isMounted = false;
    };
  }, [refreshPushStatus]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void refreshPushStatus();
  }, [isOpen, refreshPushStatus]);

  useEffect(() => {
    function onFocus() {
      void refreshPushStatus();
    }

    window.addEventListener("focus", onFocus);

    return () => window.removeEventListener("focus", onFocus);
  }, [refreshPushStatus]);

  useEffect(() => {
    if (
      pushStatus === "checking" ||
      pushStatus === "enabled" ||
      pushStatus === "unsupported"
    ) {
      return;
    }

    const dismissedKey = getPushPromptSessionKey(surface);

    if (sessionStorage.getItem(dismissedKey) === "1") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowSessionPrompt(true);
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [pushStatus, surface]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  const unreadLabel = useMemo(() => {
    if (state.unreadCount > 99) {
      return "99+";
    }

    return String(state.unreadCount);
  }, [state.unreadCount]);

  function markOneRead(notification: NotificationCenterItem) {
    if (notification.readAt) {
      return;
    }

    setState((current) => ({
      unreadCount: Math.max(0, current.unreadCount - 1),
      notifications: current.notifications.map((item) =>
        item.id === notification.id
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    }));

    startTransition(() => {
      void markNotificationReadAction({
        notificationId: notification.id,
        surface,
      });
    });
  }

  function markAllRead(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (state.unreadCount === 0) {
      return;
    }

    setState((current) => ({
      unreadCount: 0,
      notifications: current.notifications.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    }));

    startTransition(() => {
      void markAllNotificationsReadAction({ surface });
    });
  }

  function dismissSessionPrompt() {
    sessionStorage.setItem(getPushPromptSessionKey(surface), "1");
    setShowSessionPrompt(false);
  }

  async function enablePushNotifications(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (
      pushStatus === "saving" ||
      pushStatus === "enabled" ||
      pushStatus === "unsupported" ||
      pushStatus === "denied" ||
      pushStatus === "unconfigured"
    ) {
      return;
    }

    setPushStatus("saving");

    try {
      const publicKey = await getPushPublicKey();

      if (!publicKey) {
        setPushStatus("unconfigured");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      let subscription = await registration.pushManager.getSubscription();

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") {
        setPushStatus(permission === "denied" ? "denied" : "disabled");
        return;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          applicationServerKey: urlBase64ToUint8Array(publicKey),
          userVisibleOnly: true,
        });
      }

      const subscriptionJson = subscription.toJSON();

      if (!subscriptionJson.endpoint || !subscriptionJson.keys?.auth || !subscriptionJson.keys?.p256dh) {
        setPushStatus("disabled");
        return;
      }

      await fetch("/api/notifications/push/subscriptions", {
        body: JSON.stringify({
          endpoint: subscriptionJson.endpoint,
          keys: subscriptionJson.keys,
          surface,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      await registration.showNotification("Piessang notifications enabled", {
        badge: "/brand/favicon-for-public/web-app-manifest-192x192.png",
        body: "You will receive important updates from Piessang here.",
        icon: "/brand/favicon-for-public/web-app-manifest-192x192.png",
        tag: "piessang-push-enabled",
      });

      setPushStatus("enabled");
      setShowSessionPrompt(false);
    } catch (error) {
      console.error("Failed to update push notification preference", error);
      setPushStatus("disabled");
    }
  }

  return (
    <>
      <div ref={rootRef} className={cn("relative", className)}>
        <Button
          aria-expanded={isOpen}
          aria-label={
            state.unreadCount > 0
              ? `${state.unreadCount} unread notifications`
              : "Notifications"
          }
          className="relative h-9 w-9 rounded-full text-zinc-700 hover:bg-slate-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={() => setIsOpen((current) => !current)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <BellIcon className="size-4" />
          {state.unreadCount > 0 ? (
            <span
              className={cn(
                "absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold leading-5",
                styles.badge,
              )}
            >
              {unreadLabel}
            </span>
          ) : null}
        </Button>

        {isOpen ? (
          <section className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] flex max-h-[min(620px,calc(100vh-5.5rem))] w-[min(360px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-zinc-950/10 dark:border-white/10 dark:bg-[#111417] dark:shadow-black/40">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Notifications
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-white/55">
                {state.unreadCount > 0
                  ? `${state.unreadCount} unread`
                  : "All caught up"}
              </p>
            </div>
            <Button
              className="h-7 gap-1.5 px-2 text-xs"
              disabled={state.unreadCount === 0}
              onClick={markAllRead}
              type="button"
              variant="ghost"
            >
              <CheckCheckIcon className="size-3.5" />
              Mark all read
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {state.notifications.length > 0 ? (
              <div className="grid gap-1">
                {state.notifications.map((notification) => {
                  const content = (
                    <>
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          notification.readAt
                            ? "bg-transparent"
                            : styles.unreadDot,
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-zinc-950 dark:text-white">
                          {notification.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-white/62">
                          {notification.body}
                        </span>
                        <span className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                          {formatNotificationDate(notification.createdAt)}
                          {notification.actionLabel ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 normal-case tracking-normal",
                                styles.action,
                              )}
                            >
                              {notification.actionLabel}
                              <ChevronRightIcon className="size-3" />
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </>
                  );
                  const itemClass = cn(
                    "flex w-full gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-100 dark:hover:bg-white/[0.06]",
                    notification.readAt
                      ? "bg-transparent"
                      : "bg-slate-50 dark:bg-white/[0.04]",
                  );

                  if (notification.actionUrl) {
                    if (isExternalUrl(notification.actionUrl)) {
                      return (
                        <a
                          className={itemClass}
                          href={notification.actionUrl}
                          key={notification.id}
                          onClick={() => markOneRead(notification)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {content}
                        </a>
                      );
                    }

                    return (
                      <Link
                        className={itemClass}
                        href={notification.actionUrl}
                        key={notification.id}
                        onClick={() => markOneRead(notification)}
                      >
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <button
                      className={itemClass}
                      key={notification.id}
                      onClick={() => markOneRead(notification)}
                      type="button"
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid place-items-center px-6 py-10 text-center">
                <div className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-white/55">
                  <InboxIcon className="size-5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-950 dark:text-white">
                  No notifications yet
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-white/55">
                  Updates for this surface will appear here.
                </p>
              </div>
            )}
            {pushStatus !== "unsupported" && pushStatus !== "enabled" ? (
              <div className="mt-2 border-t border-slate-200 p-3 dark:border-white/10">
                <PushNotificationPrompt
                  accent={accent}
                  onEnable={enablePushNotifications}
                  status={pushStatus}
                  variant="popover"
                />
              </div>
            ) : null}
          </div>
          </section>
        ) : null}
      </div>

      {showSessionPrompt && !isOpen ? (
        <PushNotificationPrompt
          accent={accent}
          onDismiss={dismissSessionPrompt}
          onEnable={enablePushNotifications}
          status={pushStatus}
        />
      ) : null}
    </>
  );
}

async function getPushPublicKey() {
  const response = await fetch("/api/notifications/push/public-key");

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    configured?: boolean;
    publicKey?: string | null;
  };

  return data.configured ? data.publicKey ?? null : null;
}

function getPushPromptSessionKey(surface: InAppNotificationSurface) {
  return `piessang:${surface}:push-prompt-dismissed`;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}
