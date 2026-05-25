import type { Metadata } from "next";

import { SellerApplicationManager } from "@/app/(admin)/admin/(dashboard)/users/applications/application-manager";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminSellerApplications } from "@/src/modules/users/seller-applications";

export const metadata: Metadata = {
  title: "Seller Applications",
  description: "Review seller applications in the Piessang admin dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SellerApplicationsPage() {
  const access = await requireAdminCapability("admin.sellers.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const applications = await getAdminSellerApplications();

  return <SellerApplicationManager {...applications} />;
}
