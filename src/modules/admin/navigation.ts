import {
  BoxesIcon,
  ClipboardListIcon,
  FolderTreeIcon,
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
  { label: "Users", href: "/users/all", icon: UsersIcon },
  { label: "Sellers", href: "/users/sellers", icon: StoreIcon },
  { label: "Categories", href: "/catalog/categories", icon: FolderTreeIcon },
  { label: "Products", href: "/products", icon: BoxesIcon },
  { label: "Orders", href: "/orders", icon: PackageCheckIcon },
  { label: "Audit logs", href: "/audit-logs", icon: ClipboardListIcon },
  { label: "Analytics", href: "/analytics", icon: LineChartIcon },
  { label: "Settings", href: "/settings/platform", icon: SettingsIcon },
];
