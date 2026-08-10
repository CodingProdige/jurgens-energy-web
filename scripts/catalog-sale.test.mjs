import assert from "node:assert/strict";
import test from "node:test";

import { isMarketplaceVariantOnSale } from "../src/modules/marketplace/catalog-sale.ts";
import {
  createMarketplaceCatalogSearchParams,
  getMarketplaceCatalogActiveFilterCount,
  parseMarketplaceCatalogFilters,
} from "../src/modules/marketplace/catalog-filters.ts";
import { getMarketplaceCatalogProductRevision } from "../src/modules/marketplace/catalog-product-revision.ts";
import {
  getReadableSaleCampaignForeground,
  normalizeSaleCampaignColor,
} from "../src/modules/sales/campaign-presentation.ts";

const campaignId = "ef2429c6-165f-4e91-aa8d-2562f92542dd";

test("recognizes a valid positive compare-at discount", () => {
  assert.equal(
    isMarketplaceVariantOnSale({ compareAtPrice: "400.00", price: "365.99" }),
    true,
  );
});

test("rejects missing, equal, lower, zero, and invalid compare-at prices", () => {
  const nonSalePrices = [
    { compareAtPrice: null, price: "365.99" },
    { compareAtPrice: "365.99", price: "365.99" },
    { compareAtPrice: "300.00", price: "365.99" },
    { compareAtPrice: "100.00", price: "0" },
    { compareAtPrice: "invalid", price: "365.99" },
  ];

  for (const price of nonSalePrices) {
    assert.equal(isMarketplaceVariantOnSale(price), false);
  }
});

test("parses and preserves campaign-specific sale filters", () => {
  const filters = parseMarketplaceCatalogFilters({
    campaign: campaignId,
    sale: "1",
  });

  assert.equal(filters.campaignId, campaignId);
  assert.equal(filters.onSale, true);
  assert.equal(getMarketplaceCatalogActiveFilterCount(filters), 1);
  assert.equal(
    createMarketplaceCatalogSearchParams(filters).toString(),
    `campaign=${campaignId}&sale=1`,
  );
});

test("ignores malformed campaign identifiers", () => {
  const filters = parseMarketplaceCatalogFilters({
    campaign: "not-a-campaign-id",
  });

  assert.equal(filters.campaignId, null);
  assert.equal(createMarketplaceCatalogSearchParams(filters).has("campaign"), false);
});

test("normalizes campaign colors and chooses a readable foreground", () => {
  assert.equal(normalizeSaleCampaignColor("#ff5a1f"), "#FF5A1F");
  assert.equal(normalizeSaleCampaignColor("invalid"), "#FF5A1F");
  assert.equal(getReadableSaleCampaignForeground("#FFFFFF"), "#080808");
  assert.equal(getReadableSaleCampaignForeground("#080808"), "#FFFFFF");
});

test("catalog revisions change when an authoritative sale snapshot expires", () => {
  const activeSale = {
    initialPage: 2,
    products: [
      {
        id: "heater",
        isOnSale: true,
        priceLabel: "R 899,00",
        saleBadge: {
          campaignId,
          endsAt: "2026-08-10T18:00:00.000Z",
          text: "Winter sale",
        },
      },
    ],
    totalCount: 25,
    totalPages: 2,
  };
  const activeRevision = getMarketplaceCatalogProductRevision(activeSale);
  const repeatedRevision = getMarketplaceCatalogProductRevision(activeSale);
  const expiredRevision = getMarketplaceCatalogProductRevision({
    ...activeSale,
    products: [
      {
        id: "heater",
        isOnSale: false,
        priceLabel: "R 999,00",
        saleBadge: null,
      },
    ],
  });

  assert.equal(repeatedRevision, activeRevision);
  assert.notEqual(expiredRevision, activeRevision);
});
