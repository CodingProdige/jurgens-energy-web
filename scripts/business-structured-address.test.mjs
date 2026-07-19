import assert from "node:assert/strict";
import test from "node:test";

import { createMarketplaceBusinessAddress } from "../src/modules/marketplace/business-structured-address.ts";

test("structured business address prefers the registered address", () => {
  assert.deepEqual(
    createMarketplaceBusinessAddress(
      {
        addressLine1: "6 Christelle Street",
        addressLine2: null,
        city: "Paarl",
        countryCode: "ZA",
        postalCode: "7646",
        province: "Western Cape",
        suburb: "Denneburg",
      },
      "An independently configured contact address",
    ),
    {
      "@type": "PostalAddress",
      addressCountry: "ZA",
      addressLocality: "Paarl",
      addressRegion: "Western Cape",
      postalCode: "7646",
      streetAddress: "6 Christelle Street, Denneburg",
    },
  );
});

test("structured business address uses the public contact fallback when needed", () => {
  assert.equal(
    createMarketplaceBusinessAddress(null, " 6 Christelle Street, Paarl "),
    "6 Christelle Street, Paarl",
  );
  assert.equal(createMarketplaceBusinessAddress(null, ""), undefined);
});
