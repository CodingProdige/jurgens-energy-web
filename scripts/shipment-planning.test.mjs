import assert from "node:assert/strict";
import test from "node:test";

import {
  countCourierGuyUnits,
  MAX_COURIER_GUY_UNITS_PER_ORDER,
} from "../src/modules/shipping/courier-guy-limits.ts";
import { planOrderShipments } from "../src/modules/shipping/shipment-planning.ts";

const measuredItem = {
  heightMm: 200,
  lengthMm: 300,
  quantity: 1,
  sellerId: "00000000-0000-4000-8000-000000000099",
  title: "Product",
  unitPrice: 250,
  variantId: "00000000-0000-4000-8000-000000000001",
  weightGrams: 1_500,
  widthMm: 100,
};

test("splits mixed paid-order fulfillment without creating customer charges", () => {
  const plans = planOrderShipments([
    { ...measuredItem, deliveryMethod: "jurgens_local" },
    {
      ...measuredItem,
      deliveryMethod: "courier_guy",
      quantity: 2,
      variantId: "00000000-0000-4000-8000-000000000002",
    },
  ]);

  assert.equal(plans.length, 3);
  assert.equal(plans[0].provider, "jurgens_local");
  assert.deepEqual(
    plans.slice(1).map((plan) => plan.provider),
    ["courier_guy", "courier_guy"],
  );
  assert.ok(plans.every((plan) => !("customerAmount" in plan)));
});

test("keeps each courier unit as one pickup-point parcel", () => {
  const plans = planOrderShipments([
    { ...measuredItem, deliveryMethod: "courier_guy", quantity: 2 },
  ]);

  assert.equal(plans.length, 2);
  assert.ok(plans.every((plan) => plan.parcels.length === 1));
  assert.deepEqual(
    plans.map((plan) => plan.parcels[0].weightGrams),
    [1_500, 1_500],
  );
  assert.ok(plans.every((plan) => plan.sellerId === measuredItem.sellerId));
});

test("never routes a Jurgens-delivery item to Courier Guy", () => {
  const plans = planOrderShipments([
    { ...measuredItem, deliveryMethod: "jurgens_local" },
  ]);

  assert.deepEqual(
    plans.map((plan) => plan.provider),
    ["jurgens_local"],
  );
});

test("keeps courier shipments separated by seller ownership", () => {
  const otherSellerId = "00000000-0000-4000-8000-000000000098";
  const plans = planOrderShipments([
    { ...measuredItem, deliveryMethod: "courier_guy" },
    {
      ...measuredItem,
      deliveryMethod: "courier_guy",
      sellerId: otherSellerId,
      variantId: "00000000-0000-4000-8000-000000000002",
    },
  ]);

  assert.deepEqual(
    plans.map((plan) => plan.sellerId),
    [measuredItem.sellerId, otherSellerId],
  );
});

test("counts only courier units for the online-order safety limit", () => {
  assert.equal(
    countCourierGuyUnits([
      {
        fulfillmentMode: "seller_fulfilled",
        quantity: MAX_COURIER_GUY_UNITS_PER_ORDER,
      },
      { fulfillmentMode: "jurgens_fulfilled", quantity: 99 },
    ]),
    MAX_COURIER_GUY_UNITS_PER_ORDER,
  );
});
