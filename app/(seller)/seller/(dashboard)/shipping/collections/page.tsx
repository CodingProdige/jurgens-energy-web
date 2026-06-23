import type { Metadata } from "next";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-controls";
import { DashboardCompactMetrics, type DashboardMetricDefinition } from "@/components/dashboard/dashboard-compact-metrics";
import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { getSellerShipments } from "@/src/modules/sellers/shipping";
import { CollectionsManager } from "@/app/(seller)/seller/(dashboard)/shipping/shipping-managers";

export const metadata: Metadata = {
  title: "Collections",
  description: "Track booked seller collections.",
  robots: { index: false, follow: false },
};

export default async function SellerCollectionsPage() {
  const session = await requireSellerDashboardAccess();
  const data = await getSellerShipments(session.user.id);
  const collectionRows = data.shipments.filter((shipment) =>
    ["booked", "waybill_ready", "ready_for_collection", "collected", "delivered"].includes(shipment.status),
  );
  const metrics: DashboardMetricDefinition[] = [
    { id: "upcoming", label: "Upcoming", value: collectionRows.filter((shipment) => ["booked", "waybill_ready", "ready_for_collection"].includes(shipment.status)).length, color: "amber", description: "Collections waiting for courier pickup." },
    { id: "completed", label: "Completed", value: collectionRows.filter((shipment) => ["collected", "delivered"].includes(shipment.status)).length, color: "emerald", description: "Collections already handed to courier." },
    { id: "waybills", label: "Waybills ready", value: collectionRows.filter((shipment) => shipment.status === "waybill_ready").length, color: "blue", description: "Collections with waybills ready to print." },
  ];

  return (
    <div className="grid gap-5">
      <DashboardPageHeader breadcrumbs={["Shipping", "Collections"]} title="Collections" />
      <DashboardCompactMetrics metrics={metrics} storageKey="seller-collections-counts" />
      <CollectionsManager shipments={data.shipments} />
    </div>
  );
}
