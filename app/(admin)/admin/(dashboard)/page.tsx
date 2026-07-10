import {
  BadgeCheckIcon,
  BoxesIcon,
  ClipboardListIcon,
  FolderTreeIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminOverview } from "@/src/modules/admin";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description:
    "Protected Jurgens Energy admin dashboard for catalog, orders, users, audit logs, and analytics.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const access = await requireAdminCapability("admin.dashboard.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const overview = await getAdminOverview();

  return (
    <>
      <div className="mb-7 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
          <span>Admin</span>
          <span>/</span>
          <span>Overview</span>
        </div>
        <h1 className="text-[28px] font-bold tracking-normal text-zinc-950 dark:text-white">
          Marketplace operations
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-zinc-300">
          Review catalog activity, user growth, and operational risk from one
          controlled surface.
        </p>
      </div>

      <section
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        aria-label="Marketplace overview"
      >
        <DashboardStatCard
          description="Registered customer and admin accounts."
          icon={UsersIcon}
          label="Users"
          value={overview.users}
        />
        <DashboardStatCard
          description="Category branches available for merchandising."
          icon={FolderTreeIcon}
          label="Categories"
          value={overview.categories}
        />
        <DashboardStatCard
          description="Catalog records ready for moderation and merchandising."
          icon={BoxesIcon}
          label="Products"
          value={overview.products}
        />
        <DashboardStatCard
          description="Sensitive admin actions captured for review."
          icon={ClipboardListIcon}
          label="Audit logs"
          value={overview.auditLogs}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardPanel
          title="Operational priorities"
          description="Keep the catalog, access, and traceability surfaces ready before analytics."
        >
          <div className="grid gap-3">
            {[
              "Maintain products, brands, and categories",
              "Review users and admin roles",
              "Capture audit logs for sensitive actions",
              "Keep order and fulfillment workflows traceable",
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
    </>
  );
}
