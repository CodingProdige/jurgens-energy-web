import assert from "node:assert/strict";
import test from "node:test";

import { customerShippingSnapshotMatchesCart } from "../src/modules/shipping/customer-shipping-snapshot.ts";

const variantId = "00000000-0000-4000-8000-000000000001";
const sellerId = "00000000-0000-4000-8000-000000000099";
const cartItem = {
  fulfillmentMode: "seller_fulfilled",
  heightMm: 200,
  lengthMm: 300,
  quantity: 2,
  sellerId,
  unitPriceZar: 249.9,
  variantId,
  weightGrams: 1_500,
  widthMm: 100,
};
const snapshotItem = {
  fulfillmentMode: "courier_guy",
  heightMm: 200,
  lengthMm: 300,
  price: 249.9,
  quantity: 2,
  sellerId,
  variantId,
  weightGrams: 1_500,
  widthMm: 100,
};

test("accepts an immutable customer shipping snapshot for the current cart", () => {
  assert.equal(
    customerShippingSnapshotMatchesCart([snapshotItem], [cartItem]),
    true,
  );
});

test("rejects stale price, fulfillment, quantity, and measurement snapshots", () => {
  for (const staleSnapshot of [
    { ...snapshotItem, price: 250 },
    { ...snapshotItem, fulfillmentMode: "jurgens_local" },
    { ...snapshotItem, quantity: 1 },
    {
      ...snapshotItem,
      sellerId: "00000000-0000-4000-8000-000000000098",
    },
    { ...snapshotItem, weightGrams: 1_600 },
  ]) {
    assert.equal(
      customerShippingSnapshotMatchesCart([staleSnapshot], [cartItem]),
      false,
    );
  }
});

test("rejects malformed or incomplete snapshots", () => {
  assert.equal(customerShippingSnapshotMatchesCart(null, [cartItem]), false);
  assert.equal(customerShippingSnapshotMatchesCart([], [cartItem]), false);
});
