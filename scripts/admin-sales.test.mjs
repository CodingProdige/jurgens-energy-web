import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSalesMetrics,
  countHiddenSelected,
  filterSaleProducts,
  getFilteredEligibleVariantIds,
  getProductSelectionState,
  paginateSaleProducts,
  updateSelectedVariantIds,
} from "../src/modules/admin/sales-presentation.ts";

function variant(
  id,
  {
    activeCampaignId = null,
    activeCampaignName = null,
    availabilityCode,
    selectable = true,
    sku = id.toUpperCase(),
    stockOnHand = 5,
    title = id,
  } = {},
) {
  return {
    activeCampaignId,
    activeCampaignName,
    availabilityCode,
    id,
    selectable,
    sku,
    stockOnHand,
    title,
  };
}

function product(
  id,
  variants,
  {
    brandName = "Alva",
    categoryPath = "gas/heaters",
    status = "active",
    title = id,
  } = {},
) {
  return {
    brandName,
    categoryPath,
    id,
    status,
    title,
    variants,
  };
}

const products = [
  product(
    "heater",
    [
      variant("heater-12", {
        sku: "GWH-12L",
        stockOnHand: 4,
        title: "12 litre",
      }),
      variant("heater-16", {
        sku: "GWH-16L",
        stockOnHand: 0,
        title: "16 litre",
      }),
    ],
    { title: "Gas water heater" },
  ),
  product(
    "cylinder",
    [
      variant("cylinder-exchange", {
        activeCampaignId: "winter-sale",
        activeCampaignName: "Winter sale",
        selectable: false,
        sku: "CYL-14-EX",
        title: "14 kg exchange",
      }),
      variant("cylinder-full", {
        availabilityCode: "compare_at_sale",
        selectable: false,
        sku: "CYL-14-FULL",
        stockOnHand: 0,
        title: "14 kg full",
      }),
    ],
    {
      brandName: "Handigas",
      categoryPath: "gas/cylinders",
      status: "draft",
      title: "Gas cylinder",
    },
  ),
];

test("search keeps product grouping and narrows child-only matches", () => {
  const productMatch = filterSaleProducts(products, {
    query: "water heater",
  });
  const skuMatch = filterSaleProducts(products, { query: "gwh-16l" });

  assert.equal(productMatch.length, 1);
  assert.equal(productMatch[0].id, "heater");
  assert.deepEqual(
    productMatch[0].variants.map((item) => item.id),
    ["heater-12", "heater-16"],
  );
  assert.equal(skuMatch.length, 1);
  assert.equal(skuMatch[0].id, "heater");
  assert.deepEqual(
    skuMatch[0].variants.map((item) => item.id),
    ["heater-16"],
  );
});

test("combined product and variant filters retain only matching groups", () => {
  const result = filterSaleProducts(products, {
    brand: "Alva",
    category: "gas/heaters",
    eligibility: "eligible",
    stock: "out_of_stock",
    productStatus: "active",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "heater");
  assert.deepEqual(
    result[0].variants.map((item) => item.id),
    ["heater-16"],
  );

  assert.deepEqual(
    filterSaleProducts(products, {
      eligibility: "on_sale",
    }).flatMap((product) => product.variants.map((item) => item.id)),
    ["cylinder-exchange", "cylinder-full"],
  );
  assert.deepEqual(
    filterSaleProducts(products, {
      eligibility: "unavailable",
    }).flatMap((product) => product.variants.map((item) => item.id)),
    [],
  );
});

test("parent selection is tri-state and never selects blocked variants", () => {
  const mixedVariants = [
    variant("eligible-one"),
    variant("eligible-two"),
    variant("blocked", { selectable: false }),
  ];

  assert.deepEqual(getProductSelectionState(mixedVariants, []), {
    checked: false,
    disabled: false,
    eligibleCount: 2,
    selectedCount: 0,
  });
  assert.equal(
    getProductSelectionState(mixedVariants, ["eligible-one"]).checked,
    "indeterminate",
  );

  const selected = updateSelectedVariantIds([], mixedVariants, true);
  assert.deepEqual(selected, ["eligible-one", "eligible-two"]);
  assert.deepEqual(getProductSelectionState(mixedVariants, selected), {
    checked: true,
    disabled: false,
    eligibleCount: 2,
    selectedCount: 2,
  });
  assert.deepEqual(
    getProductSelectionState([variant("blocked", { selectable: false })], []),
    {
      checked: false,
      disabled: true,
      eligibleCount: 0,
      selectedCount: 0,
    },
  );
});

test("filtered bulk selection changes eligible visible variants only", () => {
  const filteredProducts = filterSaleProducts(products, {
    stock: "out_of_stock",
  });

  assert.deepEqual(getFilteredEligibleVariantIds(filteredProducts), ["heater-16"]);

  const selected = updateSelectedVariantIds(
    ["heater-12", "selection-outside-filter"],
    filteredProducts.flatMap((item) => item.variants),
    true,
  );

  assert.deepEqual(selected, [
    "heater-12",
    "selection-outside-filter",
    "heater-16",
  ]);
  assert.deepEqual(
    updateSelectedVariantIds(
      selected,
      filteredProducts.flatMap((item) => item.variants),
      false,
    ),
    ["heater-12", "selection-outside-filter"],
  );
});

test("hidden selected count compares selection with all filtered child rows", () => {
  const filteredProducts = filterSaleProducts(products, {
    query: "gwh-16l",
  });

  assert.equal(
    countHiddenSelected(
      filteredProducts,
      ["heater-12", "heater-16", "cylinder-exchange"],
    ),
    2,
  );
});

test("counts distinguish eligible, active-sale, blocked, and valid selection", () => {
  assert.deepEqual(
    buildSalesMetrics(
      products,
      ["heater-12", "cylinder-full", "stale-variant"],
      3,
    ),
    {
      activeCampaigns: 3,
      blockedVariants: 0,
      eligibleVariants: 2,
      onSaleVariants: 2,
      products: 2,
      selectedVariants: 1,
      variants: 4,
    },
  );
});

test("product pagination accounts for every result beyond the old 80-row cap", () => {
  const largeCatalog = Array.from({ length: 101 }, (_, index) =>
    product(`product-${index + 1}`, [variant(`variant-${index + 1}`)]),
  );
  const filteredProducts = filterSaleProducts(largeCatalog);
  const firstPage = paginateSaleProducts(filteredProducts, 1, 25);
  const lastPage = paginateSaleProducts(filteredProducts, 5, 25);

  assert.equal(filteredProducts.length, 101);
  assert.equal(firstPage.totalProducts, 101);
  assert.equal(firstPage.totalPages, 5);
  assert.equal(firstPage.products.length, 25);
  assert.equal(lastPage.products.length, 1);
  assert.equal(lastPage.start, 101);
  assert.equal(lastPage.end, 101);
  assert.equal(lastPage.products[0].id, "product-101");
});

test("bulk selection respects the server campaign limit", () => {
  const targetVariants = Array.from({ length: 205 }, (_, index) =>
    variant(`variant-${index + 1}`),
  );
  const selected = updateSelectedVariantIds([], targetVariants, true);

  assert.equal(selected.length, 200);
  assert.equal(selected.at(-1), "variant-200");
  assert.deepEqual(
    updateSelectedVariantIds(selected, targetVariants.slice(0, 5), false),
    selected.slice(5),
  );
});
