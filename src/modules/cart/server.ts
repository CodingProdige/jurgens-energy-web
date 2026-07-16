import { asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  brands,
  media,
  productMedia,
  products,
  productVariants,
  sellers,
} from "@/src/db/schema";
import {
  cartValidationRequestSchema,
  type CartValidationRequest,
  type CartValidationResponse,
  type ValidatedCartItem,
} from "@/src/modules/cart/contracts";
import {
  convertFromZar,
  formatFromZar,
  type CurrencyContext,
} from "@/src/modules/currency";
import { getMediaPublicUrl } from "@/src/modules/media/paths";

const publicProductStatuses = new Set(["active", "live"]);

function toMediaUrl(
  relativePath: string | null,
  thumbnailRelativePath: string | null,
) {
  const path = thumbnailRelativePath ?? relativePath;

  return path ? getMediaPublicUrl(path) : null;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function validateCartLines(
  input: CartValidationRequest,
  currencyContext: CurrencyContext,
): Promise<CartValidationResponse> {
  const parsed = cartValidationRequestSchema.parse(input);
  const requestedLines = Array.from(
    new Map(parsed.items.map((item) => [item.variantId, item])).values(),
  );
  const variantIds = requestedLines.map((item) => item.variantId);

  if (variantIds.length === 0) {
    return {
      currencyCode: currencyContext.currency,
      currencyLocale: currencyContext.locale,
      invalidVariantIds: [],
      items: [],
      subtotalDisplay: 0,
      subtotalZar: 0,
    };
  }

  const rows = await db
    .select({
      brandName: brands.name,
      compareAtPrice: productVariants.compareAtPrice,
      continueSellingOutOfStock: productVariants.continueSellingOutOfStock,
      exchangeAcceptedReturnBrands:
        productVariants.exchangeAcceptedReturnBrands,
      exchangeConfirmationText: productVariants.exchangeConfirmationText,
      exchangeEmptyCylinderSize: productVariants.exchangeEmptyCylinderSize,
      fulfillmentMode: products.fulfillmentMode,
      heightMm: productVariants.heightMm,
      isFragile: productVariants.isFragile,
      lengthMm: productVariants.lengthMm,
      mediaRelativePath: media.relativePath,
      mediaThumbnailRelativePath: media.thumbnailRelativePath,
      price: productVariants.price,
      productBrandId: products.brandId,
      productCategoryId: products.categoryId,
      productId: products.id,
      productSellerId: products.sellerId,
      productSlug: products.slug,
      productStatus: products.status,
      productTitle: products.title,
      requiresExchangeEmpty: productVariants.requiresExchangeEmpty,
      sellerName: sellers.displayName,
      shipsAlone: productVariants.shipsAlone,
      sku: productVariants.sku,
      stockOnHand: productVariants.stockOnHand,
      taxRateBps: productVariants.taxRateBps,
      variantId: productVariants.id,
      variantIsActive: productVariants.isActive,
      variantStatus: productVariants.status,
      variantTitle: productVariants.title,
      weightGrams: productVariants.weightGrams,
      widthMm: productVariants.widthMm,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(sellers, eq(sellers.id, products.sellerId))
    .leftJoin(media, eq(media.id, productVariants.mediaId))
    .where(inArray(productVariants.id, variantIds));

  const productIdsWithoutVariantMedia = rows
    .filter((row) => !row.mediaRelativePath)
    .map((row) => row.productId);
  const coverByProductId = new Map<string, string>();

  if (productIdsWithoutVariantMedia.length > 0) {
    const coverRows = await db
      .select({
        productId: productMedia.productId,
        relativePath: media.relativePath,
        thumbnailRelativePath: media.thumbnailRelativePath,
      })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(
        inArray(
          productMedia.productId,
          Array.from(new Set(productIdsWithoutVariantMedia)),
        ),
      )
      .orderBy(
        asc(productMedia.productId),
        desc(productMedia.isCover),
        asc(productMedia.sortOrder),
      );

    for (const cover of coverRows) {
      if (!coverByProductId.has(cover.productId)) {
        const url = toMediaUrl(cover.relativePath, cover.thumbnailRelativePath);

        if (url) {
          coverByProductId.set(cover.productId, url);
        }
      }
    }
  }

  const requestByVariantId = new Map(
    requestedLines.map((item) => [item.variantId, item]),
  );
  const rowByVariantId = new Map(rows.map((row) => [row.variantId, row]));
  const validatedItems = requestedLines.flatMap((requested): ValidatedCartItem[] => {
    const row = rowByVariantId.get(requested.variantId);

    if (!row) {
      return [];
    }

    const publicProduct = publicProductStatuses.has(row.productStatus);
    const activeVariant = row.variantIsActive && row.variantStatus === "active";
    const inStock = row.continueSellingOutOfStock || row.stockOnHand > 0;
    const available = publicProduct && activeVariant && inStock;
    const maxQuantity = row.continueSellingOutOfStock
      ? 99
      : Math.max(0, Math.min(99, row.stockOnHand));
    const quantity = Math.min(requested.quantity, Math.max(1, maxQuantity || 1));
    const unitPriceZar = roundMoney(Number(row.price));
    const lineTotalZar = roundMoney(unitPriceZar * quantity);
    const displayUnitPrice = roundMoney(
      convertFromZar(unitPriceZar, currencyContext),
    );
    const displayLineTotal = roundMoney(
      convertFromZar(lineTotalZar, currencyContext),
    );
    const requiresExchangeEmpty =
      row.requiresExchangeEmpty || /\bexchange\b/i.test(row.variantTitle);
    const purchaseType = requiresExchangeEmpty ? "exchange" : "standard";
    const exchangeConfirmationMissing =
      requiresExchangeEmpty && !requested.exchangeEmptyConfirmed;

    return [
      {
        available,
        brandId: row.productBrandId,
        brandName: row.brandName,
        categoryId: row.productCategoryId,
        checkoutEligible: available && !exchangeConfirmationMissing,
        compareAtPriceZar:
          row.compareAtPrice === null ? null : Number(row.compareAtPrice),
        continueSellingOutOfStock: row.continueSellingOutOfStock,
        displayLineTotal,
        displayUnitPrice,
        exchangeAcceptedReturnBrands: normalizeStringList(
          row.exchangeAcceptedReturnBrands,
        ),
        exchangeConfirmationMissing,
        exchangeConfirmationText: row.exchangeConfirmationText,
        exchangeEmptyConfirmed: requested.exchangeEmptyConfirmed,
        exchangeRequiredEmptyCylinderSize: row.exchangeEmptyCylinderSize,
        fulfillmentMode: row.fulfillmentMode,
        heightMm: row.heightMm,
        imageUrl:
          toMediaUrl(
            row.mediaRelativePath,
            row.mediaThumbnailRelativePath,
          ) ?? coverByProductId.get(row.productId) ?? null,
        inStock,
        isFragile: row.isFragile,
        lengthMm: row.lengthMm,
        lineTotalLabel: formatFromZar(lineTotalZar, currencyContext),
        lineTotalZar,
        maxQuantity,
        productId: row.productId,
        productSlug: row.productSlug,
        productTitle: row.productTitle,
        purchaseType,
        quantity,
        sellerId: row.productSellerId,
        sellerName: row.sellerName,
        shipsAlone: row.shipsAlone,
        sku: row.sku,
        taxRateBps: row.taxRateBps,
        unitPriceLabel: formatFromZar(unitPriceZar, currencyContext),
        unitPriceZar,
        variantId: row.variantId,
        variantTitle: row.variantTitle,
        weightGrams: row.weightGrams,
        widthMm: row.widthMm,
      },
    ];
  });
  const subtotalZar = roundMoney(
    validatedItems.reduce((total, item) => total + item.lineTotalZar, 0),
  );
  const subtotalDisplay = roundMoney(
    validatedItems.reduce((total, item) => total + item.displayLineTotal, 0),
  );

  return {
    currencyCode: currencyContext.currency,
    currencyLocale: currencyContext.locale,
    invalidVariantIds: variantIds.filter(
      (variantId) => !requestByVariantId.has(variantId) || !rowByVariantId.has(variantId),
    ),
    items: validatedItems,
    subtotalDisplay,
    subtotalZar,
  };
}
