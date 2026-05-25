"use client";

import {
  BarChart3Icon,
  BoxesIcon,
  ClipboardListIcon,
  FolderTreeIcon,
  LayoutDashboardIcon,
  PackageCheckIcon,
  SettingsIcon,
  ShieldCheckIcon,
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
      {
        label: "Seller applications",
        href: "/users/applications",
        capability: "admin.sellers.view",
      },
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

export function AdminDashboardShell({
  capabilities,
  children,
  notificationCenter,
  user,
}: {
  capabilities: AdminCapability[];
  children: ReactNode;
  notificationCenter: NotificationCenterState;
  user: DashboardSurfaceUser;
}) {
  return (
    <DashboardSurfaceShell
      accent="amber"
      brandAriaLabel="Piessang admin dashboard"
      capabilities={capabilities}
      navItems={navItems}
      notificationCenter={notificationCenter}
      notificationSurface="admin"
      searchAriaLabel="Search admin dashboard"
      searchPlaceholder="Search anything... (Orders, Products, Sellers, etc.)"
      user={user}
      userFallbackLabel="Admin user"
    >
      {children}
    </DashboardSurfaceShell>
  );
}
