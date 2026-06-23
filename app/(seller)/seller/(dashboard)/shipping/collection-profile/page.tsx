import type { Metadata } from "next";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-controls";
import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { getSellerCollectionProfile } from "@/src/modules/sellers/shipping";
import { CollectionProfileForm } from "@/app/(seller)/seller/(dashboard)/shipping/shipping-managers";

export const metadata: Metadata = {
  title: "Collection Profile",
  description: "Manage seller collection details.",
  robots: { index: false, follow: false },
};

export default async function SellerCollectionProfilePage() {
  const session = await requireSellerDashboardAccess();
  const data = await getSellerCollectionProfile(session.user.id);

  return (
    <div className="grid gap-5">
      <DashboardPageHeader breadcrumbs={["Shipping", "Collection profile"]} title="Collection profile" />
      <CollectionProfileForm profile={data.profile} />
    </div>
  );
}
