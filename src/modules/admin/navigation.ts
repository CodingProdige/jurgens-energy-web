import {
  BoxesIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  PackageCheckIcon,
  SettingsIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react";

import type { DashboardNavItem } from "@/components/dashboard/dashboard-shell";

export const adminNavItems: DashboardNavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboardIcon },
  { label: "Users", href: "/users", icon: UsersIcon },
  { label: "Sellers", href: "/sellers", icon: StoreIcon },
  { label: "Products", href: "/products", icon: BoxesIcon },
  { label: "Orders", href: "/orders", icon: PackageCheckIcon },
  { label: "Audit logs", href: "/audit-logs", icon: ClipboardListIcon },
  { label: "Analytics", href: "/analytics", icon: LineChartIcon },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];
