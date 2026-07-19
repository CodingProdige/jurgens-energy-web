import { z } from "zod";

import { getOpenAiIntegrationConfig } from "@/src/modules/marketplace/settings";
import type {
  MessageInterpretation,
  WhatsappSupportTopic,
} from "@/src/modules/whatsapp-ordering/service";

export type WhatsappConversationTurn = {
  body: string;
  direction: "inbound" | "outbound";
};

const aiInterpretationSchema = z.object({
  confidence: z.number().min(0).max(1),
  intent: z.enum([
    "cancel",
    "confirm",
    "human",
    "invoice",
    "order",
    "payment_link",
    "product_search",
    "repeat",
    "status",
    "stop",
    "support",
  ]),
  purchaseType: z.enum(["exchange", "standard"]).nullable(),
  query: z.string().nullable(),
  quantity: z.number().int().min(1).max(12),
  sizeKg: z.number().int().min(1).max(48).nullable(),
  supportTopic: z
    .enum([
      "account_setup",
      "business_info",
      "contact",
      "delivery_areas",
      "last_invoice",
      "location",
      "shipping_rates",
      "unknown",
    ])
    .nullable(),
});

const responseJsonSchema = {
  additionalProperties: false,
  properties: {
    confidence: {
      description:
        "0 to 1 confidence that the interpretation reflects the customer's request.",
      maximum: 1,
      minimum: 0,
      type: "number",
    },
    intent: {
      enum: [
        "cancel",
        "confirm",
        "human",
        "invoice",
        "order",
        "payment_link",
        "product_search",
        "repeat",
        "status",
        "stop",
        "support",
      ],
      type: "string",
    },
    purchaseType: {
      anyOf: [
        { enum: ["exchange", "standard"], type: "string" },
        { type: "null" },
      ],
      description:
        "exchange means customer has/returns an empty cylinder. standard means buying a full/new cylinder without exchanging an empty.",
    },
    query: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "Product/search phrase or short customer topic, or null when not needed.",
    },
    quantity: {
      maximum: 12,
      minimum: 1,
      type: "integer",
    },
    sizeKg: {
      anyOf: [
        {
          maximum: 48,
          minimum: 1,
          type: "integer",
        },
        { type: "null" },
      ],
      description:
        "Cylinder size in kilograms, for example 9, 14, 19, or null when missing.",
    },
    supportTopic: {
      anyOf: [
        {
          enum: [
            "account_setup",
            "business_info",
            "contact",
            "delivery_areas",
            "last_invoice",
            "location",
            "shipping_rates",
            "unknown",
          ],
          type: "string",
        },
        { type: "null" },
      ],
      description:
        "Support category when intent is support, invoice, or status; otherwise null.",
    },
  },
  required: [
    "confidence",
    "intent",
    "purchaseType",
    "query",
    "quantity",
    "sizeKg",
    "supportTopic",
  ],
  type: "object",
} as const;

const aiGroundedReplySchema = z.object({
  factIndices: z.array(z.number().int().min(1).max(40)).min(1).max(8),
  reply: z.string().trim().min(1).max(4000),
});

const groundedReplyJsonSchema = {
  additionalProperties: false,
  properties: {
    factIndices: {
      description:
        "One-based indices of every authoritative fact used to support the answer.",
      items: { maximum: 40, minimum: 1, type: "integer" },
      maxItems: 8,
      minItems: 1,
      type: "array",
    },
    reply: {
      description: "The concise WhatsApp reply to send to the customer.",
      maxLength: 4000,
      minLength: 1,
      type: "string",
    },
  },
  required: ["factIndices", "reply"],
  type: "object",
} as const;

