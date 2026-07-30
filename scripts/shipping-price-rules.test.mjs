import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAbsorbedShippingCost,
  calculateCustomerShippingPrice,
} from "../src/modules/shipping/customer-shipping-policy.ts";

test("charges one configured flat fee below the free-shipping threshold", () => {
  assert.deepEqual(
    calculateCustomerShippingPrice({
      flatRate: 129.9,
      freeOverAmount: 1_500,
      orderSubtotal: 1_499.99,
    }),
    {
      amount: 129.9,
      flatRate: 129.9,
      freeOverAmount: 1_500,
      rule: "flat_rate",
    },
  );
});

test("makes delivery free at and above the configured threshold", () => {
  for (const orderSubtotal of [1_500, 2_000]) {
    assert.equal(
      calculateCustomerShippingPrice({
        flatRate: 129.9,
        freeOverAmount: 1_500,
        orderSubtotal,
      }).amount,
      0,
    );
  }
});

test("carrier cost never changes the customer fee", () => {
  const customerPrice = calculateCustomerShippingPrice({
    flatRate: 100,
    freeOverAmount: null,
    orderSubtotal: 500,
  });

  assert.equal(customerPrice.amount, 100);
  assert.equal(
    calculateAbsorbedShippingCost({
      customerAmount: customerPrice.amount,
      providerAmount: 140,
    }),
    40,
  );
  assert.equal(customerPrice.amount, 100);
});

test("absorbed cost is zero when the provider charge is below the customer fee", () => {
  assert.equal(
    calculateAbsorbedShippingCost({
      customerAmount: 140,
      providerAmount: 100,
    }),
    0,
  );
});

test("rejects invalid free-shipping thresholds", () => {
  assert.throws(
    () =>
      calculateCustomerShippingPrice({
        flatRate: 100,
        freeOverAmount: 0,
        orderSubtotal: 500,
      }),
    /greater than zero/,
  );
  assert.throws(
    () =>
      calculateCustomerShippingPrice({
        flatRate: 100,
        freeOverAmount: 0.001,
        orderSubtotal: 500,
      }),
    /at least one cent after rounding/,
  );
});
