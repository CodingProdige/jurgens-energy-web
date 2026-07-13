import { z } from "zod";

import { getOpenAiIntegrationConfig } from "@/src/modules/marketplace/settings";
import type {
  MessageInterpretation,
  WhatsappSupportTopic,
} from "@/src/modules/whatsapp-ordering/service";

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

export async function interpretWhatsappMessageWithAi({
  fallback,
  message,
}: {
  fallback: MessageInterpretation;
  message: string;
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
        input: buildInterpreterInput({ fallback, message }),
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

function buildInterpreterInput({
  fallback,
  message,
}: {
  fallback: MessageInterpretation;
  message: string;
}) {
  return [
    `Customer message: ${message}`,
    `Rule-based fallback: ${JSON.stringify(fallback)}`,
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
    "- purchaseType exchange: refill, swap, exchange, topup, empty cylinder, gas ran out, hand over empty.",
    "- purchaseType standard: full/new cylinder, buying from scratch, no empty to return.",
    "- If they say same/usual/again, prefer repeat even if size is missing.",
    "- Extract quantity and kg size from words or digits where present.",
    "- For product_search, put the product phrase in query.",
    "- For support, choose the closest supportTopic.",
  ].join("\n");
}

function normalizeAiInterpretation(
  interpretation: z.infer<typeof aiInterpretationSchema>,
  fallback: MessageInterpretation,
): MessageInterpretation | null {
  if (interpretation.confidence < 0.55) {
    return null;
  }

  if (fallback.intent === "stop") {
    return fallback;
  }

  return {
    intent: interpretation.intent,
    purchaseType: interpretation.purchaseType,
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
