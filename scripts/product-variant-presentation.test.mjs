import assert from "node:assert/strict";
import test from "node:test";

import {
  getSoldQuantityLabel,
  isExchangeVariant,
} from "../src/modules/marketplace/product-variant-presentation.ts";

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

test("sales proof uses honest rounded-down milestones", () => {
  assert.equal(getSoldQuantityLabel(0), null);
  assert.equal(getSoldQuantityLabel(Number.NaN), null);
  assert.equal(getSoldQuantityLabel(1), "1+ sold");
  assert.equal(getSoldQuantityLabel(27), "20+ sold");
  assert.equal(getSoldQuantityLabel(178), "100+ sold");
  assert.equal(getSoldQuantityLabel(1_782), "1K+ sold");
  assert.equal(getSoldQuantityLabel(128_000), "100K+ sold");
  assert.equal(getSoldQuantityLabel(2_400_000), "2M+ sold");
});
