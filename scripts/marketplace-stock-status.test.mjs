import assert from "node:assert/strict";
import test from "node:test";

import {
  getMarketplaceProductLowStockQuantity,
  getMarketplaceProductStockStatus,
  getMarketplaceVariantStockStatus,
} from "../src/modules/marketplace/stock-status.ts";

test("low stock starts at and below the configured threshold", () => {
  assert.equal(
    getMarketplaceVariantStockStatus({
      continueSellingOutOfStock: false,
      lowStockAlert: 9,
      stockOnHand: 9,
    }),
    "low_stock",
  );
  assert.equal(
    getMarketplaceVariantStockStatus({
      continueSellingOutOfStock: false,
      lowStockAlert: 9,
      stockOnHand: 8,
    }),
    "low_stock",
  );
});

test("stock above the low-stock threshold remains in stock", () => {
  assert.equal(
    getMarketplaceVariantStockStatus({
      continueSellingOutOfStock: false,
      lowStockAlert: 9,
      stockOnHand: 10,
    }),
    "in_stock",
  );
});

test("zero stock without overselling is backorder before low stock", () => {
  assert.equal(
    getMarketplaceVariantStockStatus({
      continueSellingOutOfStock: false,
      lowStockAlert: 9,
      stockOnHand: 0,
    }),
    "backorder",
  );
});

test("product stock is low only when no active variant has normal stock", () => {
  assert.equal(
    getMarketplaceProductStockStatus([
      {
        continueSellingOutOfStock: false,
        lowStockAlert: 9,
        stockOnHand: 9,
      },
      {
        continueSellingOutOfStock: false,
        lowStockAlert: 3,
        stockOnHand: 12,
      },
    ]),
    "in_stock",
  );
  assert.equal(
    getMarketplaceProductStockStatus([
      {
        continueSellingOutOfStock: false,
        lowStockAlert: 9,
        stockOnHand: 9,
      },
    ]),
    "low_stock",
  );
});

test("product low-stock quantity totals only genuinely scarce stock", () => {
  assert.equal(
    getMarketplaceProductLowStockQuantity([
      {
        continueSellingOutOfStock: false,
        lowStockAlert: 9,
        stockOnHand: 9,
      },
    ]),
    9,
  );
  assert.equal(
    getMarketplaceProductLowStockQuantity([
      {
        continueSellingOutOfStock: false,
        lowStockAlert: 9,
        stockOnHand: 9,
      },
      {
        continueSellingOutOfStock: false,
        lowStockAlert: 3,
        stockOnHand: 12,
      },
    ]),
    null,
  );
  assert.equal(
    getMarketplaceProductLowStockQuantity([
      {
        continueSellingOutOfStock: true,
        lowStockAlert: 9,
        stockOnHand: 0,
      },
    ]),
    null,
  );
});
