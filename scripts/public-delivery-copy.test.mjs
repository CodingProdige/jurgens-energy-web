import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  formatPublicBusinessDayRange,
  getPublicDeliveryTiming,
  getPublicDeliveryTimingDescription,
  getPublicProductDeliveryCopy,
  getPublicProductDeliveryTimingLabel,
  publicDeliveryTiming,
  publicDeliveryTimingDescription,
  publicProductDeliveryTimingLabel,
} from "../src/modules/marketplace/public-delivery-copy.ts";

function readProjectFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const defaultTimingSettings = {
  shippingHandlingMaxBusinessDays: 1,
  shippingHandlingMinBusinessDays: 0,
  shippingTransitMaxBusinessDays: 3,
  shippingTransitMinBusinessDays: 1,
};

test("product delivery copy matches the published delivery window", () => {
  assert.deepEqual(publicDeliveryTiming, {
    handlingMaxBusinessDays: 1,
    handlingMinBusinessDays: 0,
    totalMaxBusinessDays: 4,
    totalMinBusinessDays: 1,
    transitMaxBusinessDays: 3,
    transitMinBusinessDays: 1,
  });
  assert.equal(
    publicDeliveryTimingDescription,
    "Usually arrives within 1–4 business days after payment confirmation.",
  );
  assert.equal(publicProductDeliveryTimingLabel, "1–4 business days");

  assert.deepEqual(
    getPublicProductDeliveryCopy({
      ...defaultTimingSettings,
      fulfillmentMode: "seller_fulfilled",
      shippingEnabled: true,
    }),
    {
      available: true,
      benefit: "Usually arrives within 1–4 business days",
      detail: publicProductDeliveryTimingLabel,
      label: "Nationwide delivery",
    },
  );
  assert.deepEqual(
    getPublicProductDeliveryCopy({
      ...defaultTimingSettings,
      fulfillmentMode: "jurgens_fulfilled",
      shippingEnabled: true,
    }),
    {
      available: true,
      benefit: "Usually arrives within 1–4 business days",
      detail: publicProductDeliveryTimingLabel,
      label: "Jurgens delivery areas",
    },
  );
});

test("product delivery copy reflects disabled online delivery", () => {
  assert.deepEqual(
    getPublicProductDeliveryCopy({
      ...defaultTimingSettings,
      fulfillmentMode: "seller_fulfilled",
      shippingEnabled: false,
    }),
    {
      available: false,
      benefit: "Online delivery is currently unavailable",
      detail: "Delivery currently unavailable",
      label: "Online delivery unavailable",
    },
  );
});

test("product delivery copy never exposes internal carrier costing", () => {
  const publicCopy = [
    publicDeliveryTimingDescription,
    publicProductDeliveryTimingLabel,
    ...(["jurgens_fulfilled", "seller_fulfilled"].flatMap(
      (fulfillmentMode) =>
        Object.values(
          getPublicProductDeliveryCopy({
            ...defaultTimingSettings,
            fulfillmentMode,
            shippingEnabled: true,
          }),
        ),
    )),
  ].join(" ");

  assert.doesNotMatch(
    publicCopy,
    /carrier (?:cost|quote)|reconcil|absorb|Courier Guy|order-level delivery fee/i,
  );
  assert.doesNotMatch(publicCopy, /Arrives in ZA|in as little as/i);
});

test("configured handling and transit ranges drive every public timing label", () => {
  const settings = {
    shippingHandlingMaxBusinessDays: 2,
    shippingHandlingMinBusinessDays: 1,
    shippingTransitMaxBusinessDays: 5,
    shippingTransitMinBusinessDays: 2,
  };

  assert.deepEqual(getPublicDeliveryTiming(settings), {
    handlingMaxBusinessDays: 2,
    handlingMinBusinessDays: 1,
    totalMaxBusinessDays: 7,
    totalMinBusinessDays: 3,
    transitMaxBusinessDays: 5,
    transitMinBusinessDays: 2,
  });
  assert.equal(getPublicProductDeliveryTimingLabel(settings), "3–7 business days");
  assert.equal(
    getPublicProductDeliveryCopy({
      ...settings,
      fulfillmentMode: "seller_fulfilled",
      shippingEnabled: true,
    }).benefit,
    "Usually arrives within 3–7 business days",
  );
  assert.equal(
    getPublicDeliveryTimingDescription(settings),
    "Usually arrives within 3–7 business days after payment confirmation.",
  );
  assert.equal(formatPublicBusinessDayRange(1, 1), "1 business day");
});

test("public timing consumers resolve copy from saved marketplace settings", () => {
  const aboutRoute = readProjectFile(
    "app/(marketplace)/(content)/about/page.tsx",
  );
  const faqRoute = readProjectFile(
    "app/(marketplace)/(content)/faq/page.tsx",
  );
  const faqPage = readProjectFile(
    "src/modules/marketplace/content/faq-page.tsx",
  );
  const localDeliveryPage = readProjectFile(
    "src/modules/marketplace/content/local-delivery-page.tsx",
  );
  const footer = readProjectFile(
    "components/marketplace/marketplace-footer.tsx",
  );
  const deliveryPolicyRoute = readProjectFile(
    "app/(marketplace)/(policies)/delivery-information/page.tsx",
  );
  const policyDocuments = readProjectFile(
    "src/modules/marketplace/policies/documents.ts",
  );
  const termsPolicyRoute = readProjectFile(
    "app/(marketplace)/(policies)/terms-and-conditions/page.tsx",
  );

  assert.match(
    aboutRoute,
    /getPublicDeliveryTimingDescription\(settings\)/,
  );
  assert.match(
    faqRoute,
    /getPublicDeliveryTimingDescription\(settings\)/,
  );
  assert.match(
    faqRoute,
    /createFaqStructuredDataItems\(\s*deliveryFeeDescription,\s*deliveryTimingDescription,/,
  );
  assert.match(
    faqPage,
    /answer: `\$\{deliveryTimingDescription\} Orders placed after the 2:00 PM SAST cutoff/,
  );
  assert.match(
    localDeliveryPage,
    /getPublicDeliveryTiming\(settings\)/,
  );
  assert.match(
    localDeliveryPage,
    /getPublicDeliveryTimingDescription\(settings\)/,
  );
  assert.match(
    footer,
    /getPublicDeliveryTimingDescription\(settings\)/,
  );
  assert.match(
    deliveryPolicyRoute,
    /createDeliveryInformationDocument\(\s*getPublicDeliveryFeeDescription\(settings\),\s*settings,/,
  );
  assert.match(policyDocuments, /getPublicDeliveryTiming\(settings\)/);
  assert.match(
    policyDocuments,
    /getPublicDeliveryTimingDescription\(settings\)/,
  );
  assert.match(
    termsPolicyRoute,
    /createTermsAndConditionsDocument\(settings\)/,
  );

  for (const source of [
    aboutRoute,
    faqRoute,
    faqPage,
    localDeliveryPage,
    footer,
  ]) {
    assert.doesNotMatch(source, /1–4 business days/);
  }
});
