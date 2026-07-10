"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  ChevronDownIcon,
  MenuIcon,
  SearchIcon,
  StarIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";

import { CurrencySelector } from "@/components/currency/currency-selector";
import { JurgensEnergyLogo } from "@/components/brand/jurgens-energy-logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InAppNotificationSurface } from "@/src/db/schema";
import type { CurrencyPreference } from "@/src/modules/currency";
import type { NotificationCenterState } from "@/src/modules/notifications/in-app";

export type DashboardSurfaceAccent = "amber" | "green";

export type DashboardSurfaceNavItem<TCapability extends string = string> = {
  label: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  capability?: TCapability;
  children?: Array<{
    capability?: TCapability;
    label: string;
    href?: string;
    disabled?: boolean;
  }>;
};

export type DashboardSurfaceUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

const surfaceControlClass =
  "border-slate-200 bg-white text-zinc-950 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10";

const accentStyles = {
  amber: {
    activeResponsive:
      "bg-[#c4982d]/12 font-semibold text-[#8a641f] ring-1 ring-[#c4982d]/25 dark:bg-[#c4982d]/18 dark:text-[#f0c760] dark:ring-[#c4982d]/25",
    activeDark:
      "bg-[#c4982d]/16 font-semibold text-white ring-1 ring-[#c4982d]/35",
    childResponsive:
      "bg-[#c4982d]/10 font-semibold text-[#8a641f] dark:bg-[#c4982d]/16 dark:text-[#f0c760]",
    childDark: "bg-[#c4982d]/14 font-semibold text-white",
    icon: "text-[#c4982d]",
    avatar: "bg-[#c4982d] text-white",
  },
  green: {
    activeResponsive:
      "bg-emerald-600/12 font-semibold text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-500/18 dark:text-emerald-200 dark:ring-emerald-400/25",
    activeDark:
      "bg-emerald-500/15 font-semibold text-white ring-1 ring-emerald-400/30",
    childResponsive:
      "bg-emerald-600/10 font-semibold text-emerald-800 dark:bg-emerald-500/16 dark:text-emerald-200",
    childDark: "bg-emerald-500/14 font-semibold text-white",
    icon: "text-emerald-500",
    avatar: "bg-emerald-600 text-white",
  },
} as const;

function hasCapability<TCapability extends string>(
  capabilities: readonly TCapability[],
  capability?: TCapability,
) {
  return !capability || capabilities.includes(capability);
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function SetupAttentionMarker() {
  return (
    <span className="pointer-events-none absolute left-1 top-1 text-amber-400 drop-shadow-sm">
      <StarIcon className="size-2.5 fill-current" />
    </span>
  );
}

function SurfaceBrand({
  ariaLabel,
  className,
}: {
  ariaLabel: string;
  className?: string;
}) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={ariaLabel}>
      <JurgensEnergyLogo compact className={className} />
    </Link>
  );
}

