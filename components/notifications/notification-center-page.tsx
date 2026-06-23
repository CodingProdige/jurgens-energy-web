import Link from "next/link";
import {
  BellIcon,
  CheckCircle2Icon,
  CircleIcon,
  ExternalLinkIcon,
} from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-controls";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  NotificationCenterItem,
  NotificationCenterState,
} from "@/src/modules/notifications/in-app";

function formatNotificationTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function NotificationLink({ item }: { item: NotificationCenterItem }) {
  if (!item.actionUrl) {
    return null;
  }

  const label = item.actionLabel ?? "Open";
  const className =
    "inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-zinc-800 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]";

  if (isExternalUrl(item.actionUrl)) {
    return (
      <a className={className} href={item.actionUrl} rel="noreferrer" target="_blank">
        {label}
        <ExternalLinkIcon className="size-3.5" />
      </a>
    );
  }

  return (
    <Link className={className} href={item.actionUrl}>
      {label}
    </Link>
  );
}

function NotificationCard({ item }: { item: NotificationCenterItem }) {
  const isUnread = !item.readAt;

  return (
    <article
      className={cn(
        "rounded-lg border p-4 shadow-sm",
        isUnread
          ? "border-amber-200 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-400/8"
          : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isUnread ? (
              <CircleIcon className="size-3 fill-amber-500 text-amber-500" />
            ) : (
              <CheckCircle2Icon className="size-3.5 text-emerald-500" />
            )}
            <h2 className="break-words text-sm font-semibold text-zinc-950 dark:text-white">
              {item.title}
            </h2>
            <Badge className="rounded-md bg-slate-100 text-xs text-slate-700 dark:bg-white/10 dark:text-zinc-300">
              {item.type.replaceAll("_", " ")}
            </Badge>
          </div>
          <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600 dark:text-zinc-400">
            {item.body}
          </p>
          <p className="mt-3 text-xs text-slate-500 dark:text-zinc-500">
            {formatNotificationTimestamp(item.createdAt)}
          </p>
        </div>
        <div className="shrink-0">
          <NotificationLink item={item} />
        </div>
      </div>
    </article>
  );
}

export function NotificationCenterPage({
  breadcrumbs,
  emptyCopy,
  state,
  title,
}: {
  breadcrumbs: string[];
  emptyCopy: string;
  state: NotificationCenterState;
  title: string;
}) {
  return (
    <>
      <DashboardPageHeader breadcrumbs={breadcrumbs} title={title} />

      <div className="grid gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Event stream
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                {state.unreadCount > 0
                  ? `${state.unreadCount} unread notification${state.unreadCount === 1 ? "" : "s"}`
                  : "Everything has been read."}
              </p>
            </div>
            <Badge className="rounded-md bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300">
              {state.notifications.length} shown
            </Badge>
          </div>
        </section>

        {state.notifications.length > 0 ? (
          <section className="grid gap-3">
            {state.notifications.map((item) => (
              <NotificationCard item={item} key={item.id} />
            ))}
          </section>
        ) : (
          <section className="grid place-items-center rounded-lg border border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-zinc-400">
              <BellIcon className="size-5" />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
              No notifications yet
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-zinc-400">
              {emptyCopy}
            </p>
          </section>
        )}
      </div>
    </>
  );
}
