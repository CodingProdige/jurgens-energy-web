import { z } from "zod";

import {
  defineWhatsappAgentReadTool,
  defineWhatsappAgentWriteTool,
  runWhatsappAgentOrchestrator,
  type WhatsappAgentConversationTurn,
  type WhatsappAgentOpenAiConfig,
  type WhatsappAgentOrchestrationResult,
  type WhatsappWriteAuthorizationRequest,
} from "@/src/modules/whatsapp-ordering/orchestrator";

export type WhatsappAgentAdapterResult = {
  data?: Record<string, unknown> | null;
  facts: string[];
  status: string;
};

export type WhatsappAgentOrderProposal = {
  purchaseType: "exchange" | "standard" | null;
  quantity: number;
  repeatLastOrder: boolean;
  sizeKg: number | null;
};

export type WhatsappAgentAdapters = {
  cancelPendingRequest: () => Promise<WhatsappAgentAdapterResult>;
  checkDeliveryArea: (destination: string) => Promise<WhatsappAgentAdapterResult>;
  confirmOrderAndCreateCheckout: () => Promise<WhatsappAgentAdapterResult>;
  getBusinessInformation: (
    question: string,
  ) => Promise<WhatsappAgentAdapterResult>;
  getLatestInvoice: () => Promise<WhatsappAgentAdapterResult>;
  getOrderStatus: () => Promise<WhatsappAgentAdapterResult>;
  proposeOrder: (
    proposal: WhatsappAgentOrderProposal,
  ) => Promise<WhatsappAgentAdapterResult>;
  renewPaymentLink: () => Promise<WhatsappAgentAdapterResult>;
  requestHumanHandover: (
    reason: string,
  ) => Promise<WhatsappAgentAdapterResult>;
  searchProducts: (query: string) => Promise<WhatsappAgentAdapterResult>;
  stopWhatsappAutomation: () => Promise<WhatsappAgentAdapterResult>;
};

export type JurgensWhatsappAgentResult = WhatsappAgentOrchestrationResult & {
  authoritativeFacts: string[];
};

type AgentAuthorizationContext = {
  currentMessage: string;
};

const stringArgumentSchema = z
  .object({ value: z.string().trim().min(1).max(500) })
  .strict();
const confirmedArgumentSchema = z
  .object({ confirmed: z.literal(true) })
  .strict();
const orderProposalSchema = z
  .object({
    purchase_type: z.enum(["exchange", "standard"]).nullable(),
    quantity: z.number().int().min(1).max(12),
    repeat_last_order: z.boolean(),
    size_kg: z.number().int().min(1).max(48).nullable(),
  })
  .strict();

type AgentToolResult = {
  data: Record<string, unknown> | null;
  facts: string[];
  status: string;
};
type ConfirmedArguments = z.infer<typeof confirmedArgumentSchema>;
type EmptyArguments = Record<string, never>;
type OrderProposalArguments = z.infer<typeof orderProposalSchema>;
type StringArguments = z.infer<typeof stringArgumentSchema>;

const singleValueParameters = {
  additionalProperties: false,
  properties: {
    value: { type: "string", minLength: 1, maxLength: 500 },
  },
  required: ["value"],
  type: "object",
} as const;
const confirmedParameters = {
  additionalProperties: false,
  properties: {
    confirmed: { const: true, type: "boolean" },
  },
  required: ["confirmed"],
  type: "object",
} as const;
const orderProposalParameters = {
  additionalProperties: false,
  properties: {
    purchase_type: {
      anyOf: [
        { enum: ["exchange", "standard"], type: "string" },
        { type: "null" },
      ],
      description:
        "exchange means the customer returns an eligible empty cylinder; standard means a full/new cylinder without a return.",
    },
    quantity: { maximum: 12, minimum: 1, type: "integer" },
    repeat_last_order: { type: "boolean" },
    size_kg: {
      anyOf: [
        { maximum: 48, minimum: 1, type: "integer" },
        { type: "null" },
      ],
    },
  },
  required: ["purchase_type", "quantity", "repeat_last_order", "size_kg"],
  type: "object",
} as const;

