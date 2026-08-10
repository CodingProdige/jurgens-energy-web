export type SaleEligibilityFilter =
  | "all"
  | "eligible"
  | "on_sale"
  | "unavailable";

export type SaleStockFilter = "all" | "in_stock" | "out_of_stock";

export type SalePresentationFilters = {
  brand: string;
  category: string;
  eligibility: SaleEligibilityFilter;
  stock: SaleStockFilter;
  productStatus: string;
  query: string;
};

export type SalePresentationVariant = {
  activeCampaignId?: string | null;
  activeCampaignName?: string | null;
  availabilityCode?: string;
  id: string;
  optionValues?: readonly string[];
  productSlug?: string;
  selectable: boolean;
  sku: string;
  stockOnHand: number;
  title: string;
};

export type SalePresentationProduct<
  TVariant extends SalePresentationVariant = SalePresentationVariant,
> = {
  brandId?: string | null;
  brandName: string | null;
  categoryId?: string | null;
  categoryPath: string | null;
  id: string;
  slug?: string;
  status: string;
  title: string;
  variants: readonly TVariant[];
};

export type SaleSelectionState = {
  checked: boolean | "indeterminate";
  disabled: boolean;
  eligibleCount: number;
  selectedCount: number;
};

export type SalePresentationCounts = {
  activeCampaigns: number;
  blockedVariants: number;
  eligibleVariants: number;
  onSaleVariants: number;
  products: number;
  selectedVariants: number;
  variants: number;
};

export type SaleProductPage<TProduct> = {
  currentPage: number;
  end: number;
  pageSize: number;
  products: TProduct[];
  start: number;
  totalPages: number;
  totalProducts: number;
};

export const defaultSalePresentationFilters: SalePresentationFilters = {
  brand: "all",
  category: "all",
  eligibility: "all",
  stock: "all",
  productStatus: "all",
  query: "",
};

function normalizeSearchValue(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function matchesEntityFilter(
  id: string | null | undefined,
  label: string | null,
  filter: string,
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "__none__") {
    return !id && !label;
  }

  return id === filter || label === filter;
}

function isVariantOnSale(variant: SalePresentationVariant) {
  return (
    variant.availabilityCode === "active_campaign" ||
    variant.availabilityCode === "compare_at_sale" ||
    Boolean(variant.activeCampaignId || variant.activeCampaignName)
  );
}

function matchesEligibilityFilter(
  variant: SalePresentationVariant,
  filter: SaleEligibilityFilter,
) {
  if (filter === "eligible") {
    return variant.selectable;
  }

  if (filter === "on_sale") {
    return isVariantOnSale(variant);
  }

  if (filter === "unavailable") {
    return !variant.selectable && !isVariantOnSale(variant);
  }

  return true;
}

function matchesStockFilter(
  variant: SalePresentationVariant,
  filter: SaleStockFilter,
) {
  if (filter === "in_stock") {
    return variant.stockOnHand > 0;
  }

  if (filter === "out_of_stock") {
    return variant.stockOnHand <= 0;
  }

  return true;
}

function productMatchesQuery(
  product: SalePresentationProduct,
  normalizedQuery: string,
) {
  if (!normalizedQuery) {
    return true;
  }

  return [
    product.title,
    product.slug,
    product.brandName,
    product.categoryPath,
  ].some((value) => normalizeSearchValue(value).includes(normalizedQuery));
}

function variantMatchesQuery(
  variant: SalePresentationVariant,
  normalizedQuery: string,
) {
  if (!normalizedQuery) {
    return true;
  }

  return [
    variant.title,
    variant.sku,
    variant.productSlug,
    ...(variant.optionValues ?? []),
  ].some((value) =>
    normalizeSearchValue(value).includes(normalizedQuery),
  );
}

function toSelectedIdSet(selectedVariantIds: Iterable<string>) {
  return selectedVariantIds instanceof Set
    ? selectedVariantIds
    : new Set(selectedVariantIds);
}

/**
 * Keeps product context while filtering child variants. A product-level query
 * match retains every child that passes the non-search filters. A child-only
 * query match retains only the matching variants beneath their parent.
 */
export function filterSaleProducts<
  TVariant extends SalePresentationVariant,
  TProduct extends SalePresentationProduct<TVariant>,
