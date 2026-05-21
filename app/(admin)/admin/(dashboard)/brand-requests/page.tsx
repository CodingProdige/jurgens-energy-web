import type { Metadata } from "next";

import { BrandRequestDashboard } from "@/app/(admin)/admin/(dashboard)/brand-requests/brand-request-manager";
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
  const requestData = await getAdminBrandRequests();

  return <BrandRequestDashboard {...requestData} />;
}
