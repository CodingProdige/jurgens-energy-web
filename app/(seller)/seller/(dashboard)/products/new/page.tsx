import type { Metadata } from "next";

import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { getSellerCreateProductData } from "@/src/modules/sellers/product-create";
import { ProductCreateWizard } from "@/app/(seller)/seller/(dashboard)/products/new/product-create-wizard";

export const metadata: Metadata = {
  title: "New Product",
  description: "Create a new seller product on Piessang.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function NewSellerProductPage() {
  const session = await requireSellerDashboardAccess();
  const data = await getSellerCreateProductData(session.user.id);

  return <ProductCreateWizard data={data} />;
}
