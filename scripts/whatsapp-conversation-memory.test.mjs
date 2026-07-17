import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWhatsappModelMemory,
  classifyWhatsappConfirmation,
  evaluateWhatsappConversationCase,
  sanitizeWhatsappTextForModel,
  updateWhatsappRollingMemory,
} from "../src/modules/whatsapp-ordering/conversation-memory.ts";

test("redacts identity and address data without corrupting commerce facts", () => {
  const url = "https://jurgensenergy.com/whatsapp/resume/90dfc7b1-5d5b-4dc0-8813-81349321d3e2";
  const input = [
    "My name is Dillon Jurgens",
    "Email: dillon@example.com and phone +27 82 722 3783",
    "Delivery address: 6 Christelle Street, Paarl, 7646",
    "Order JE-20260716-00A9E4CBA8 costs R 1 152,99.",
    `Pay here: ${url}`,
    "Customer ID: d882d0d2-fa41-4767-a416-34f2c866c575",
  ].join("\n");
  const safe = sanitizeWhatsappTextForModel(input, {
    knownNames: ["Dillon Jurgens", "Dillon"],
  });

  assert.doesNotMatch(safe, /Dillon|dillon@example|82 722|Christelle|7646|d882d0d2/i);
  assert.match(safe, /\[customer name omitted\]/i);
  assert.match(safe, /\[email omitted\]/i);
  assert.match(safe, /\[phone omitted\]/i);
  assert.match(safe, /Delivery detail: \[omitted\]/i);
  assert.match(safe, /\[internal ID omitted\]/i);
  assert.match(safe, /JE-20260716-00A9E4CBA8/);
  assert.match(safe, /R 1 152,99/);
  assert.ok(safe.includes(url));
});

test("deduplicates only the stored copy of the current inbound message", () => {
  const currentInbound = "One 9kg gas, asseblief";
  const memory = buildWhatsappModelMemory({
    currentInbound,
    recentTurns: [
      { body: "Hey, I need a refill", direction: "inbound" },
      {
        body: "Sure — which cylinder size and do you have an empty to exchange?",
        direction: "outbound",
      },
      { body: "Do you deliver to Paarl?", direction: "inbound" },
      {
        body: "I can check Paarl once I know the exact product.",
        direction: "outbound",
      },
      { body: "  One 9kg gas, asseblief!  ", direction: "inbound" },
    ],
  });

  assert.equal(memory.currentInbound, currentInbound);
  assert.equal(memory.recentTurns.length, 4);
  assert.equal(
    memory.recentTurns.filter((turn) => /One 9kg gas/i.test(turn.body)).length,
    0,
  );
  assert.match(memory.recentTurns[2].body, /Paarl/);
});

test("bounds rolling memory and exposes no raw workflow identifiers or addresses", () => {
  const recentTurns = Array.from({ length: 24 }, (_, index) => ({
    body: `turn ${index} ${"x".repeat(400)}`,
    direction: index % 2 ? "outbound" : "inbound",
  }));
  const memory = buildWhatsappModelMemory({
    currentInbound: "ja",
    limits: {
      maxFacts: 2,
      maxRecentCharacters: 1_200,
      maxSummaryCharacters: 120,
      maxTurnCharacters: 300,
      maxTurns: 6,
    },
    recentTurns,
    rollingMemory: {
      facts: [
        "Order JE-20260716-00A9E4CBA8 total is R 365,99.",
        "Checkout https://jurgensenergy.com/pay/abc",
        "Email customer@example.com",
      ],
      summary: `Dillon wants LPG. Address: 6 Christelle Street, Paarl 7646. ${"z".repeat(300)}`,
    },
    knownNames: ["Dillon"],
    workflowState: {
      pendingOrder: {
        candidate: {
          productId: "d882d0d2-fa41-4767-a416-34f2c866c575",
          purchaseType: "exchange",
          quantity: 1,
          variantId: "7cd6d5f1-6081-4f03-a72c-9cd315a693a0",
        },
        customerPrompt: "Dillon at 6 Christelle Street wants a 9kg exchange",
      },
    },
  });

  assert.ok(memory.recentTurns.length <= 6);
  assert.ok(
    memory.recentTurns.reduce((total, turn) => total + turn.body.length, 0) <=
      1_200,
  );
  assert.ok(memory.rollingMemory.summary.length <= 120);
  assert.equal(memory.rollingMemory.facts.length, 2);
  assert.equal(memory.workflow.pendingAction, "confirm_order");
  assert.equal(memory.workflow.order?.purchaseType, "exchange");
  assert.doesNotMatch(JSON.stringify(memory.workflow), /d882d0d2|7cd6d5f1|Christelle|Dillon/);
});

