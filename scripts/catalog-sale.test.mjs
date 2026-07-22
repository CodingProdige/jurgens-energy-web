import assert from "node:assert/strict";
import test from "node:test";

import { isMarketplaceVariantOnSale } from "../src/modules/marketplace/catalog-sale.ts";

test("recognizes a valid positive compare-at discount", () => {
  assert.equal(
    isMarketplaceVariantOnSale({ compareAtPrice: "400.00", price: "365.99" }),
    true,
  );
});

test("rejects missing, equal, lower, zero, and invalid compare-at prices", () => {
  const nonSalePrices = [
    { compareAtPrice: null, price: "365.99" },
    { compareAtPrice: "365.99", price: "365.99" },
    { compareAtPrice: "300.00", price: "365.99" },
    { compareAtPrice: "100.00", price: "0" },
    { compareAtPrice: "invalid", price: "365.99" },
  ];

  for (const price of nonSalePrices) {
    assert.equal(isMarketplaceVariantOnSale(price), false);
  }
});
