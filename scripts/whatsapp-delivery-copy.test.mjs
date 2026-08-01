import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const whatsappServiceSource = readFileSync(
  new URL("../src/modules/whatsapp-ordering/service.ts", import.meta.url),
  "utf8",
);
const publicDeliveryCopySource = readFileSync(
  new URL("../src/modules/marketplace/public-delivery-copy.ts", import.meta.url),
  "utf8",
);

test("WhatsApp delivery replies distinguish national and Jurgens eligibility", () => {
  assert.doesNotMatch(
    whatsappServiceSource,
    /deliver(?:s|ing)? eligible (?:online-store )?orders within South Africa/i,
  );
  assert.match(
    whatsappServiceSource,
    /Courier-eligible products can be delivered nationwide within South Africa\./,
  );
  assert.match(
    whatsappServiceSource,
    /Products marked for Jurgens delivery require an eligible delivery postcode\./,
  );
});

test("WhatsApp delivery replies use the saved public timing settings", () => {
  assert.match(
    whatsappServiceSource,
    /getPublicDeliveryTimingDescription/,
  );
  assert.match(
    whatsappServiceSource,
    /function getSouthAfricaDeliveryTimingFacts\(settings: MarketplaceSettings\)/,
  );
  assert.match(
    whatsappServiceSource,
    /getPublicDeliveryTimingDescription\(settings\)/,
  );
  assert.match(
    whatsappServiceSource,
    /getWhatsappKnowledgeFacts\(question, settings\)/,
  );
  assert.doesNotMatch(
    whatsappServiceSource,
    /Transit time after dispatch depends/,
  );
  assert.doesNotMatch(
    whatsappServiceSource,
    /Eligible delivery normally takes 1–4 business days/,
  );
});

test("WhatsApp delivery replies describe the customer fee, not a courier quote", () => {
  assert.match(
    whatsappServiceSource,
    /getPublicDeliveryFeeDescription\(settings\)/,
  );
  assert.match(
    publicDeliveryCopySource,
    /Standard delivery is \$\{flatRateCopy\}, VAT included\./,
  );
  assert.match(
    publicDeliveryCopySource,
    /Free delivery over \$\{formatZar\(freeOverAmount\)\}\./,
  );
  assert.doesNotMatch(
    whatsappServiceSource,
    /Delivery availability and shipping costs are confirmed at checkout from the complete delivery address\./,
  );
});
