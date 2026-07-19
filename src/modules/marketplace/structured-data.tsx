import type { MarketplaceProductDetail } from "@/src/modules/marketplace/catalog";
import { createMarketplaceBusinessAddress } from "@/src/modules/marketplace/business-structured-address";
import { createMarketplaceCanonicalUrl } from "@/src/modules/marketplace/seo";
import type { MarketplaceSettings } from "@/src/modules/marketplace/settings";
import type { PublicBusinessIdentity } from "@/src/modules/business-information";

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
  businessIdentity,
  settings,
}: {
  areaNames: string[];
  businessIdentity: PublicBusinessIdentity;
  settings: MarketplaceSettings;
}): StructuredDataValue {
  const homeUrl = createMarketplaceCanonicalUrl("/");
  const organizationId = `${homeUrl}#organization`;
  const onlineStoreId = `${homeUrl}#online-store`;
  const contactPhone =
    settings.contactPhonePrimary.trim() ||
    settings.whatsappBusinessPhoneNumber?.trim() ||
    undefined;
  const contactEmail = settings.contactEmail.trim() || undefined;
  const businessAddress = createMarketplaceBusinessAddress(
    businessIdentity.registeredAddress,
    settings.contactAddress,
  );
  const tradingName = businessIdentity.tradingName.trim() || "Jurgens Energy";
  const legalName = businessIdentity.legalName?.trim() || undefined;
  const registrationNumber =
    businessIdentity.companyRegistrationNumber?.trim() || undefined;
  const vatRegistrationNumber =
    businessIdentity.vatRegistrationNumber?.trim() || undefined;
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
        address: businessAddress,
        email: contactEmail,
        identifier: registrationNumber
          ? {
              "@type": "PropertyValue",
              propertyID: "South African company registration number",
              value: registrationNumber,
            }
          : undefined,
        legalName,
        name: tradingName,
        telephone: contactPhone,
        url: homeUrl,
        vatID: vatRegistrationNumber,
        ...(sameAs.length > 0 ? { sameAs } : {}),
      },
      {
        "@id": onlineStoreId,
        "@type": "OnlineStore",
        address: businessAddress,
        areaServed: areaNames.map((name) => ({
          "@type": "AdministrativeArea",
          name,
        })),
        email: contactEmail,
        legalName,
        name: tradingName,
        parentOrganization: { "@id": organizationId },
        telephone: contactPhone,
        url: homeUrl,
        vatID: vatRegistrationNumber,
      },
    ],
  };
}

export function createProductStructuredData(
  product: MarketplaceProductDetail,
  selectedVariantId?: string,
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
  const selectedVariant = selectedVariantId
    ? availableVariants.find((variant) => variant.id === selectedVariantId)
    : undefined;
  const exactVariant = selectedVariant ??
    (availableVariants.length === 1 ? availableVariants[0] : undefined);
  const exactVariantUrl = exactVariant
    ? `${productUrl}?variant=${encodeURIComponent(exactVariant.id)}`
    : undefined;
  const offer = exactVariant
      ? {
          "@type": "Offer",
          availability: exactVariant.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          price: exactVariant.price,
          priceCurrency: "ZAR",
          seller: { "@id": `${createMarketplaceCanonicalUrl("/")}#organization` },
          url: exactVariantUrl,
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
    "@id": exactVariantUrl
      ? `${exactVariantUrl}#product`
      : `${productUrl}#product`,
    "@type": "Product",
    brand: product.brandName
      ? { "@type": "Brand", name: product.brandName }
      : undefined,
    category: product.category?.name,
    description:
      exactVariant?.requiresExchangeEmpty
        ? `${description} Exchange price requires a compatible empty cylinder to be handed over at delivery.`
        : description,
    gtin:
      normalizeGtin(exactVariant?.barcode) ??
      (availableVariants.length === 1
        ? normalizeGtin(product.barcode)
        : null) ??
      undefined,
    image:
      exactVariant?.imageUrl
        ? [toAbsoluteUrl(exactVariant.imageUrl), ...images].filter(
            (value, index, values): value is string =>
              Boolean(value) && values.indexOf(value) === index,
          )
        : images.length > 0
          ? images
          : undefined,
    name:
      exactVariant && exactVariant.title !== product.title
        ? `${product.title} - ${exactVariant.title}`
        : product.title,
    offers: offer,
    sku: exactVariant?.sku,
    url: exactVariantUrl ?? productUrl,
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
    provider: { "@id": `${createMarketplaceCanonicalUrl("/")}#online-store` },
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

function normalizeGtin(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (![8, 12, 13, 14].includes(digits.length)) {
    return null;
  }

  const checkDigit = Number(digits.at(-1));
  let sum = 0;

  for (
    let index = digits.length - 2, position = 0;
    index >= 0;
    index--, position++
  ) {
    sum += Number(digits[index]) * (position % 2 === 0 ? 3 : 1);
  }

  return (10 - (sum % 10)) % 10 === checkDigit ? digits : null;
}
