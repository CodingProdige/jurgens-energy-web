import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const whatsappServiceSource = readFileSync(
  new URL("../src/modules/whatsapp-ordering/service.ts", import.meta.url),
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

test("WhatsApp delivery replies describe the customer fee, not a courier quote", () => {
  assert.match(
    whatsappServiceSource,
    /One configured VAT-inclusive flat delivery fee applies per eligible order\./,
  );
  assert.match(
    whatsappServiceSource,
    /An active free-shipping rule may reduce that fee to zero when the qualifying product subtotal reaches its threshold\./,
  );
  assert.doesNotMatch(
    whatsappServiceSource,
    /Delivery availability and shipping costs are confirmed at checkout from the complete delivery address\./,
  );
});
