import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getTidioScriptUrl,
  normalizeTidioPublicKey,
} from "../src/modules/marketplace/tidio.ts";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const gateSource = read("components/marketplace/marketplace-gate.tsx");
const marketplaceSettingsSource = read("src/modules/marketplace/settings.ts");
const sensitiveSurfaceSources = [
  "app/(marketplace)/checkout/page.tsx",
  "app/(marketplace)/checkout/cancel/page.tsx",
  "app/(marketplace)/checkout/return/page.tsx",
  "app/(marketplace)/whatsapp/resume/[token]/page.tsx",
  "app/forgot-password/page.tsx",
  "app/register/page.tsx",
  "app/reset-password/page.tsx",
  "app/sign-in/page.tsx",
  "src/modules/marketplace/account/components.tsx",
].map(read);
const tidioButtonSource = read(
  "components/marketplace/marketplace-tidio-button.tsx",
);
const whatsappWebhookSource = read("app/api/webhooks/whatsapp/route.ts");

test("builds only a fixed Tidio script URL from a strict public key", () => {
  const publicKey = "fouwfr0cnygz4sj8kttyv0cz1rpaayva";

  assert.equal(normalizeTidioPublicKey(` ${publicKey} `), publicKey);
  assert.equal(
    getTidioScriptUrl(publicKey),
    `https://code.tidio.co/${publicKey}.js`,
  );

  for (const unsafeValue of [
    "https://example.com/widget.js",
    `${publicKey}/other`,
    `${publicKey}.js`,
    "<script>alert(1)</script>",
    "too-short",
    "A".repeat(32),
  ]) {
    assert.equal(getTidioScriptUrl(unsafeValue), null);
  }
});

test("renders exactly the deliberately selected and enabled support launcher", () => {
  assert.match(
    gateSource,
    /storefrontSupportProvider === "whatsapp"[\s\S]*?whatsappOrderingEnabled[\s\S]*?hasWhatsappApiKey[\s\S]*?whatsappBusinessPhoneNumber[\s\S]*?<MarketplaceWhatsAppButton/,
  );
  assert.match(
    gateSource,
    /normalizeTidioPublicKey\(settings\.tidioPublicKey\)[\s\S]*?storefrontSupportProvider === "tidio"[\s\S]*?tidioEnabled[\s\S]*?tidioPublicKey[\s\S]*?<MarketplaceTidioButton/,
  );
  assert.match(gateSource, /:\s*null;/);
});

test("turning off 360dialog stops inbound and transactional support operations", () => {
  assert.match(
    whatsappWebhookSource,
    /if \(!config\.whatsappOrderingEnabled\)[\s\S]*?createNoReplyResponse/,
  );
  assert.match(
    marketplaceSettingsSource,
    /getWhatsappEmailNotificationSettings[\s\S]*?enabled:[\s\S]*?settings\.whatsappOrderingEnabled[\s\S]*?settings\.whatsappEmailNotificationsEnabled/,
  );
  assert.match(
    marketplaceSettingsSource,
    /getWhatsappOrderNotificationSettings[\s\S]*?enabled:[\s\S]*?settings\.whatsappOrderingEnabled[\s\S]*?settings\.whatsappOrderNotificationsEnabled/,
  );
});

test("loads Tidio only from the first-party launcher click with resilient states", () => {
  const clickHandlerIndex = tidioButtonSource.indexOf("async function openChat");
  const scriptAppendIndex = tidioButtonSource.indexOf(
    "document.body.append(script)",
  );

  assert.ok(clickHandlerIndex >= 0);
  assert.ok(scriptAppendIndex >= 0);
  assert.match(
    tidioButtonSource,
    /onClick=\{openChat\}[\s\S]*?type="button"/,
  );
  assert.match(tidioButtonSource, /aria-busy=\{isLoading\}/);
  assert.match(tidioButtonSource, /aria-live="polite"/);
  assert.match(tidioButtonSource, /role="alert"/);
  assert.match(tidioButtonSource, /tidioLoadTimeoutMs = 15_000/);
  assert.match(
    tidioButtonSource,
    /if \(!mountedRef\.current \|\| requestIdRef\.current !== requestId\)[\s\S]*?api\.hide\(\)/,
  );
  assert.match(
    tidioButtonSource,
    /mountedTidioLaunchers === 0[\s\S]*?getTidioApi\(\)\?\.hide\(\)/,
  );
  assert.doesNotMatch(tidioButtonSource, /dangerouslySetInnerHTML|next\/script/);
});

test("keeps Tidio out of authentication, account, checkout, and token surfaces", () => {
  for (const source of sensitiveSurfaceSources) {
    assert.match(source, /<MarketplaceGate allowTidioLauncher=\{false\}>/);
  }

  assert.match(
    tidioButtonSource,
    /sensitiveTidioPathPrefixes[\s\S]*?forceCleanNavigationToSensitiveSurface[\s\S]*?window\.location\.assign/,
  );
});

test("never reuses a Tidio API from a different configured project", () => {
  assert.match(
    tidioButtonSource,
    /if \(existingApi\)[\s\S]*?existingScript\.src !== scriptUrl[\s\S]*?Promise\.reject/,
  );
});
