import assert from "node:assert/strict";
import test from "node:test";

import {
  getExchangeRequirementText,
  resolveCartLineExchangePolicy,
} from "../src/modules/cart/exchange-requirements.ts";

test("turns legacy checkbox copy into a delivery handover notice", () => {
  assert.equal(
    getExchangeRequirementText({
      emptySize: "9kg",
      fallbackText:
        "I confirm I have a 9kg empty cylinder in acceptable condition to exchange on delivery.",
      quantity: 1,
    }),
    "Supply us with your 9kg empty cylinder in acceptable condition when your order is delivered.",
  );
});

test("keeps custom notice copy and updates generated copy for quantity", () => {
  assert.equal(
    getExchangeRequirementText({
      emptySize: "9kg",
      fallbackText: "The cylinder must be safe to handle.",
      quantity: 1,
    }),
    "The cylinder must be safe to handle.",
  );
  assert.equal(
    getExchangeRequirementText({
      emptySize: "9kg",
      fallbackText: "The cylinder must be safe to handle.",
      quantity: 2,
    }),
    "Supply us with your 2 × 9kg empty cylinders in acceptable condition when your order is delivered.",
  );
});

test("replaces older bring or hand-over copy with delivery-specific wording", () => {
  assert.equal(
    getExchangeRequirementText({
      emptySize: "14kg",
      fallbackText:
        "Bring a 14kg empty cylinder in acceptable condition for exchange.",
      quantity: 1,
    }),
    "Supply us with your 14kg empty cylinder in acceptable condition when your order is delivered.",
  );
});

test("exchange notices never block an otherwise available cart line", () => {
  assert.deepEqual(
    resolveCartLineExchangePolicy({
      available: true,
      requiresExchangeEmpty: true,
    }),
    {
      checkoutEligible: true,
      exchangeConfirmationMissing: false,
      purchaseType: "exchange",
    },
  );
  assert.deepEqual(
    resolveCartLineExchangePolicy({
      available: false,
      requiresExchangeEmpty: true,
    }),
    {
      checkoutEligible: false,
      exchangeConfirmationMissing: false,
      purchaseType: "exchange",
    },
  );
  assert.deepEqual(
    resolveCartLineExchangePolicy({
      available: true,
      requiresExchangeEmpty: false,
    }),
    {
      checkoutEligible: true,
      exchangeConfirmationMissing: false,
      purchaseType: "standard",
    },
  );
});
