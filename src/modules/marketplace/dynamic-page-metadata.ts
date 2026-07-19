import type { Metadata } from "next";

import { createMarketplaceCanonicalUrl } from "@/src/modules/marketplace/seo";

const marketplaceBrandName = "Jurgens Energy";
const brandedTitleSuffixPattern = /\s*[|\-–—]\s*Jurgens Energy\s*$/i;

type MarketplaceDynamicPageMetadataInput = {
  article?: {
    authorNames?: string[];
    modifiedAt?: Date | null;
    publishedAt?: Date | null;
  };
  description: string;
  image?: {
    alt: string;
    url: string;
  } | null;
  path: string;
  title: string;
};

export function compactMarketplaceMetadataDescription(
  value: string,
  maximumLength = 160,
) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maximumLength) {
    return normalized;
  }

  const sentenceEndings = [...normalized.matchAll(/[.!?](?=\s|$)/g)]
    .map((match) => (match.index ?? -1) + 1)
    .filter((index) => index >= 100 && index <= maximumLength);
  const sentenceEnding = sentenceEndings.at(-1);

  if (sentenceEnding) {
    return normalized.slice(0, sentenceEnding);
  }

  const wordBoundary = normalized.lastIndexOf(" ", maximumLength - 1);
  const cutoff = wordBoundary >= 100 ? wordBoundary : maximumLength - 1;

  return `${normalized.slice(0, cutoff).replace(/[,:;\s]+$/g, "")}…`;
}

/**
 * Builds the complete share and canonical metadata for database-backed public
 * marketplace pages. The document title stays unbranded so the root title
 * template adds the Jurgens Energy suffix exactly once.
 */
export function createMarketplaceDynamicPageMetadata({
  article,
  description,
  image,
  path,
  title,
}: MarketplaceDynamicPageMetadataInput): Metadata {
  const pageTitle = toUnbrandedPageTitle(title);
  const shareTitle =
    pageTitle.toLocaleLowerCase() === marketplaceBrandName.toLocaleLowerCase()
      ? marketplaceBrandName
      : `${pageTitle} | ${marketplaceBrandName}`;
  const canonicalUrl = createMarketplaceCanonicalUrl(path);
  const shareImage = image
    ? {
        alt: image.alt,
        url: createMarketplaceCanonicalUrl(image.url),
      }
    : undefined;
  const commonOpenGraphMetadata = {
    description,
    images: shareImage ? [shareImage] : undefined,
    locale: "en_ZA",
    siteName: marketplaceBrandName,
    title: shareTitle,
    url: canonicalUrl,
  };

  return {
    alternates: {
      canonical: canonicalUrl,
    },
    description,
    openGraph: article
      ? {
          ...commonOpenGraphMetadata,
          authors:
            article.authorNames && article.authorNames.length > 0
              ? article.authorNames
              : undefined,
          modifiedTime: article.modifiedAt?.toISOString(),
          publishedTime: article.publishedAt?.toISOString(),
          type: "article",
        }
      : {
          ...commonOpenGraphMetadata,
          type: "website",
        },
    title: pageTitle,
    twitter: {
      card: shareImage ? "summary_large_image" : "summary",
      description,
      images: shareImage ? [shareImage] : undefined,
      title: shareTitle,
    },
  };
}

function toUnbrandedPageTitle(title: string) {
  const normalizedTitle = title.trim();
  const unbrandedTitle = normalizedTitle.replace(brandedTitleSuffixPattern, "").trim();

  return unbrandedTitle || marketplaceBrandName;
}
