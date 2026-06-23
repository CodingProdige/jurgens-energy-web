"use client";

import {
  BarChart3Icon,
  BoxesIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  PackageCheckIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StoreIcon,
  TruckIcon,
  WalletCardsIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  DashboardSurfaceShell,
  type DashboardSurfaceNavItem,
  type DashboardSurfaceUser,
} from "@/components/dashboard/dashboard-surface-shell";
import type { CurrencyPreference } from "@/src/modules/currency";
import type { NotificationCenterState } from "@/src/modules/notifications/in-app";

const navItems: DashboardSurfaceNavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboardIcon },
  { label: "Orders", href: "/orders", icon: ClipboardListIcon },
  { label: "Products", href: "/products", icon: BoxesIcon },
  {
    label: "Shipping",
    href: "/shipping",
    icon: TruckIcon,
    children: [
      { label: "Parcel presets", href: "/shipping/parcel-presets" },
      { label: "Shipments", href: "/shipping/shipments" },
      { label: "Collections", href: "/shipping/collections" },
      { label: "Collection profile", href: "/shipping/collection-profile" },
    ],
  },
  { label: "Fulfillment", href: "/fulfillment", icon: PackageCheckIcon },
  { label: "Storefront", href: "/storefront", icon: StoreIcon },
  { label: "Reviews", href: "/reviews", icon: ShieldCheckIcon },
  { label: "Payouts", href: "/payouts", icon: WalletCardsIcon },
  { label: "Analytics", href: "/analytics", icon: BarChart3Icon },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];

export function SellerDashboardShell({
  attentionHrefs,
  children,
  currencyPreference,
  notificationCenter,
  user,
}: {
  attentionHrefs?: string[];
  children: ReactNode;
  currencyPreference: CurrencyPreference;
  notificationCenter: NotificationCenterState;
  user: DashboardSurfaceUser;
}) {
  return (
    <DashboardSurfaceShell
      accent="green"
      attentionHrefs={attentionHrefs}
      brandAriaLabel="Piessang seller dashboard"
      currencyPreference={currencyPreference}
      navItems={navItems}
      notificationCenter={notificationCenter}
      notificationCenterHref="/notifications"
      notificationSurface="seller"
      searchAriaLabel="Search seller dashboard"
      searchPlaceholder="Search anything... (Orders, Products, Shipments, etc.)"
      user={user}
      userFallbackLabel="Seller user"
    >
      {children}
    </DashboardSurfaceShell>
  );
}
