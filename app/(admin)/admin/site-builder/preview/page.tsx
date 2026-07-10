import type { Metadata } from "next";

import { SiteBuilderPreviewFrame } from "@/components/admin/site-builder/site-builder-preview-frame";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getPublishedBlogPosts } from "@/src/modules/blog";
import { getCurrencyContext } from "@/src/modules/currency/server";
import { getMarketplaceCatalog } from "@/src/modules/marketplace/catalog";
import { getStorefrontPageForAdmin } from "@/src/modules/marketplace/storefront";

export const metadata: Metadata = {
  title: "Site Builder Preview",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminSiteBuilderPreviewPage() {
  const access = await requireAdminCapability("admin.marketing.view");

  if (!access.ok) {
    return null;
  }

  const currencyContext = await getCurrencyContext();
  const [blogPosts, catalog, storefrontPage] = await Promise.all([
    getPublishedBlogPosts(12),
    getMarketplaceCatalog({
      currencyContext,
      limit: 48,
    }),
    getStorefrontPageForAdmin(),
  ]);

  return (
    <SiteBuilderPreviewFrame
      brands={catalog.brands}
      blogPosts={blogPosts}
      categories={catalog.categories}
      initialSections={storefrontPage.draftSections}
      products={catalog.products}
    />
  );
}
