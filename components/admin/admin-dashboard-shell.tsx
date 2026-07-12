"use client";

import {
  BarChart3Icon,
  BoxesIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderTreeIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  SettingsIcon,
  TruckIcon,
  UserCogIcon,
  ZapIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  DashboardSurfaceShell,
  type DashboardSurfaceNavItem,
  type DashboardSurfaceUser,
} from "@/components/dashboard/dashboard-surface-shell";
import type { AdminCapability } from "@/src/modules/admin/staff-constants";
import type { CurrencyPreference } from "@/src/modules/currency";
import type { NotificationCenterState } from "@/src/modules/notifications/in-app";

const navItems: DashboardSurfaceNavItem<AdminCapability>[] = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboardIcon,
    capability: "admin.dashboard.view",
  },
  {
    label: "Orders",
    icon: ClipboardListIcon,
    children: [
      {
        label: "All orders",
        href: "/orders",
        capability: "admin.orders.view",
      },
      {
        label: "Scheduled",
        href: "/orders/scheduled",
        capability: "admin.orders.view",
      },
    ],
  },
  {
    label: "Shipping",
    href: "/shipping",
    icon: TruckIcon,
    capability: "admin.orders.view",
  },
  {
    label: "WhatsApp",
    href: "/whatsapp",
    icon: MessageCircleIcon,
    capability: "admin.orders.view",
  },
  {
    label: "Products",
    icon: BoxesIcon,
    children: [
      {
        label: "All products",
        href: "/products/all",
        capability: "admin.catalog.view",
      },
      {
        label: "New product",
        href: "/products/new",
        capability: "admin.catalog.manage",
      },
    ],
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
      {
        label: "Admin staff",
        href: "/users/staff",
        capability: "admin.staff.view",
      },
    ],
  },
  {
    label: "Site Builder",
    href: "/site-builder",
    icon: ZapIcon,
    capability: "admin.marketing.view",
  },
  {
    label: "Blog",
    href: "/blog",
    icon: FileTextIcon,
    capability: "admin.marketing.view",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3Icon,
    capability: "admin.analytics.view",
  },
  {
    label: "Settings",
    href: "/settings/platform",
    icon: SettingsIcon,
    capability: "admin.settings.view",
  },
];

export function AdminDashboardShell({
  capabilities,
  children,
  currencyPreference,
  notificationCenter,
  user,
}: {
  capabilities: AdminCapability[];
  children: ReactNode;
  currencyPreference: CurrencyPreference;
  notificationCenter: NotificationCenterState;
  user: DashboardSurfaceUser;
}) {
  return (
    <DashboardSurfaceShell
      accent="amber"
      brandAriaLabel="Jurgens Energy admin dashboard"
      capabilities={capabilities}
      currencyPreference={currencyPreference}
      navItems={navItems}
      notificationCenter={notificationCenter}
      notificationCenterHref="/notifications"
      notificationSurface="admin"
      searchAriaLabel="Search admin dashboard"
      searchPlaceholder="Search anything... (Orders, Products, Customers, etc.)"
      user={user}
      userFallbackLabel="Admin user"
    >
      {children}
    </DashboardSurfaceShell>
  );
}
