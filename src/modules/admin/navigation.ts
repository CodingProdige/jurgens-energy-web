import {
  BoxesIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderTreeIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  PackageCheckIcon,
  SettingsIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";

import type { DashboardNavItem } from "@/components/dashboard/dashboard-shell";

export const adminNavItems: DashboardNavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboardIcon },
  { label: "Users", href: "/users/all", icon: UsersIcon },
  { label: "Categories", href: "/catalog/categories", icon: FolderTreeIcon },
  { label: "Products", href: "/products/all", icon: BoxesIcon },
  { label: "Orders", href: "/orders", icon: PackageCheckIcon },
  { label: "Site Builder", href: "/site-builder", icon: ZapIcon },
  { label: "Blog", href: "/blog", icon: FileTextIcon },
  { label: "Audit logs", href: "/audit-logs", icon: ClipboardListIcon },
  { label: "Analytics", href: "/analytics", icon: LineChartIcon },
  { label: "Settings", href: "/settings/platform", icon: SettingsIcon },
];
