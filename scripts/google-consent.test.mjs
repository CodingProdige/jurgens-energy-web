import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGoogleConsentDefaultsScript,
  googleConsentVersion,
  parseGoogleConsentPreferences,
  serializeGoogleConsentPreferences,
  toGoogleConsentState,
} from "../src/modules/analytics/google-consent.ts";

test("round-trips the compact consent cookie", () => {
  const preferences = {
    advertising: false,
    analytics: true,
    version: googleConsentVersion,
  };

  assert.deepEqual(
    parseGoogleConsentPreferences(
      serializeGoogleConsentPreferences(preferences),
    ),
    preferences,
  );
});

test("rejects malformed or outdated consent cookies", () => {
  assert.equal(parseGoogleConsentPreferences("not-json"), null);
  assert.equal(
    parseGoogleConsentPreferences(
      encodeURIComponent(JSON.stringify({ a: true, d: true, v: 999 })),
    ),
    null,
  );
});

test("defaults all optional Google Consent Mode signals to denied", () => {
  assert.deepEqual(toGoogleConsentState(null), {
    ad_personalization: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    analytics_storage: "denied",
    functionality_storage: "granted",
    personalization_storage: "denied",
    security_storage: "granted",
  });
});

test("the bootstrap establishes consent defaults before Google tags load", () => {
  const script = buildGoogleConsentDefaultsScript();

  assert.match(script, /gtag\('consent','default'/);
  assert.match(script, /ad_user_data:advertising/);
  assert.match(script, /ad_personalization:advertising/);
  assert.match(script, /wait_for_update:500/);
});
