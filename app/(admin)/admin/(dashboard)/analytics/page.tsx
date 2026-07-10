import type { Metadata } from "next";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import {
  DashboardPageHeader,
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "Admin Analytics",
  description: "Review Jurgens Energy operational analytics.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminAnalyticsPage() {
  const access = await requireAdminCapability("admin.analytics.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  return (
    <>
      <DashboardPageHeader breadcrumbs={["Analytics"]} title="Analytics" />
      <section className={dashboardPanelClass}>
        <div className="p-5">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            Analytics surface pending
          </p>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-zinc-400">
            This route is now protected and reachable. The next implementation
            should aggregate order, product, customer, and shipping metrics once
            the checkout and fulfillment pipeline starts writing live data.
          </p>
        </div>
      </section>
    </>
  );
}
