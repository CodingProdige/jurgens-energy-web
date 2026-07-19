import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  brands,
  categories,
  media,
  productMedia,
  productVariants,
  products,
} from "@/src/db/schema";
import { createMarketplaceCanonicalUrl } from "@/src/modules/marketplace/seo";
import {
  getGoogleMerchantDestinationControls,
  type GoogleMerchantDestination,
} from "@/src/modules/marketplace/google-feed-utils";
import { getMediaPublicUrl } from "@/src/modules/media/paths";

const publicProductStatuses = ["live", "active"] as const;
const googleFeedCurrency = "ZAR";
const googleFeedDescriptionLimit = 5_000;
const googleFeedTitleLimit = 150;

type ProductOptionSchema = {
  name: string;
  values: string[];
};

type GoogleMerchantVariantOption = {
  name: string;
  value: string;
};

export type GoogleMerchantFeedItem = {
  additionalImageLinks: string[];
  availability: "in_stock" | "out_of_stock";
  brand: string;
  canonicalLink: string;
  description: string;
  excludedDestinations: GoogleMerchantDestination[];
  gtin: string | null;
  id: string;
  imageLink: string;
  itemGroupId: string | null;
  itemGroupTitle: string | null;
  identifierExists: boolean;
  includedDestinations: GoogleMerchantDestination[];
  link: string;
  mpn: string | null;
  price: string;
  productType: string | null;
  returnPolicyLabel: string | null;
  salePrice: string | null;
  shippingLabel: "local_lpg" | "national_courier";
  title: string;
  variantOptions: GoogleMerchantVariantOption[];
};

