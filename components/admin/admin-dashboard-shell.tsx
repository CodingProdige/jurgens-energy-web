"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  BarChart3Icon,
  BoxesIcon,
  ChevronDownIcon,
  MenuIcon,
  ClipboardListIcon,
  FolderTreeIcon,
  LayoutDashboardIcon,
  PackageCheckIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserCogIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AdminCapability } from "@/src/modules/admin/staff-constants";
import type { NotificationCenterState } from "@/src/modules/notifications/in-app";

type AdminNavItem = {
  label: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  capability?: AdminCapability;
  children?: Array<{
    capability?: AdminCapability;
    label: string;
    href?: string;
    disabled?: boolean;
  }>;
};

type AdminShellUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

const adminControlClass =
  "border-slate-200 bg-white text-zinc-950 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10";

const navItems: AdminNavItem[] = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboardIcon,
    capability: "admin.dashboard.view",
  },
  {
    label: "Orders",
    href: "/orders",
    icon: ClipboardListIcon,
    capability: "admin.orders.view",
  },
  {
    label: "Products",
    href: "/products",
    icon: BoxesIcon,
    capability: "admin.catalog.view",
  },
  {
    label: "Catalog",
    icon: FolderTreeIcon,
    children: [
      {
        label: "Categories",
        href: "/catalog/categories",
        capability: "admin.catalog.view",
      },
      { label: "Brands", href: "/catalog/brands", capability: "admin.catalog.view" },
      {
        label: "Brand requests",
        href: "/catalog/brand-requests",
        capability: "admin.catalog.view",
      },
    ],
  },
  {
    label: "Users & Access",
    icon: UserCogIcon,
    children: [
      { label: "All users", href: "/users/all", capability: "admin.users.view" },
      {
        label: "Customers",
        href: "/users/customers",
        capability: "admin.users.view",
      },
      { label: "Admins", href: "/users/admins", capability: "admin.users.view" },
      { label: "Sellers", href: "/users/sellers", capability: "admin.users.view" },
      {
        label: "Admin staff",
        href: "/users/staff",
        capability: "admin.staff.view",
      },
      { label: "Seller applications", disabled: true },
    ],
  },
  {
    label: "Marketing",
    href: "/marketing",
    icon: ZapIcon,
    capability: "admin.marketing.view",
  },
  {
    label: "Reviews",
    href: "/reviews",
    icon: ShieldCheckIcon,
    capability: "admin.reviews.view",
  },
  {
    label: "Payouts",
    href: "/payouts",
    icon: PackageCheckIcon,
    capability: "admin.payouts.view",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3Icon,
    capability: "admin.analytics.view",
  },
  {
    label: "Settings",
    icon: SettingsIcon,
    children: [
      {
        label: "Platform settings",
        href: "/settings/platform",
        capability: "admin.settings.view",
      },
    ],
  },
];

function hasCapability(
  capabilities: AdminCapability[],
  capability?: AdminCapability,
) {
  return !capability || capabilities.includes(capability);
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminBrand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className="flex min-w-0 items-center gap-3"
      aria-label="Piessang admin dashboard"
    >
      <span className="relative block h-8 w-8 shrink-0 overflow-hidden">
        <Image
          src="/brand/logo/Piessang Logo Full - Clipped.png"
          alt=""
          width={146}
          height={32}
          priority
          className="h-8 w-[146px] max-w-none object-left"
        />
      </span>
      <span className={cn("text-sm font-extrabold tracking-[0.18em]", className)}>
        PIESSANG
      </span>
    </Link>
  );
}

