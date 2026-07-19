import type { Metadata } from "next";

import { ProductCreateWizard } from "@/app/(seller)/seller/(dashboard)/products/new/product-create-wizard";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getSellerCreateProductData } from "@/src/modules/sellers/product-create";

export const metadata: Metadata = {
  title: "New Product",
  description: "Create a Jurgens Energy catalog product.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function NewAdminProductPage() {
  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const data = await getSellerCreateProductData(access.session.user.id);

  return <ProductCreateWizard data={data} enablePrivateCostPricing />;
}