export async function getGoogleMerchantFeedItems() {
  const variantRows = await db
    .select({
      brandName: brands.name,
      categoryPath: categories.path,
      compareAtPrice: productVariants.compareAtPrice,
      continueSellingOutOfStock:
        productVariants.continueSellingOutOfStock,
      googleFulfillmentChannel: productVariants.googleFulfillmentChannel,
      googleReturnPolicyLabel: productVariants.googleReturnPolicyLabel,
      manufacturerMpn: productVariants.manufacturerMpn,
      optionSchema: products.optionSchema,
      optionValues: productVariants.optionValues,
      price: productVariants.price,
      productBarcode: products.barcode,
      productDescription: products.description,
      productFullDescription: products.fullDescription,
      productFulfillmentMode: products.fulfillmentMode,
      productId: products.id,
      productShortDescription: products.shortDescription,
      productSlug: products.slug,
      productTitle: products.title,
      requiresExchangeEmpty: productVariants.requiresExchangeEmpty,
      stockOnHand: productVariants.stockOnHand,
      variantBarcode: productVariants.barcode,
      variantId: productVariants.id,
      variantMediaId: productVariants.mediaId,
      variantTitle: productVariants.title,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        inArray(products.status, publicProductStatuses),
        eq(productVariants.status, "active"),
        eq(productVariants.isActive, true),
      ),
    )
    .orderBy(
      asc(products.title),
      asc(productVariants.price),
      asc(productVariants.title),
    );

  const eligibleRows = variantRows.filter((row) => {
    const price = Number(row.price);

    return (
      row.googleFulfillmentChannel !== "excluded" &&
      Number.isFinite(price) &&
      price > 0
    );
  });
  const productIds = uniqueStrings(eligibleRows.map((row) => row.productId));
  const variantMediaIds = uniqueStrings(
    eligibleRows
      .map((row) => row.variantMediaId)
      .filter((mediaId): mediaId is string => Boolean(mediaId)),
  );
  const [productMediaRows, variantMediaRows] = await Promise.all([
    productIds.length > 0
      ? db
          .select({
            productId: productMedia.productId,
            relativePath: media.relativePath,
          })
          .from(productMedia)
          .innerJoin(media, eq(media.id, productMedia.mediaId))
          .where(
            and(
              inArray(productMedia.productId, productIds),
              eq(media.isPublic, true),
            ),
          )
          .orderBy(
            asc(productMedia.productId),
            desc(productMedia.isCover),
            asc(productMedia.sortOrder),
          )
      : Promise.resolve([]),
    variantMediaIds.length > 0
      ? db
          .select({
            id: media.id,
            relativePath: media.relativePath,
          })
          .from(media)
          .where(
            and(inArray(media.id, variantMediaIds), eq(media.isPublic, true)),
          )
      : Promise.resolve([]),
  ]);
  const imageLinksByProductId = new Map<string, string[]>();

  for (const row of productMediaRows) {
    const imageLink = toAbsoluteMediaUrl(row.relativePath);
    const existingLinks = imageLinksByProductId.get(row.productId) ?? [];

    if (!existingLinks.includes(imageLink)) {
      existingLinks.push(imageLink);
      imageLinksByProductId.set(row.productId, existingLinks);
    }
  }

  const variantImageLinkById = new Map(
    variantMediaRows.map((row) => [row.id, toAbsoluteMediaUrl(row.relativePath)]),
  );
  const eligibleVariantCountByProductId = new Map<string, number>();

  for (const row of eligibleRows) {
    eligibleVariantCountByProductId.set(
      row.productId,
      (eligibleVariantCountByProductId.get(row.productId) ?? 0) + 1,
    );
  }

  return eligibleRows.flatMap((row): GoogleMerchantFeedItem[] => {
    const productImageLinks = imageLinksByProductId.get(row.productId) ?? [];
    const variantImageLink = row.variantMediaId
      ? variantImageLinkById.get(row.variantMediaId)
      : null;
    const imageLink = variantImageLink ?? productImageLinks[0] ?? null;

    if (!imageLink) {
      return [];
    }

    const currentPrice = Number(row.price);
    const compareAtPrice = Number(row.compareAtPrice);
    const isOnSale =
      Number.isFinite(compareAtPrice) && compareAtPrice > currentPrice;
    const variantOptions = getVariantOptions(row.optionSchema, row.optionValues);
    const shouldGroupVariants =
      (eligibleVariantCountByProductId.get(row.productId) ?? 0) > 1 &&
      variantOptions.length > 0;
    const canonicalLink = createMarketplaceCanonicalUrl(
      `/products/${encodeURIComponent(row.productSlug)}`,
    );
    const link = new URL(canonicalLink);
    link.searchParams.set("variant", row.variantId);
    const baseDescription =
      firstCleanProductText([
        row.productShortDescription,
        row.productDescription,
        row.productFullDescription,
      ]) ?? `${cleanProductText(row.productTitle)} from Jurgens Energy.`;
    const baseTitle = cleanProductText(
      row.variantTitle && row.variantTitle !== row.productTitle
        ? `${row.productTitle} - ${row.variantTitle}`
        : row.productTitle,
    );
    const isExchangeOffer = getIsExchangeOffer(row);
    const description = isExchangeOffer
      ? `${baseDescription} Exchange price requires a compatible empty cylinder to be handed over at delivery.`
      : baseDescription;
    const title = isExchangeOffer
      ? `${baseTitle} - Empty cylinder required`
      : baseTitle;
    const gtin =
      getValidGtin(row.variantBarcode) ?? getValidGtin(row.productBarcode);
    const mpn =
      firstCleanProductText([row.manufacturerMpn])?.slice(0, 70) ?? null;
    const returnPolicyLabel =
      firstCleanProductText([row.googleReturnPolicyLabel])?.slice(0, 100) ??
      null;
    const shippingLabel = getGoogleShippingLabel(
      row.googleFulfillmentChannel,
      row.productFulfillmentMode,
    );
    const destinations = getGoogleMerchantDestinationControls(shippingLabel);

    return [
      {
        additionalImageLinks: uniqueStrings(
          [variantImageLink, ...productImageLinks].filter(
            (candidate): candidate is string =>
              Boolean(candidate) && candidate !== imageLink,
          ),
        ).slice(0, 10),
        availability:
          row.continueSellingOutOfStock || row.stockOnHand > 0
            ? "in_stock"
            : "out_of_stock",
        brand: (
          firstCleanProductText([row.brandName]) ?? "Jurgens Energy"
        ).slice(0, 70),
        canonicalLink,
        description: description.slice(0, googleFeedDescriptionLimit),
        excludedDestinations: destinations.excluded,
        gtin,
        id: row.variantId,
        imageLink,
        itemGroupId: shouldGroupVariants ? row.productId : null,
        itemGroupTitle: shouldGroupVariants
          ? cleanProductText(row.productTitle).slice(0, googleFeedTitleLimit)
          : null,
        identifierExists: Boolean(gtin || mpn),
        includedDestinations: destinations.included,
        link: link.toString(),
        mpn,
        price: formatGooglePrice(isOnSale ? compareAtPrice : currentPrice),
        productType: row.categoryPath
          ? cleanProductText(row.categoryPath).slice(0, 750)
          : null,
        returnPolicyLabel,
        salePrice: isOnSale ? formatGooglePrice(currentPrice) : null,
        shippingLabel,
        title: title.slice(0, googleFeedTitleLimit),
        variantOptions: shouldGroupVariants ? variantOptions : [],
      },
    ];
  });
}

