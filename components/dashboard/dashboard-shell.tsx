import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

import { JurgensEnergyLogo } from "@/components/brand/jurgens-energy-logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import type { InAppNotificationSurface } from "@/src/db/schema";
import type { NotificationCenterState } from "@/src/modules/notifications/in-app";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
};

type DashboardShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  navItems: DashboardNavItem[];
  activeHref: string;
  userLabel: string;
  surfaceLabel: string;
  surfaceHref: string;
  badge?: string;
  accent?: "amber" | "green";
  notificationCenter?: NotificationCenterState;
  notificationSurface?: InAppNotificationSurface;
};

const accentStyles = {
  amber: {
    cardShadow: "shadow-amber-950/10",
    navActive:
      "bg-zinc-950 text-white shadow-lg shadow-zinc-950/10 hover:bg-zinc-950 hover:text-white dark:bg-white/10 dark:text-white dark:shadow-black/30",
    eyebrow: "text-amber-600 dark:text-amber-300",
    promo:
      "border-amber-500/20 bg-amber-600 text-white shadow-amber-600/20 dark:bg-amber-600/90",
    promoText: "text-amber-100",
  },
  green: {
    cardShadow: "shadow-emerald-950/10",
    navActive:
      "bg-emerald-900 text-white shadow-lg shadow-emerald-950/10 hover:bg-emerald-900 hover:text-white dark:bg-emerald-500/18 dark:text-white dark:shadow-black/30",
    eyebrow: "text-emerald-700 dark:text-emerald-300",
    promo:
      "border-emerald-500/20 bg-emerald-800 text-white shadow-emerald-700/20 dark:bg-emerald-700/90",
    promoText: "text-emerald-100",
  },
} as const;

export function DashboardShell({
  children,
  eyebrow,
  title,
  description,
  navItems,
  activeHref,
  userLabel,
  surfaceLabel,
  surfaceHref,
  badge,
  accent = "amber",
  notificationCenter,
  notificationSurface,
}: DashboardShellProps) {
  const styles = accentStyles[accent];

  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-100 p-3 text-zinc-950 dark:bg-[linear-gradient(180deg,#101011,#171718_44%,#101011)] dark:text-white sm:p-6 lg:p-0">
      <div className="mx-auto grid w-full max-w-[1540px] grid-cols-1 gap-4 lg:min-h-screen lg:grid-cols-[292px_minmax(0,1fr)] lg:gap-6 lg:px-6">
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:self-start lg:overflow-y-auto lg:py-6">
          <div className="grid min-h-full gap-4 lg:grid-rows-[auto_auto_minmax(0,1fr)_auto]">
            <Link
              href={surfaceHref}
              className={cn(
                "rounded-2xl border border-white/70 bg-white/76 p-4 shadow-xl backdrop-blur-xl transition dark:border-white/10 dark:bg-[#111112]/88 dark:shadow-black/30",
                styles.cardShadow,
              )}
            >
              <JurgensEnergyLogo compact />
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {surfaceLabel}
              </p>
            </Link>

            <section
              className={cn(
                "rounded-2xl border border-white/70 bg-white/76 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#171718]/88 dark:shadow-black/30",
                styles.cardShadow,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Signed in
                  </p>
                  <p className="mt-2 break-all text-sm font-semibold">
                    {userLabel}
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </section>

            <nav
              className={cn(
                "grid gap-1 overflow-y-auto rounded-2xl border border-white/70 bg-white/76 p-3 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#171718]/88 dark:shadow-black/30",
                styles.cardShadow,
              )}
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeHref === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
                      isActive && styles.navActive,
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="size-4" />
                      {item.label}
                    </span>
                    {item.badge ? (
                      <Badge variant={isActive ? "secondary" : "outline"}>
                        {item.badge}
                      </Badge>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className={cn("rounded-2xl p-4 shadow-xl", styles.promo)}>
              <p className="text-sm font-semibold">Launch-ready path</p>
              <p className={cn("mt-1 text-xs", styles.promoText)}>
                Shared admin surfaces for one controlled self-hosted storefront.
              </p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 lg:py-6">
          <header
            className={cn(
              "mb-4 flex flex-col gap-4 rounded-2xl border border-white/70 bg-white/76 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#171718]/88 dark:shadow-black/30 md:flex-row md:items-start md:justify-between sm:p-5",
              styles.cardShadow,
            )}
          >
            <div>
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>{surfaceLabel}</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <p className={cn("mt-5 text-xs font-semibold uppercase tracking-wide", styles.eyebrow)}>
                {eyebrow}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-normal text-zinc-950 dark:text-white sm:text-4xl">
                  {title}
                </h1>
                {badge ? <Badge variant="outline">{badge}</Badge> : null}
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {notificationCenter && notificationSurface ? (
                <NotificationBell
                  accent={accent}
                  initialState={notificationCenter}
                  surface={notificationSurface}
                />
              ) : null}
              <Button variant="outline">Export</Button>
            </div>
          </header>

          <div className="grid gap-4">{children}</div>
        </section>
      </div>
    </main>
  );
}
