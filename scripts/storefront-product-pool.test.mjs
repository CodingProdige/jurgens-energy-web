import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { filterStorefrontProducts } from "../src/modules/marketplace/product-filters.ts";

function category({ id, path }) {
  return {
    children: [],
    id,
    name: id,
    path,
    productCount: 1,
    slug: id,
  };
}

function product({ category, id }) {
  return {
    averageRating: 0,
    brandId: "brand",
    brandName: "Brand",
    brandSlug: "brand",
    category,
    compareAtPriceLabel: null,
    coverImageUrl: null,
    discountLabel: null,
    fulfillmentMode: "courier_guy",
    hasExchangeOption: false,
    id,
    inStock: true,
    lowStockQuantity: null,
    priceLabel: "R 100,00",
    previewVideo: null,
    quickAddVariantId: null,
    reviewCount: 0,
    shortDescription: null,
    slug: id,
    soldQuantity: 0,
    stockStatus: "in_stock",
    title: id,
    variantCount: 1,
  };
}

test("storefront product sections include products assigned to descendant categories", () => {
  const parent = category({ id: "gas-appliances", path: "gas-appliances" });
  const child = category({
    id: "burners",
    path: "gas-appliances/burners",
  });
  const sibling = category({ id: "gas-cylinders", path: "gas-cylinders" });

  const visible = filterStorefrontProducts({
    categories: [parent, child, sibling],
    products: [
      product({ category: child, id: "burner" }),
      product({ category: sibling, id: "cylinder" }),
    ],
    selectedBrandIds: [],
    selectedCategoryIds: [parent.id],
    source: "category",
  });

  assert.deepEqual(
    visible.map((item) => item.id),
    ["burner"],
  );
});

test("homepage and builder preview do not pre-truncate product sections before filtering", () => {
  const homepageSource = readFileSync("app/(marketplace)/page.tsx", "utf8");
  const builderPreviewSource = readFileSync(
    "app/(admin)/admin/site-builder/preview/page.tsx",
    "utf8",
  );

  assert.match(homepageSource, /getMarketplaceCatalog\(\{\s*brandSlug,[\s\S]*?limit:\s*null,/);
  assert.match(builderPreviewSource, /getMarketplaceCatalog\(\{\s*currencyContext,[\s\S]*?limit:\s*null,/);
});
