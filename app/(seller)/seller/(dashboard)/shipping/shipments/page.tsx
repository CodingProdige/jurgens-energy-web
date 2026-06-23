import type { Metadata } from "next";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-controls";
import { DashboardCompactMetrics, type DashboardMetricDefinition } from "@/components/dashboard/dashboard-compact-metrics";
import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { getSellerShipments } from "@/src/modules/sellers/shipping";
import { ShipmentsManager } from "@/app/(seller)/seller/(dashboard)/shipping/shipping-managers";

export const metadata: Metadata = {
  title: "Shipments",
  description: "Track seller shipments.",
  robots: { index: false, follow: false },
};

export default async function SellerShipmentsPage() {
  const session = await requireSellerDashboardAccess();
  const data = await getSellerShipments(session.user.id);
  const metrics: DashboardMetricDefinition[] = [
    { id: "total", label: "Total shipments", value: data.shipments.length, color: "blue", description: "All shipments created for this seller." },
    { id: "open", label: "Open", value: data.shipments.filter((shipment) => !["delivered", "cancelled", "returned"].includes(shipment.status)).length, color: "amber", description: "Shipments still in progress." },
    { id: "ready", label: "Waybills ready", value: data.shipments.filter((shipment) => ["waybill_ready", "ready_for_collection"].includes(shipment.status)).length, color: "emerald", description: "Shipments ready for waybill printing or collection." },
    { id: "delivered", label: "Delivered", value: data.shipments.filter((shipment) => shipment.status === "delivered").length, color: "emerald", description: "Shipments delivered to customers." },
  ];

  return (
    <div className="grid gap-5">
      <DashboardPageHeader breadcrumbs={["Shipping", "Shipments"]} title="Shipments" />
      <DashboardCompactMetrics metrics={metrics} storageKey="seller-shipments-counts" />
      <ShipmentsManager shipments={data.shipments} />
    </div>
  );
}
