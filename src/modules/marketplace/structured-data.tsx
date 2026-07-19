import type { MarketplaceProductDetail } from "@/src/modules/marketplace/catalog";
import { createMarketplaceCanonicalUrl } from "@/src/modules/marketplace/seo";
import type { MarketplaceSettings } from "@/src/modules/marketplace/settings";

export type StructuredDataValue = Record<string, unknown>;

export function MarketplaceJsonLd({
  data,
}: {
  data: StructuredDataValue | StructuredDataValue[];
}) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
      type="application/ld+json"
    />
  );
}

export function createMarketplaceBusinessStructuredData({
  areaNames,
  settings,
}: {
  areaNames: string[];
  settings: MarketplaceSettings;
}): StructuredDataValue {
  const homeUrl = createMarketplaceCanonicalUrl("/");
  const organizationId = `${homeUrl}#organization`;
  const storeId = `${homeUrl}#store`;
  const contactPhone =
    settings.contactPhonePrimary.trim() ||
    settings.whatsappBusinessPhoneNumber?.trim() ||
    undefined;
  const sameAs = [
    settings.facebookUrl,
    settings.instagramUrl,
    settings.twitterUrl,
  ].filter((value): value is string => Boolean(value));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@id": organizationId,
        "@type": "Organization",
        name: "Jurgens Energy",
        url: homeUrl,
        ...(sameAs.length > 0 ? { sameAs } : {}),
      },
      {
        "@id": storeId,
        "@type": "Store",
        address: settings.contactAddress.trim() || undefined,
        areaServed: areaNames.map((name) => ({
          "@type": "AdministrativeArea",
          name,
        })),
        email: settings.contactEmail.trim() || undefined,
        name: "Jurgens Energy",
        parentOrganization: { "@id": organizationId },
        telephone: contactPhone,
        url: homeUrl,
      },
    ],
  };
}

export function createProductStructuredData(
  product: MarketplaceProductDetail,
): StructuredDataValue {
  const productUrl = createMarketplaceCanonicalUrl(`/products/${product.slug}`);
  const availableVariants = product.variants.filter((variant) =>
    Number.isFinite(Number(variant.price)),
  );
  const prices = availableVariants.map((variant) => Number(variant.price));
  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);
  const description =
    stripMarkup(product.shortDescription) ??
    stripMarkup(product.description) ??
    `Shop ${product.title} from Jurgens Energy.`;
  const images = product.imageUrls
    .map(toAbsoluteUrl)
    .filter((value): value is string => Boolean(value));
  const offer =
    availableVariants.length === 1
      ? {
          "@type": "Offer",
          availability: availableVariants[0]!.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          price: availableVariants[0]!.price,
          priceCurrency: "ZAR",
          seller: { "@id": `${createMarketplaceCanonicalUrl("/")}#organization` },
          url: `${productUrl}?variant=${encodeURIComponent(availableVariants[0]!.id)}`,
        }
      : prices.length > 0
        ? {
            "@type": "AggregateOffer",
            highPrice: highPrice.toFixed(2),
            lowPrice: lowPrice.toFixed(2),
            offerCount: availableVariants.length,
            priceCurrency: "ZAR",
            url: productUrl,
          }
        : undefined;

  return {
    "@context": "https://schema.org",
    "@id": `${productUrl}#product`,
    "@type": "Product",
    brand: product.brandName
      ? { "@type": "Brand", name: product.brandName }
      : undefined,
    category: product.category?.name,
    description,
    gtin: product.barcode || undefined,
    image: images.length > 0 ? images : undefined,
    name: product.title,
    offers: offer,
    sku:
      availableVariants.length === 1 ? availableVariants[0]!.sku : undefined,
    url: productUrl,
  };
}

export function createBreadcrumbStructuredData(
  items: Array<{ name: string; path: string }>,
): StructuredDataValue {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      item: createMarketplaceCanonicalUrl(item.path),
      name: item.name,
      position: index + 1,
    })),
  };
}

export function createFaqStructuredData(
  items: Array<{ answer: string; question: string }>,
): StructuredDataValue {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
      name: item.question,
    })),
  };
}

export function createArticleStructuredData({
  authorName,
  dateModified,
  datePublished,
  description,
  imageUrl,
  path,
  title,
}: {
  authorName: string | null;
  dateModified: Date;
  datePublished: Date | null;
  description: string;
  imageUrl: string | null;
  path: string;
  title: string;
}): StructuredDataValue {
  const url = createMarketplaceCanonicalUrl(path);

  return {
    "@context": "https://schema.org",
    "@id": `${url}#article`,
    "@type": "Article",
    author: authorName
      ? { "@type": "Person", name: authorName }
      : { "@id": `${createMarketplaceCanonicalUrl("/")}#organization` },
    dateModified: dateModified.toISOString(),
    datePublished: (datePublished ?? dateModified).toISOString(),
    description,
    headline: title,
    image: imageUrl ? toAbsoluteUrl(imageUrl) : undefined,
    mainEntityOfPage: url,
    publisher: { "@id": `${createMarketplaceCanonicalUrl("/")}#organization` },
    url,
  };
}

export function createDeliveryServiceStructuredData({
  areaNames,
}: {
  areaNames: string[];
}): StructuredDataValue {
  const url = createMarketplaceCanonicalUrl("/lpg-delivery");

  return {
    "@context": "https://schema.org",
    "@id": `${url}#service`,
    "@type": "Service",
    areaServed: areaNames.map((name) => ({
      "@type": "AdministrativeArea",
      name,
    })),
    description:
      "Local LPG cylinder delivery and eligible empty-cylinder exchange from Jurgens Energy, subject to live product, address and delivery-zone availability.",
    name: "Jurgens Energy local LPG delivery",
    provider: { "@id": `${createMarketplaceCanonicalUrl("/")}#store` },
    serviceType: "LPG cylinder delivery and exchange",
    url,
  };
}

function toAbsoluteUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, createMarketplaceCanonicalUrl("/")).toString();
  } catch {
    return null;
  }
}

function stripMarkup(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const stripped = value
    .replace(/<\/(p|div|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  return stripped || null;
}
