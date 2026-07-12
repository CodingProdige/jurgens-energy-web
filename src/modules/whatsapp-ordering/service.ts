import crypto from "node:crypto";

import { and, asc, desc, eq, gt, or } from "drizzle-orm";

import { db } from "@/src/db";
import {
  brands,
  categories,
  media,
  orderItems,
  orders,
  payments,
  productMedia,
  products,
  productVariants,
  shipments,
  whatsappConversations,
  whatsappMessages,
  whatsappOrderDrafts,
} from "@/src/db/schema";
import { env } from "@/src/config/env";
import { formatFromZar } from "@/src/modules/currency";
import { getMediaPublicUrl } from "@/src/modules/media/paths";
import { getJurgensDeliveryZones } from "@/src/modules/shipping/jurgens-delivery";
import { send360DialogTextMessage } from "@/src/modules/whatsapp-ordering/360dialog";
import { interpretWhatsappMessageWithAi } from "@/src/modules/whatsapp-ordering/ai";
import {
  linkWhatsappNumberToUser,
  normalizeWhatsappAccountPhone,
  rememberWhatsappCustomerLink,
} from "@/src/modules/whatsapp-ordering/customer-links";
import type { LocalCartInput } from "@/src/modules/cart";

const zarCurrencyContext = {
  currency: "ZAR",
  locale: "en-ZA",
  rate: 1,
} as const;
const draftTtlMs = 60 * 60 * 1000;
const publicProductStatuses = new Set(["active", "live"]);
const checkoutLinkExpiryLabel = "1 hour";
const contactPhoneNumbers = ["021 123 4567", "081 234 5678"] as const;
const contactEmail = "info@jurgensenergy.com";

type WhatsappProvider = "360dialog" | "generic" | "meta" | "take_app" | "twilio";
export type WhatsappPurchaseType = "exchange" | "standard";
export type WhatsappSupportTopic =
  | "account_setup"
  | "business_info"
  | "contact"
  | "delivery_areas"
  | "last_invoice"
  | "location"
  | "shipping_rates"
  | "unknown";

export type WhatsappInboundMessage = {
  body: string;
  from: string;
  profileName?: string | null;
  provider: WhatsappProvider;
  providerConversationId?: string | null;
  providerMessageId?: string | null;
  rawPayload?: Record<string, unknown>;
};

export type WhatsappAssistantResult = {
  conversationId: string | null;
  draftUrl: string | null;
  reply: string;
  skipReply?: boolean;
  status:
    | "ask_for_size"
    | "automation_paused"
    | "draft_confirmation"
    | "draft_created"
    | "duplicate_ignored"
    | "human_handoff"
    | "invalid_phone"
    | "no_match"
    | "opted_out"
    | "support_answer";
};

export type WhatsappDraftCartPayload = {
  cartItem: LocalCartInput;
  draftId: string;
  expiresAt: string;
  intent: string;
  prompt: string | null;
  summary: {
    priceLabel: string;
    productTitle: string;
    purchaseType: WhatsappPurchaseType;
    quantity: number;
    variantTitle: string;
  };
};

export type MessageInterpretation = {
  intent:
    | "cancel"
    | "confirm"
    | "human"
    | "invoice"
    | "order"
    | "payment_link"
    | "product_search"
    | "repeat"
    | "status"
    | "stop"
    | "support";
  purchaseType: WhatsappPurchaseType | null;
  query: string | null;
  quantity: number;
  sizeKg: number | null;
  supportTopic: WhatsappSupportTopic | null;
};

type DraftVariantCandidate = {
  exchangeEmptyConfirmed: boolean;
  intent: string;
  productId: string;
  purchaseType: WhatsappPurchaseType;
  quantity: number;
  sourceOrderId?: string | null;
  sourceOrderItemId?: string | null;
  variantId: string;
};

type VariantSnapshot = {
  brandName: string | null;
  exchangeAcceptedReturnBrands: string[];
  exchangeConfirmationText: string | null;
  exchangeRequiredEmptyCylinderSize: string | null;
  imageUrl: string | null;
  priceLabel: string;
  productId: string;
  productTitle: string;
  purchaseType: WhatsappPurchaseType;
  quantity: number;
  slug: string;
  title: string;
  totalLabel: string;
  unitPriceZar: number;
  variantId: string;
  variantTitle: string;
};

