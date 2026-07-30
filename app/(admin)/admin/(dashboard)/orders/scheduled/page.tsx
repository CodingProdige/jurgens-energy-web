import type { Metadata } from "next";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import {
  DashboardCompactMetrics,
  type DashboardMetricDefinition,
} from "@/components/dashboard/dashboard-compact-metrics";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-controls";
import { getAdminScheduledOrders } from "@/src/modules/admin/scheduled-orders";
import { hasAdminCapability } from "@/src/modules/admin/staff";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { ScheduledOrdersManager } from "@/app/(admin)/admin/(dashboard)/orders/scheduled/scheduled-orders-manager";

export const metadata: Metadata = {
  title: "Local Deliveries",
  description: "Plan and progress paid Jurgens Energy local deliveries.",
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
      description: "All paid orders with a Jurgens local-delivery shipment.",
      id: "total",
      label: "Total",
      value: data.metrics.total,
    },
    {
      color: "red",
      description:
        "Paid local deliveries that still need an admin-assigned date.",
      id: "unscheduled",
      label: "Needs date",
      value: data.metrics.unscheduled,
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
        breadcrumbs={["Orders", "Local deliveries"]}
        title="Local Deliveries"
      />

      <div className="grid gap-4">
        <DashboardCompactMetrics
          metrics={metrics}
          storageKey="jurgens:admin:scheduled-order-metrics"
        />
        <ScheduledOrdersManager
          canManage={hasAdminCapability(
            access.session.user.adminCapabilities,
            "admin.orders.manage",
          )}
          rows={data.rows}
        />
      </div>
    </>
  );
}
