import type { Metadata } from "next";

import { CategoryDashboard } from "@/app/(admin)/admin/(dashboard)/catalog/categories/category-manager";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminCatalogTaxonomy } from "@/src/modules/catalog/admin";

export const metadata: Metadata = {
  title: "Admin Categories",
  description: "Manage Jurgens Energy catalog categories and category branches.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminCategoriesPage() {
  const access = await requireAdminCapability("admin.catalog.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const taxonomy = await getAdminCatalogTaxonomy();

  return (
    <CategoryDashboard
      options={taxonomy.options}
      rootCategoryCount={taxonomy.rootCategoryCount}
      subcategoryCount={taxonomy.subcategoryCount}
      totalProducts={taxonomy.totalProducts}
      tree={taxonomy.tree}
    />
  );
}
