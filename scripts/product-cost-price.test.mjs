import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateGrossMarginBps,
  calculateGrossProfitCents,
  getVariantProfitability,
  normalizeOptionalCostPrice,
  optionalCostPriceInputSchema,
  parseMoneyToCents,
  resolveOptionalCostPriceForSave,
} from "../src/modules/products/cost-price.ts";

test("cost price validation accepts empty and non-negative decimal money", () => {
  assert.equal(optionalCostPriceInputSchema.safeParse(undefined).success, true);
  assert.equal(optionalCostPriceInputSchema.safeParse("").success, true);
  assert.equal(optionalCostPriceInputSchema.safeParse("0").success, true);
  assert.equal(optionalCostPriceInputSchema.safeParse("123.45").success, true);
  assert.equal(optionalCostPriceInputSchema.safeParse("-1").success, false);
  assert.equal(optionalCostPriceInputSchema.safeParse("12.345").success, false);
  assert.equal(optionalCostPriceInputSchema.safeParse("not money").success, false);
});

test("cost price normalization stores a canonical two-decimal string", () => {
  assert.equal(normalizeOptionalCostPrice(undefined), null);
  assert.equal(normalizeOptionalCostPrice(""), null);
  assert.equal(normalizeOptionalCostPrice(" 0012.5 "), "12.50");
  assert.equal(normalizeOptionalCostPrice("0"), "0.00");
  assert.throws(() => normalizeOptionalCostPrice("-2"), RangeError);
});

test("omitted cost preserves existing data while an explicit blank clears it", () => {
  assert.equal(
    resolveOptionalCostPriceForSave({
      existingCostPrice: "72.50",
      input: undefined,
    }),
    "72.50",
  );
  assert.equal(
    resolveOptionalCostPriceForSave({
      existingCostPrice: "72.50",
      input: "",
    }),
    null,
  );
  assert.equal(
    resolveOptionalCostPriceForSave({
      existingCostPrice: null,
      input: "80",
    }),
    "80.00",
  );
});

test("money conversion avoids floating point parsing for decimal inputs", () => {
  assert.equal(parseMoneyToCents("0.01"), 1);
  assert.equal(parseMoneyToCents("123.40"), 12_340);
  assert.equal(parseMoneyToCents("9999999999.99"), 999_999_999_999);
  assert.equal(parseMoneyToCents("10000000000.00"), null);
});

test("gross profit and gross margin support profit and loss", () => {
  assert.equal(calculateGrossProfitCents(10_000, 6_000), 4_000);
  assert.equal(calculateGrossMarginBps(10_000, 6_000), 4_000);
  assert.equal(calculateGrossProfitCents(10_000, 12_500), -2_500);
  assert.equal(calculateGrossMarginBps(10_000, 12_500), -2_500);
  assert.equal(calculateGrossMarginBps(0, 0), null);
  assert.throws(() => calculateGrossMarginBps(0, -1), RangeError);
});

test("variant profitability is unavailable until a cost price is supplied", () => {
  assert.equal(
    getVariantProfitability({ costPrice: null, price: "100.00" }),
    null,
  );
  assert.deepEqual(
    getVariantProfitability({ costPrice: "60.00", price: "100.00" }),
    {
      costPriceCents: 6_000,
      grossMarginBps: 4_000,
      grossProfitCents: 4_000,
      sellingPriceCents: 10_000,
    },
  );
});
