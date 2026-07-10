import Link from "next/link";
import type { Metadata } from "next";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { StorefrontBuilder } from "@/components/admin/site-builder/storefront-builder";
import { JurgensEnergyLogo } from "@/components/brand/jurgens-energy-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
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

export default async function AdminSiteBuilderPage() {
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
    <main className="min-h-screen bg-[#f7f7f2] p-3 text-zinc-950 dark:bg-[#080808] dark:text-white sm:p-4">
      <header className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 shadow-sm dark:border-white/18 dark:bg-[#151719]">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            aria-label="Back to admin dashboard"
            className="inline-flex shrink-0"
            href="/"
          >
            <JurgensEnergyLogo compact />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight">
              Site Builder
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Full-screen marketplace home page editor.
            </p>
          </div>
        </div>
        <ThemeToggle compact />
      </header>

      <StorefrontBuilder
        brands={brands}
        categories={categories}
        chrome="dedicated"
        initialPage={storefrontPage}
        mediaLibrary={mediaLibrary}
      />
    </main>
  );
}
