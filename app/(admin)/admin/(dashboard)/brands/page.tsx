import type { Metadata } from "next";

import { BrandDashboard } from "@/app/(admin)/admin/(dashboard)/brands/brand-manager";
import { requireAdminAccess } from "@/src/modules/auth/permissions";
import { getAdminBrands } from "@/src/modules/catalog/admin";
import { getAdminMediaLibrary } from "@/src/modules/media/admin";

export const metadata: Metadata = {
  title: "Admin Brands",
  description:
    "Manage Piessang marketplace brands and product brand visibility.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminBrandsPage() {
  const session = await requireAdminAccess();
  const [brandData, mediaLibrary] = await Promise.all([
    getAdminBrands(),
    getAdminMediaLibrary(session.user.id),
  ]);

  return <BrandDashboard {...brandData} mediaLibrary={mediaLibrary} />;
}
