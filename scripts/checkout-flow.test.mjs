import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECKOUT_STEPS,
  getCheapestCheckoutShippingOption,
  isCheckoutAddressStepReady,
  isCheckoutShippingStepReady,
} from "../src/modules/checkout/flow.ts";

test("defines the checkout steps in customer-facing order", () => {
  assert.deepEqual(CHECKOUT_STEPS, ["address", "shipping", "payment"]);
});

test("returns null when no checkout shipping options are available", () => {
  assert.equal(getCheapestCheckoutShippingOption([]), null);
});

test("selects the checkout shipping option with the lowest amount", () => {
  const options = [
    { amountZar: 149, quoteId: "standard" },
    { amountZar: 89, quoteId: "economy" },
    { amountZar: 199, quoteId: "express" },
  ];

  assert.strictEqual(getCheapestCheckoutShippingOption(options), options[1]);
});

test("keeps the first checkout shipping option when amounts are equal", () => {
  const options = [
    { amountZar: 99, quoteId: "first" },
    { amountZar: 99, quoteId: "second" },
  ];

  assert.strictEqual(getCheapestCheckoutShippingOption(options), options[0]);
});

test("allows the address step to continue when every requirement is complete", () => {
  assert.equal(
    isCheckoutAddressStepReady({
      addressBookChoiceComplete: true,
      addressComplete: true,
      customerComplete: true,
    }),
    true,
  );
});

test("keeps the address step blocked for each incomplete requirement", () => {
  const ready = {
    addressBookChoiceComplete: true,
    addressComplete: true,
    customerComplete: true,
  };

  for (const field of Object.keys(ready)) {
    assert.equal(
      isCheckoutAddressStepReady({ ...ready, [field]: false }),
      false,
      `${field} should block the address step`,
    );
  }
});

test("allows the shipping step to continue when quotes and schedule are valid", () => {
  assert.equal(
    isCheckoutShippingStepReady({
      allGroupsAvailable: true,
      hasQuoteError: false,
      isLoadingQuotes: false,
      scheduleValid: true,
    }),
    true,
  );
});

test("keeps the shipping step blocked while rates are incomplete or invalid", () => {
  assert.equal(
    isCheckoutShippingStepReady({
      allGroupsAvailable: false,
      hasQuoteError: false,
      isLoadingQuotes: false,
      scheduleValid: true,
    }),
    false,
  );
  assert.equal(
    isCheckoutShippingStepReady({
      allGroupsAvailable: true,
      hasQuoteError: false,
      isLoadingQuotes: true,
      scheduleValid: true,
    }),
    false,
  );
  assert.equal(
    isCheckoutShippingStepReady({
      allGroupsAvailable: true,
      hasQuoteError: true,
      isLoadingQuotes: false,
      scheduleValid: true,
    }),
    false,
  );
  assert.equal(
    isCheckoutShippingStepReady({
      allGroupsAvailable: true,
      hasQuoteError: false,
      isLoadingQuotes: false,
      scheduleValid: false,
    }),
    false,
  );
});
