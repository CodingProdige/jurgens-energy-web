import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectCourierGuyManualPackingPlan,
  manualPackingPackageInputSchema,
} from "../src/modules/shipping/courier-guy-manual-packing-rules.ts";

const firstItemId = "11111111-1111-4111-8111-111111111111";
const secondItemId = "22222222-2222-4222-8222-222222222222";
const sellerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const secondSellerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const items = [
  { id: firstItemId, quantity: 2, sellerId },
  { id: secondItemId, quantity: 1, sellerId },
];

function physicalPackage(itemsOverride) {
  return {
    heightMm: 180,
    items: itemsOverride,
    lengthMm: 320,
    weightGrams: 2_300.5,
    widthMm: 240,
  };
}

test("accepts an exact manual allocation and derives package seller and sequence", () => {
  const packages = [
    physicalPackage([
      { orderItemId: firstItemId, quantity: 1 },
      { orderItemId: secondItemId, quantity: 1 },
    ]),
    physicalPackage([{ orderItemId: firstItemId, quantity: 1 }]),
  ];
  const result = inspectCourierGuyManualPackingPlan(items, packages);

  assert.equal(result.packages.length, 2);
  assert.equal(result.packages[0].packageSequence, 1);
  assert.equal(result.packages[1].packageSequence, 2);
  assert.equal(result.packages[0].sellerId, sellerId);
  assert.equal(result.packages[0].totalItemQuantity, 2);
  assert.equal(result.totalItemQuantity, 3);
  assert.deepEqual(
    result.allocatedItems.map((item) => item.allocatedQuantity),
    [2, 1],
  );
  assert.equal(packages[0].items.length, 2, "the input must not be mutated");
});

test("requires at least one physical package", () => {
  assert.throws(
    () => inspectCourierGuyManualPackingPlan(items, []),
    /at least one physical package/i,
  );
});

test("requires each package to contain an allocated item", () => {
  const parsed = manualPackingPackageInputSchema.safeParse(physicalPackage([]));

  assert.equal(parsed.success, false);
});

test("rejects unknown order items", () => {
  assert.throws(
    () =>
      inspectCourierGuyManualPackingPlan(items, [
        physicalPackage([
          {
            orderItemId: "33333333-3333-4333-8333-333333333333",
            quantity: 1,
          },
        ]),
      ]),
    /not part of this Courier Guy order/i,
  );
});

test("rejects duplicate allocation rows inside one package", () => {
  assert.throws(
    () =>
      inspectCourierGuyManualPackingPlan(items, [
        physicalPackage([
          { orderItemId: firstItemId, quantity: 1 },
          { orderItemId: firstItemId, quantity: 1 },
          { orderItemId: secondItemId, quantity: 1 },
        ]),
      ]),
    /more than once/i,
  );
});

test("allows one order line to be deliberately split across packages", () => {
  const result = inspectCourierGuyManualPackingPlan(items, [
    physicalPackage([{ orderItemId: firstItemId, quantity: 1 }]),
    physicalPackage([
      { orderItemId: firstItemId, quantity: 1 },
      { orderItemId: secondItemId, quantity: 1 },
    ]),
  ]);

  assert.equal(result.totalItemQuantity, 3);
});

test("rejects unpacked quantities", () => {
  assert.throws(
    () =>
      inspectCourierGuyManualPackingPlan(items, [
        physicalPackage([
          { orderItemId: firstItemId, quantity: 1 },
          { orderItemId: secondItemId, quantity: 1 },
        ]),
      ]),
    /still unpacked/i,
  );
});

test("rejects over-allocated quantities", () => {
  assert.throws(
    () =>
      inspectCourierGuyManualPackingPlan(items, [
        physicalPackage([
          { orderItemId: firstItemId, quantity: 3 },
          { orderItemId: secondItemId, quantity: 1 },
        ]),
      ]),
    /over-allocated/i,
  );
});

test("rejects non-whole and non-positive allocation quantities", () => {
  for (const quantity of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
    assert.throws(() =>
      inspectCourierGuyManualPackingPlan(items, [
        physicalPackage([
          { orderItemId: firstItemId, quantity },
          { orderItemId: secondItemId, quantity: 1 },
        ]),
      ]),
    );
  }
});

test("rejects packages containing items from different sellers", () => {
  assert.throws(
    () =>
      inspectCourierGuyManualPackingPlan(
        [
          { id: firstItemId, quantity: 1, sellerId },
          { id: secondItemId, quantity: 1, sellerId: secondSellerId },
        ],
        [
          physicalPackage([
            { orderItemId: firstItemId, quantity: 1 },
            { orderItemId: secondItemId, quantity: 1 },
          ]),
        ],
      ),
    /different sellers/i,
  );
});

test("treats platform-owned and seller-owned items as different sellers", () => {
  assert.throws(
    () =>
      inspectCourierGuyManualPackingPlan(
        [
          { id: firstItemId, quantity: 1, sellerId: null },
          { id: secondItemId, quantity: 1, sellerId },
        ],
        [
          physicalPackage([
            { orderItemId: firstItemId, quantity: 1 },
            { orderItemId: secondItemId, quantity: 1 },
          ]),
        ],
      ),
    /different sellers/i,
  );
});

test("rejects duplicate order-item rows in the source order", () => {
  assert.throws(
    () =>
      inspectCourierGuyManualPackingPlan(
        [
          { id: firstItemId, quantity: 1, sellerId },
          { id: firstItemId, quantity: 1, sellerId },
        ],
        [physicalPackage([{ orderItemId: firstItemId, quantity: 2 }])],
      ),
    /appears more than once/i,
  );
});

test("requires positive finite package measurements", () => {
  for (const [field, value] of [
    ["weightGrams", 0],
    ["lengthMm", -1],
    ["widthMm", Number.NaN],
    ["heightMm", Number.POSITIVE_INFINITY],
  ]) {
    const parsed = manualPackingPackageInputSchema.safeParse({
      ...physicalPackage([{ orderItemId: firstItemId, quantity: 1 }]),
      [field]: value,
    });

    assert.equal(parsed.success, false, `${field} should be rejected`);
  }
});