export async function renderGoogleMerchantFeed() {
  const items = await getGoogleMerchantFeedItems();
  const storeUrl = createMarketplaceCanonicalUrl("/");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "  <channel>",
    "    <title>Jurgens Energy Products</title>",
    `    <link>${escapeXml(storeUrl)}</link>`,
    "    <description>Live Jurgens Energy product availability and pricing.</description>",
    ...items.flatMap(renderGoogleMerchantFeedItem),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

function renderGoogleMerchantFeedItem(item: GoogleMerchantFeedItem) {
  return [
    "    <item>",
    `      <g:id>${escapeXml(item.id)}</g:id>`,
    `      <title>${escapeXml(item.title)}</title>`,
    `      <description>${escapeXml(item.description)}</description>`,
    `      <link>${escapeXml(item.link)}</link>`,
    `      <g:canonical_link>${escapeXml(item.canonicalLink)}</g:canonical_link>`,
    `      <g:image_link>${escapeXml(item.imageLink)}</g:image_link>`,
    ...item.additionalImageLinks.map(
      (imageLink) =>
        `      <g:additional_image_link>${escapeXml(imageLink)}</g:additional_image_link>`,
    ),
    `      <g:availability>${item.availability}</g:availability>`,
    `      <g:condition>new</g:condition>`,
    `      <g:price>${escapeXml(item.price)}</g:price>`,
    ...(item.salePrice
      ? [`      <g:sale_price>${escapeXml(item.salePrice)}</g:sale_price>`]
      : []),
    `      <g:brand>${escapeXml(item.brand)}</g:brand>`,
    ...(item.mpn ? [`      <g:mpn>${escapeXml(item.mpn)}</g:mpn>`] : []),
    ...(item.gtin ? [`      <g:gtin>${item.gtin}</g:gtin>`] : []),
    ...(!item.identifierExists
      ? ["      <g:identifier_exists>no</g:identifier_exists>"]
      : []),
    ...item.includedDestinations.map(
      (destination) =>
        `      <g:included_destination>${destination}</g:included_destination>`,
    ),
    ...item.excludedDestinations.map(
      (destination) =>
        `      <g:excluded_destination>${destination}</g:excluded_destination>`,
    ),
    `      <g:shipping_label>${escapeXml(item.shippingLabel)}</g:shipping_label>`,
    ...(item.returnPolicyLabel
      ? [
          `      <g:return_policy_label>${escapeXml(item.returnPolicyLabel)}</g:return_policy_label>`,
        ]
      : []),
    ...(item.productType
      ? [`      <g:product_type>${escapeXml(item.productType)}</g:product_type>`]
      : []),
    ...(item.itemGroupId && item.itemGroupTitle
      ? [
          `      <g:item_group_id>${escapeXml(item.itemGroupId)}</g:item_group_id>`,
          `      <g:item_group_title>${escapeXml(item.itemGroupTitle)}</g:item_group_title>`,
          ...item.variantOptions.flatMap((option) => [
            "      <g:variant_option>",
            `        <g:name>${escapeXml(option.name)}</g:name>`,
            `        <g:value>${escapeXml(option.value)}</g:value>`,
            "      </g:variant_option>",
          ]),
        ]
      : []),
    "    </item>",
  ];
}

function getVariantOptions(
  optionSchema: ProductOptionSchema[] | null,
  optionValues: string[],
) {
  if (!optionSchema?.length || optionSchema.length !== optionValues.length) {
    return [];
  }

  const options = optionSchema.map((option, index) => ({
    name: cleanProductText(option.name).slice(0, 250),
    value: cleanProductText(optionValues[index] ?? "").slice(0, 250),
  }));

  return options.every((option) => option.name && option.value) ? options : [];
}

function getIsExchangeOffer(row: {
  requiresExchangeEmpty: boolean;
  variantTitle: string;
}) {
  return row.requiresExchangeEmpty || /\bexchange\b/i.test(row.variantTitle);
}

function getGoogleShippingLabel(
  channel: "local_lpg" | "national_courier" | "excluded" | null,
  fulfillmentMode: "seller_fulfilled" | "piessang_fulfilled",
) {
  if (channel === "local_lpg" || channel === "national_courier") {
    return channel;
  }

  return fulfillmentMode === "piessang_fulfilled"
    ? ("local_lpg" as const)
    : ("national_courier" as const);
}

function formatGooglePrice(value: number) {
  return `${value.toFixed(2)} ${googleFeedCurrency}`;
}

function toAbsoluteMediaUrl(relativePath: string) {
  return createMarketplaceCanonicalUrl(getMediaPublicUrl(relativePath));
}

function cleanProductText(value: string) {
  return value
    .replace(/<\/(p|div|h[1-6]|li)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function firstCleanProductText(values: Array<string | null>) {
  for (const value of values) {
    const cleaned = value ? cleanProductText(value) : "";

    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}

function getValidGtin(value: string | null) {
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

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}
