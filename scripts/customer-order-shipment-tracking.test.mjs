import assert from "node:assert/strict";
import test from "node:test";

import {
  getCustomerCourierGuyPackageCount,
  getCustomerCourierGuyPackageNumber,
  groupCustomerShipmentPackageContents,
} from "../src/modules/marketplace/account/shipment-tracking.ts";

test("counts only persisted Courier Guy package sequences", () => {
  assert.equal(
    getCustomerCourierGuyPackageCount([
      { packageSequence: 1, provider: "courier_guy" },
      { packageSequence: 2, provider: "courier_guy" },
      { packageSequence: null, provider: "courier_guy" },
      { packageSequence: null, provider: "jurgens_local" },
    ]),
    2,
  );
});

test("preserves the highest package number when historical sequences have gaps", () => {
  assert.equal(
    getCustomerCourierGuyPackageCount([
      { packageSequence: 1, provider: "courier_guy" },
      { packageSequence: 3, provider: "courier_guy" },
    ]),
    3,
  );
});

test("does not number legacy shipments without a manual package sequence", () => {
  assert.equal(
    getCustomerCourierGuyPackageCount([
      { packageSequence: null, provider: "courier_guy" },
      { packageSequence: null, provider: "jurgens_local" },
    ]),
    null,
  );
  assert.equal(
    getCustomerCourierGuyPackageNumber({
      packageSequence: null,
      provider: "courier_guy",
    }),
    null,
  );
  assert.equal(
    getCustomerCourierGuyPackageNumber({
      packageSequence: 1,
      provider: "jurgens_local",
    }),
    null,
  );
});

test("groups packed order-item quantities by customer shipment", () => {
  const contents = groupCustomerShipmentPackageContents([
    {
      orderItemId: "item-one",
      quantity: 1,
      shipmentId: "shipment-one",
      title: "First product",
    },
    {
      orderItemId: "item-one",
      quantity: 1,
      shipmentId: "shipment-two",
      title: "First product",
    },
    {
      orderItemId: "item-two",
      quantity: 2,
      shipmentId: "shipment-two",
      title: "Second product",
    },
  ]);

  assert.deepEqual(contents.get("shipment-one"), [
    { orderItemId: "item-one", quantity: 1, title: "First product" },
  ]);
  assert.deepEqual(contents.get("shipment-two"), [
    { orderItemId: "item-one", quantity: 1, title: "First product" },
    { orderItemId: "item-two", quantity: 2, title: "Second product" },
  ]);
});

test("combines duplicate allocations within one shipment", () => {
  const contents = groupCustomerShipmentPackageContents([
    {
      orderItemId: "item-one",
      quantity: 1,
      shipmentId: "shipment-one",
      title: "First product",
    },
    {
      orderItemId: "item-one",
      quantity: 2,
      shipmentId: "shipment-one",
      title: "First product",
    },
  ]);

  assert.deepEqual(contents.get("shipment-one"), [
    { orderItemId: "item-one", quantity: 3, title: "First product" },
  ]);
});

test("returns no package contents for legacy shipments without allocations", () => {
  const contents = groupCustomerShipmentPackageContents([]);

  assert.equal(contents.size, 0);
});
