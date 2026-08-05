import type { Metadata } from "next";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import {
  DashboardBackButton,
  DashboardPageHeader,
} from "@/components/dashboard/dashboard-controls";
import { getAdminSalesData } from "@/src/modules/admin/sales";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

import { AdminSaleManager } from "./sale-manager";

export const metadata: Metadata = {
  title: "Product Sales",
  description: "Manage simple product sale pricing for Jurgens Energy.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminProductSalesPage() {
  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const data = await getAdminSalesData();

  return (
    <div className="grid min-w-0 gap-4">
      <DashboardPageHeader
        breadcrumbs={["Products", "Sales"]}
        title="Product sales"
      />
      <DashboardBackButton href="/products/all" label="Back to products" />
      <AdminSaleManager data={data} />
    </div>
  );
}