function AdminNavList({
  capabilities,
  pathname,
  onNavigate,
  variant = "dark",
}: {
  capabilities: AdminCapability[];
  pathname: string;
  onNavigate?: () => void;
  variant?: "dark" | "responsive";
}) {
  const isResponsive = variant === "responsive";
  const getInitialOpenGroups = () =>
    Object.fromEntries(
      navItems
        .filter((item) => item.children)
        .map((item) => [
          item.label,
          Boolean(
            item.children?.some(
              (child) =>
                child.href &&
                isActivePath(pathname, child.href),
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
            (child) =>
              child.href && isActivePath(pathname, child.href),
          ) &&
          !next[item.label]
        ) {
          next[item.label] = true;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [pathname]);

  return (
    <nav className="grid gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          (item.href ? isActivePath(pathname, item.href) : false) ||
          item.children?.some(
            (child) =>
              child.href && isActivePath(pathname, child.href),
          );
        const activeClass = isResponsive
          ? "bg-[#c4982d]/12 font-semibold text-[#8a641f] ring-1 ring-[#c4982d]/25 dark:bg-[#c4982d]/18 dark:text-[#f0c760] dark:ring-[#c4982d]/25"
          : "bg-[#c4982d]/16 font-semibold text-white ring-1 ring-[#c4982d]/35";
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
                  "flex h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm transition",
                  isActive ? activeClass : inactiveClass,
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "size-4",
                      isActive ? "text-[#c4982d]" : "text-current",
                    )}
                  />
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
                    const isDisabled =
                      child.disabled || !hasCapability(capabilities, child.capability);

                    if (!child.href || isDisabled) {
                      return (
                        <span
                          key={child.label}
                          className={cn(
                            "flex h-9 cursor-not-allowed items-center rounded-md px-3 text-sm opacity-50",
                            isResponsive
                              ? "text-zinc-500 dark:text-white/58"
                              : "text-white/58",
                          )}
                        >
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
                          "flex h-9 items-center rounded-md px-3 text-sm transition",
                          isResponsive
                            ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-white/58 dark:hover:bg-white/[0.06] dark:hover:text-white"
                            : "text-white/58 hover:bg-white/[0.05] hover:text-white",
                          isChildActive &&
                            (isResponsive
                              ? "bg-[#c4982d]/10 font-semibold text-[#8a641f] dark:bg-[#c4982d]/16 dark:text-[#f0c760]"
                              : "bg-[#c4982d]/14 font-semibold text-white"),
                        )}
                      >
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
                "flex h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-medium opacity-45",
                inactiveClass,
              )}
            >
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
              "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
              isActive ? activeClass : inactiveClass,
            )}
          >
            <Icon className={cn("size-4", isActive && "text-[#c4982d]")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function getAdminInitials(user: AdminShellUser) {
  const displayName = user.name ?? user.email ?? "Admin";
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

function AdminUserCard({
  user,
  variant = "dark",
}: {
  user: AdminShellUser;
  variant?: "dark" | "responsive";
}) {
  const isResponsive = variant === "responsive";
  const displayName = user.name ?? user.email ?? "Admin user";
  const supportingText = user.email ?? "Administrator";
  const initials = getAdminInitials(user);

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
          <div className="grid size-10 place-items-center rounded-full bg-[#c4982d] text-sm font-bold text-white">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className={cn("truncate text-xs", isResponsive ? "text-zinc-500 dark:text-white/55" : "text-white/55")}>
            {supportingText}
          </p>
        </div>
        <ChevronDownIcon
          className={cn("ml-auto size-4", isResponsive ? "text-zinc-500 dark:text-white/55" : "text-white/55")}
        />
      </div>
    </div>
  );
}

function Sidebar({
  capabilities,
  pathname,
  user,
}: {
  capabilities: AdminCapability[];
  pathname: string;
  user: AdminShellUser;
}) {
  return (
    <aside className="fixed bottom-0 left-0 top-[72px] z-30 hidden w-[236px] border-r border-white/10 bg-[#080b0d] text-white lg:flex lg:flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.28)_transparent]">
        <AdminNavList capabilities={capabilities} pathname={pathname} />
      </div>

      <div className="shrink-0 px-5 pb-5 pt-3">
        <AdminUserCard user={user} />
      </div>
    </aside>
  );
}

function MobileNavDrawer({
  capabilities,
  isOpen,
  onClose,
  pathname,
  user,
}: {
  capabilities: AdminCapability[];
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
  user: AdminShellUser;
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
          <AdminBrand className="text-zinc-950 dark:text-white" />
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
            <AdminNavList
              capabilities={capabilities}
              pathname={pathname}
              onNavigate={onClose}
              variant="responsive"
            />
          </div>
        </div>

        <div className="mt-5">
          <AdminUserCard user={user} variant="responsive" />
        </div>
      </aside>
    </div>
  );
}

function AdminHeader({
  notificationCenter,
  onOpenMenu,
}: {
  notificationCenter: NotificationCenterState;
  onOpenMenu: () => void;
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
        <AdminBrand />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative hidden w-full max-w-[524px] md:block">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search anything... (Orders, Products, Sellers, etc.)"
            className={cn("h-9 rounded-lg pl-10 pr-12 text-sm shadow-sm", adminControlClass)}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            ⌘ K
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          <Button
            aria-label="Search admin dashboard"
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-zinc-700 hover:bg-slate-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white md:hidden"
            type="button"
          >
            <SearchIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            className={cn("hidden h-9 gap-2 rounded-lg px-4 sm:inline-flex", adminControlClass)}
          >
            <ZapIcon className="size-4 text-[#c4982d]" />
            Quick Actions
            <ChevronDownIcon className="size-4" />
          </Button>
          <NotificationBell
            accent="amber"
            initialState={notificationCenter}
            surface="admin"
          />
          <ThemeToggle compact className="sm:hidden" />
          <ThemeToggle className="hidden sm:inline-flex" />
        </div>
      </div>
    </header>
  );
}

export function AdminDashboardShell({
  capabilities,
  children,
  notificationCenter,
  user,
}: {
  capabilities: AdminCapability[];
  children: ReactNode;
  notificationCenter: NotificationCenterState;
  user: AdminShellUser;
}) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <main className="min-h-screen overflow-x-hidden bg-white pt-[72px] text-[#111827] dark:bg-[#0f1114] dark:text-white lg:pl-[236px]">
      <AdminHeader
        notificationCenter={notificationCenter}
        onOpenMenu={() => setIsMobileNavOpen(true)}
      />
      <Sidebar capabilities={capabilities} pathname={pathname} user={user} />
      <MobileNavDrawer
        capabilities={capabilities}
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        pathname={pathname}
        user={user}
      />
      <section className="min-w-0 px-5 py-5 sm:px-7">{children}</section>
    </main>
  );
}
