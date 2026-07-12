import type { Metadata } from "next";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import {
  DashboardCompactMetrics,
  type DashboardMetricDefinition,
} from "@/components/dashboard/dashboard-compact-metrics";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-controls";
import { getAdminScheduledOrders } from "@/src/modules/admin/scheduled-orders";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { ScheduledOrdersManager } from "@/app/(admin)/admin/(dashboard)/orders/scheduled/scheduled-orders-manager";

export const metadata: Metadata = {
  title: "Scheduled Orders",
  description: "Review and update scheduled Jurgens Energy delivery orders.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminScheduledOrdersPage() {
  const access = await requireAdminCapability("admin.orders.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const data = await getAdminScheduledOrders();
  const metrics: DashboardMetricDefinition[] = [
    {
      color: "blue",
      description: "All direct Jurgens delivery schedules currently stored.",
      id: "total",
      label: "Total",
      value: data.metrics.total,
    },
    {
      color: "amber",
      description: "Deliveries selected for today's local delivery date.",
      id: "today",
      label: "Today",
      value: data.metrics.today,
    },
    {
      color: "amber",
      description: "Scheduled, preparing, or rescheduled deliveries.",
      id: "scheduled",
      label: "Scheduled",
      value: data.metrics.scheduled,
    },
    {
      color: "blue",
      description: "Deliveries currently marked out for delivery.",
      id: "out_for_delivery",
      label: "Out",
      value: data.metrics.outForDelivery,
    },
    {
      color: "emerald",
      description: "Completed Jurgens direct deliveries.",
      id: "completed",
      label: "Completed",
      value: data.metrics.completed,
    },
    {
      color: "red",
      description: "Cancelled scheduled direct deliveries.",
      id: "cancelled",
      label: "Cancelled",
      value: data.metrics.cancelled,
    },
  ];

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={["Orders", "Scheduled"]}
        title="Scheduled Orders"
      />

      <div className="grid gap-4">
        <DashboardCompactMetrics
          metrics={metrics}
          storageKey="jurgens:admin:scheduled-order-metrics"
        />
        <ScheduledOrdersManager rows={data.rows} />
      </div>
    </>
  );
}
