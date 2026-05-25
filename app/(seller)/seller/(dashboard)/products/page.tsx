import type { Metadata } from "next";

import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { getSellerProductsPageData } from "@/src/modules/sellers/products";
import { SellerProductManager } from "@/app/(seller)/seller/(dashboard)/products/product-manager";

export const metadata: Metadata = {
  title: "Seller Products",
  description:
    "Manage seller products, fulfillment mode, and parcel readiness for Piessang shipping rates.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SellerProductsPage() {
  const session = await requireSellerDashboardAccess();
  const data = await getSellerProductsPageData(session.user.id);

  return <SellerProductManager data={data} />;
}