type WhatsappConversationState = {
  moderation?: {
    abuseCount?: number;
    automationPausedAt?: string;
    automationPausedBy?: "admin" | "system";
    lastBoundaryReplyAt?: string;
    lastFlagReason?: string;
    lastFlaggedAt?: string;
    mutedUntil?: string;
    repeatedMessageCount?: number;
    repeatedMessageHash?: string;
    unknownCount?: number;
  };
  pendingOrder?: {
    candidate: DraftVariantCandidate;
    customerPrompt: string;
  };
  partialOrder?: {
    customerPrompt: string;
    purchaseType: WhatsappPurchaseType | null;
    quantity: number;
    sizeKg: number | null;
    updatedAt: string;
  };
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createDraftUrl(token: string) {
  return new URL(`/whatsapp/resume/${token}`, env.APP_URL).toString();
}

function toMediaUrl(
  relativePath: string | null,
  thumbnailRelativePath: string | null,
) {
  const path = thumbnailRelativePath ?? relativePath;

  return path ? getMediaPublicUrl(path) : null;
}

function normalizeWhatsappPhone(value: string) {
  return normalizeWhatsappAccountPhone(value);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashMessageBody(value: string) {
  return crypto.createHash("sha256").update(normalizeText(value)).digest("hex");
}

function parseQuantity(text: string) {
  const match =
    text.match(/\b(?:x|qty|quantity)\s*(\d{1,2})\b/) ??
    text.match(/\b(\d{1,2})\s*(?:cylinders?|bottles?)\b/);

  if (!match?.[1]) {
    return 1;
  }

  return Math.max(1, Math.min(12, Number(match[1]) || 1));
}

function parseCylinderSize(text: string) {
  const match = text.match(/\b(\d{1,2})\s*k(?:g|gs|ilo|ilos)?\b/);

  if (!match?.[1]) {
    return null;
  }

  const size = Number(match[1]);

  return Number.isFinite(size) && size > 0 ? size : null;
}

function isGreetingMessage(message: string) {
  const text = normalizeText(message);

  return /^(hi|hello|hey|howzit|good morning|good afternoon|good evening|yo|sup|hiya|hi there|hello there)[!.?\s]*$/.test(
    text,
  );
}

type ModerationCheck =
  | {
      flagged: false;
    }
  | {
      flagged: true;
      kind: "abuse" | "malicious" | "spam";
      reason: string;
    };

function checkMessageModeration(
  message: string,
  state: WhatsappConversationState,
): ModerationCheck {
  const text = normalizeText(message);
  const previousHash = state.moderation?.repeatedMessageHash;
  const previousCount = state.moderation?.repeatedMessageCount ?? 0;
  const currentHash = hashMessageBody(message);

  if (text.length > 1500) {
    return {
      flagged: true,
      kind: "spam",
      reason: "Message is too long for automated WhatsApp ordering.",
    };
  }

  if (previousHash === currentHash && previousCount >= 2) {
    return {
      flagged: true,
      kind: "spam",
      reason: "Repeated identical message.",
    };
  }

  if (
    /(\bignore\b.*\b(instructions|rules|policy|system|developer)\b|\bsystem prompt\b|\bdeveloper message\b|\bapi key\b|\benv vars?\b|\bsecret\b|\bpassword\b|\bopenai api\b|\bdialogue api\b|\bwebhook token\b|\bdrop table\b|\bsql injection\b|\bjailbreak\b)/.test(
      text,
    )
  ) {
    return {
      flagged: true,
      kind: "malicious",
      reason: "Prompt injection or sensitive internal-data request.",
    };
  }

  if (
    /(\bi will\b.*\b(kill|shoot|stab|bomb|hurt)\b|\bkill you\b|\bshoot you\b|\bstab you\b|\byou are\b.*\b(cunt|bitch|idiot|moron)\b|\bfuck you\b)/.test(
      text,
    )
  ) {
    return {
      flagged: true,
      kind: "abuse",
      reason: "Abusive or threatening message.",
    };
  }

  return { flagged: false };
}

function updateRepeatedMessageState(
  state: WhatsappConversationState,
  message: string,
): WhatsappConversationState {
  const messageHash = hashMessageBody(message);
  const repeatedMessageCount =
    state.moderation?.repeatedMessageHash === messageHash
      ? (state.moderation.repeatedMessageCount ?? 0) + 1
      : 1;

  return {
    ...state,
    moderation: {
      ...state.moderation,
      repeatedMessageCount,
      repeatedMessageHash: messageHash,
    },
  };
}

function shouldSkipAutomatedReply(state: WhatsappConversationState) {
  const moderation = state.moderation;

  if (!moderation) {
    return false;
  }

  if (moderation.automationPausedAt) {
    return true;
  }

  if (!moderation.mutedUntil) {
    return false;
  }

  return new Date(moderation.mutedUntil).getTime() > Date.now();
}

function flagConversationState({
  check,
  state,
}: {
  check: Extract<ModerationCheck, { flagged: true }>;
  state: WhatsappConversationState;
}) {
  const now = new Date();
  const existing = state.moderation ?? {};
  const abuseCount =
    check.kind === "abuse" || check.kind === "malicious"
      ? (existing.abuseCount ?? 0) + 1
      : (existing.abuseCount ?? 0);
  const unknownCount =
    check.kind === "spam"
      ? (existing.unknownCount ?? 0) + 1
      : (existing.unknownCount ?? 0);
  const shouldMute = abuseCount >= 2 || unknownCount >= 3;
  const mutedUntil = shouldMute
    ? new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    : existing.mutedUntil;

  return {
    ...state,
    moderation: {
      ...existing,
      abuseCount,
      lastFlagReason: check.reason,
      lastFlaggedAt: now.toISOString(),
      mutedUntil,
      unknownCount,
    },
  };
}

function incrementUnknownConversationState(state: WhatsappConversationState) {
  const now = new Date();
  const existing = state.moderation ?? {};
  const unknownCount = (existing.unknownCount ?? 0) + 1;
  const mutedUntil =
    unknownCount >= 3
      ? new Date(now.getTime() + 30 * 60 * 1000).toISOString()
      : existing.mutedUntil;

  return {
    ...state,
    moderation: {
      ...existing,
      lastFlagReason: "Repeated unknown or off-topic message.",
      lastFlaggedAt: now.toISOString(),
      mutedUntil,
      unknownCount,
    },
  };
}

function buildModerationReply(state: WhatsappConversationState) {
  const moderation = state.moderation;

  if (moderation?.mutedUntil) {
    return "I am pausing automated replies for now. A Jurgens Energy team member can review this conversation if needed.";
  }

  return "I can only help with Jurgens Energy gas orders, LPG exchanges, delivery, invoices, products, and account support.";
}

function createInterpretation(
  values: Partial<MessageInterpretation> & {
    intent: MessageInterpretation["intent"];
  },
): MessageInterpretation {
  return {
    purchaseType: null,
    query: null,
    quantity: 1,
    sizeKg: null,
    supportTopic: null,
    ...values,
  };
}

function interpretMessage(message: string): MessageInterpretation {
  const text = normalizeText(message);
  const sizeKg = parseCylinderSize(text);
  const quantity = parseQuantity(text);

  if (/(\bstop\b|\bunsubscribe\b|\bopt out\b)/.test(text)) {
    return createInterpretation({ intent: "stop", quantity, sizeKg });
  }

  if (/^(\s*)?(yes|yep|yeah|correct|confirm|confirmed|go ahead|send (it|link)|send the link|pay now)(\s*)?$/.test(text)) {
    return createInterpretation({ intent: "confirm", quantity, sizeKg });
  }

  if (/^(\s*)?(no|nope|cancel|wrong|never mind|nevermind)(\s*)?$/.test(text)) {
    return createInterpretation({ intent: "cancel", quantity, sizeKg });
  }

  if (/(\bagent\b|\bhuman\b|\bperson\b|\bcall me\b|\bhelp\b)/.test(text)) {
    return createInterpretation({ intent: "human", quantity, sizeKg });
  }

  if (/(\bnew payment link\b|\bresend\b.*\blink\b|\blink expired\b|\bsend\b.*\blink\b)/.test(text)) {
    return createInterpretation({ intent: "payment_link", quantity, sizeKg });
  }

  if (/(\binvoice\b|\bproof of payment\b|\breceipt\b)/.test(text)) {
    return createInterpretation({
      intent: "invoice",
      quantity,
      sizeKg,
      supportTopic: "last_invoice",
    });
  }

  if (/(\btrack\b|\bwhere is my\b|\bstatus\b|\border status\b|\bdelivery status\b|\bdriver\b|\bexpect\b.*\bdelivery\b)/.test(text)) {
    return createInterpretation({ intent: "status", quantity, sizeKg });
  }

  if (/(\bdo you have\b|\bsell\b|\bstock\b|\bavailable\b|\blooking for\b)/.test(text)) {
    return createInterpretation({
      intent: "product_search",
      query: message,
      quantity,
      sizeKg,
    });
  }

  if (/(\bemail\b|\bphone\b|\bnumber\b|\bcontact\b)/.test(text)) {
    return createInterpretation({
      intent: "support",
      quantity,
      sizeKg,
      supportTopic: "contact",
    });
  }

  if (/(\blocat|\baddress\b|\bwhere are you\b)/.test(text)) {
    return createInterpretation({
      intent: "support",
      quantity,
      sizeKg,
      supportTopic: "location",
    });
  }

  if (/(\bwhere do you deliver\b|\bdelivery areas?\b|\bdeliver to\b|\bpostal code\b)/.test(text)) {
    return createInterpretation({
      intent: "support",
      quantity,
      sizeKg,
      supportTopic: "delivery_areas",
    });
  }

  if (/(\bshipping rates?\b|\bdelivery cost\b|\bdelivery fee\b|\bshipping cost\b)/.test(text)) {
    return createInterpretation({
      intent: "support",
      quantity,
      sizeKg,
      supportTopic: "shipping_rates",
    });
  }

  if (/(\baccount\b|\bregister\b|\bsign ?up\b|\bsign in\b|\blogin\b)/.test(text)) {
    return createInterpretation({
      intent: "support",
      quantity,
      sizeKg,
      supportTopic: "account_setup",
    });
  }

  if (/(\bwhat do you\b|\bwho are you\b|\babout\b|\bwhat is jurgens\b)/.test(text)) {
    return createInterpretation({
      intent: "support",
      quantity,
      sizeKg,
      supportTopic: "business_info",
    });
  }

  const wantsFull =
    /(\bfull\b|\bnew\b|\bbuy\b|\bpurchase\b|\banother cylinder\b)/.test(text) &&
    !/(\bempty\b|\bexchange\b|\bswap\b|\brefill\b|\btop ?up\b|\btopup\b)/.test(
      text,
    );
  const wantsExchange =
    /(\bexchange\b|\bswap\b|\brefill\b|\btop ?up\b|\btopup\b|\bempty\b)/.test(
      text,
    );
  const wantsRepeat =
    /(\bagain\b|\bsame\b|\banother\b|\blast\b|\busual\b|\btop ?up\b|\btopup\b)/.test(
      text,
    );
  const purchaseType: WhatsappPurchaseType | null = wantsExchange
    ? "exchange"
    : wantsFull
      ? "standard"
      : null;
  const hasOrderCue =
    Boolean(sizeKg) ||
    wantsExchange ||
    wantsFull ||
    /(\border\b|\bneed\b|\bsend\b|\bgas\b|\blpg\b|\bcylinder\b|\bbottle\b)/.test(
      text,
    );

  if (!hasOrderCue) {
    return createInterpretation({
      intent: "support",
      query: message,
      quantity,
      sizeKg,
      supportTopic: "unknown",
    });
  }

  return createInterpretation({
    intent: wantsRepeat ? "repeat" : "order",
    purchaseType,
    quantity,
    sizeKg,
  });
}

async function interpretMessageWithAiFallback(
  message: string,
): Promise<MessageInterpretation> {
  const fallback = interpretMessage(message);

  if (fallback.intent === "stop") {
    return fallback;
  }

  const aiInterpretation = await interpretWhatsappMessageWithAi({
    fallback,
    message,
  });

  return aiInterpretation ?? fallback;
}

function optionValuesText(optionValues: string[]) {
  return optionValues.join(" ");
}

function candidateHasSize(
  candidate: {
    exchangeEmptyCylinderSize: string | null;
    productTitle: string;
    variantOptionValues: string[];
    variantTitle: string;
  },
  sizeKg: number | null,
) {
  if (!sizeKg) {
    return false;
  }

  const sizePattern = new RegExp(`\\b${sizeKg}\\s*k(?:g|gs)?\\b`, "i");

  return sizePattern.test(
    [
      candidate.productTitle,
      candidate.variantTitle,
      candidate.exchangeEmptyCylinderSize,
      optionValuesText(candidate.variantOptionValues),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function isCylinderCandidate(candidate: {
  categoryPath: string | null;
  productTitle: string;
  variantTitle: string;
}) {
  return /cylinder|lpg|gas/.test(
    [candidate.productTitle, candidate.variantTitle, candidate.categoryPath]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  );
}

async function upsertCustomerLink(phone: string, userId: string | null) {
  return rememberWhatsappCustomerLink({
    phone,
    source: userId ? "order_history" : "whatsapp_origin",
    userId,
    verified: Boolean(userId),
  });
}

async function getOrCreateConversation({
  customerLinkId,
  phone,
  provider,
  providerConversationId,
  userId,
}: {
  customerLinkId: string;
  phone: string;
  provider: WhatsappProvider;
  providerConversationId: string | null;
  userId: string | null;
}) {
  const [existing] = await db
    .select({
      id: whatsappConversations.id,
      state: whatsappConversations.state,
    })
    .from(whatsappConversations)
    .where(
      and(
        eq(whatsappConversations.phone, phone),
        eq(whatsappConversations.status, "open"),
      ),
    )
    .orderBy(desc(whatsappConversations.updatedAt))
    .limit(1);

  if (existing) {
    return { id: existing.id, state: getConversationState(existing.state) };
  }

  const now = new Date();
  const [created] = await db
    .insert(whatsappConversations)
    .values({
      customerLinkId,
      lastInboundAt: now,
      phone,
      provider,
      providerConversationId,
      updatedAt: now,
      userId,
    })
    .returning({
      id: whatsappConversations.id,
      state: whatsappConversations.state,
    });

  return { id: created.id, state: getConversationState(created.state) };
}

function getConversationState(value: unknown): WhatsappConversationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const state = value as WhatsappConversationState;
  const pendingOrder = state.pendingOrder;
  const partialOrder =
    state.partialOrder &&
    typeof state.partialOrder === "object" &&
    !Array.isArray(state.partialOrder)
      ? state.partialOrder
      : undefined;
  const moderation =
    state.moderation &&
    typeof state.moderation === "object" &&
    !Array.isArray(state.moderation)
      ? state.moderation
      : undefined;
  const nextState: WhatsappConversationState = {};

  if (moderation) {
    nextState.moderation = {
      abuseCount: Number.isFinite(Number(moderation.abuseCount))
        ? Number(moderation.abuseCount)
        : undefined,
      automationPausedAt:
        typeof moderation.automationPausedAt === "string"
          ? moderation.automationPausedAt
          : undefined,
      automationPausedBy:
        moderation.automationPausedBy === "admin" ||
        moderation.automationPausedBy === "system"
          ? moderation.automationPausedBy
          : undefined,
      lastBoundaryReplyAt:
        typeof moderation.lastBoundaryReplyAt === "string"
          ? moderation.lastBoundaryReplyAt
          : undefined,
      lastFlagReason:
        typeof moderation.lastFlagReason === "string"
          ? moderation.lastFlagReason
          : undefined,
      lastFlaggedAt:
        typeof moderation.lastFlaggedAt === "string"
          ? moderation.lastFlaggedAt
          : undefined,
      mutedUntil:
        typeof moderation.mutedUntil === "string"
          ? moderation.mutedUntil
          : undefined,
      repeatedMessageCount: Number.isFinite(Number(moderation.repeatedMessageCount))
        ? Number(moderation.repeatedMessageCount)
        : undefined,
      repeatedMessageHash:
        typeof moderation.repeatedMessageHash === "string"
          ? moderation.repeatedMessageHash
          : undefined,
      unknownCount: Number.isFinite(Number(moderation.unknownCount))
        ? Number(moderation.unknownCount)
        : undefined,
    };
  }

  if (
    pendingOrder &&
    typeof pendingOrder === "object" &&
    pendingOrder.candidate &&
    typeof pendingOrder.customerPrompt === "string"
  ) {
    nextState.pendingOrder = pendingOrder;
  }

  if (partialOrder && isRecentPartialOrder(partialOrder)) {
    nextState.partialOrder = {
      customerPrompt:
        typeof partialOrder.customerPrompt === "string"
          ? partialOrder.customerPrompt
          : "",
      purchaseType:
        partialOrder.purchaseType === "exchange" ||
        partialOrder.purchaseType === "standard"
          ? partialOrder.purchaseType
          : null,
      quantity: normalizeQuantity(partialOrder.quantity),
      sizeKg: normalizeSizeKg(partialOrder.sizeKg),
      updatedAt: partialOrder.updatedAt,
    };
  }

  return nextState;
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);

  return Number.isFinite(quantity)
    ? Math.max(1, Math.min(12, Math.trunc(quantity)))
    : 1;
}

function normalizeSizeKg(value: unknown) {
  const sizeKg = Number(value);

  return Number.isFinite(sizeKg) && sizeKg > 0 ? sizeKg : null;
}

function isRecentPartialOrder(
  partialOrder: NonNullable<WhatsappConversationState["partialOrder"]>,
) {
  const updatedAt = new Date(partialOrder.updatedAt).getTime();

  if (!Number.isFinite(updatedAt)) {
    return false;
  }

  return Date.now() - updatedAt < 30 * 60 * 1000;
}

function mergeInterpretationWithPartialOrder({
  interpretation,
  partialOrder,
}: {
  interpretation: MessageInterpretation;
  partialOrder: WhatsappConversationState["partialOrder"];
}): MessageInterpretation {
  if (
    interpretation.intent !== "order" ||
    !partialOrder ||
    !isRecentPartialOrder(partialOrder)
  ) {
    return interpretation;
  }

  return {
    ...interpretation,
    purchaseType: interpretation.purchaseType ?? partialOrder.purchaseType,
    quantity:
      interpretation.quantity === 1
        ? partialOrder.quantity
        : interpretation.quantity,
    sizeKg: interpretation.sizeKg ?? partialOrder.sizeKg,
  };
}

function buildPartialOrderState({
  interpretation,
  message,
  partialOrder,
}: {
  interpretation: MessageInterpretation;
  message: string;
  partialOrder: WhatsappConversationState["partialOrder"];
}): NonNullable<WhatsappConversationState["partialOrder"]> {
  return {
    customerPrompt: [partialOrder?.customerPrompt, message]
      .filter(Boolean)
      .join(" "),
    purchaseType: interpretation.purchaseType ?? partialOrder?.purchaseType ?? null,
    quantity:
      interpretation.quantity === 1 && partialOrder
        ? partialOrder.quantity
        : interpretation.quantity,
    sizeKg: interpretation.sizeKg ?? partialOrder?.sizeKg ?? null,
    updatedAt: new Date().toISOString(),
  };
}

function buildOrderCustomerPrompt({
  message,
  partialOrder,
}: {
  message: string;
  partialOrder: WhatsappConversationState["partialOrder"];
}) {
  return [partialOrder?.customerPrompt, message].filter(Boolean).join(" ");
}

async function updateConversationState(
  conversationId: string,
  state: WhatsappConversationState,
) {
  await db
    .update(whatsappConversations)
    .set({ state, updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId));
}

async function clearPendingOrder(
  conversationId: string,
  state: WhatsappConversationState,
) {
  const nextState = { ...state };
  delete nextState.pendingOrder;
  delete nextState.partialOrder;

  await updateConversationState(conversationId, nextState);

  return nextState;
}

async function recordWhatsappMessage({
  body,
  conversationId,
  direction,
  payload,
  provider,
  providerMessageId,
}: {
  body: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  payload?: Record<string, unknown> | null;
  provider: WhatsappProvider;
  providerMessageId?: string | null;
}) {
  const rows = await db
    .insert(whatsappMessages)
    .values({
      body,
      conversationId,
      direction,
      payload: payload ?? null,
      provider,
      providerMessageId:
        providerMessageId ?? `${direction}:${crypto.randomUUID()}`,
    })
    .onConflictDoNothing()
    .returning({ id: whatsappMessages.id });

  return rows.length > 0;
}

async function updateConversationAfterMessage({
  conversationId,
  direction,
  intent,
}: {
  conversationId: string;
  direction: "inbound" | "outbound";
  intent?: string | null;
}) {
  const now = new Date();
  const updateValues = {
    updatedAt: now,
    ...(direction === "inbound" ? { lastInboundAt: now } : {}),
    ...(direction === "outbound" ? { lastOutboundAt: now } : {}),
    ...(intent ? { lastIntent: intent } : {}),
  };

  await db
    .update(whatsappConversations)
    .set(updateValues)
    .where(eq(whatsappConversations.id, conversationId));
}

async function findLastOrderCandidate({
  phone,
  purchaseType,
  sizeKg,
}: {
  phone: string;
  purchaseType: WhatsappPurchaseType | null;
  sizeKg: number | null;
}): Promise<DraftVariantCandidate | null> {
  const rows = await db
    .select({
      exchangeEmptyCylinderSize: productVariants.exchangeEmptyCylinderSize,
      orderCreatedAt: orders.createdAt,
      orderId: orders.id,
      orderItemId: orderItems.id,
      orderItemPurchaseType: orderItems.purchaseType,
      productId: products.id,
      productTitle: products.title,
      quantity: orderItems.quantity,
      requiresExchangeEmpty: productVariants.requiresExchangeEmpty,
      userId: orders.userId,
      variantId: productVariants.id,
      variantOptionValues: productVariants.optionValues,
      variantTitle: productVariants.title,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(orders.customerPhone, phone),
        or(eq(orders.status, "paid"), eq(orders.status, "fulfilled")),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(18);

  const match = rows.find((row) => {
    if (purchaseType && row.orderItemPurchaseType !== purchaseType) {
      return false;
    }

    if (sizeKg && !candidateHasSize(row, sizeKg)) {
      return false;
    }

    return true;
  });

  if (!match) {
    return null;
  }

  return {
    exchangeEmptyConfirmed: match.requiresExchangeEmpty,
    intent: "repeat_last_order",
    productId: match.productId,
    purchaseType: match.requiresExchangeEmpty ? "exchange" : "standard",
    quantity: Math.max(1, Math.min(12, match.quantity)),
    sourceOrderId: match.orderId,
    sourceOrderItemId: match.orderItemId,
    variantId: match.variantId,
  };
}

async function findCatalogCandidate({
  purchaseType,
  quantity,
  sizeKg,
}: {
  purchaseType: WhatsappPurchaseType | null;
  quantity: number;
  sizeKg: number | null;
}): Promise<DraftVariantCandidate | null> {
  if (!sizeKg) {
    return null;
  }

  const rows = await db
    .select({
      categoryPath: categories.path,
      continueSellingOutOfStock: productVariants.continueSellingOutOfStock,
      exchangeEmptyCylinderSize: productVariants.exchangeEmptyCylinderSize,
      fulfillmentMode: products.fulfillmentMode,
      price: productVariants.price,
      productId: products.id,
      productStatus: products.status,
      productTitle: products.title,
      requiresExchangeEmpty: productVariants.requiresExchangeEmpty,
      stockOnHand: productVariants.stockOnHand,
      variantId: productVariants.id,
      variantIsActive: productVariants.isActive,
      variantOptionValues: productVariants.optionValues,
      variantStatus: productVariants.status,
      variantTitle: productVariants.title,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId));

  const scored = rows
    .filter((row) => {
      return (
        row.variantIsActive &&
        row.variantStatus === "active" &&
        publicProductStatuses.has(row.productStatus) &&
        isCylinderCandidate(row) &&
        candidateHasSize(row, sizeKg)
      );
    })
    .map((row) => {
      let score = 0;

      if (row.continueSellingOutOfStock || row.stockOnHand > 0) {
        score += 20;
      }

      if (purchaseType === "exchange" && row.requiresExchangeEmpty) {
        score += 80;
      } else if (purchaseType === "standard" && !row.requiresExchangeEmpty) {
        score += 70;
      } else if (!purchaseType && row.requiresExchangeEmpty) {
        score += 30;
      }

      if (row.fulfillmentMode === "piessang_fulfilled") {
        score += 15;
      }

      return { row, score };
    })
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return Number(first.row.price) - Number(second.row.price);
    });

  const best = scored[0]?.row;

  if (!best) {
    return null;
  }

  const matchedPurchaseType: WhatsappPurchaseType = best.requiresExchangeEmpty
    ? "exchange"
    : "standard";

  return {
    exchangeEmptyConfirmed: best.requiresExchangeEmpty,
    intent: "catalog_match",
    productId: best.productId,
    purchaseType: matchedPurchaseType,
    quantity,
    variantId: best.variantId,
  };
}

async function createWhatsappOrderDraft({
  candidate,
  conversationId,
  customerPrompt,
  phone,
  userId,
}: {
  candidate: DraftVariantCandidate;
  conversationId: string;
  customerPrompt: string;
  phone: string;
  userId: string | null;
}) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + draftTtlMs);
  const [draft] = await db
    .insert(whatsappOrderDrafts)
    .values({
      conversationId,
      customerPrompt,
      exchangeEmptyConfirmed: candidate.exchangeEmptyConfirmed,
      expiresAt,
      intent: candidate.intent,
      metadata: {
        source: "whatsapp",
      },
      phone,
      productId: candidate.productId,
      purchaseType: candidate.purchaseType,
      quantity: candidate.quantity,
      sourceOrderId: candidate.sourceOrderId ?? null,
      sourceOrderItemId: candidate.sourceOrderItemId ?? null,
      tokenHash,
      userId,
      variantId: candidate.variantId,
    })
    .returning({
      id: whatsappOrderDrafts.id,
    });

  return {
    draftId: draft.id,
    draftUrl: createDraftUrl(token),
    token,
  };
}

async function getVariantSnapshot({
  purchaseType,
  quantity,
  variantId,
}: {
  purchaseType: WhatsappPurchaseType;
  quantity: number;
  variantId: string;
}): Promise<VariantSnapshot | null> {
  const [row] = await db
    .select({
      brandName: brands.name,
      exchangeAcceptedReturnBrands: productVariants.exchangeAcceptedReturnBrands,
      exchangeConfirmationText: productVariants.exchangeConfirmationText,
      exchangeEmptyCylinderSize: productVariants.exchangeEmptyCylinderSize,
      mediaRelativePath: media.relativePath,
      mediaThumbnailRelativePath: media.thumbnailRelativePath,
      price: productVariants.price,
      productId: products.id,
      productSlug: products.slug,
      productStatus: products.status,
      productTitle: products.title,
      requiresExchangeEmpty: productVariants.requiresExchangeEmpty,
      variantId: productVariants.id,
      variantIsActive: productVariants.isActive,
      variantStatus: productVariants.status,
      variantTitle: productVariants.title,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(media, eq(media.id, productVariants.mediaId))
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (
    !row ||
    !row.variantIsActive ||
    row.variantStatus !== "active" ||
    !publicProductStatuses.has(row.productStatus)
  ) {
    return null;
  }

  let imageUrl = toMediaUrl(row.mediaRelativePath, row.mediaThumbnailRelativePath);

  if (!imageUrl) {
    const [cover] = await db
      .select({
        relativePath: media.relativePath,
        thumbnailRelativePath: media.thumbnailRelativePath,
      })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(eq(productMedia.productId, row.productId))
      .orderBy(desc(productMedia.isCover), asc(productMedia.sortOrder))
      .limit(1);

    imageUrl =
      cover ? toMediaUrl(cover.relativePath, cover.thumbnailRelativePath) : null;
  }

  const actualPurchaseType: WhatsappPurchaseType = row.requiresExchangeEmpty
    ? "exchange"
    : purchaseType;
  const unitPriceZar = Number(row.price);
  const safeUnitPriceZar = Number.isFinite(unitPriceZar) ? unitPriceZar : 0;

  return {
    brandName: row.brandName,
    exchangeAcceptedReturnBrands: Array.isArray(row.exchangeAcceptedReturnBrands)
      ? row.exchangeAcceptedReturnBrands.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    exchangeConfirmationText: row.exchangeConfirmationText,
    exchangeRequiredEmptyCylinderSize: row.exchangeEmptyCylinderSize,
    imageUrl,
    priceLabel: formatFromZar(safeUnitPriceZar, zarCurrencyContext),
    productId: row.productId,
    productTitle: row.productTitle,
    purchaseType: actualPurchaseType,
    quantity,
    slug: row.productSlug,
    title:
      row.variantTitle && row.variantTitle !== row.productTitle
        ? `${row.productTitle} - ${row.variantTitle}`
        : row.productTitle,
    totalLabel: formatFromZar(safeUnitPriceZar * quantity, zarCurrencyContext),
    unitPriceZar: safeUnitPriceZar,
    variantId: row.variantId,
    variantTitle: row.variantTitle,
  };
}

function buildDraftReply({
  draftUrl,
  interpretation,
  snapshot,
}: {
  draftUrl: string;
  interpretation: MessageInterpretation;
  snapshot: VariantSnapshot;
}) {
  const typeLabel = snapshot.purchaseType === "exchange" ? "exchange" : "full";
  const quantityLabel = snapshot.quantity > 1 ? ` x${snapshot.quantity}` : "";
  const repeatLabel =
    interpretation.intent === "repeat" ? "I found your last order" : "I found";

  return `${repeatLabel}: ${snapshot.title}${quantityLabel} (${typeLabel}) at ${snapshot.priceLabel}. Your secure Jurgens Energy review and payment link expires in ${checkoutLinkExpiryLabel}: ${draftUrl}`;
}

function buildOrderConfirmationReply({
  interpretation,
  snapshot,
}: {
  interpretation: MessageInterpretation;
  snapshot: VariantSnapshot;
}) {
  const typeLabel =
    snapshot.purchaseType === "exchange"
      ? "Exchange - you hand over an acceptable empty cylinder on delivery"
      : "Full/new cylinder - no empty cylinder return";
  const intro =
    interpretation.intent === "repeat"
      ? "I found your previous order. Please confirm before I send a payment link:"
      : "Please confirm this before I send a payment link:";
  const imageLine = snapshot.imageUrl ? `\nProduct image: ${snapshot.imageUrl}` : "";

  return [
    intro,
    `${snapshot.quantity} x ${snapshot.title}`,
    `Type: ${typeLabel}`,
    `Unit price: ${snapshot.priceLabel}`,
    `Product subtotal: ${snapshot.totalLabel}`,
    "Delivery is calculated on the secure checkout step from your address.",
    `${imageLine}`,
    `Reply YES to confirm, or tell me what to change. The secure review/payment link will expire in ${checkoutLinkExpiryLabel}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildGreetingReply(state: WhatsappConversationState) {
  const pendingOrder = state.pendingOrder;

  if (pendingOrder) {
    const snapshot = await getVariantSnapshot({
      purchaseType: pendingOrder.candidate.purchaseType,
      quantity: pendingOrder.candidate.quantity,
      variantId: pendingOrder.candidate.variantId,
    });

    if (snapshot) {
      return [
        "Hi, welcome back.",
        `Are you still looking for ${snapshot.quantity} x ${snapshot.title}?`,
        "Reply YES to confirm, or tell me what to change.",
      ].join("\n");
    }
  }

  if (state.partialOrder && isRecentPartialOrder(state.partialOrder)) {
    const quantityLabel =
      state.partialOrder.quantity > 1 ? `${state.partialOrder.quantity} x ` : "";
    const sizeLabel = state.partialOrder.sizeKg
      ? `${state.partialOrder.sizeKg}kg `
      : "";

    if (state.partialOrder.sizeKg && !state.partialOrder.purchaseType) {
      return [
        "Hi, welcome back.",
        `I still have ${quantityLabel}${sizeLabel}cylinder noted.`,
        "Should that be an exchange or a full/new cylinder?",
      ].join("\n");
    }

    if (!state.partialOrder.sizeKg && state.partialOrder.purchaseType) {
      const typeLabel =
        state.partialOrder.purchaseType === "exchange" ? "exchange" : "full/new";

      return [
        "Hi, welcome back.",
        `I still have a ${typeLabel} cylinder order started.`,
        "What size do you need?",
      ].join("\n");
    }
  }

  return [
    "Hi, this is Jurgens Energy.",
    "Do you need a gas top-up or cylinder exchange today?",
    "Send the size, quantity, and delivery suburb.",
  ].join("\n");
}

async function respond({
  conversationId,
  draftUrl = null,
  provider,
  reply,
  status,
}: {
  conversationId: string | null;
  draftUrl?: string | null;
  provider: WhatsappProvider;
  reply: string;
  status: WhatsappAssistantResult["status"];
}) {
  if (conversationId) {
    await recordWhatsappMessage({
      body: reply,
      conversationId,
      direction: "outbound",
      provider,
    });
    await updateConversationAfterMessage({
      conversationId,
      direction: "outbound",
      intent: status,
    });
  }

  return {
    conversationId,
    draftUrl,
    reply,
    status,
  };
}

function createStoreUrl(path: string) {
  return new URL(path, env.APP_URL).toString();
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatMoney(value: string | number) {
  return formatFromZar(value, zarCurrencyContext);
}

function identityCondition(phone: string, userId: string | null) {
  return userId
    ? or(eq(orders.customerPhone, phone), eq(orders.userId, userId))
    : eq(orders.customerPhone, phone);
}

async function findLastOrderSummary({
  phone,
  requirePaid = false,
  userId,
}: {
  phone: string;
  requirePaid?: boolean;
  userId: string | null;
}) {
  const [order] = await db
    .select({
      createdAt: orders.createdAt,
      grandTotal: orders.grandTotal,
      id: orders.id,
      orderNumber: orders.orderNumber,
      paidAt: orders.paidAt,
      shippingTotal: orders.shippingTotal,
      status: orders.status,
      subtotal: orders.subtotal,
    })
    .from(orders)
    .where(
      and(
        identityCondition(phone, userId),
        requirePaid
          ? or(eq(orders.status, "paid"), eq(orders.status, "fulfilled"))
          : undefined,
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (!order) {
    return null;
  }

  const [items, shipmentRows, paymentRows] = await Promise.all([
    db
      .select({
        quantity: orderItems.quantity,
        title: orderItems.title,
        unitPrice: orderItems.unitPrice,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id)),
    db
      .select({
        status: shipments.status,
        trackingNumber: shipments.trackingNumber,
        trackingUrl: shipments.trackingUrl,
        waybillNumber: shipments.waybillNumber,
      })
      .from(shipments)
      .where(eq(shipments.orderId, order.id))
      .orderBy(desc(shipments.createdAt))
      .limit(1),
    db
      .select({
        providerStatus: payments.providerStatus,
        status: payments.status,
      })
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(desc(payments.createdAt))
      .limit(1),
  ]);

  return {
    ...order,
    items,
    payment: paymentRows[0] ?? null,
    shipment: shipmentRows[0] ?? null,
  };
}

function buildOrderSummaryLines(order: Awaited<ReturnType<typeof findLastOrderSummary>>) {
  if (!order) {
    return [];
  }

  return order.items.map(
    (item) =>
      `${item.quantity} x ${item.title} at ${formatMoney(item.unitPrice)} each`,
  );
}

async function answerLastInvoice({
  phone,
  userId,
}: {
  phone: string;
  userId: string | null;
}) {
  const order = await findLastOrderSummary({ phone, requirePaid: true, userId });

  if (!order) {
    return "I could not find a paid Jurgens Energy order linked to this WhatsApp number yet. If you used a different account or phone number, ask for a human and we can help match it.";
  }

  return [
    `Your latest paid order/invoice I can see is ${order.orderNumber}.`,
    `Date: ${formatDate(order.paidAt ?? order.createdAt)}`,
    `Items: ${buildOrderSummaryLines(order).join("; ") || "No item lines found"}`,
    `Subtotal: ${formatMoney(order.subtotal)}`,
    `Delivery: ${formatMoney(order.shippingTotal)}`,
    `Total paid: ${formatMoney(order.grandTotal)}`,
    "For a formal PDF invoice, sign in to your Jurgens Energy account or ask for a human to resend it.",
  ].join("\n");
}

async function answerOrderStatus({
  phone,
  userId,
}: {
  phone: string;
  userId: string | null;
}) {
  const order = await findLastOrderSummary({ phone, userId });

  if (!order) {
    return "I could not find an order linked to this WhatsApp number yet. If you ordered with another number or email, ask for a human and we can help find it.";
  }

  const shipment = order.shipment;
  const trackingLine = shipment?.trackingUrl
    ? `Tracking: ${shipment.trackingUrl}`
    : shipment?.trackingNumber
      ? `Tracking number: ${shipment.trackingNumber}`
      : null;

  return [
    `Latest order: ${order.orderNumber}`,
    `Order status: ${order.status}`,
    order.payment ? `Payment status: ${order.payment.status}` : null,
    shipment ? `Delivery status: ${shipment.status.replaceAll("_", " ")}` : null,
    trackingLine,
    `Total: ${formatMoney(order.grandTotal)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function rateLabel(rate: {
  fromAmount: number;
  price: number;
  upToAmount: number | null;
}) {
  const range = rate.upToAmount
    ? `${formatMoney(rate.fromAmount)}-${formatMoney(rate.upToAmount)}`
    : `${formatMoney(rate.fromAmount)}+`;

  return `${range}: ${formatMoney(rate.price)}`;
}

async function answerDeliveryAreas() {
  const zones = await getJurgensDeliveryZones({ activeOnly: true });
  const intro = [
    "It depends on what you are looking for.",
    "Jurgens Energy direct LPG delivery and Bob Go courier delivery do not use the same coverage rules.",
    "Are you looking for a cylinder exchange/top-up, a full/new cylinder, or accessories? Send the item and delivery suburb or postal code and I can guide you.",
  ];

  if (zones.length === 0) {
    return [
      ...intro,
      "Jurgens Energy direct delivery zones are not configured yet. Courier options, where available, are calculated at checkout from the delivery address.",
    ].join("\n");
  }

  return [
    ...intro,
    "Current Jurgens Energy direct delivery zones:",
    ...zones.slice(0, 8).map((zone) => {
      const codes = zone.postalCodes.slice(0, 8).join(", ");
      const more = zone.postalCodes.length > 8 ? "..." : "";

      return `- ${zone.name}: ${codes}${more}`;
    }),
    "For seller-fulfilled marketplace items, Bob Go courier availability is calculated at checkout from the delivery address and parcel data.",
  ].join("\n");
}

async function answerShippingRates() {
  const zones = await getJurgensDeliveryZones({ activeOnly: true });

  if (zones.length === 0) {
    return "Shipping rates are calculated at checkout from your address. Jurgens Energy direct delivery zones are not configured yet.";
  }

  return [
    "Configured Jurgens Energy direct delivery rates:",
    ...zones.slice(0, 6).map((zone) => {
      const rates = zone.rates.map(rateLabel).join("; ");
      const minimum =
        zone.minimumOrderAmount > 0
          ? ` Minimum order: ${formatMoney(zone.minimumOrderAmount)}.`
          : "";

      return `- ${zone.name}: ${rates || "No rate tiers configured."}${minimum}`;
    }),
    "Courier delivery for Bob Go/seller items is calculated at checkout from the delivery address and parcel data.",
  ].join("\n");
}

function searchTerms(value: string | null) {
  const stopWords = new Set([
    "a",
    "any",
    "available",
    "do",
    "for",
    "have",
    "i",
    "looking",
    "need",
    "sell",
    "stock",
    "the",
    "you",
  ]);

  return normalizeText(value ?? "")
    .split(" ")
    .filter((term) => term.length > 1 && !stopWords.has(term));
}

async function answerProductSearch(query: string | null) {
  const terms = searchTerms(query);

  if (terms.length === 0) {
    return `Tell me what product you are looking for, for example "do you have 9kg LPG cylinders?" or "do you sell gas stoves?".`;
  }

  const rows = await db
    .select({
      brandName: brands.name,
      categoryPath: categories.path,
      continueSellingOutOfStock: productVariants.continueSellingOutOfStock,
      mediaRelativePath: media.relativePath,
      mediaThumbnailRelativePath: media.thumbnailRelativePath,
      price: productVariants.price,
      productId: products.id,
      productSlug: products.slug,
      productStatus: products.status,
      productTitle: products.title,
      shortDescription: products.shortDescription,
      stockOnHand: productVariants.stockOnHand,
      variantIsActive: productVariants.isActive,
      variantStatus: productVariants.status,
      variantTitle: productVariants.title,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(media, eq(media.id, productVariants.mediaId));

  const matches = rows
    .filter(
      (row) =>
        row.variantIsActive &&
        row.variantStatus === "active" &&
        publicProductStatuses.has(row.productStatus),
    )
    .map((row) => {
      const haystack = normalizeText(
        [
          row.productTitle,
          row.variantTitle,
          row.shortDescription,
          row.brandName,
          row.categoryPath,
        ]
          .filter(Boolean)
          .join(" "),
      );
      const score = terms.reduce(
        (total, term) => total + (haystack.includes(term) ? 1 : 0),
        0,
      );

      return { row, score };
    })
    .filter((match) => match.score > 0)
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return Number(first.row.price) - Number(second.row.price);
    });
  const seenProductIds = new Set<string>();
  const topMatches = matches
    .filter((match) => {
      if (seenProductIds.has(match.row.productId)) {
        return false;
      }

      seenProductIds.add(match.row.productId);
      return true;
    })
    .slice(0, 3);

  if (topMatches.length === 0) {
    return `I could not find a matching product for "${query}". Try another product name, or ask for a human and we can check manually.`;
  }

  return [
    "I found these matching products:",
    ...topMatches.map(({ row }, index) => {
      const inStock = row.continueSellingOutOfStock || row.stockOnHand > 0;
      const imageUrl = toMediaUrl(
        row.mediaRelativePath,
        row.mediaThumbnailRelativePath,
      );

      return [
        `${index + 1}. ${row.productTitle} - ${formatMoney(row.price)} - ${
          inStock ? "in stock" : "currently out of stock"
        }`,
        createStoreUrl(`/products/${row.productSlug}`),
        imageUrl ? `Image: ${imageUrl}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }),
    "Reply with the product, quantity, and whether it is exchange or full/new if you want me to help build the order.",
  ].join("\n");
}

async function answerSupportQuestion({
  interpretation,
  phone,
  userId,
}: {
  interpretation: MessageInterpretation;
  phone: string;
  userId: string | null;
}) {
  if (interpretation.intent === "invoice") {
    return answerLastInvoice({ phone, userId });
  }

  if (interpretation.intent === "product_search") {
    return answerProductSearch(interpretation.query);
  }

  switch (interpretation.supportTopic) {
    case "account_setup":
      return `You can create a Jurgens Energy marketplace account here: ${createStoreUrl("/register")}. If you already have one, sign in here: ${createStoreUrl("/sign-in")}.`;
    case "business_info":
      return "Jurgens Energy supplies LPG cylinders, cylinder exchanges, and gas accessories through the online marketplace, with direct local delivery where configured and courier options for seller-fulfilled items.";
    case "contact":
      return `You can contact Jurgens Energy at ${contactEmail}. Phone numbers listed on the store are ${contactPhoneNumbers.join(" and ")}.`;
    case "delivery_areas":
      return answerDeliveryAreas();
    case "location":
      return "Jurgens Energy is based in South Africa. The storefront currently lists the public location as South Africa; ask for a human if you need a specific branch or collection address.";
    case "shipping_rates":
      return answerShippingRates();
    case "last_invoice":
      return answerLastInvoice({ phone, userId });
    case "unknown":
    default:
      return "I can help with that. Are you looking to place a gas order, check delivery, find a product, or speak to the Jurgens Energy team?";
  }
}

async function renewLatestWhatsappDraft({
  conversationId,
  customerPrompt,
  phone,
  userId,
}: {
  conversationId: string;
  customerPrompt: string;
  phone: string;
  userId: string | null;
}) {
  const [latestDraft] = await db
    .select({
      exchangeEmptyConfirmed: whatsappOrderDrafts.exchangeEmptyConfirmed,
      productId: whatsappOrderDrafts.productId,
      purchaseType: whatsappOrderDrafts.purchaseType,
      quantity: whatsappOrderDrafts.quantity,
      sourceOrderId: whatsappOrderDrafts.sourceOrderId,
      sourceOrderItemId: whatsappOrderDrafts.sourceOrderItemId,
      variantId: whatsappOrderDrafts.variantId,
    })
    .from(whatsappOrderDrafts)
    .where(
      and(
        eq(whatsappOrderDrafts.phone, phone),
        eq(whatsappOrderDrafts.status, "pending"),
      ),
    )
    .orderBy(desc(whatsappOrderDrafts.createdAt))
    .limit(1);

  if (!latestDraft) {
    return null;
  }

  await db
    .update(whatsappOrderDrafts)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(whatsappOrderDrafts.phone, phone),
        eq(whatsappOrderDrafts.status, "pending"),
      ),
    );

  const purchaseType =
    latestDraft.purchaseType === "exchange" ? "exchange" : "standard";
  const candidate: DraftVariantCandidate = {
    exchangeEmptyConfirmed: latestDraft.exchangeEmptyConfirmed,
    intent: "renew_payment_link",
    productId: latestDraft.productId,
    purchaseType,
    quantity: Math.max(1, Math.min(12, latestDraft.quantity)),
    sourceOrderId: latestDraft.sourceOrderId,
    sourceOrderItemId: latestDraft.sourceOrderItemId,
    variantId: latestDraft.variantId,
  };

  const snapshot = await getVariantSnapshot({
    purchaseType: candidate.purchaseType,
    quantity: candidate.quantity,
    variantId: candidate.variantId,
  });

  if (!snapshot) {
    return null;
  }

  const draft = await createWhatsappOrderDraft({
    candidate,
    conversationId,
    customerPrompt,
    phone,
    userId,
  });

  return {
    draftUrl: draft.draftUrl,
    snapshot,
  };
}

export async function processWhatsappInboundMessage(
  input: WhatsappInboundMessage,
): Promise<WhatsappAssistantResult> {
  const phone = normalizeWhatsappPhone(input.from);

  if (!phone) {
    return {
      conversationId: null,
      draftUrl: null,
      reply:
        "I could not read your WhatsApp number. Please send your request from a valid WhatsApp number or order online.",
      status: "invalid_phone",
    };
  }

  let link = await upsertCustomerLink(phone, null);
  const conversation = await getOrCreateConversation({
    customerLinkId: link.id,
    phone,
    provider: input.provider,
    providerConversationId: input.providerConversationId ?? null,
    userId: link.userId,
  });

  const insertedInbound = await recordWhatsappMessage({
    body: input.body,
    conversationId: conversation.id,
    direction: "inbound",
    payload: input.rawPayload,
    provider: input.provider,
    providerMessageId: input.providerMessageId,
  });

  if (!insertedInbound && input.providerMessageId) {
    return {
      conversationId: conversation.id,
      draftUrl: null,
      reply: "",
      skipReply: true,
      status: "automation_paused",
    };
  }

  let conversationState = updateRepeatedMessageState(conversation.state, input.body);

  if (shouldSkipAutomatedReply(conversationState)) {
    await updateConversationState(conversation.id, conversationState);
    await updateConversationAfterMessage({
      conversationId: conversation.id,
      direction: "inbound",
      intent: "automation_paused",
    });

    return {
      conversationId: conversation.id,
      draftUrl: null,
      reply: "",
      skipReply: true,
      status: "duplicate_ignored",
    };
  }

  const moderationCheck = checkMessageModeration(input.body, conversationState);

  if (moderationCheck.flagged) {
    conversationState = flagConversationState({
      check: moderationCheck,
      state: conversationState,
    });
    await updateConversationState(conversation.id, conversationState);
    await updateConversationAfterMessage({
      conversationId: conversation.id,
      direction: "inbound",
      intent: `moderation_${moderationCheck.kind}`,
    });

    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply: buildModerationReply(conversationState),
      status: "support_answer",
    });
  }

  if (isGreetingMessage(input.body)) {
    await updateConversationState(conversation.id, conversationState);
    await updateConversationAfterMessage({
      conversationId: conversation.id,
      direction: "inbound",
      intent: "greeting",
    });

    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply: await buildGreetingReply(conversationState),
      status: "support_answer",
    });
  }

  await updateConversationState(conversation.id, conversationState);

  const rawInterpretation = await interpretMessageWithAiFallback(input.body);
  const interpretation = mergeInterpretationWithPartialOrder({
    interpretation: rawInterpretation,
    partialOrder: conversationState.partialOrder,
  });
  const lastOrderCandidate =
    interpretation.intent === "repeat"
      ? await findLastOrderCandidate({
          phone,
          purchaseType: interpretation.purchaseType,
          sizeKg: interpretation.sizeKg,
        })
      : null;
  const userIdFromLastOrder = lastOrderCandidate?.sourceOrderId
    ? await findUserIdForOrder(lastOrderCandidate.sourceOrderId)
    : null;

  if (userIdFromLastOrder && userIdFromLastOrder !== link.userId) {
    link = await upsertCustomerLink(phone, userIdFromLastOrder);
    await db
      .update(whatsappConversations)
      .set({ updatedAt: new Date(), userId: link.userId })
      .where(eq(whatsappConversations.id, conversation.id));
  }

  await updateConversationAfterMessage({
    conversationId: conversation.id,
    direction: "inbound",
    intent: interpretation.intent,
  });

  if (interpretation.intent === "stop") {
    await db
      .update(whatsappConversations)
      .set({ state: {}, status: "closed", updatedAt: new Date() })
      .where(eq(whatsappConversations.id, conversation.id));

    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply:
        "No problem. I have stopped this WhatsApp ordering conversation. You can still order any time from the Jurgens Energy store.",
      status: "opted_out",
    });
  }

  if (interpretation.intent === "cancel") {
    await clearPendingOrder(conversation.id, conversationState);

    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply:
        "No problem, I have cleared that pending WhatsApp order. Tell me what you need when you are ready.",
      status: "support_answer",
    });
  }

  if (interpretation.intent === "confirm" && conversationState.pendingOrder) {
    const pendingOrder = conversationState.pendingOrder;
    const snapshot = await getVariantSnapshot({
      purchaseType: pendingOrder.candidate.purchaseType,
      quantity: pendingOrder.candidate.quantity,
      variantId: pendingOrder.candidate.variantId,
    });

    if (!snapshot) {
      await clearPendingOrder(conversation.id, conversationState);

      return respond({
        conversationId: conversation.id,
        provider: input.provider,
        reply:
          "That product changed before I could create the checkout link. Please send the cylinder size and type again, like '9kg exchange'.",
        status: "no_match",
      });
    }

    const draft = await createWhatsappOrderDraft({
      candidate: pendingOrder.candidate,
      conversationId: conversation.id,
      customerPrompt: pendingOrder.customerPrompt,
      phone,
      userId: link.userId,
    });

    await clearPendingOrder(conversation.id, conversationState);

    return respond({
      conversationId: conversation.id,
      draftUrl: draft.draftUrl,
      provider: input.provider,
      reply: buildDraftReply({
        draftUrl: draft.draftUrl,
        interpretation,
        snapshot,
      }),
      status: "draft_created",
    });
  }

  if (interpretation.intent === "payment_link") {
    if (conversationState.pendingOrder) {
      return respond({
        conversationId: conversation.id,
        provider: input.provider,
        reply:
          "I can send the secure payment link after you confirm the order. Reply YES to confirm, or tell me what to change.",
        status: "draft_confirmation",
      });
    }

    const replacementDraft = await renewLatestWhatsappDraft({
      conversationId: conversation.id,
      customerPrompt: input.body,
      phone,
      userId: link.userId,
    });

    if (!replacementDraft) {
      return respond({
        conversationId: conversation.id,
        provider: input.provider,
        reply:
          "I could not find a recent unpaid WhatsApp checkout link to renew. Tell me what you need, for example '9kg exchange', and I will build a fresh order.",
        status: "no_match",
      });
    }

    return respond({
      conversationId: conversation.id,
      draftUrl: replacementDraft.draftUrl,
      provider: input.provider,
      reply: `Here is a fresh secure review and payment link for ${replacementDraft.snapshot.quantity} x ${replacementDraft.snapshot.title}. It expires in ${checkoutLinkExpiryLabel}: ${replacementDraft.draftUrl}`,
      status: "draft_created",
    });
  }

  if (interpretation.intent === "human") {
    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply:
        "Got you. A Jurgens Energy team member can jump in here. For a gas topup, you can also say something like '9kg exchange' or 'same as last time'.",
      status: "human_handoff",
    });
  }

  if (interpretation.intent === "status") {
    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply: await answerOrderStatus({ phone, userId: link.userId }),
      status: "support_answer",
    });
  }

  if (
    interpretation.intent === "invoice" ||
    interpretation.intent === "product_search" ||
    interpretation.intent === "support"
  ) {
    let reply = await answerSupportQuestion({
      interpretation,
      phone,
      userId: link.userId,
    });

    if (
      interpretation.intent === "support" &&
      interpretation.supportTopic === "unknown"
    ) {
      conversationState = incrementUnknownConversationState(conversationState);
      await updateConversationState(conversation.id, conversationState);

      if (conversationState.moderation?.mutedUntil) {
        reply = buildModerationReply(conversationState);
      }
    }

    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply,
      status: "support_answer",
    });
  }

  if (interpretation.intent === "confirm") {
    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply:
        "I do not have an order waiting for confirmation yet. Tell me what you need, for example '9kg exchange' or 'same as last time'.",
      status: "ask_for_size",
    });
  }

  if (interpretation.intent === "order" && !interpretation.purchaseType) {
    await updateConversationState(conversation.id, {
      ...conversationState,
      partialOrder: buildPartialOrderState({
        interpretation,
        message: input.body,
        partialOrder: conversationState.partialOrder,
      }),
    });

    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply:
        "Got it. Should that be an exchange where you hand over an empty cylinder, or a full/new cylinder with no empty return?",
      status: "ask_for_size",
    });
  }

  const candidate =
    lastOrderCandidate ??
    (await findCatalogCandidate({
      purchaseType: interpretation.purchaseType,
      quantity: interpretation.quantity,
      sizeKg: interpretation.sizeKg,
    }));

  if (!candidate) {
    const reply = interpretation.sizeKg
      ? `I could not find an available ${interpretation.sizeKg}kg cylinder option yet. Reply with another size, like "9kg exchange", or ask for a human.`
      : `I can sort that. Reply with the size and type, for example "9kg exchange", "14kg exchange", or "9kg full".`;

    if (!interpretation.sizeKg) {
      await updateConversationState(conversation.id, {
        ...conversationState,
        partialOrder: buildPartialOrderState({
          interpretation,
          message: input.body,
          partialOrder: conversationState.partialOrder,
        }),
      });
    }

    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply,
      status: interpretation.sizeKg ? "no_match" : "ask_for_size",
    });
  }

  const snapshot = await getVariantSnapshot({
    purchaseType: candidate.purchaseType,
    quantity: candidate.quantity,
    variantId: candidate.variantId,
  });

  if (!snapshot) {
    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply:
        "That product changed before I could create the checkout link. Please reply with the cylinder size again, like '9kg exchange'.",
      status: "no_match",
    });
  }

  const nextConversationState: WhatsappConversationState = {
    ...conversationState,
    pendingOrder: {
      candidate,
      customerPrompt: buildOrderCustomerPrompt({
        message: input.body,
        partialOrder: conversationState.partialOrder,
      }),
    },
  };
  delete nextConversationState.partialOrder;

  await updateConversationState(conversation.id, nextConversationState);

  const reply = buildOrderConfirmationReply({
    interpretation,
    snapshot,
  });

  return respond({
    conversationId: conversation.id,
    draftUrl: null,
    provider: input.provider,
    reply,
    status: "draft_confirmation",
  });
}

async function findUserIdForOrder(orderId: string) {
  const [order] = await db
    .select({ userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  return order?.userId ?? null;
}

export async function sendWhatsappPaymentConfirmationForOrder(orderId: string) {
  const [order] = await db
    .select({
      customerPhone: orders.customerPhone,
      grandTotal: orders.grandTotal,
      id: orders.id,
      orderNumber: orders.orderNumber,
      paidAt: orders.paidAt,
      status: orders.status,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.status !== "paid") {
    return { ok: false, skipped: true };
  }

  const phone = normalizeWhatsappPhone(order.customerPhone);

  if (!phone) {
    return { ok: false, skipped: true };
  }

  const [conversation] = await db
    .select({
      id: whatsappConversations.id,
      provider: whatsappConversations.provider,
    })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.phone, phone))
    .orderBy(desc(whatsappConversations.updatedAt))
    .limit(1);

  if (!conversation) {
    return { ok: false, skipped: true };
  }

  const items = await db
    .select({
      quantity: orderItems.quantity,
      title: orderItems.title,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  const body = [
    `Payment received for Jurgens Energy order ${order.orderNumber}.`,
    `Paid: ${formatMoney(order.grandTotal)}`,
    `Items: ${
      items.map((item) => `${item.quantity} x ${item.title}`).join("; ") ||
      "No item lines found"
    }`,
    "Your order is now in our fulfilment flow. We will keep your online store order status aligned from here.",
  ].join("\n");
  const result = await send360DialogTextMessage({
    body,
    to: phone,
  });

  if (result.ok) {
    await recordWhatsappMessage({
      body,
      conversationId: conversation.id,
      direction: "outbound",
      provider:
        conversation.provider === "360dialog" ||
        conversation.provider === "generic" ||
        conversation.provider === "meta" ||
        conversation.provider === "take_app" ||
        conversation.provider === "twilio"
          ? conversation.provider
          : "360dialog",
    });
    await updateConversationAfterMessage({
      conversationId: conversation.id,
      direction: "outbound",
      intent: "payment_confirmed",
    });
  }

  return result;
}

export async function getWhatsappOrderDraftByToken(
  token: string,
): Promise<WhatsappDraftCartPayload | null> {
  const tokenHash = hashToken(token);
  const [draft] = await db
    .select({
      customerPrompt: whatsappOrderDrafts.customerPrompt,
      exchangeEmptyConfirmed: whatsappOrderDrafts.exchangeEmptyConfirmed,
      expiresAt: whatsappOrderDrafts.expiresAt,
      id: whatsappOrderDrafts.id,
      intent: whatsappOrderDrafts.intent,
      purchaseType: whatsappOrderDrafts.purchaseType,
      quantity: whatsappOrderDrafts.quantity,
      status: whatsappOrderDrafts.status,
      variantId: whatsappOrderDrafts.variantId,
    })
    .from(whatsappOrderDrafts)
    .where(
      and(
        eq(whatsappOrderDrafts.tokenHash, tokenHash),
        gt(whatsappOrderDrafts.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!draft || draft.status === "cancelled") {
    return null;
  }

  const purchaseType =
    draft.purchaseType === "exchange" ? "exchange" : "standard";
  const snapshot = await getVariantSnapshot({
    purchaseType,
    quantity: draft.quantity,
    variantId: draft.variantId,
  });

  if (!snapshot) {
    return null;
  }

  return {
    cartItem: {
      brandName: snapshot.brandName,
      exchangeAcceptedReturnBrands: snapshot.exchangeAcceptedReturnBrands,
      exchangeConfirmationText: snapshot.exchangeConfirmationText,
      exchangeEmptyConfirmed: draft.exchangeEmptyConfirmed,
      exchangeRequiredEmptyCylinderSize:
        snapshot.exchangeRequiredEmptyCylinderSize,
      imageUrl: snapshot.imageUrl,
      priceLabel: snapshot.priceLabel,
      productId: snapshot.productId,
      purchaseType: snapshot.purchaseType,
      quantity: snapshot.quantity,
      slug: snapshot.slug,
      title: snapshot.title,
      variantId: snapshot.variantId,
    },
    draftId: draft.id,
    expiresAt: draft.expiresAt.toISOString(),
    intent: draft.intent,
    prompt: draft.customerPrompt,
    summary: {
      priceLabel: snapshot.priceLabel,
      productTitle: snapshot.productTitle,
      purchaseType: snapshot.purchaseType,
      quantity: snapshot.quantity,
      variantTitle: snapshot.variantTitle,
    },
  };
}

export async function consumeWhatsappOrderDraft(
  token: string,
  userId: string | null = null,
) {
  const now = new Date();
  const [draft] = await db
    .select({ phone: whatsappOrderDrafts.phone })
    .from(whatsappOrderDrafts)
    .where(eq(whatsappOrderDrafts.tokenHash, hashToken(token)))
    .limit(1);

  if (draft?.phone && userId) {
    await linkWhatsappNumberToUser({
      phone: draft.phone,
      source: "whatsapp_draft",
      userId,
      verified: true,
    });
  }

  await db
    .update(whatsappOrderDrafts)
    .set({
      consumedAt: now,
      status: "consumed",
      updatedAt: now,
      ...(userId ? { userId } : {}),
    })
    .where(eq(whatsappOrderDrafts.tokenHash, hashToken(token)));
}
