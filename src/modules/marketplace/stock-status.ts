export type MarketplaceStockStatus = "backorder" | "in_stock" | "low_stock";

type MarketplaceVariantStockInput = {
  continueSellingOutOfStock: boolean;
  lowStockAlert: number;
  stockOnHand: number;
};

export const marketplaceStockStatusLabels: Record<
  MarketplaceStockStatus,
  string
> = {
  backorder: "Backorder",
  in_stock: "In Stock",
  low_stock: "Low stock",
};

export function getMarketplaceVariantInStock({
  continueSellingOutOfStock,
  stockOnHand,
}: Pick<
  MarketplaceVariantStockInput,
  "continueSellingOutOfStock" | "stockOnHand"
>) {
  return continueSellingOutOfStock || stockOnHand > 0;
}

export function getMarketplaceVariantStockStatus(
  variant: MarketplaceVariantStockInput,
): MarketplaceStockStatus {
  if (!getMarketplaceVariantInStock(variant)) {
    return "backorder";
  }

  const lowStockAlert = Math.max(0, Math.floor(variant.lowStockAlert));

  if (
    !variant.continueSellingOutOfStock &&
    lowStockAlert > 0 &&
    variant.stockOnHand <= lowStockAlert
  ) {
    return "low_stock";
  }

  return "in_stock";
}

export function getMarketplaceProductStockStatus(
  variants: readonly MarketplaceVariantStockInput[],
): MarketplaceStockStatus {
  const statuses = variants.map(getMarketplaceVariantStockStatus);

  if (statuses.includes("in_stock")) {
    return "in_stock";
  }

  if (statuses.includes("low_stock")) {
    return "low_stock";
  }

  return "backorder";
}

export function getMarketplaceProductLowStockQuantity(
  variants: readonly MarketplaceVariantStockInput[],
) {
  if (getMarketplaceProductStockStatus(variants) !== "low_stock") {
    return null;
  }

  const quantity = variants.reduce((total, variant) => {
    if (variant.continueSellingOutOfStock) {
      return total;
    }

    if (getMarketplaceVariantStockStatus(variant) !== "low_stock") {
      return total;
    }

    return total + Math.max(0, Math.floor(variant.stockOnHand));
  }, 0);

  return quantity > 0 ? quantity : null;
}

export function getMarketplaceStockStatusLabel(status: MarketplaceStockStatus) {
  return marketplaceStockStatusLabels[status];
}
