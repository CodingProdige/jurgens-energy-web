import type { Metadata } from "next";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-controls";
import { StorefrontBuilder } from "@/components/admin/site-builder/storefront-builder";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminMediaLibrary } from "@/src/modules/media/admin";
import {
  getMarketplaceBrands,
  getMarketplaceCategories,
} from "@/src/modules/marketplace/catalog";
import { getStorefrontPageForAdmin } from "@/src/modules/marketplace/storefront";

export const metadata: Metadata = {
  title: "Site Builder",
  description: "Manage Jurgens Energy marketplace site content.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminMarketingPage() {
  const access = await requireAdminCapability("admin.marketing.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const [brands, categories, mediaLibrary, storefrontPage] = await Promise.all([
    getMarketplaceBrands(),
    getMarketplaceCategories(),
    getAdminMediaLibrary(access.session.user.id),
    getStorefrontPageForAdmin(),
  ]);

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={["Site Builder"]}
        title="Site Builder"
      />
      <StorefrontBuilder
        brands={brands}
        categories={categories}
        chrome="dashboard"
        initialPage={storefrontPage}
        mediaLibrary={mediaLibrary}
      />
    </>
  );
}