export async function interpretWhatsappMessageWithAi({
  fallback,
  message,
  recentTurns = [],
  workflowSummary = null,
}: {
  fallback: MessageInterpretation;
  message: string;
  recentTurns?: WhatsappConversationTurn[];
  workflowSummary?: string | null;
}): Promise<MessageInterpretation | null> {
  const openAiConfig = await getOpenAiIntegrationConfig();

  if (!openAiConfig.isConfigured || !openAiConfig.apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: buildInterpreterInput({
          fallback,
          message,
          recentTurns,
          workflowSummary,
        }),
        instructions: [
          "You classify WhatsApp messages for a South African LPG gas support and ordering assistant.",
          "Return only the structured JSON requested by the schema.",
          "Do not invent product availability, prices, stock, delivery promises, or payment claims.",
          "If the user asks a normal business, product, delivery, account, invoice, or order-status question, classify it instead of sending it to a human.",
          "If the user wants staff, complains, or the request is unsafe or unclear, use intent human.",
        ].join(" "),
        max_output_tokens: 180,
        model: openAiConfig.model,
        reasoning: {
          effort: openAiConfig.reasoningEffort,
        },
        store: false,
        text: {
          format: {
            name: "whatsapp_order_intent",
            schema: responseJsonSchema,
            strict: true,
            type: "json_schema",
          },
        },
      }),
      headers: {
        Authorization: `Bearer ${openAiConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return normalizeAiInterpretation(
      aiInterpretationSchema.parse(JSON.parse(getResponseText(await response.json()))),
      fallback,
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function answerWhatsappQuestionWithAi({
  knowledgeFacts,
  question,
  recentTurns = [],
}: {
  knowledgeFacts: string[];
  question: string;
  recentTurns?: WhatsappConversationTurn[];
}): Promise<string | null> {
  const facts = knowledgeFacts
    .map((fact) => fact.trim())
    .filter(Boolean)
    .slice(0, 40);
  const safeQuestion = redactIdentityMetadata(question.trim());

  if (!safeQuestion || facts.length === 0) {
    return null;
  }

  const groundedAnswer = await requestGroundedWhatsappReply({
    input: [
      `Customer question: ${safeQuestion}`,
      "",
      "Authoritative live knowledge facts:",
      ...facts.map((fact, index) => `${index + 1}. ${fact}`),
      "",
      formatRecentTurns(recentTurns),
      "",
      "Answer the question using only the authoritative live knowledge facts.",
    ]
      .filter(Boolean)
      .join("\n"),
    instructions: [
      "You answer Jurgens Energy customer questions on WhatsApp.",
      "Use only the supplied authoritative live knowledge facts for business claims.",
      "List the one-based indices of every fact that directly supports the answer in factIndices; do not cite irrelevant facts.",
      "Recent conversation is only for continuity and must not override the supplied facts.",
      "If the supplied facts do not answer the question, say that you do not have enough verified information and offer a human handover.",
      "Do not invent or infer products, availability, stock, prices, quantities, delivery coverage, delivery promises, payment state, invoice state, order state, links, policies, or completed actions.",
      "Use a warm, direct, concise South African English WhatsApp style.",
      "Ask at most one question.",
      "Return only the structured JSON requested by the schema.",
    ].join(" "),
    maxOutputTokens: 420,
  });

  if (!groundedAnswer) {
    return null;
  }

  const reply = groundedAnswer.reply;

  if (
    !reply ||
    countQuestions(reply) > 1 ||
    /\/(?:media|api\/whatsapp\/product-media)\//i.test(reply)
  ) {
    return null;
  }

  const selectedFacts = [
    ...new Set(groundedAnswer.factIndices),
  ].map((index) => facts[index - 1]);

  if (selectedFacts.some((fact) => !fact)) {
    return null;
  }

  const allowedProtectedValues = [safeQuestion, ...selectedFacts].join("\n");

  return getProtectedValues(reply).every((value) =>
      allowedProtectedValues.includes(value),
    ) && hasSupportingFactForSensitiveClaims(reply, selectedFacts)
    ? reply
    : null;
}

function buildInterpreterInput({
  fallback,
  message,
  recentTurns,
  workflowSummary,
}: {
  fallback: MessageInterpretation;
  message: string;
  recentTurns: WhatsappConversationTurn[];
  workflowSummary: string | null;
}) {
  return [
    `Customer message: ${redactIdentityMetadata(message)}`,
    `Rule-based fallback: ${JSON.stringify({
      ...fallback,
      query: fallback.query ? redactIdentityMetadata(fallback.query) : null,
    })}`,
    "",
    formatWorkflowContext({ recentTurns, workflowSummary }),
    "",
    "Classification guide:",
    "- intent repeat: same again, usual, last order, another one, top me up again, refill me like last time.",
    "- intent order: a specific new order request, including slang like gas is finished, bottle empty, need LPG, send a 9kg.",
    "- intent confirm: yes, correct, confirm, go ahead, send the link, only when confirming a prior offer/order.",
    "- intent cancel: no, cancel, wrong, never mind, only when rejecting a prior offer/order.",
    "- intent product_search: do you have, sell, stock, looking for a product, product availability questions.",
    "- intent invoice: invoice questions, especially last invoice or proof of payment.",
    "- intent payment_link: send a new payment link, resend link, link expired.",
    "- intent support: contact details, email, phone, location, what the business does, delivery areas, shipping rates, account setup.",
    "- intent status: where is my order, tracking, delivery status, driver update.",
    "- intent human: call me, agent, help from staff, complaints, unclear non-order questions.",
    "- intent stop: stop, unsubscribe, opt out.",
    "- purchaseType exchange: refill, replace, replacement, swap, exchange, topup, empty cylinder, gas ran out, hand over empty.",
    "- purchaseType standard: full/new cylinder, buying from scratch, no empty to return.",
    "- If they say same/usual/again, prefer repeat even if size is missing.",
    "- Extract quantity and kg size from words or digits where present.",
    "- For product_search, put the product phrase in query.",
    "- For support, choose the closest supportTopic.",
  ].join("\n");
}

async function requestGroundedWhatsappReply({
  input,
  instructions,
  maxOutputTokens,
}: {
  input: string;
  instructions: string;
  maxOutputTokens: number;
}) {
  const openAiConfig = await getOpenAiIntegrationConfig();

  if (!openAiConfig.isConfigured || !openAiConfig.apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input,
        instructions,
        max_output_tokens: maxOutputTokens,
        model: openAiConfig.model,
        reasoning: {
          effort: openAiConfig.reasoningEffort,
        },
        store: false,
        text: {
          format: {
            name: "whatsapp_grounded_knowledge_answer",
            schema: groundedReplyJsonSchema,
            strict: true,
            type: "json_schema",
          },
        },
      }),
      headers: {
        Authorization: `Bearer ${openAiConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return aiGroundedReplySchema.parse(
      JSON.parse(getResponseText(await response.json())),
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatWorkflowContext({
  recentTurns,
  workflowSummary,
}: {
  recentTurns: WhatsappConversationTurn[];
  workflowSummary: string | null;
}) {
  const sections = [
    workflowSummary?.trim()
      ? `Current workflow (contains no customer identity fields):\n${redactIdentityMetadata(workflowSummary.trim()).slice(0, 2400)}`
      : null,
    formatRecentTurns(recentTurns),
  ].filter(Boolean);

  return sections.length > 0
    ? sections.join("\n\n")
    : "No prior conversation context was supplied.";
}

function formatRecentTurns(recentTurns: WhatsappConversationTurn[]) {
  const turns = recentTurns
    .slice(-10)
    .map(({ body, direction }) => ({
      body: redactIdentityMetadata(body.trim()).slice(0, 1000),
      direction,
    }))
    .filter((turn) => turn.body);

  if (turns.length === 0) {
    return "";
  }

  return [
    "Recent conversation turns (message text only; no profile identity metadata):",
    ...turns.map(
      (turn) => `${turn.direction === "inbound" ? "Customer" : "Assistant"}: ${turn.body}`,
    ),
  ].join("\n");
}

function countQuestions(value: string) {
  return value.replace(/https?:\/\/[^\s<>()]+/g, "").match(/\?/g)?.length ?? 0;
}

export function validateWhatsappAgentReply({
  authoritativeFacts,
  customerMessage,
  reply,
}: {
  authoritativeFacts: string[];
  customerMessage: string;
  reply: string;
}) {
  const normalizedReply = reply.trim();
  const facts = authoritativeFacts.map((fact) => fact.trim()).filter(Boolean);

  if (
    !normalizedReply ||
    facts.length === 0 ||
    countQuestions(normalizedReply) > 1 ||
    /\/(?:media|api\/whatsapp\/product-media)\//i.test(normalizedReply) ||
    /\b(?:system|developer|tool)\s+(?:prompt|message|instructions?)\b/i.test(
      normalizedReply,
    )
  ) {
    return false;
  }

  const allowedProtectedValues = [customerMessage, ...facts].join("\n");

  return (
    getProtectedValues(normalizedReply).every((value) =>
      allowedProtectedValues.includes(value),
    ) &&
    hasSupportingFactForSensitiveClaims(normalizedReply, facts) &&
    !hasReversedSensitiveClaim(normalizedReply, facts)
  );
}

function redactIdentityMetadata(value: string) {
  return value
    .replace(/https?:\/\/[^\s<>()]+/gi, "[link omitted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email omitted]")
    .replace(
      /\b(?:JE-\d{8}-[A-Z0-9]+|INV-?\d+)\b/gi,
      "[order reference omitted]",
    )
    .replace(
      /\b(?:my name is|the name is)\s+[\p{L}\p{M}][\p{L}\p{M}'’. -]{1,79}(?=$|[,.!?;])/giu,
      "Customer name: [omitted]",
    )
    .replace(
      /\b(?:customer|account|full)\s+name\s*:\s*[^\n]+/gi,
      "Customer name: [omitted]",
    )
    .replace(
      /\b(?:street\s+address|delivery\s+address|address|suburb|city|province|postal\s+code|postcode)\s*:\s*[^\n]+/gi,
      "Delivery detail: [omitted]",
    )
    .replace(
      /\b\d{1,6}\s+[\p{L}\p{M}0-9'’.-]+(?:\s+[\p{L}\p{M}0-9'’.-]+){0,5}\s+(?:street|straat|road|rd|avenue|ave|lane|ln|drive|dr|close|crescent|way|boulevard|blvd)\b[^\n]*/giu,
      "[street address omitted]",
    )
    .replace(
      /\b(?:customer|account|user)\s+id\s*:\s*[^\s,;]+/gi,
      "Account ID: [omitted]",
    )
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[account ID omitted]",
    )
    .replace(
      /(?:\+27\s?[6-8]\d(?:[\s-]?\d){7}|\b0[6-8]\d(?:[\s-]?\d){7}\b)/g,
      "[phone omitted]",
    )
    .replace(/\b\d{4}\b/g, "[postal code omitted]");
}

function hasSupportingFactForSensitiveClaims(
  reply: string,
  selectedFacts: Array<string | undefined>,
) {
  const facts = selectedFacts.filter(Boolean).join("\n");
  const claimChecks = [
    { claim: /\b(?:deliver|delivery|shipping|courier)\b/i, fact: /\b(?:deliver|delivery|shipping|courier|fulfilment)\b/i },
    { claim: /\b(?:available|availability|stock|in stock|out of stock)\b/i, fact: /\b(?:available|availability|stock|in stock|out of stock)\b/i },
    { claim: /\b(?:return|refund|exchange|handover)\b/i, fact: /\b(?:return|refund|exchange|handover)\b/i },
    { claim: /\b(?:VAT|company registration|registered business)\b/i, fact: /\b(?:VAT|company registration|registered business)\b/i },
  ];

  return claimChecks.every(
    ({ claim, fact }) => !claim.test(reply) || fact.test(facts),
  );
}

function hasReversedSensitiveClaim(reply: string, facts: string[]) {
  const source = facts.join("\n");
  const reversals = [
    /\b(?:not|isn't|is not|never)\s+(?:available|in stock|paid|confirmed|complete|completed|delivered|refunded)\b/i,
    /\b(?:not|isn't|is not|never)\s+(?:out of stock|unavailable|pending|failed|cancelled|canceled)\b/i,
    /\b(?:no|without)\s+(?:empty[- ]cylinder handover|exchange handover|delivery fee)\b/i,
  ];

  return reversals.some((pattern) => {
    const claim = reply.match(pattern)?.[0];

    return Boolean(claim && !source.toLowerCase().includes(claim.toLowerCase()));
  });
}

function getProtectedValues(value: string) {
  const patterns = [
    /https?:\/\/[^\s<>()]+/g,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    /(?:\+27(?:[\s()-]*\d){9}\b|\b0(?:[\s()-]*\d){9}\b)/g,
    /\b(?:company registration number|VAT registration number|primary customer support phone|secondary customer support phone|customer support email)\s*:\s*[^\n]+/gi,
    /\b\d{4}\/\d{6}\/\d{2}\b/g,
    /\b4\d{9}\b/g,
    /\b(?:ZAR|R)\s*\d(?:[\d\s.,]*\d)?\b/g,
    /\b\d+\s*x\s+[^\n]+/gi,
    /\b\d+(?:[.,]\d+)?\s*kg\b/gi,
    /\b(?:JE-\d{8}-[A-Z0-9]+|INV-?\d+)\b/gi,
    /\b(?:type|unit price|product subtotal|delivery fee|subtotal|total paid|total)\s*:\s*[^\n]+/gi,
    /\bThis is (?:an exchange|a full\/new cylinder)[^\n]+/gi,
    /\b(?:currently available to order|currently out of stock|out of stock|in stock)\b/gi,
    /\breply\s+(?:YES|RETRY|STOP)\b/gi,
    /\b(?:payment|delivery|order)\s+status\s*:\s*[^\n]+/gi,
    /\b(?:payment|delivery|order)(?:\s+confirmation)?(?:\s+is|\s+remains|\s+was)?\s+(?:awaiting payment|awaiting confirmation|complete|completed|confirmed|paid|pending|processing|failed|cancelled|canceled|refunded|fulfilled|dispatched|out for delivery|delivered|unavailable|delayed)\b/gi,
  ];
  const matches = patterns.flatMap((pattern) => value.match(pattern) ?? []);

  return [...new Set(matches.map((match) => match.replace(/[),.;!?]+$/, "")))];
}

function normalizeAiInterpretation(
  interpretation: z.infer<typeof aiInterpretationSchema>,
  fallback: MessageInterpretation,
): MessageInterpretation | null {
  if (interpretation.confidence < 0.55) {
    return null;
  }

  if (
    fallback.intent === "stop" ||
    fallback.intent === "confirm" ||
    fallback.intent === "cancel"
  ) {
    return fallback;
  }

  return {
    intent: interpretation.intent,
    purchaseType: fallback.purchaseType ?? interpretation.purchaseType,
    query: interpretation.query?.trim() || fallback.query,
    quantity:
      fallback.quantity !== 1
        ? fallback.quantity
        : Math.max(1, Math.min(12, interpretation.quantity)),
    sizeKg: fallback.sizeKg ?? interpretation.sizeKg,
    supportTopic:
      (interpretation.supportTopic as WhatsappSupportTopic | null) ??
      fallback.supportTopic,
  };
}

function getResponseText(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    for (const item of payload.output) {
      if (
        typeof item === "object" &&
        item !== null &&
        "content" in item &&
        Array.isArray(item.content)
      ) {
        const text = item.content
          .map((contentItem: unknown) =>
            typeof contentItem === "object" &&
            contentItem !== null &&
            "text" in contentItem &&
            typeof contentItem.text === "string"
              ? contentItem.text
              : "",
          )
          .join("")
          .trim();

        if (text) {
          return text;
        }
      }
    }
  }

  return "";
}
