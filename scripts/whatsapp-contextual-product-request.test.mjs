import assert from "node:assert/strict";
import test from "node:test";

import { classifyWhatsappContextualProductRequest } from "../src/modules/whatsapp-ordering/contextual-product-request.ts";

test("recognizes explicit requests for the current product image", () => {
  const messages = [
    "Can you send me an image?",
    "Send me the product image please",
    "No, I just want an image of the product",
    "Can I see a photo?",
    "Do you have a picture of it?",
    "Please share a pic",
    "send image",
    "image please",
    "show me",
    "Can you show me it?",
    "May I see the cylinder?",
    "Stuur asseblief 'n foto",
  ];

  for (const message of messages) {
    assert.equal(
      classifyWhatsappContextualProductRequest(message),
      "product_image",
      message,
    );
  }
});

test("does not confuse ordinary order, catalogue, or payment requests with image requests", () => {
  const messages = [
    "Send me one 9kg gas cylinder",
    "Send a 9kg exchange please",
    "I need a refill",
    "Show me your 9kg options",
    "Show me the price",
    "Which cylinders do you have?",
    "Do you have 9kg cylinders in stock?",
    "Send the payment link",
    "Send it",
    "Picture this: I need two 14kg cylinders",
    "I already have a product image",
    "Nice product image",
    "",
  ];

  for (const message of messages) {
    assert.equal(
      classifyWhatsappContextualProductRequest(message),
      null,
      message,
    );
  }
});