>(
  products: readonly TProduct[],
  filters: Partial<SalePresentationFilters> = {},
): Array<TProduct & { variants: TVariant[] }> {
  const activeFilters = {
    ...defaultSalePresentationFilters,
    ...filters,
  };
  const normalizedQuery = normalizeSearchValue(activeFilters.query);

  return products.flatMap((product) => {
    if (
      !matchesEntityFilter(
        product.brandId,
        product.brandName,
        activeFilters.brand,
      ) ||
      !matchesEntityFilter(
        product.categoryId,
        product.categoryPath,
        activeFilters.category,
      ) ||
      (activeFilters.productStatus !== "all" &&
        product.status !== activeFilters.productStatus)
    ) {
      return [];
    }

    const productQueryMatch = productMatchesQuery(product, normalizedQuery);
    const matchingVariants = product.variants.filter(
      (variant) =>
        matchesEligibilityFilter(variant, activeFilters.eligibility) &&
        matchesStockFilter(variant, activeFilters.stock) &&
        (productQueryMatch || variantMatchesQuery(variant, normalizedQuery)),
    );

    return matchingVariants.length > 0
      ? [{ ...product, variants: [...matchingVariants] }]
      : [];
  });
}

export function getProductSelectionState(
  variants: readonly SalePresentationVariant[],
  selectedVariantIds: Iterable<string>,
): SaleSelectionState {
  const selectedIds = toSelectedIdSet(selectedVariantIds);
  const eligibleVariants = variants.filter((variant) => variant.selectable);
  const selectedCount = eligibleVariants.reduce(
    (count, variant) => count + Number(selectedIds.has(variant.id)),
    0,
  );

  return {
    checked:
      selectedCount === 0
        ? false
        : selectedCount === eligibleVariants.length
          ? true
          : "indeterminate",
    disabled: eligibleVariants.length === 0,
    eligibleCount: eligibleVariants.length,
    selectedCount,
  };
}

export function updateSelectedVariantIds(
  selectedVariantIds: Iterable<string>,
  variants: readonly SalePresentationVariant[],
  checked: boolean,
  limit = 200,
) {
  const nextSelectedIds = new Set(selectedVariantIds);
  const selectionLimit = Math.max(0, Math.trunc(limit));

  for (const variant of variants) {
    if (!variant.selectable) {
      continue;
    }

    if (checked) {
      if (nextSelectedIds.size < selectionLimit) {
        nextSelectedIds.add(variant.id);
      }
    } else {
      nextSelectedIds.delete(variant.id);
    }
  }

  return Array.from(nextSelectedIds);
}

export function getFilteredEligibleVariantIds(
  products: readonly SalePresentationProduct[],
) {
  return Array.from(
    new Set(
      products.flatMap((product) =>
        product.variants
          .filter((variant) => variant.selectable)
          .map((variant) => variant.id),
      ),
    ),
  );
}

export function countHiddenSelected(
  filteredProducts: readonly SalePresentationProduct[],
  selectedVariantIds: Iterable<string>,
) {
  const visibleVariantIds = new Set(
    filteredProducts.flatMap((product) =>
      product.variants.map((variant) => variant.id),
    ),
  );

  return Array.from(toSelectedIdSet(selectedVariantIds)).reduce(
    (count, variantId) => count + Number(!visibleVariantIds.has(variantId)),
    0,
  );
}

export function buildSalesMetrics(
  products: readonly SalePresentationProduct[],
  selectedVariantIds: Iterable<string>,
  activeCampaignCount: number,
): SalePresentationCounts {
  const variants = products.flatMap((product) => [...product.variants]);
  const selectedIds = toSelectedIdSet(selectedVariantIds);

  return {
    activeCampaigns: Number.isFinite(activeCampaignCount)
      ? Math.max(0, Math.trunc(activeCampaignCount))
      : 0,
    blockedVariants: variants.filter(
      (variant) => !variant.selectable && !isVariantOnSale(variant),
    ).length,
    eligibleVariants: variants.filter((variant) => variant.selectable).length,
    onSaleVariants: variants.filter(isVariantOnSale).length,
    products: products.length,
    selectedVariants: variants.filter(
      (variant) => variant.selectable && selectedIds.has(variant.id),
    ).length,
    variants: variants.length,
  };
}

/**
 * Paginates complete product groups, never flattened child rows, so one
 * product and its matching variants cannot be split across pages.
 */
export function paginateSaleProducts<TProduct>(
  products: readonly TProduct[],
  requestedPage: number,
  requestedPageSize: number,
): SaleProductPage<TProduct> {
  const pageSize =
    Number.isFinite(requestedPageSize) && requestedPageSize > 0
      ? Math.trunc(requestedPageSize)
      : 10;
  const totalProducts = products.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const currentPage = Math.min(
    totalPages,
    Math.max(
      1,
      Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1,
    ),
  );
  const offset = (currentPage - 1) * pageSize;
  const pageProducts = products.slice(offset, offset + pageSize);

  return {
    currentPage,
    end: Math.min(offset + pageProducts.length, totalProducts),
    pageSize,
    products: pageProducts,
    start: totalProducts === 0 ? 0 : offset + 1,
    totalPages,
    totalProducts,
  };
}
