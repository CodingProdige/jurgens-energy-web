import assert from "node:assert/strict";
import test from "node:test";

import {
  campaignAttributionInputSchema,
  createCampaignAttributionSnapshot,
  parseCampaignAttributionCookie,
  serializeCampaignAttributionCookie,
} from "../src/modules/marketing/campaign-attribution.ts";

test("validates and normalizes supported campaign attribution values", () => {
  const parsed = campaignAttributionInputSchema.parse({
    gclid: " google-click-id ",
    utmCampaign: " winter-lpg ",
    utmMedium: " cpc ",
    utmSource: " google ",
  });

  assert.deepEqual(parsed, {
    gclid: "google-click-id",
    utmCampaign: "winter-lpg",
    utmMedium: "cpc",
    utmSource: "google",
  });
});

test("rejects empty, unknown, and unsafe attribution payloads", () => {
  assert.equal(campaignAttributionInputSchema.safeParse({}).success, false);
  assert.equal(
    campaignAttributionInputSchema.safeParse({ arbitrary: "value" }).success,
    false,
  );
  assert.equal(
    campaignAttributionInputSchema.safeParse({
      utmCampaign: "unsafe\u0000campaign",
    }).success,
    false,
  );
});

test("round-trips a server-timestamped attribution cookie", () => {
  const snapshot = createCampaignAttributionSnapshot(
    {
      gbraid: "google-braid",
      utmContent: "delivery-ad",
      wbraid: "web-to-app-braid",
    },
    new Date("2026-07-17T08:00:00.000Z"),
  );
  const serialized = serializeCampaignAttributionCookie(snapshot);

  assert.deepEqual(parseCampaignAttributionCookie(serialized), snapshot);
  assert.equal(parseCampaignAttributionCookie("not-json"), null);
});
