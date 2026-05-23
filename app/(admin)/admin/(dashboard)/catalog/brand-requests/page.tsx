import type { Metadata } from "next";

import { BrandRequestDashboard } from "@/app/(admin)/admin/(dashboard)/catalog/brand-requests/brand-request-manager";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminBrandRequests } from "@/src/modules/catalog/admin";

export const metadata: Metadata = {
  title: "Admin Brand Requests",
  description: "Review seller-submitted brand requests for Piessang catalog.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminBrandRequestsPage() {
  const access = await requireAdminCapability("admin.catalog.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const requestData = await getAdminBrandRequests();

  return <BrandRequestDashboard {...requestData} />;
}
