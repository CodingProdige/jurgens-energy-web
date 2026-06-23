import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ProductCreateWizard } from "@/app/(seller)/seller/(dashboard)/products/new/product-create-wizard";
import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import {
  getSellerCreateProductData,
  getSellerEditableProductData,
} from "@/src/modules/sellers/product-create";

export const metadata: Metadata = {
  title: "Edit Product",
  description: "Edit a seller product on Piessang.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EditSellerProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const [{ productId }, session] = await Promise.all([
    params,
    requireSellerDashboardAccess(),
  ]);
  const [data, initialProduct] = await Promise.all([
    getSellerCreateProductData(session.user.id),
    getSellerEditableProductData({
      productId,
      userId: session.user.id,
    }),
  ]);

  if (!initialProduct) {
    notFound();
  }

  return <ProductCreateWizard data={data} initialProduct={initialProduct} />;
}
