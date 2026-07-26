import assert from "node:assert/strict";
import test from "node:test";

import {
  getGoogleMerchantCustomLabel0,
  getGoogleMerchantDestinationControls,
} from "../src/modules/marketplace/google-feed-utils.ts";

test("keeps postcode-limited LPG offers in online destinations", () => {
  assert.deepEqual(getGoogleMerchantDestinationControls("local_lpg"), {
    excluded: ["Local_inventory_ads", "Free_local_listings"],
    included: ["Shopping_ads", "Free_listings"],
  });
});

test("keeps national courier offers in online destinations only", () => {
  assert.deepEqual(getGoogleMerchantDestinationControls("national_courier"), {
    excluded: ["Local_inventory_ads", "Free_local_listings"],
    included: ["Shopping_ads", "Free_listings"],
  });
});

test("labels every offer by its delivery channel for Google Ads", () => {
  assert.equal(getGoogleMerchantCustomLabel0("local_lpg"), "local_lpg");
  assert.equal(
    getGoogleMerchantCustomLabel0("national_courier"),
    "national_courier",
  );
});
