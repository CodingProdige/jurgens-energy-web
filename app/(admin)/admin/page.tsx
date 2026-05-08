import {
  BadgeCheckIcon,
  BoxesIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  PackageCheckIcon,
  ShieldCheckIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";

import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { requireAdminAccess } from "@/src/modules/auth/permissions";
import { getAdminOverview } from "@/src/modules/admin";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description:
    "Protected Piessang admin dashboard for marketplace operations, sellers, users, products, orders, audit logs, and analytics.",
  robots: {
    index: false,
    follow: false,
  },
};

const adminNavItems = [
  { label: "Overview", href: "/", icon: LayoutDashboardIcon },
  { label: "Users", href: "/users", icon: UsersIcon },
  { label: "Sellers", href: "/sellers", icon: StoreIcon },
  { label: "Products", href: "/products", icon: BoxesIcon },
  { label: "Orders", href: "/orders", icon: PackageCheckIcon },
  { label: "Audit logs", href: "/audit-logs", icon: ClipboardListIcon },
  { label: "Analytics", href: "/analytics", icon: LineChartIcon },
];

export default async function AdminPage() {
  const session = await requireAdminAccess();
  const overview = await getAdminOverview();

  return (
    <DashboardShell
      activeHref="/"
      badge="Admin"
      description="Review platform activity, seller readiness, user growth, and operational risk from one controlled surface."
      eyebrow="Protected admin"
      navItems={adminNavItems}
      surfaceHref="/"
      surfaceLabel="Admin"
      title="Marketplace operations"
      userLabel={`${session.user.email} (admin)`}
    >
      <section
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        aria-label="Marketplace overview"
      >
        <DashboardStatCard
          description="Registered customer, seller, and admin accounts."
          icon={UsersIcon}
          label="Users"
          value={overview.users}
        />
        <DashboardStatCard
          description="Seller profiles across pending, active, and suspended states."
          icon={StoreIcon}
          label="Sellers"
          value={overview.sellers}
        />
        <DashboardStatCard
          description="Catalog records ready for moderation and merchandising."
          icon={BoxesIcon}
          label="Products"
          value={overview.products}
        />
        <DashboardStatCard
          description="Sensitive admin and seller actions captured for review."
          icon={ClipboardListIcon}
          label="Audit logs"
          value={overview.auditLogs}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardPanel
          title="Operational priorities"
          description="The next admin screens should focus on moderation, access, and traceability before analytics."
        >
          <div className="grid gap-3">
            {[
              "Approve and suspend sellers",
              "Review users and roles",
              "Capture audit logs for sensitive actions",
              "Prepare product moderation workflows",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-3 text-sm dark:border-white/10 dark:bg-white/[0.04]"
              >
                <BadgeCheckIcon className="size-4 text-amber-600 dark:text-amber-300" />
                {item}
              </div>
            ))}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Security posture"
          description="Keep server-side permission checks as the hard boundary."
        >
          <div className="rounded-xl border border-amber-500/20 bg-amber-600/10 p-4 dark:bg-amber-500/10">
            <ShieldCheckIcon className="size-5 text-amber-600 dark:text-amber-300" />
            <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
              Admin pages are dynamic, role-gated, and designed to stay uncached
              for user-specific operational data.
            </p>
          </div>
        </DashboardPanel>
      </section>
    </DashboardShell>
  );
}
