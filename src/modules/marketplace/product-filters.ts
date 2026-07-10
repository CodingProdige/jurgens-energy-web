import type {
  MarketplaceProductCard,
} from "@/src/modules/marketplace/catalog";
import type {
  StorefrontProductSource,
} from "@/src/modules/marketplace/storefront-types";

export function getProductSearchText(product: MarketplaceProductCard) {
  return [
    product.title,
    product.brandName,
    product.category?.name,
    product.category?.path,
    product.shortDescription,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isExchangeProduct(product: MarketplaceProductCard) {
  return getProductSearchText(product).includes("exchange");
}

export function isFullCylinderProduct(product: MarketplaceProductCard) {
  const text = getProductSearchText(product);

  return (
    (text.includes("full lpg cylinders") ||
      text.includes("lpg cylinder") ||
      text.includes("lpg cylinders")) &&
    !text.includes("exchange") &&
    !text.includes("empty") &&
    !text.includes("deposit") &&
    !text.includes("accessor")
  );
}

export function isAccessoryProduct(product: MarketplaceProductCard) {
  const text = getProductSearchText(product);

  return (
    text.includes("accessor") ||
    text.includes("regulator") ||
    text.includes("hose") ||
    text.includes("fitting") ||
    text.includes("clamp") ||
    text.includes("burner") ||
    text.includes("cooker") ||
    text.includes("stove") ||
    text.includes("geyser")
  );
}

export function filterStorefrontProducts({
  products,
  selectedBrandIds = [],
  selectedCategoryIds = [],
  source,
}: {
  products: MarketplaceProductCard[];
  selectedBrandIds?: string[];
  selectedCategoryIds?: string[];
  source: StorefrontProductSource;
}) {
  if (source === "brand") {
    const selectedBrandIdSet = new Set(selectedBrandIds);

    return selectedBrandIdSet.size > 0
      ? products.filter(
          (product) =>
            product.brandId !== null && selectedBrandIdSet.has(product.brandId),
        )
      : products.filter((product) => product.brandId !== null);
  }

  if (source === "category") {
    const selectedCategoryIdSet = new Set(selectedCategoryIds);

    return selectedCategoryIdSet.size > 0
      ? products.filter(
          (product) =>
            product.category !== null &&
            selectedCategoryIdSet.has(product.category.id),
        )
      : products.filter((product) => product.category !== null);
  }

  if (source === "accessories") {
    return products.filter(isAccessoryProduct);
  }

  if (source === "exchange") {
    return products.filter(isExchangeProduct);
  }

  if (source === "full_cylinders") {
    const fullCylinderProducts = products.filter(isFullCylinderProduct);

    return fullCylinderProducts.length > 0 ? fullCylinderProducts : products;
  }

  return products;
}
