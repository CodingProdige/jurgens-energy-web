import assert from "node:assert/strict";
import test from "node:test";

import {
  filterPopulatedShopMenuCategories,
  findShopMenuCategory,
} from "../src/modules/marketplace/shop-menu-categories.ts";

function category({ children = [], id, productCount = 0 }) {
  return {
    children,
    id,
    name: id,
    productCount,
    slug: id,
  };
}

test("removes empty category branches and keeps populated categories", () => {
  const categories = [
    category({ id: "empty-root" }),
    category({ id: "populated-root", productCount: 2 }),
  ];

  const visible = filterPopulatedShopMenuCategories(categories);

  assert.deepEqual(
    visible.map((item) => item.id),
    ["populated-root"],
  );
});

test("retains ancestors of populated descendants and prunes empty siblings", () => {
  const categories = [
    category({
      children: [
        category({ id: "empty-child" }),
        category({
          children: [category({ id: "populated-leaf", productCount: 1 })],
          id: "nested-parent",
        }),
      ],
      id: "root",
    }),
  ];

  const visible = filterPopulatedShopMenuCategories(categories);

  assert.equal(visible.length, 1);
  assert.deepEqual(
    visible[0].children.map((item) => item.id),
    ["nested-parent"],
  );
  assert.deepEqual(
    visible[0].children[0].children.map((item) => item.id),
    ["populated-leaf"],
  );
});

test("preserves ordering and does not mutate the source tree", () => {
  const categories = [
    category({ id: "first", productCount: 1 }),
    category({ id: "empty" }),
    category({ id: "second", productCount: 1 }),
  ];
  const snapshot = structuredClone(categories);

  const visible = filterPopulatedShopMenuCategories(categories);

  assert.deepEqual(
    visible.map((item) => item.id),
    ["first", "second"],
  );
  assert.deepEqual(categories, snapshot);
});

test("finds a visible category anywhere in the filtered tree", () => {
  const categories = filterPopulatedShopMenuCategories([
    category({
      children: [category({ id: "cylinder-accessories", productCount: 1 })],
      id: "gas-cylinders",
      productCount: 1,
    }),
  ]);

  const match = findShopMenuCategory(
    categories,
    (item) => item.slug.includes("accessor"),
  );

  assert.equal(match?.id, "cylinder-accessories");
});
