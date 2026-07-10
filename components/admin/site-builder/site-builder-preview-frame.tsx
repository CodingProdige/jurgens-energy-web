"use client";

import { useEffect, useState } from "react";

import { StorefrontPageRenderer } from "@/components/marketplace/storefront-section-renderer";
import type { PublicBlogPostSummary } from "@/src/modules/blog";
import type {
  MarketplaceBrandSummary,
  MarketplaceCategorySummary,
  MarketplaceProductCard as MarketplaceProductCardData,
} from "@/src/modules/marketplace/catalog";
import type { StorefrontSection } from "@/src/modules/marketplace/storefront-types";

type PreviewUpdateMessage = {
  selectedSectionId: string | null;
  sections: StorefrontSection[];
  type: "site-builder-preview:update";
};

function isPreviewUpdateMessage(value: unknown): value is PreviewUpdateMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<PreviewUpdateMessage>;

  return (
    payload.type === "site-builder-preview:update" &&
    Array.isArray(payload.sections)
  );
}

export function SiteBuilderPreviewFrame({
  brands,
  blogPosts,
  categories,
  initialSections,
  products,
}: {
  brands: MarketplaceBrandSummary[];
  blogPosts: PublicBlogPostSummary[];
  categories: MarketplaceCategorySummary[];
  initialSections: StorefrontSection[];
  products: MarketplaceProductCardData[];
}) {
  const [sections, setSections] = useState(initialSections);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (!isPreviewUpdateMessage(event.data)) {
        return;
      }

      setSections(event.data.sections);
      setSelectedSectionId(event.data.selectedSectionId);
    }

    window.addEventListener("message", handleMessage);

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
      <div className="w-full overflow-hidden bg-white dark:bg-[#101010]">
        <StorefrontPageRenderer
          brands={brands}
          blogPosts={blogPosts}
          categories={categories}
          products={products}
          sections={sections}
          selectedSectionId={selectedSectionId}
        />
      </div>
    </main>
  );
}
