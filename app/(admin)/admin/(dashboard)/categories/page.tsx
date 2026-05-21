import type { Metadata } from "next";

import { CategoryDashboard } from "@/app/(admin)/admin/(dashboard)/categories/category-manager";
import { getAdminCatalogTaxonomy } from "@/src/modules/catalog/admin";

export const metadata: Metadata = {
  title: "Admin Categories",
  description:
    "Manage Piessang marketplace categories, category branches, and success fee defaults.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminCategoriesPage() {
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
