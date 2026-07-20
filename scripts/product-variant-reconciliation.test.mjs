import assert from "node:assert/strict";
import test from "node:test";

import { reconcileProductVariantIdentities } from "../src/modules/products/variant-reconciliation.ts";

const existingVariants = [
  { id: "exchange-id", sku: "9KG-EXCHANGE" },
  { id: "full-id", sku: "9KG-FULL" },
];

test("saved variant IDs survive media-only edits and SKU renames", () => {
  assert.deepEqual(
    reconcileProductVariantIdentities({
      existingVariants,
      submittedVariants: [
        { persistedVariantId: "exchange-id", sku: "9KG-EXCHANGE-NEW" },
        { persistedVariantId: "full-id", sku: "9KG-FULL" },
      ],
    }),
    {
      ok: true,
      resolvedVariantIds: ["exchange-id", "full-id"],
      retiredVariantIds: [],
    },
  );
});

test("repeat saves can recover existing IDs by SKU", () => {
  assert.deepEqual(
    reconcileProductVariantIdentities({
      existingVariants,
      submittedVariants: [
        { sku: "9kg-exchange" },
        { sku: "9kg-full" },
      ],
    }),
    {
      ok: true,
      resolvedVariantIds: ["exchange-id", "full-id"],
      retiredVariantIds: [],
    },
  );
});

test("a renamed single variant keeps its sole existing ID", () => {
  assert.deepEqual(
    reconcileProductVariantIdentities({
      existingVariants: [existingVariants[0]],
      fallbackToOnlyExistingVariant: true,
      submittedVariants: [{ sku: "RENAMED-SINGLE-SKU" }],
    }),
    {
      ok: true,
      resolvedVariantIds: ["exchange-id"],
      retiredVariantIds: [],
    },
  );
});

test("omitted variants are identified for safe retirement", () => {
  assert.deepEqual(
    reconcileProductVariantIdentities({
      existingVariants,
      submittedVariants: [
        { persistedVariantId: "exchange-id", sku: "9KG-EXCHANGE" },
      ],
    }),
    {
      ok: true,
      resolvedVariantIds: ["exchange-id"],
      retiredVariantIds: ["full-id"],
    },
  );
});

test("foreign and duplicate persisted IDs are rejected", () => {
  assert.deepEqual(
    reconcileProductVariantIdentities({
      existingVariants,
      submittedVariants: [
        { persistedVariantId: "foreign-id", sku: "FOREIGN" },
      ],
    }),
    {
      ok: false,
      message: "One or more saved variants do not belong to this product.",
    },
  );
  assert.deepEqual(
    reconcileProductVariantIdentities({
      existingVariants,
      submittedVariants: [
        { persistedVariantId: "exchange-id", sku: "9KG-EXCHANGE" },
        { persistedVariantId: "exchange-id", sku: "DUPLICATE" },
      ],
    }),
    {
      ok: false,
      message: "The same saved variant was submitted more than once.",
    },
  );
});
