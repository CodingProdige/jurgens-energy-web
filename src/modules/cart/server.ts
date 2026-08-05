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
  type CartAvailabilityIssueReason,
  type CartValidationRequest,
  type CartValidationResponse,
  type InvalidCartItem,
  type ValidatedCartItem,
} from "@/src/modules/cart/contracts";
import { getBusinessVatStatus } from "@/src/modules/business-information";
import {
  getExchangeRequirementText,
  resolveCartLineExchangePolicy,
} from "@/src/modules/cart/exchange-requirements";
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
  const path = relativePath ?? thumbnailRelativePath;

  return path ? getMediaPublicUrl(path) : null;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function getAvailabilityIssue({
  activeVariant,
  inStock,
  publicProduct,
}: {
  activeVariant: boolean;
  inStock: boolean;
  publicProduct: boolean;
}): {
  label: string;
  reason: CartAvailabilityIssueReason;
} | null {
  if (!publicProduct) {
    return {
      label: "This product is not currently listed for sale.",
      reason: "product_not_live",
    };
  }

  if (!activeVariant) {
    return {
      label: "This selected option is not currently sold.",
      reason: "variant_not_active",
    };
  }

  if (!inStock) {
    return {
      label: "This selected option is out of stock.",
      reason: "out_of_stock",
    };
  }

  return null;
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
      invalidItems: [],
      invalidVariantIds: [],
      items: [],
      subtotalDisplay: 0,
      subtotalZar: 0,
    };
  }

  const [rows, vatStatus] = await Promise.all([
    db.select({
      brandName: brands.name,
      compareAtPrice: productVariants.compareAtPrice,
      continueSellingOutOfStock: productVariants.continueSellingOutOfStock,
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
      .where(inArray(productVariants.id, variantIds)),
    getBusinessVatStatus(),
  ]);

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
    const availabilityIssue = getAvailabilityIssue({
      activeVariant,
      inStock,
      publicProduct,
    });
    const maxQuantity = row.continueSellingOutOfStock
      ? 99
      : Math.max(0, Math.min(99, row.stockOnHand));
    const quantity = Math.min(requested.quantity, Math.max(1, maxQuantity || 1));
    const unitPriceZar = roundMoney(Number(row.price));
    const lineTotalZar = roundMoney(unitPriceZar * quantity);
    const taxRateBps = vatStatus.isVatRegistered ? row.taxRateBps : 0;
    const displayUnitPrice = roundMoney(
      convertFromZar(unitPriceZar, currencyContext),
    );
    const displayLineTotal = roundMoney(
      convertFromZar(lineTotalZar, currencyContext),
    );
    const requiresExchangeEmpty =
      row.requiresExchangeEmpty || /\bexchange\b/i.test(row.variantTitle);
    const exchangePolicy = resolveCartLineExchangePolicy({
      available,
      requiresExchangeEmpty,
    });
    const exchangeRequirementText = requiresExchangeEmpty
      ? getExchangeRequirementText({
          emptySize: row.exchangeEmptyCylinderSize,
          fallbackText: row.exchangeConfirmationText,
          quantity,
        })
      : null;

    return [
      {
        available,
        availabilityIssueLabel: availabilityIssue?.label ?? null,
        availabilityIssueReason: availabilityIssue?.reason ?? null,
        brandId: row.productBrandId,
        brandName: row.brandName,
        categoryId: row.productCategoryId,
        checkoutEligible: exchangePolicy.checkoutEligible,
        compareAtPriceZar:
          row.compareAtPrice === null ? null : Number(row.compareAtPrice),
        continueSellingOutOfStock: row.continueSellingOutOfStock,
        displayLineTotal,
        displayUnitPrice,
        exchangeConfirmationMissing: exchangePolicy.exchangeConfirmationMissing,
        exchangeConfirmationText: exchangeRequirementText,
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
        purchaseType: exchangePolicy.purchaseType,
        quantity,
        sellerId: row.productSellerId,
        sellerName: row.sellerName,
        shipsAlone: row.shipsAlone,
        sku: row.sku,
        taxRateBps,
        unitPriceLabel: formatFromZar(unitPriceZar, currencyContext),
        unitPriceZar,
        variantId: row.variantId,
        variantTitle: row.variantTitle,
        weightGrams: row.weightGrams,
        widthMm: row.widthMm,
      },
    ];
  });
  const invalidItems: InvalidCartItem[] = requestedLines
    .filter((requested) => !rowByVariantId.has(requested.variantId))
    .map((requested) => ({
      purchaseType: requested.purchaseType,
      quantity: requested.quantity,
      reason: "not_found",
      reasonLabel:
        "This product or selected option has been removed from the catalogue.",
      variantId: requested.variantId,
    }));
  const subtotalZar = roundMoney(
    validatedItems.reduce((total, item) => total + item.lineTotalZar, 0),
  );
  const subtotalDisplay = roundMoney(
    validatedItems.reduce((total, item) => total + item.displayLineTotal, 0),
  );

  return {
    currencyCode: currencyContext.currency,
    currencyLocale: currencyContext.locale,
    invalidItems,
    invalidVariantIds: invalidItems.map((item) => item.variantId),
    items: validatedItems,
    subtotalDisplay,
    subtotalZar,
  };
}