export async function runJurgensWhatsappAgentTurn({
  adapters,
  authorizeWrite,
  config,
  currentMessage,
  recentTurns,
  validateReply,
  workflowContext,
}: {
  adapters: WhatsappAgentAdapters;
  authorizeWrite: (
    request: WhatsappWriteAuthorizationRequest<AgentAuthorizationContext>,
  ) => boolean | Promise<boolean>;
  config: WhatsappAgentOpenAiConfig;
  currentMessage: string;
  recentTurns: readonly WhatsappAgentConversationTurn[];
  validateReply: (reply: string, authoritativeFacts: string[]) => boolean;
  workflowContext: string;
}): Promise<JurgensWhatsappAgentResult | null> {
  const authoritativeFacts: string[] = [];
  const execute = async (
    callback: () => Promise<WhatsappAgentAdapterResult>,
  ) => {
    const result = await callback();
    const verifiedFacts = result.facts
      .map((fact) => fact.trim())
      .filter(Boolean)
      .slice(0, 40);

    authoritativeFacts.push(...verifiedFacts);

    return {
      data: result.data ?? null,
      facts: verifiedFacts,
      status: result.status,
    };
  };
  const tools = [
    defineWhatsappAgentReadTool<
      StringArguments,
      AgentToolResult,
      AgentAuthorizationContext
    >({
      description:
        "Search the live Jurgens Energy catalogue for products, current prices, availability and product links. Use this for any product question.",
      execute: ({ value }) => execute(() => adapters.searchProducts(value)),
      name: "search_products",
      parameters: singleValueParameters,
      parseArguments: (value) => stringArgumentSchema.parse(value),
    }),
    defineWhatsappAgentReadTool<
      StringArguments,
      AgentToolResult,
      AgentAuthorizationContext
    >({
      description:
        "Retrieve the verified country-level delivery policy for eligible online-store orders within South Africa. Exact product eligibility and delivery fees are confirmed at checkout from the customer's complete delivery address.",
      execute: ({ value }) =>
        execute(() => adapters.checkDeliveryArea(value)),
      name: "check_delivery_area",
      parameters: singleValueParameters,
      parseArguments: (value) => stringArgumentSchema.parse(value),
    }),
    defineWhatsappAgentReadTool<
      StringArguments,
      AgentToolResult,
      AgentAuthorizationContext
    >({
      description:
        "Retrieve verified Jurgens Energy business, contact, policy, fulfilment and product knowledge relevant to the customer's question.",
      execute: ({ value }) =>
        execute(() => adapters.getBusinessInformation(value)),
      name: "get_business_information",
      parameters: singleValueParameters,
      parseArguments: (value) => stringArgumentSchema.parse(value),
    }),
    defineWhatsappAgentReadTool<
      EmptyArguments,
      AgentToolResult,
      AgentAuthorizationContext
    >({
      description:
        "Retrieve the authenticated or phone-matched customer's latest order and delivery status.",
      execute: () => execute(adapters.getOrderStatus),
      name: "get_order_status",
      parameters: {
        additionalProperties: false,
        properties: {},
        required: [],
        type: "object",
      },
      parseArguments: (value) =>
        z.object({}).strict().parse(value) as EmptyArguments,
    }),
    defineWhatsappAgentReadTool<
      EmptyArguments,
      AgentToolResult,
      AgentAuthorizationContext
    >({
      description:
        "Retrieve the authenticated or phone-matched customer's latest paid invoice information and secure invoice link when available.",
      execute: () => execute(adapters.getLatestInvoice),
      name: "get_latest_invoice",
      parameters: {
        additionalProperties: false,
        properties: {},
        required: [],
        type: "object",
      },
      parseArguments: (value) =>
        z.object({}).strict().parse(value) as EmptyArguments,
    }),
    defineWhatsappAgentWriteTool<
      OrderProposalArguments,
      AgentToolResult,
      AgentAuthorizationContext
    >({
      confirmationDescription:
        "Prepare the requested product as an order offer for the customer to review. This does not create a payment or paid order.",
      description:
        "Resolve a customer's cylinder request from the live catalogue and prepare an exact offer for explicit confirmation. Use when the customer wants to buy, refill, replace, exchange, repeat or top up gas.",
      execute: (args) =>
        execute(() =>
          adapters.proposeOrder({
            purchaseType: args.purchase_type,
            quantity: args.quantity,
            repeatLastOrder: args.repeat_last_order,
            sizeKg: args.size_kg,
          }),
        ),
      name: "propose_order",
      parameters: orderProposalParameters,
      parseArguments: (value) => orderProposalSchema.parse(value),
    }),
    defineWhatsappAgentWriteTool<
      ConfirmedArguments,
      AgentToolResult,
      AgentAuthorizationContext
    >({
      confirmationDescription:
        "Create a secure checkout link for the exact order offer currently waiting for confirmation.",
      description:
        "Create the secure checkout link only after the customer explicitly confirms the persisted pending order offer.",
      execute: () => execute(adapters.confirmOrderAndCreateCheckout),
      name: "confirm_order_and_create_checkout",
      parameters: confirmedParameters,
      parseArguments: (value) => confirmedArgumentSchema.parse(value),
    }),
    defineWhatsappAgentWriteTool<
      ConfirmedArguments,
      AgentToolResult,
      AgentAuthorizationContext
    >({
      confirmationDescription:
        "Cancel and clear the currently pending WhatsApp order or delivery request.",
      description:
        "Clear the pending request only when the customer explicitly cancels or declines it.",
      execute: () => execute(adapters.cancelPendingRequest),
      name: "cancel_pending_request",
      parameters: confirmedParameters,
      parseArguments: (value) => confirmedArgumentSchema.parse(value),
    }),
    defineWhatsappAgentWriteTool<
      ConfirmedArguments,
      AgentToolResult,
      AgentAuthorizationContext
    >({
      confirmationDescription:
        "Generate a replacement secure checkout link for the customer's latest eligible unpaid WhatsApp draft.",
      description:
        "Renew an expired or requested payment link when the customer explicitly asks for a new link.",
      execute: () => execute(adapters.renewPaymentLink),
      name: "renew_payment_link",
      parameters: confirmedParameters,
      parseArguments: (value) => confirmedArgumentSchema.parse(value),
    }),
    defineWhatsappAgentWriteTool<
      StringArguments,
      AgentToolResult,
      AgentAuthorizationContext
    >({
      confirmationDescription:
        "Pause automated replies and hand this conversation to a Jurgens Energy team member.",
      description:
        "Pause automation when the customer asks for a human, raises a complaint, safety concern, payment dispute, bulk quotation or another issue requiring staff.",
      execute: ({ value }) =>
        execute(() => adapters.requestHumanHandover(value)),
      name: "request_human_handover",
      parameters: singleValueParameters,
      parseArguments: (value) => stringArgumentSchema.parse(value),
    }),
    defineWhatsappAgentWriteTool<
      ConfirmedArguments,
      AgentToolResult,
      AgentAuthorizationContext
    >({
      confirmationDescription:
        "Close the automated WhatsApp ordering conversation and stop automated service replies.",
      description:
        "Stop WhatsApp automation only when the customer explicitly opts out or says STOP.",
      execute: () => execute(adapters.stopWhatsappAutomation),
      name: "stop_whatsapp_automation",
      parameters: confirmedParameters,
      parseArguments: (value) => confirmedArgumentSchema.parse(value),
    }),
  ];

  const result = await runWhatsappAgentOrchestrator({
    authorizeWrite,
    config,
    currentMessage,
    executionContext: { currentMessage },
    finalResponseGuard: ({ reply, toolCalls }) =>
      toolCalls.some((toolCall) => toolCall.outcome === "succeeded") &&
      validateReply(reply, authoritativeFacts),
    maxModelTurns: 7,
    maxOutputTokens: 650,
    maxToolCalls: 5,
    recentTurns,
    timeoutMs: 12_000,
    tools,
    trustedBusinessInstructions: [
      "Jurgens Energy is the sole seller in this store.",
      "Jurgens Energy is an online store that delivers eligible online-store orders within South Africa.",
      "For delivery questions, state the South Africa policy first: handling takes 0–1 business day after payment confirmation; the order cutoff is 2:00 PM SAST, with after-cutoff orders starting processing on the next business day; shipping takes 1–3 business days after dispatch; and the combined estimated delivery time is 1–4 business days. Delivery fees are shown at checkout.",
      "Do not describe postal-code zones, subregions, local-delivery areas or configured rate tiers. Exact product eligibility is confirmed at checkout from the complete South African delivery address.",
      "Jurgens Energy has no public walk-in shop, customer collection counter or returns desk.",
      "For a cylinder order, use propose_order rather than writing an offer from memory.",
      "Set repeat_last_order true only when the customer explicitly refers to the same, usual or previous order; refill, replace, replacement or top-up alone is an exchange request, not a repeat-order instruction.",
      "An exchange requires an eligible empty cylinder handover; a full/new cylinder does not.",
      "Do not create a checkout link until the persisted offer is explicitly confirmed.",
      "Do not ask for an address in chat when secure checkout can collect it.",
      "Product media is sent separately by the application; never expose internal media paths.",
      "Avoid robotic numbered scripts. Acknowledge what the customer said, answer directly and ask no more than one natural follow-up question.",
      "Understand South African English, Afrikaans and natural code-switching.",
    ].join(" "),
    workflowContext,
  });

  return result
    ? {
        ...result,
        authoritativeFacts: [...new Set(authoritativeFacts)].slice(0, 40),
      }
    : null;
}
