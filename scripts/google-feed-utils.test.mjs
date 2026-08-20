import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getGoogleMerchantCustomLabel0,
  getGoogleMerchantDestinationControls,
  getGoogleMerchantShippingLabel,
  meetsGoogleMerchantMinimumProductPrice,
  shouldPublishGoogleMerchantOffer,
} from "../src/modules/marketplace/google-feed-utils.ts";

const googleMerchantFeedSource = readFileSync(
  new URL("../src/modules/marketplace/google-merchant-feed.ts", import.meta.url),
  "utf8",
);

const usableLiveDelivery = {
  courierGuyDropoffPickupPointId: "K0000",
  courierGuyEnabled: true,
  courierGuyLiveAccountCode: "JUR082",
  courierGuyMode: "live",
  courierGuySandboxAccountCode: null,
  hasCourierGuyLiveApiKey: true,
  hasCourierGuySandboxApiKey: false,
  shippingEnabled: true,
};

test("excludes postcode-limited Jurgens offers from every Google destination", () => {
  assert.deepEqual(getGoogleMerchantDestinationControls("local_lpg"), {
    excluded: [
      "Shopping_ads",
      "Free_listings",
      "Local_inventory_ads",
      "Free_local_listings",
    ],
    included: [],
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

test("never labels a Jurgens-delivered offer as nationwide courier delivery", () => {
  assert.equal(
    getGoogleMerchantShippingLabel("national_courier", "jurgens_fulfilled"),
    "local_lpg",
  );
  assert.equal(
    getGoogleMerchantShippingLabel(null, "jurgens_fulfilled"),
    "local_lpg",
  );
});

test("defaults seller-fulfilled offers to nationwide courier delivery", () => {
  assert.equal(
    getGoogleMerchantShippingLabel(null, "seller_fulfilled"),
    "national_courier",
  );
});

test("preserves an explicit Merchant Center exclusion", () => {
  assert.equal(
    getGoogleMerchantShippingLabel("excluded", "seller_fulfilled"),
    null,
  );
});

test("excludes offers below the configured Merchant Center price floor", () => {
  assert.equal(meetsGoogleMerchantMinimumProductPrice(99.99, 100), false);
  assert.equal(meetsGoogleMerchantMinimumProductPrice(100, 100), true);
  assert.equal(meetsGoogleMerchantMinimumProductPrice(100.01, 100), true);
  assert.equal(meetsGoogleMerchantMinimumProductPrice(0, 0), false);
  assert.equal(meetsGoogleMerchantMinimumProductPrice(99.99, 0), true);
});

test("publishes nationwide offers only with enabled shipping and a usable active Courier Guy environment", () => {
  assert.equal(
    shouldPublishGoogleMerchantOffer("national_courier", usableLiveDelivery),
    true,
  );

  for (const unavailableConfiguration of [
    { ...usableLiveDelivery, shippingEnabled: false },
    { ...usableLiveDelivery, courierGuyEnabled: false },
    { ...usableLiveDelivery, courierGuyLiveAccountCode: null },
    { ...usableLiveDelivery, hasCourierGuyLiveApiKey: false },
    { ...usableLiveDelivery, courierGuyDropoffPickupPointId: null },
    {
      ...usableLiveDelivery,
      courierGuyMode: "sandbox",
      courierGuySandboxAccountCode: "JUR001",
      hasCourierGuySandboxApiKey: true,
    },
  ]) {
    assert.equal(
      shouldPublishGoogleMerchantOffer(
        "national_courier",
        unavailableConfiguration,
      ),
      false,
    );
  }
});

test("keeps postcode-limited offers in the feed with their destination exclusions", () => {
  assert.equal(
    shouldPublishGoogleMerchantOffer("local_lpg", {
      ...usableLiveDelivery,
      courierGuyEnabled: false,
      courierGuyDropoffPickupPointId: null,
      hasCourierGuyLiveApiKey: false,
      shippingEnabled: false,
    }),
    true,
  );
  assert.deepEqual(getGoogleMerchantDestinationControls("local_lpg").included, []);
});

test("publishes saved item handling time without overriding account-level shipping", () => {
  assert.match(
    googleMerchantFeedSource,
    /<g:min_handling_time>\$\{item\.minHandlingTime\}<\/g:min_handling_time>/,
  );
  assert.match(
    googleMerchantFeedSource,
    /<g:max_handling_time>\$\{item\.maxHandlingTime\}<\/g:max_handling_time>/,
  );
  assert.doesNotMatch(googleMerchantFeedSource, /<g:shipping>/);
  assert.doesNotMatch(googleMerchantFeedSource, /<g:min_transit_time>/);
  assert.doesNotMatch(googleMerchantFeedSource, /<g:max_transit_time>/);
});
