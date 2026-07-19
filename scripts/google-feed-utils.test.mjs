import assert from "node:assert/strict";
import test from "node:test";

import {
  getGoogleLocalInventoryAvailability,
  getGoogleMerchantDestinationControls,
  normalizeGoogleLocalInventoryStoreCode,
} from "../src/modules/marketplace/google-feed-utils.ts";

test("normalizes Google Business Profile store codes accepted by admin settings", () => {
  assert.equal(
    normalizeGoogleLocalInventoryStoreCode("  PAARL-01  "),
    "PAARL-01",
  );
  assert.equal(
    normalizeGoogleLocalInventoryStoreCode("jurgens_energy_1"),
    "jurgens_energy_1",
  );
  assert.equal(normalizeGoogleLocalInventoryStoreCode(""), null);
  assert.equal(normalizeGoogleLocalInventoryStoreCode("Paarl store"), null);
  assert.equal(normalizeGoogleLocalInventoryStoreCode("x".repeat(101)), null);
});

test("maps physical store stock to Google's local inventory availability values", () => {
  assert.equal(getGoogleLocalInventoryAvailability(4), "in_stock");
  assert.equal(getGoogleLocalInventoryAvailability(3), "in_stock");
  assert.equal(
    getGoogleLocalInventoryAvailability(2),
    "limited_availability",
  );
  assert.equal(
    getGoogleLocalInventoryAvailability(1),
    "limited_availability",
  );
  assert.equal(getGoogleLocalInventoryAvailability(0), "out_of_stock");
  assert.equal(getGoogleLocalInventoryAvailability(-1), "out_of_stock");
});

test("keeps local LPG offers in local destinations only", () => {
  assert.deepEqual(getGoogleMerchantDestinationControls("local_lpg"), {
    excluded: ["Shopping_ads", "Free_listings"],
    included: ["Free_local_listings", "Local_inventory_ads"],
  });
});

test("keeps national courier offers in online destinations only", () => {
  assert.deepEqual(getGoogleMerchantDestinationControls("national_courier"), {
    excluded: ["Local_inventory_ads", "Free_local_listings"],
    included: ["Shopping_ads", "Free_listings"],
  });
});
