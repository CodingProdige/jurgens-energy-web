import type { Metadata } from "next";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-controls";
import { DashboardCompactMetrics, type DashboardMetricDefinition } from "@/components/dashboard/dashboard-compact-metrics";
import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { getSellerParcelPresets } from "@/src/modules/sellers/shipping";
import { ParcelPresetsManager } from "@/app/(seller)/seller/(dashboard)/shipping/shipping-managers";

export const metadata: Metadata = {
  title: "Parcel Presets",
  description: "Manage reusable parcel metrics.",
  robots: { index: false, follow: false },
};

export default async function SellerParcelPresetsPage() {
  const session = await requireSellerDashboardAccess();
  const data = await getSellerParcelPresets(session.user.id);
  const metrics: DashboardMetricDefinition[] = [
    { id: "total", label: "Total presets", value: data.presets.length, color: "blue", description: "All parcel presets saved for this seller." },
    { id: "active", label: "Active", value: data.presets.filter((preset) => preset.isActive).length, color: "emerald", description: "Presets available on product and variant forms." },
    { id: "inactive", label: "Inactive", value: data.presets.filter((preset) => !preset.isActive).length, color: "slate", description: "Disabled presets kept for history." },
    { id: "default", label: "Default", value: data.presets.filter((preset) => preset.isDefault).length, color: "amber", description: "Preset that auto-fills new product parcel metrics." },
  ];

  return (
    <div className="grid gap-5">
      <DashboardPageHeader breadcrumbs={["Shipping", "Parcel presets"]} title="Parcel presets" />
      <DashboardCompactMetrics metrics={metrics} storageKey="seller-parcel-presets-counts" />
      <ParcelPresetsManager presets={data.presets} />
    </div>
  );
}
