import type { Metadata } from "next";

import { AdminProductManager } from "@/app/(admin)/admin/(dashboard)/products/all/product-manager";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { getAdminProducts } from "@/src/modules/admin/product-reviews";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "Admin Products",
  description: "Browse and inspect products across every seller on Piessang.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminProductsAllPage() {
  const access = await requireAdminCapability("admin.catalog.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const data = await getAdminProducts();

  return <AdminProductManager {...data} />;
}