test("updates rolling memory with deduplicated verified facts and redacts its summary", () => {
  const memory = updateWhatsappRollingMemory({
    current: {
      facts: ["Order JE-20260716-00A9E4CBA8 total is R 365,99."],
      summary: "Customer wants LPG.",
    },
    knownNames: ["Dillon"],
    limits: { maxFacts: 2 },
    summary: "Dillon wants delivery to Address: 6 Christelle Street, Paarl 7646.",
    verifiedFacts: [
      "Order JE-20260716-00A9E4CBA8 total is R 365,99.",
      "Checkout https://jurgensenergy.com/whatsapp/resume/abc123",
    ],
  });

  assert.equal(memory.facts.length, 2);
  assert.equal(
    memory.facts[0],
    "Order JE-20260716-00A9E4CBA8 total is R 365,99.",
  );
  assert.equal(
    memory.facts[1],
    "Checkout https://jurgensenergy.com/whatsapp/resume/abc123",
  );
  assert.doesNotMatch(memory.summary, /Dillon|Christelle|7646/i);
});

test("requires pending server state before treating yes or ja as confirmation", () => {
  assert.equal(
    classifyWhatsappConfirmation({ message: "yes", pendingAction: null }),
    "not_confirmation",
  );
  assert.equal(
    classifyWhatsappConfirmation({
      message: "ja asseblief",
      pendingAction: "confirm_order",
    }),
    "confirmed",
  );
  assert.equal(
    classifyWhatsappConfirmation({
      message: "nee dankie",
      pendingAction: "confirm_order",
    }),
    "declined",
  );
  assert.equal(
    classifyWhatsappConfirmation({
      message: "ja maar deliver julle in Paarl?",
      pendingAction: "confirm_order",
    }),
    "ambiguous",
  );
  assert.equal(
    classifyWhatsappConfirmation({
      message: "Ja, dit is reg",
      pendingAction: "confirm_order",
    }),
    "confirmed",
  );
  assert.equal(
    classifyWhatsappConfirmation({
      message: "yes, that's correct",
      pendingAction: "confirm_order",
    }),
    "confirmed",
  );
  assert.equal(
    classifyWhatsappConfirmation({
      message: "nee, eerder 14kg not 9kg",
      pendingAction: "confirm_order",
    }),
    "ambiguous",
  );
});

test("evaluates a messy code-switch conversation and preserves exact reply facts", () => {
  const orderReference = "JE-20260716-00A9E4CBA8";
  const total = "R 365,99";
  const checkoutUrl = "https://jurgensenergy.com/whatsapp/resume/abc123";
  const scenario = evaluateWhatsappConversationCase({
    currentInbound: "Ja stuur die link asseblief",
    expectedConfirmation: "confirmed",
    expectedContext: ["Paarl", "9kg", "exchange"],
    forbiddenContext: ["Dillon", "dillon@example.com", "+27827223783"],
    knownNames: ["Dillon Jurgens", "Dillon"],
    mustIncludeExactReplyFacts: [orderReference, total, checkoutUrl],
    mustNotIncludeReply: ["/media/admin-media-thumbs/"],
    recentTurns: [
      { body: "Hey ek kort gas again", direction: "inbound" },
      { body: "Sure — watter size het jy nodig?", direction: "outbound" },
      { body: "Deliver julle Paarl toe?", direction: "inbound" },
      {
        body: "Yes, I can check Paarl. Which product and quantity?",
        direction: "outbound",
      },
      { body: "One 9kg exchange please", direction: "inbound" },
      {
        body: "I found the 9kg exchange. Reply YES and I will send the secure checkout link.",
        direction: "outbound",
      },
      { body: "Ja stuur die link asseblief", direction: "inbound" },
    ],
    reply: `Thanks — order ${orderReference} is ready. Total: ${total}. Secure checkout: ${checkoutUrl}`,
    rollingMemory: {
      facts: ["Customer previously asked about delivery to Paarl."],
      summary: "Customer wants one 9kg exchange cylinder.",
    },
    workflowState: {
      pendingOrder: {
        candidate: { purchaseType: "exchange", quantity: 1 },
        customerPrompt: "One 9kg exchange",
      },
    },
  });

  assert.deepEqual(scenario.failures, []);
  assert.equal(scenario.passed, true);
});

test("flags unnatural replies with multiple questions and internal image paths", () => {
  const result = evaluateWhatsappConversationCase({
    currentInbound: "I need gas",
    recentTurns: [],
    reply:
      "Which size? Do you have an empty? /media/admin-media-thumbs/product.webp",
  });

  assert.equal(result.passed, false);
  assert.equal(result.failures.length, 2);
});
