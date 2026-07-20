import assert from "node:assert/strict";
import test from "node:test";

import {
  getInitialMediaPickerSelection,
  normalizeMediaSelectionIds,
  toggleMediaPickerSelection,
} from "../src/modules/media/selection.ts";

test("the media picker starts with the complete saved product selection", () => {
  assert.deepEqual(
    getInitialMediaPickerSelection({
      selectedAssetId: "old-cover",
      selectedAssetIds: ["old-cover", "gallery-image"],
    }),
    ["old-cover", "gallery-image"],
  );
});

test("a single picker replaces the previous selection", () => {
  assert.deepEqual(
    toggleMediaPickerSelection({
      allowMultipleSelection: false,
      assetId: "new-cover",
      selectedAssetIds: ["old-cover"],
    }),
    ["new-cover"],
  );
});

test("a multiple picker keeps the saved selection and adds new media", () => {
  assert.deepEqual(
    toggleMediaPickerSelection({
      allowMultipleSelection: true,
      assetId: "new-gallery-image",
      selectedAssetIds: ["old-cover"],
    }),
    ["old-cover", "new-gallery-image"],
  );
});

test("product media uses the exact picker selection in cover order", () => {
  const pickerSelection = toggleMediaPickerSelection({
    allowMultipleSelection: true,
    assetId: "old-cover",
    selectedAssetIds: ["old-cover", "new-cover"],
  });

  assert.deepEqual(normalizeMediaSelectionIds(pickerSelection, 10), [
    "new-cover",
  ]);
});

test("product media preserves order, removes duplicates, and caps at ten", () => {
  const selectedAssetIds = [
    "new-cover",
    "gallery-1",
    "new-cover",
    ...Array.from({ length: 12 }, (_, index) => `gallery-${index + 2}`),
  ];

  assert.deepEqual(normalizeMediaSelectionIds(selectedAssetIds, 10), [
    "new-cover",
    "gallery-1",
    "gallery-2",
    "gallery-3",
    "gallery-4",
    "gallery-5",
    "gallery-6",
    "gallery-7",
    "gallery-8",
    "gallery-9",
  ]);
});
