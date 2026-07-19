import assert from "node:assert/strict";
import test from "node:test";

import { isExchangeVariant } from "../src/modules/marketplace/product-variant-presentation.ts";

test("full/new variants do not activate exchange-only product details", () => {
  assert.equal(
    isExchangeVariant({
      requiresExchangeEmpty: false,
      title: "Full New",
    }),
    false,
  );
  assert.equal(isExchangeVariant(null), false);
});

test("exchange variants activate exchange-only product details", () => {
  assert.equal(
    isExchangeVariant({
      requiresExchangeEmpty: true,
      title: "Refill",
    }),
    true,
  );
  assert.equal(
    isExchangeVariant({
      requiresExchangeEmpty: false,
      title: "9kg Exchange",
    }),
    true,
  );
});
