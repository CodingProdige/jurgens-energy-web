"use client";

import {
  BarChart3Icon,
  BoxesIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderTreeIcon,
  InboxIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  SettingsIcon,
  TruckIcon,
  UserCogIcon,
  ZapIcon,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";

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
        label: "Local deliveries",
        href: "/orders/scheduled",
        capability: "admin.orders.view",
      },
      {
        label: "Invoices",
        href: "/orders/invoices",
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
    label: "Contact inquiries",
    href: "/contact-inquiries",
    icon: InboxIcon,
    capability: "admin.contact_inquiries.view",
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
        label: "Reviews",
        href: "/products/reviews",
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
    icon: SettingsIcon,
    children: [
      {
        label: "Platform",
        href: "/settings/platform",
        capability: "admin.settings.view",
      },
      {
        label: "Business information",
        href: "/settings/business",
        capability: "admin.settings.view",
      },
      {
        label: "SEO metadata",
        href: "/settings/seo",
        capability: "admin.marketing.view",
      },
    ],
  },
];

function getAdminNotificationNavCounts(
  notificationCenter: NotificationCenterState,
) {
  const counts = {
    contact: 0,
    orders: 0,
    reviews: 0,
    shipping: 0,
    whatsapp: 0,
  };

  for (const notification of notificationCenter.notifications) {
    if (notification.readAt) {
      continue;
    }

    const key = [
      notification.type,
      notification.title,
      notification.actionUrl ?? "",
    ]
      .join(" ")
      .toLowerCase();

    if (key.includes("contact")) {
      counts.contact += 1;
      continue;
    }

    if (key.includes("whatsapp") || key.includes("conversation")) {
      counts.whatsapp += 1;
      continue;
    }

    if (key.includes("review")) {
      counts.reviews += 1;
      continue;
    }

    if (
      key.includes("shipment") ||
      key.includes("shipping") ||
      key.includes("delivery")
    ) {
      counts.shipping += 1;
      continue;
    }

    if (key.includes("order") || key.includes("payment")) {
      counts.orders += 1;
    }
  }

  return counts;
}

function formatNavBadge(value: number) {
  if (value <= 0) {
    return null;
  }

  return value > 99 ? "99+" : value;
}

function withAdminNotificationBadges(
  items: DashboardSurfaceNavItem<AdminCapability>[],
  counts: ReturnType<typeof getAdminNotificationNavCounts>,
) {
  return items.map((item) => {
    const nextItem: DashboardSurfaceNavItem<AdminCapability> = { ...item };

    if (item.label === "Orders") {
      nextItem.badge = formatNavBadge(counts.orders);
      nextItem.children = item.children?.map((child) =>
        child.label === "All orders"
          ? { ...child, badge: formatNavBadge(counts.orders) }
          : child,
      );
    } else if (item.label === "Shipping") {
      nextItem.badge = formatNavBadge(counts.shipping);
    } else if (item.label === "WhatsApp") {
      nextItem.badge = formatNavBadge(counts.whatsapp);
    } else if (item.label === "Contact inquiries") {
      nextItem.badge = formatNavBadge(counts.contact);
    } else if (item.label === "Products") {
      nextItem.badge = formatNavBadge(counts.reviews);
      nextItem.children = item.children?.map((child) =>
        child.label === "Reviews"
          ? { ...child, badge: formatNavBadge(counts.reviews) }
          : child,
      );
    }

    return nextItem;
  });
}

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
  const navItemsWithBadges = useMemo(
    () =>
      withAdminNotificationBadges(
        navItems,
        getAdminNotificationNavCounts(notificationCenter),
      ),
    [notificationCenter],
  );

  return (
    <DashboardSurfaceShell
      accent="amber"
      brandAriaLabel="Jurgens Energy admin dashboard"
      capabilities={capabilities}
      currencyPreference={currencyPreference}
      navItems={navItemsWithBadges}
      notificationCenter={notificationCenter}
      notificationCenterHref="/notifications"
      notificationSurface="admin"
      searchAriaLabel="Search admin dashboard"
      searchPlaceholder="Search anything... (Orders, Products, Customers, etc.)"
      showQuickActions={false}
      user={user}
      userFallbackLabel="Admin user"
    >
      {children}
    </DashboardSurfaceShell>
  );
}
