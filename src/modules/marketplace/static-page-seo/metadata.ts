import type { Metadata } from "next";

import { createMarketplaceCanonicalUrl } from "@/src/modules/marketplace/seo";

type OpenGraphImages = NonNullable<Metadata["openGraph"]>["images"];

export type CreateMarketplacePageMetadataInput = {
  description: string;
  images?: OpenGraphImages;
  openGraphType?: "article" | "website";
  path: string;
  title: string;
};

export function createBrandedMarketplaceTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();

  return /\bjurgens\s+energy\b/i.test(normalized)
    ? normalized
    : `${normalized} | Jurgens Energy`;
}

export function createMarketplacePageMetadata({
  description,
  images,
  openGraphType = "website",
  path,
  title,
}: CreateMarketplacePageMetadataInput): Metadata {
  const canonicalUrl = createMarketplaceCanonicalUrl(path);
  const brandedTitle = createBrandedMarketplaceTitle(title);

  return {
    alternates: {
      canonical: canonicalUrl,
    },
    description,
    openGraph: {
      description,
      images,
      locale: "en_ZA",
      siteName: "Jurgens Energy",
      title: brandedTitle,
      type: openGraphType,
      url: canonicalUrl,
    },
    title,
    twitter: {
      card: images ? "summary_large_image" : "summary",
      description,
      images,
      title: brandedTitle,
    },
  };
}
