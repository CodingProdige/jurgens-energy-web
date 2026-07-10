import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductCreateWizard } from "@/app/(seller)/seller/(dashboard)/products/new/product-create-wizard";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import {
  getSellerCreateProductData,
  getSellerEditableProductData,
} from "@/src/modules/sellers/product-create";

export const metadata: Metadata = {
  title: "Edit Product",
  description: "Edit a Jurgens Energy catalog product.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function EditAdminProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const [{ productId }, access] = await Promise.all([
    params,
    requireAdminCapability("admin.catalog.manage"),
  ]);

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const [data, initialProduct] = await Promise.all([
    getSellerCreateProductData(access.session.user.id),
    getSellerEditableProductData({
      productId,
      userId: access.session.user.id,
    }),
  ]);

  if (!initialProduct) {
    notFound();
  }

  return <ProductCreateWizard data={data} initialProduct={initialProduct} />;
}
