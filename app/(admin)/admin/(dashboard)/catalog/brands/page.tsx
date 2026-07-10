import type { Metadata } from "next";

import { BrandDashboard } from "@/app/(admin)/admin/(dashboard)/catalog/brands/brand-manager";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminBrands } from "@/src/modules/catalog/admin";
import { getAdminMediaLibrary } from "@/src/modules/media/admin";

export const metadata: Metadata = {
  title: "Admin Brands",
  description: "Manage Jurgens Energy catalog brands and product brand visibility.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminBrandsPage() {
  const access = await requireAdminCapability("admin.catalog.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const [brandData, mediaLibrary] = await Promise.all([
    getAdminBrands(),
    getAdminMediaLibrary(access.session.user.id),
  ]);

  return <BrandDashboard {...brandData} mediaLibrary={mediaLibrary} />;
}
