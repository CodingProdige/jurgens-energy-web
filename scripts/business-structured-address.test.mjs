import assert from "node:assert/strict";
import test from "node:test";

import { createMarketplaceBusinessAddress } from "../src/modules/marketplace/business-structured-address.ts";

test("structured business address prefers the registered address", () => {
  assert.deepEqual(
    createMarketplaceBusinessAddress(
      {
        addressLine1: "10 Example Road",
        addressLine2: null,
        city: "Cape Town",
        countryCode: "ZA",
        postalCode: "8001",
        province: "Western Cape",
        suburb: "Gardens",
      },
    ),
    {
      "@type": "PostalAddress",
      addressCountry: "ZA",
      addressLocality: "Cape Town",
      addressRegion: "Western Cape",
      postalCode: "8001",
      streetAddress: "10 Example Road, Gardens",
    },
  );
});

test("structured business address is omitted until Business Information is complete", () => {
  assert.equal(createMarketplaceBusinessAddress(null), undefined);
});