function SurfaceNavList<TCapability extends string>({
  accent,
  attentionHrefs,
  capabilities,
  navItems,
  pathname,
  onNavigate,
  variant = "dark",
}: {
  accent: DashboardSurfaceAccent;
  attentionHrefs?: readonly string[];
  capabilities: readonly TCapability[];
  navItems: DashboardSurfaceNavItem<TCapability>[];
  pathname: string;
  onNavigate?: () => void;
  variant?: "dark" | "responsive";
}) {
  const isResponsive = variant === "responsive";
  const styles = accentStyles[accent];
  const hasAttention = (href?: string) =>
    Boolean(
      href &&
        attentionHrefs?.some((attentionHref) => isActivePath(attentionHref, href)),
    );
  const getInitialOpenGroups = () =>
    Object.fromEntries(
      navItems
        .filter((item) => item.children)
        .map((item) => [
          item.label,
          Boolean(
            item.children?.some(
              (child) => child.href && isActivePath(pathname, child.href),
            ),
          ),
        ]),
    );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    getInitialOpenGroups,
  );

  useEffect(() => {
    setOpenGroups((current) => {
      let changed = false;
      const next = { ...current };

      for (const item of navItems) {
        if (
          item.children?.some(
            (child) => child.href && isActivePath(pathname, child.href),
          ) &&
          !next[item.label]
        ) {
          next[item.label] = true;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [navItems, pathname]);

  return (
    <nav className="grid gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          (item.href ? isActivePath(pathname, item.href) : false) ||
          item.children?.some(
            (child) => child.href && isActivePath(pathname, child.href),
          );
        const itemNeedsAttention =
          hasAttention(item.href) ||
          Boolean(item.children?.some((child) => hasAttention(child.href)));
        const activeClass = isResponsive ? styles.activeResponsive : styles.activeDark;
        const inactiveClass = isResponsive
          ? "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-white/70 dark:hover:bg-white/[0.08] dark:hover:text-white"
          : "text-white/70 hover:bg-white/[0.06] hover:text-white";

        if (item.children) {
          const isOpen = openGroups[item.label] ?? false;

          return (
            <div key={item.label}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [item.label]: !(current[item.label] ?? false),
                  }))
                }
                className={cn(
                  "relative flex h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm transition",
                  isActive ? activeClass : inactiveClass,
                )}
              >
                {itemNeedsAttention ? <SetupAttentionMarker /> : null}
                <span className="flex items-center gap-3">
                  <Icon className={cn("size-4", isActive ? styles.icon : "text-current")} />
                  {item.label}
                </span>
                <ChevronDownIcon
                  className={cn(
                    "size-4 transition-transform",
                    isOpen && "rotate-180",
                    isResponsive
                      ? "text-zinc-500 dark:text-white/70"
                      : "text-white/70",
                  )}
                />
              </button>
              {isOpen ? (
                <div
                  className={cn(
                    "ml-5 mt-2 grid gap-1 border-l pl-4",
                    isResponsive
                      ? "border-zinc-200 dark:border-white/10"
                      : "border-white/10",
                  )}
                >
                  {item.children.map((child) => {
                    const isChildActive = child.href
                      ? isActivePath(pathname, child.href)
                      : false;
                    const childNeedsAttention = hasAttention(child.href);
                    const isDisabled =
                      child.disabled || !hasCapability(capabilities, child.capability);

                    if (!child.href || isDisabled) {
                      return (
                        <span
                          key={child.label}
                          className={cn(
                            "relative flex h-9 cursor-not-allowed items-center rounded-md px-3 text-sm opacity-50",
                            isResponsive
                              ? "text-zinc-500 dark:text-white/58"
                              : "text-white/58",
                          )}
                        >
                          {childNeedsAttention ? <SetupAttentionMarker /> : null}
                          {child.label}
                        </span>
                      );
                    }

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onNavigate}
                        className={cn(
                          "relative flex h-9 items-center rounded-md px-3 text-sm transition",
                          isResponsive
                            ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-white/58 dark:hover:bg-white/[0.06] dark:hover:text-white"
                            : "text-white/58 hover:bg-white/[0.05] hover:text-white",
                          isChildActive &&
                            (isResponsive ? styles.childResponsive : styles.childDark),
                        )}
                      >
                        {childNeedsAttention ? <SetupAttentionMarker /> : null}
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        }

        if (!item.href) {
          return null;
        }

        if (!hasCapability(capabilities, item.capability)) {
          return (
            <span
              key={item.label}
            className={cn(
                "relative flex h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-medium opacity-45",
                inactiveClass,
              )}
            >
              {itemNeedsAttention ? <SetupAttentionMarker /> : null}
              <Icon className="size-4" />
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
              isActive ? activeClass : inactiveClass,
            )}
          >
            {itemNeedsAttention ? <SetupAttentionMarker /> : null}
            <Icon className={cn("size-4", isActive && styles.icon)} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function getInitials(user: DashboardSurfaceUser, fallback: string) {
  const displayName = user.name ?? user.email ?? fallback;
  const parts = displayName
    .replace(/\(.+\)$/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return displayName.slice(0, 1).toUpperCase();
}

function SurfaceUserCard({
  accent,
  fallbackLabel,
  user,
  variant = "dark",
}: {
  accent: DashboardSurfaceAccent;
  fallbackLabel: string;
  user: DashboardSurfaceUser;
  variant?: "dark" | "responsive";
}) {
  const isResponsive = variant === "responsive";
  const displayName = user.name ?? user.email ?? fallbackLabel;
  const supportingText = user.email ?? fallbackLabel;
  const initials = getInitials(user, fallbackLabel);

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        isResponsive
          ? "border-zinc-200 bg-zinc-100 text-zinc-950 dark:border-white/6 dark:bg-white/[0.06] dark:text-white"
          : "border-white/6 bg-white/[0.06] text-white",
      )}
    >
      <div className="flex items-center gap-3">
        {user.image ? (
          <Image
            src={user.image}
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <div className={cn("grid size-10 place-items-center rounded-full text-sm font-bold", accentStyles[accent].avatar)}>
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p
            className={cn(
              "truncate text-xs",
              isResponsive ? "text-zinc-500 dark:text-white/55" : "text-white/55",
            )}
          >
            {supportingText}
          </p>
        </div>
        <ChevronDownIcon
          className={cn(
            "ml-auto size-4",
            isResponsive ? "text-zinc-500 dark:text-white/55" : "text-white/55",
          )}
        />
      </div>
    </div>
  );
}

function Sidebar<TCapability extends string>({
  accent,
  attentionHrefs,
  capabilities,
  navItems,
  pathname,
  user,
  userFallbackLabel,
}: {
  accent: DashboardSurfaceAccent;
  attentionHrefs?: readonly string[];
  capabilities: readonly TCapability[];
  navItems: DashboardSurfaceNavItem<TCapability>[];
  pathname: string;
  user: DashboardSurfaceUser;
  userFallbackLabel: string;
}) {
  return (
    <aside className="fixed bottom-0 left-0 top-[72px] z-30 hidden w-[236px] border-r border-white/10 bg-[#080b0d] text-white lg:flex lg:flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.28)_transparent]">
        <SurfaceNavList
          accent={accent}
          attentionHrefs={attentionHrefs}
          capabilities={capabilities}
          navItems={navItems}
          pathname={pathname}
        />
      </div>

      <div className="shrink-0 px-5 pb-5 pt-3">
        <SurfaceUserCard
          accent={accent}
          fallbackLabel={userFallbackLabel}
          user={user}
        />
      </div>
    </aside>
  );
}

function MobileNavDrawer<TCapability extends string>({
  accent,
  attentionHrefs,
  brandAriaLabel,
  capabilities,
  isOpen,
  navItems,
  onClose,
  pathname,
  user,
  userFallbackLabel,
}: {
  accent: DashboardSurfaceAccent;
  attentionHrefs?: readonly string[];
  brandAriaLabel: string;
  capabilities: readonly TCapability[];
  isOpen: boolean;
  navItems: DashboardSurfaceNavItem<TCapability>[];
  onClose: () => void;
  pathname: string;
  user: DashboardSurfaceUser;
  userFallbackLabel: string;
}) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsVisible(false);
      const timeout = window.setTimeout(() => setIsVisible(true), 20);
      document.body.style.overflow = "hidden";

      return () => {
        window.clearTimeout(timeout);
        document.body.style.overflow = "";
      };
    }

    setIsVisible(false);
    const timeout = window.setTimeout(() => setShouldRender(false), 300);

    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 lg:hidden",
        isVisible ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <button
        aria-label="Close navigation menu"
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-300 ease-out motion-reduce:transition-none",
          isVisible ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        type="button"
      />
      <aside
        className={cn(
          "relative flex h-full w-[min(300px,86vw)] flex-col bg-white px-5 py-5 text-zinc-950 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none dark:bg-[#080b0d] dark:text-white",
          isVisible ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <SurfaceBrand ariaLabel={brandAriaLabel} className="text-zinc-950 dark:text-white" />
          <Button
            aria-label="Close navigation menu"
            size="icon-sm"
            variant="ghost"
            className="rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onClose}
            type="button"
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="-mr-5 min-h-0 flex-1 overflow-y-auto">
          <div className="pr-5">
            <SurfaceNavList
              accent={accent}
              attentionHrefs={attentionHrefs}
              capabilities={capabilities}
              navItems={navItems}
              pathname={pathname}
              onNavigate={onClose}
              variant="responsive"
            />
          </div>
        </div>

        <div className="mt-5">
          <SurfaceUserCard
            accent={accent}
            fallbackLabel={userFallbackLabel}
            user={user}
            variant="responsive"
          />
        </div>
      </aside>
    </div>
  );
}

function SurfaceHeader({
  accent,
  brandAriaLabel,
  currencyPreference,
  notificationCenter,
  notificationCenterHref,
  notificationSurface,
  onOpenMenu,
  searchAriaLabel,
  searchPlaceholder,
}: {
  accent: DashboardSurfaceAccent;
  brandAriaLabel: string;
  currencyPreference: CurrencyPreference;
  notificationCenter: NotificationCenterState;
  notificationCenterHref?: string;
  notificationSurface: InAppNotificationSurface;
  onOpenMenu: () => void;
  searchAriaLabel: string;
  searchPlaceholder: string;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-[72px] items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-sm dark:border-white/10 dark:bg-[#0f1114] sm:px-6 lg:px-7">
      <Button
        aria-label="Open navigation menu"
        size="icon-sm"
        variant="ghost"
        className="rounded-full text-zinc-700 hover:bg-slate-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white lg:hidden"
        onClick={onOpenMenu}
        type="button"
      >
        <MenuIcon className="size-5" />
      </Button>

      <div className="flex w-[150px] shrink-0 sm:w-[190px] lg:w-[201px]">
        <SurfaceBrand ariaLabel={brandAriaLabel} />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative hidden w-full max-w-[524px] md:block">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder={searchPlaceholder}
            className={cn("h-9 rounded-lg pl-10 pr-12 text-sm shadow-sm", surfaceControlClass)}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            ⌘ K
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          <Button
            aria-label={searchAriaLabel}
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-zinc-700 hover:bg-slate-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white md:hidden"
            type="button"
          >
            <SearchIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            className={cn("hidden h-9 gap-2 rounded-lg px-4 sm:inline-flex", surfaceControlClass)}
          >
            <ZapIcon className={cn("size-4", accentStyles[accent].icon)} />
            Quick Actions
            <ChevronDownIcon className="size-4" />
          </Button>
          <NotificationBell
            accent={accent}
            centerHref={notificationCenterHref}
            initialState={notificationCenter}
            surface={notificationSurface}
          />
          <CurrencySelector
            className="hidden xl:flex"
            initialPreference={currencyPreference}
            variant="dashboard"
          />
          <ThemeToggle compact className="sm:hidden" />
          <ThemeToggle className="hidden sm:inline-flex" />
        </div>
      </div>
    </header>
  );
}

export function DashboardSurfaceShell<TCapability extends string = string>({
  accent,
  attentionHrefs,
  brandAriaLabel,
  capabilities,
  currencyPreference,
  children,
  navItems,
  notificationCenter,
  notificationCenterHref,
  notificationSurface,
  searchAriaLabel,
  searchPlaceholder,
  user,
  userFallbackLabel,
}: {
  accent: DashboardSurfaceAccent;
  attentionHrefs?: readonly string[];
  brandAriaLabel: string;
  capabilities?: readonly TCapability[];
  currencyPreference: CurrencyPreference;
  children: ReactNode;
  navItems: DashboardSurfaceNavItem<TCapability>[];
  notificationCenter: NotificationCenterState;
  notificationCenterHref?: string;
  notificationSurface: InAppNotificationSurface;
  searchAriaLabel: string;
  searchPlaceholder: string;
  user: DashboardSurfaceUser;
  userFallbackLabel: string;
}) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const effectiveCapabilities = capabilities ?? [];

  return (
    <main className="min-h-screen overflow-x-hidden bg-white pt-[72px] text-[#111827] dark:bg-[#0f1114] dark:text-white lg:pl-[236px]">
      <SurfaceHeader
        accent={accent}
        brandAriaLabel={brandAriaLabel}
        currencyPreference={currencyPreference}
        notificationCenter={notificationCenter}
        notificationCenterHref={notificationCenterHref}
        notificationSurface={notificationSurface}
        onOpenMenu={() => setIsMobileNavOpen(true)}
        searchAriaLabel={searchAriaLabel}
        searchPlaceholder={searchPlaceholder}
      />
      <Sidebar
        accent={accent}
        attentionHrefs={attentionHrefs}
        capabilities={effectiveCapabilities}
        navItems={navItems}
        pathname={pathname}
        user={user}
        userFallbackLabel={userFallbackLabel}
      />
      <MobileNavDrawer
        accent={accent}
        attentionHrefs={attentionHrefs}
        brandAriaLabel={brandAriaLabel}
        capabilities={effectiveCapabilities}
        isOpen={isMobileNavOpen}
        navItems={navItems}
        onClose={() => setIsMobileNavOpen(false)}
        pathname={pathname}
        user={user}
        userFallbackLabel={userFallbackLabel}
      />
      <section className="min-w-0 px-5 py-5 sm:px-7">{children}</section>
    </main>
  );
}
