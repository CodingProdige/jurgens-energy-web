import crypto from "node:crypto";

import { and, asc, desc, eq, gt, or, sql as drizzleSql } from "drizzle-orm";

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
  sellerFulfillmentProfiles,
  sellers,
  shipments,
  whatsappConversations,
  whatsappMessages,
  whatsappOrderDrafts,
} from "@/src/db/schema";
import { env } from "@/src/config/env";
import { validateCartLines } from "@/src/modules/cart/server";
import { formatFromZar } from "@/src/modules/currency";
import { getMediaPublicUrl } from "@/src/modules/media/paths";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import { probeBobGoCheckoutRates } from "@/src/modules/shipping/bobgo-client";
import { checkJurgensDeliveryAvailability } from "@/src/modules/shipping/jurgens-delivery";
import { send360DialogTextMessage } from "@/src/modules/whatsapp-ordering/360dialog";
import { interpretWhatsappMessageWithAi } from "@/src/modules/whatsapp-ordering/ai";
import {
  linkWhatsappNumberToUser,
  normalizeWhatsappAccountPhone,
  rememberWhatsappCustomerLink,
} from "@/src/modules/whatsapp-ordering/customer-links";
import {
  deliveryAddressDraftsEqual,
  extractDeliveryDestinationHint,
  extractSouthAfricanPostalCode,
  getCompleteDeliveryAddress,
  getMissingDeliveryAddressFields,
  isDeliveryCoverageQuestion,
  mergeDeliveryAddressDraft,
  parseDeliveryProductChoice,
  parseWhatsappDeliveryInquiry,
  type WhatsappDeliveryInquiry,
  type WhatsappDeliveryProductChoice,
} from "@/src/modules/whatsapp-ordering/delivery-inquiry";
import type { LocalCartInput } from "@/src/modules/cart";

const zarCurrencyContext = {
  country: "ZA",
  currency: "ZAR",
  locale: "en-ZA",
  rate: 1,
  rateUpdatedAt: null,
} as const;
const draftTtlMs = 60 * 60 * 1000;
const publicProductStatuses = new Set(["active", "live"]);
const checkoutLinkExpiryLabel = "1 hour";

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
  deliveryInquiry?: WhatsappDeliveryInquiry;
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
  return parseExplicitQuantity(text) ?? 1;
}

function parseExplicitQuantity(text: string) {
  const normalized = normalizeText(text);
  const match =
    normalized.match(/\b(\d{1,2})\s*x\b/) ??
    normalized.match(/\b(?:x|qty|quantity)\s*(\d{1,2})\b/) ??
    normalized.match(
      /\b(?:make\s+(?:it|that)|change\s+(?:it|that)?\s*to)\s+(\d{1,2})\b/,
    ) ??
    normalized.match(
      /\b(?:deliver|ship|courier)\s+(\d{1,2})(?:\s+(?:of\s+)?(?:these|them|units?))?\s+(?:to|in)\b/,
    ) ??
    normalized.match(
      /\b(?:order|buy|get|take)\s+(\d{1,2})(?:\s+(?:of\s+)?(?:these|them|those|units?|items?))?$/,
    ) ??
    normalized.match(
      /\b(\d{1,2})\s+(?=\d{1,2}\s*k(?:g|gs|ilo|ilos)?\b)/,
    ) ??
    normalized.match(
      /\b(\d{1,2})\s*(?:cylinders?|bottles?|units?|items?|exchanges?|refills?|heaters?|stoves?)\b/,
    );

  let quantity = match?.[1] ? Number(match[1]) : null;

  if (quantity === null) {
    const wordMatch =
      normalized.match(
        /\b(?:order|buy|get|take)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+(?:of\s+)?(?:these|them|those|units?|items?))?$/,
      ) ??
      normalized.match(
        /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b(?=\s+(?:\d{1,2}\s*k(?:g|gs|ilo|ilos)?\b|cylinders?|bottles?|units?|items?|exchanges?|refills?|heaters?|stoves?))/,
      );
    const numberWords: Record<string, number> = {
      eight: 8,
      eleven: 11,
      five: 5,
      four: 4,
      nine: 9,
      one: 1,
      seven: 7,
      six: 6,
      ten: 10,
      three: 3,
      twelve: 12,
      two: 2,
    };

    quantity = wordMatch?.[1] ? numberWords[wordMatch[1]] ?? null : null;
  }

  if (quantity === null || !Number.isFinite(quantity)) {
    return null;
  }

  return Math.max(1, Math.min(12, quantity));
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

  if (
    text !== "retry" &&
    previousHash === currentHash &&
    previousCount >= 3
  ) {
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

  if (/(\bwhere do you deliver\b|\bdelivery areas?\b|\bdeliver(?:y)? to\b|\bship to\b|\bcourier to\b|\bpostal code\b)/.test(text)) {
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
  const deliveryInquiry = parseWhatsappDeliveryInquiry(state.deliveryInquiry);
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

  if (deliveryInquiry) {
    nextState.deliveryInquiry = deliveryInquiry;
  }

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

async function updateConversationModerationState(
  conversationId: string,
  moderation: NonNullable<WhatsappConversationState["moderation"]>,
) {
  await db
    .update(whatsappConversations)
    .set({
      state: drizzleSql`jsonb_set(COALESCE(${whatsappConversations.state}, '{}'::jsonb), '{moderation}', ${JSON.stringify(moderation)}::jsonb, true)`,
      updatedAt: new Date(),
    })
    .where(eq(whatsappConversations.id, conversationId));
}

async function updateDeliveryInquiryState(
  conversationId: string,
  inquiry: WhatsappDeliveryInquiry,
  expectedProbeAt?: string,
) {
  const rows = await db
    .update(whatsappConversations)
    .set({
      state: drizzleSql`jsonb_set(COALESCE(${whatsappConversations.state}, '{}'::jsonb), '{deliveryInquiry}', ${JSON.stringify(inquiry)}::jsonb, true)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(whatsappConversations.id, conversationId),
        ...(expectedProbeAt
          ? [
              drizzleSql`${whatsappConversations.state} #>> '{deliveryInquiry,lastProbeAt}' = ${expectedProbeAt}`,
            ]
          : []),
      ),
    )
    .returning({ id: whatsappConversations.id });

  return rows.length > 0;
}

async function clearPendingOrder(
  conversationId: string,
  state: WhatsappConversationState,
) {
  const nextState = { ...state };
  delete nextState.deliveryInquiry;
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
  const deliveryInquiry = state.deliveryInquiry;

  if (deliveryInquiry) {
    if (deliveryInquiry.step === "awaiting_product") {
      return "Hi, welcome back. I still need the exact product and quantity before I can check delivery.";
    }

    if (deliveryInquiry.step === "awaiting_product_choice") {
      return [
        "Hi, welcome back. Choose the product you want me to check:",
        ...deliveryInquiry.choices.map(
          (choice, index) => `${index + 1}. ${choice.label}`,
        ),
      ].join("\n");
    }

    if (deliveryInquiry.step === "awaiting_postal_code") {
      if (deliveryInquiry.postalCode) {
        return "Hi, welcome back. I still have the postal code, but the last local delivery check did not complete. Reply RETRY and I will try again, or ask for a human.";
      }

      return "Hi, welcome back. Send the four-digit delivery postal code and I will finish the local delivery check.";
    }

    if (deliveryInquiry.step === "awaiting_address") {
      if (
        getCompleteDeliveryAddress(deliveryInquiry.address) &&
        deliveryInquiry.lastProbeAt
      ) {
        return "Hi, welcome back. I already have the courier address, but the last live check did not complete. Reply RETRY after a minute and I will try again, or ask for a human.";
      }

      return buildDeliveryAddressPrompt(
        getMissingDeliveryAddressFields(deliveryInquiry.address),
      );
    }

    if (deliveryInquiry.lastResult) {
      const expiresAt = deliveryInquiry.lastResult.expiresAt
        ? new Date(deliveryInquiry.lastResult.expiresAt).getTime()
        : null;

      if (expiresAt !== null && expiresAt <= Date.now()) {
        return "Hi, welcome back. That live courier estimate has expired. Reply RETRY and I will request current delivery options again.";
      }

      return deliveryInquiry.lastResult.reply;
    }
  }

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

async function answerDeliveryAreas() {
  return "Delivery depends on the exact product because some items use Jurgens Energy local delivery and others use live courier delivery. Send the product, variant and quantity so I can check the correct method.";
}

async function answerShippingRates() {
  return "Delivery pricing depends on the exact product, quantity and destination. Send the product and quantity first so I can route the check through Jurgens Energy local delivery or the live courier provider.";
}

async function answerContactDetails() {
  const settings = await getMarketplaceSettings();
  const phoneNumbers = [
    settings.contactPhonePrimary,
    settings.contactPhoneSecondary,
  ].filter(Boolean);
  const details = [
    settings.contactEmail ? `Email: ${settings.contactEmail}` : null,
    phoneNumbers.length > 0 ? `Phone: ${phoneNumbers.join(" / ")}` : null,
    settings.contactAddress ? `Address: ${settings.contactAddress}` : null,
    `Website: ${createStoreUrl("/")}`,
  ].filter(Boolean);

  return details.length > 0
    ? ["You can contact Jurgens Energy here:", ...details].join("\n")
    : `You can contact Jurgens Energy through the marketplace: ${createStoreUrl("/")}`;
}

async function answerLocation() {
  const settings = await getMarketplaceSettings();

  return settings.contactAddress
    ? `Jurgens Energy is located at ${settings.contactAddress}.`
    : "Jurgens Energy is based in South Africa. Ask for a human if you need a specific branch or collection address.";
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

const deliverySearchStopWords = new Set([
  "a",
  "about",
  "again",
  "actually",
  "address",
  "an",
  "another",
  "afternoon",
  "area",
  "are",
  "available",
  "availability",
  "buy",
  "can",
  "check",
  "change",
  "code",
  "cost",
  "could",
  "courier",
  "deliver",
  "delivered",
  "delivering",
  "delivers",
  "delivery",
  "date",
  "day",
  "do",
  "does",
  "different",
  "fee",
  "friday",
  "for",
  "guys",
  "get",
  "have",
  "how",
  "i",
  "in",
  "is",
  "it",
  "item",
  "last",
  "later",
  "make",
  "monday",
  "morning",
  "me",
  "meant",
  "my",
  "next",
  "of",
  "now",
  "order",
  "other",
  "please",
  "prefer",
  "product",
  "postal",
  "postcode",
  "price",
  "qty",
  "quantity",
  "rate",
  "rates",
  "ship",
  "shipped",
  "shipping",
  "same",
  "saturday",
  "some",
  "sunday",
  "instead",
  "switch",
  "that",
  "take",
  "the",
  "there",
  "thursday",
  "this",
  "to",
  "today",
  "tomorrow",
  "tuesday",
  "time",
  "us",
  "urgent",
  "urgently",
  "use",
  "usual",
  "variant",
  "want",
  "we",
  "what",
  "when",
  "wednesday",
  "week",
  "weekend",
  "where",
  "whether",
  "you",
]);

function getRequestedDeliveryPurchaseType(value: string) {
  const text = normalizeText(value);
  const wantsExchange =
    /\b(exchange|swap|refill|top up|topup|empty)\b/.test(text);
  const wantsStandard =
    /\b(full|new|buy|purchase)\b/.test(text) && !wantsExchange;

  return wantsExchange
    ? ("exchange" as const)
    : wantsStandard
      ? ("standard" as const)
      : null;
}

function withoutStructuredDeliveryAddress(value: string) {
  const pipeParts = value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (
    (pipeParts.length === 5 || pipeParts.length === 6) &&
    /^\d{4}$/.test(pipeParts[4] ?? "")
  ) {
    return "";
  }

  return value
    .split(/\r?\n/)
    .filter((rawLine) => {
      const line = rawLine.trim();
      const separatorIndex = line.search(/[:=-]/);

      if (separatorIndex <= 0) {
        return true;
      }

      const label = normalizeText(line.slice(0, separatorIndex));

      return !/^(street|street address|address|address line 1|address line 2|unit|complex|suburb|local area|area|city|town|province|state|postal code|postcode|zip code)$/.test(
        label,
      );
    })
    .join(" ");
}

function getDeliveryProductSearchContext({
  interpretation,
  query,
}: {
  interpretation: MessageInterpretation;
  query: string;
}) {
  let productText = normalizeText(withoutStructuredDeliveryAddress(query));
  const deliveryMatch = /\b(deliver(?:ed|ing|s|y)?|ship(?:ped|ping|s)?|courier)\b/.exec(
    productText,
  );

  if (deliveryMatch?.index !== undefined) {
    const afterDeliveryIndex = deliveryMatch.index + deliveryMatch[0].length;
    const afterDelivery = productText.slice(afterDeliveryIndex);
    const destinationBoundary = /\b(?:to|in)\b/.exec(afterDelivery);

    if (destinationBoundary?.index !== undefined) {
      productText = `${productText.slice(0, deliveryMatch.index)} ${afterDelivery.slice(0, destinationBoundary.index)}`;
    }
  }

  const terms = productText
    .split(" ")
    .filter(
      (term) =>
        term.length > 1 &&
        !deliverySearchStopWords.has(term) &&
        !/^\d{4}$/.test(term),
    );
  const purchaseType =
    interpretation.purchaseType ?? getRequestedDeliveryPurchaseType(productText);
  const sizeKg = interpretation.sizeKg ?? parseCylinderSize(productText);

  return {
    hasProductSignal:
      terms.length > 0 || sizeKg !== null || purchaseType !== null,
    purchaseType,
    sizeKg,
    terms,
  };
}

function normalizeDeliveryCatalogToken(value: string) {
  if (value.length > 4 && value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.length > 3 && value.endsWith("s")) {
    return value.slice(0, -1);
  }

  return value;
}

function getDeliveryCatalogPurchaseType(candidate: {
  productTitle: string;
  requiresExchangeEmpty: boolean;
  variantTitle: string;
}) {
  const labelledAsExchange = /\b(exchange|refill|swap|top\s*up)\b/.test(
    normalizeText(`${candidate.productTitle} ${candidate.variantTitle}`),
  );

  return candidate.requiresExchangeEmpty || labelledAsExchange
    ? ("exchange" as const)
    : ("standard" as const);
}

async function findDeliveryProductChoices({
  interpretation,
  query,
}: {
  interpretation: MessageInterpretation;
  query: string;
}): Promise<WhatsappDeliveryProductChoice[]> {
  const search = getDeliveryProductSearchContext({ interpretation, query });

  if (!search.hasProductSignal) {
    return [];
  }

  const rows = await db
    .select({
      brandName: brands.name,
      categoryPath: categories.path,
      continueSellingOutOfStock: productVariants.continueSellingOutOfStock,
      exchangeEmptyCylinderSize: productVariants.exchangeEmptyCylinderSize,
      price: productVariants.price,
      productStatus: products.status,
      productTitle: products.title,
      requiresExchangeEmpty: productVariants.requiresExchangeEmpty,
      shortDescription: products.shortDescription,
      stockOnHand: productVariants.stockOnHand,
      variantId: productVariants.id,
      variantIsActive: productVariants.isActive,
      variantOptionValues: productVariants.optionValues,
      variantStatus: productVariants.status,
      variantTitle: productVariants.title,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(categories, eq(categories.id, products.categoryId));

  return rows
    .filter((row) => {
      const inStock = row.continueSellingOutOfStock || row.stockOnHand > 0;
      const sizeMatches = search.sizeKg
        ? candidateHasSize(row, search.sizeKg)
        : true;
      const purchaseTypeMatches = search.purchaseType
        ? search.purchaseType === getDeliveryCatalogPurchaseType(row)
        : true;

      return (
        row.variantIsActive &&
        row.variantStatus === "active" &&
        publicProductStatuses.has(row.productStatus) &&
        inStock &&
        sizeMatches &&
        purchaseTypeMatches
      );
    })
    .map((row) => {
      const isCylinder = isCylinderCandidate(row);
      const purchaseType = getDeliveryCatalogPurchaseType(row);
      const purchaseLabel = purchaseType === "exchange"
        ? "exchange refill swap top up"
        : "full new standard";
      const haystackTokens = new Set(
        normalizeText(
        [
          row.productTitle,
          row.variantTitle,
          row.shortDescription,
          row.brandName,
          row.categoryPath,
          row.exchangeEmptyCylinderSize,
          optionValuesText(row.variantOptionValues),
          isCylinder ? purchaseLabel : null,
        ]
          .filter(Boolean)
          .join(" "),
        )
          .split(" ")
          .map(normalizeDeliveryCatalogToken),
      );
      let score = search.terms.reduce(
        (total, term) =>
          total +
          (haystackTokens.has(normalizeDeliveryCatalogToken(term)) ? 2 : 0),
        0,
      );

      if (search.sizeKg && candidateHasSize(row, search.sizeKg)) {
        score += 8;
      }

      if (
        search.purchaseType &&
        search.purchaseType === purchaseType
      ) {
        score += 6;
      }

      return { isCylinder, row, score };
    })
    .filter(({ score }) => score > 0)
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return Number(first.row.price) - Number(second.row.price);
    })
    .slice(0, 3)
    .map(({ row }) => {
      const title =
        row.variantTitle && row.variantTitle !== row.productTitle
          ? `${row.productTitle} - ${row.variantTitle}`
          : row.productTitle;

      return {
        label: `${title.slice(0, 280)} - ${formatMoney(row.price)}`.slice(
          0,
          320,
        ),
        variantId: row.variantId,
      };
    });
}

function buildDeliveryProductChoiceReply({
  choices,
  quantity,
}: {
  choices: WhatsappDeliveryProductChoice[];
  quantity: number;
}) {
  return [
    "I need the exact item before I check delivery. Which one do you mean?",
    ...choices.map((choice, index) => `${index + 1}. ${choice.label}`),
    `Reply with ${choices.length === 1 ? "1" : `1-${choices.length}`}. I will check ${quantity} unit${quantity === 1 ? "" : "s"}.`,
  ].join("\n");
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

type DeliveryInquiryContext = {
  conversationId: string;
  conversationState: WhatsappConversationState;
  interpretation: MessageInterpretation;
  message: string;
  provider: WhatsappProvider;
};

function isDeliveryInquiryControlIntent(interpretation: MessageInterpretation) {
  return (
    interpretation.intent === "stop" ||
    interpretation.intent === "cancel" ||
    interpretation.intent === "human" ||
    interpretation.intent === "invoice" ||
    interpretation.intent === "payment_link" ||
    interpretation.intent === "status" ||
    (interpretation.intent === "support" &&
      interpretation.supportTopic !== "unknown" &&
      interpretation.supportTopic !== "delivery_areas" &&
      interpretation.supportTopic !== "shipping_rates")
  );
}

function isDeliveryDestinationChangeRequest(message: string) {
  const text = normalizeText(message);

  if (/\b(?:your|jurgens|business|company)\b.*\baddress\b/.test(text)) {
    return false;
  }

  if (/^(?:do|can|could|where)\b.*\byou\b/.test(text)) {
    return false;
  }

  return (
    /\b(?:change|switch|update)\b.*\b(?:delivery\s+)?(?:address|destination|location|postcode|postal code|suburb)\b/.test(
      text,
    ) ||
    /\b(?:address|destination|location|postcode|postal code|suburb)\b.*\b(?:change|switch|update)\b/.test(
      text,
    ) ||
    /\b(?:use|try|my|have|provide|send)\b.*\b(?:another|different|new|other)\b.*\b(?:delivery\s+)?(?:address|destination|location|postcode|postal code|suburb)\b/.test(
      text,
    ) ||
    /^(?:another|different|new|other)(?:\s+delivery)?\s+(?:address|destination|location|postcode|postal code|suburb)$/.test(
      text,
    ) ||
    /\b(?:another|different|new|other)\s+delivery\s+(?:address|destination|location|postcode|postal code|suburb)\b/.test(
      text,
    )
  );
}

async function respondToDeliveryInquiry({
  context,
  expectedProbeAt,
  inquiry,
  reply,
}: {
  context: DeliveryInquiryContext;
  expectedProbeAt?: string;
  inquiry: WhatsappDeliveryInquiry;
  reply: string;
}) {
  const stateUpdated = await updateDeliveryInquiryState(
    context.conversationId,
    inquiry,
    expectedProbeAt,
  );
  const currentReply = stateUpdated
    ? reply.slice(0, 4000)
    : "Your delivery details changed while I was checking, so I discarded the older courier result and kept your newer request.";

  return respond({
    conversationId: context.conversationId,
    provider: context.provider,
    reply: currentReply,
    status: "support_answer",
  });
}

function buildDeliveryAddressPrompt(missingFields?: string[]) {
  return [
    "This item uses courier delivery. I need the complete delivery address to check live courier availability.",
    missingFields?.length
      ? `Still needed: ${missingFields.join(", ")}.`
      : null,
    "Send it in this format:",
    "Street address: 12 Main Street",
    "Suburb: Denneburg",
    "City: Paarl",
    "Province: Western Cape",
    "Postal code: 7646",
    "You can send the fields over more than one message.",
  ]
    .filter(Boolean)
    .join("\n");
}

function appendDeliveryCustomerPrompt(current: string, message: string) {
  return [current, message].filter(Boolean).join(" ").slice(0, 1500);
}

function createResolvedDeliveryInquiry({
  expiresAt = null,
  inquiry,
  reply,
}: {
  expiresAt?: string | null;
  inquiry: WhatsappDeliveryInquiry;
  reply: string;
}): WhatsappDeliveryInquiry {
  const checkedAt = new Date().toISOString();
  const safeReply = reply.slice(0, 4000);

  return {
    ...inquiry,
    choices: [],
    lastResult: {
      checkedAt,
      expiresAt,
      reply: safeReply,
    },
    step: "resolved",
    updatedAt: checkedAt,
  };
}

function getDeliveryResultNextStep(
  conversationState: WhatsappConversationState,
  item: { productSlug: string; quantity: number; variantId: string },
) {
  const pendingCandidate = conversationState.pendingOrder?.candidate;
  const matchesPendingOrder =
    pendingCandidate?.variantId === item.variantId &&
    pendingCandidate.quantity === item.quantity;

  return matchesPendingOrder
    ? "Reply YES if you want to continue with the pending order."
    : `View the product or continue to checkout here: ${createStoreUrl(`/products/${item.productSlug}`)}`;
}

function getUnavailableDeliveryNextStep() {
  return "Send a different product, quantity or destination and I will run a new check, or ask for a human.";
}

async function loadDeliveryInquiryItem(inquiry: WhatsappDeliveryInquiry) {
  if (!inquiry.selectedVariantId) {
    return null;
  }

  const cart = await validateCartLines(
    {
      items: [
        {
          exchangeEmptyConfirmed: true,
          purchaseType: "standard",
          quantity: inquiry.quantity,
          variantId: inquiry.selectedVariantId,
        },
      ],
    },
    zarCurrencyContext,
  );
  const item = cart.items[0];

  return item?.available ? item : null;
}

async function checkJurgensDeliveryInquiry({
  context,
  inquiry,
}: {
  context: DeliveryInquiryContext;
  inquiry: WhatsappDeliveryInquiry;
}) {
  const item = await loadDeliveryInquiryItem(inquiry);

  if (!item) {
    return respondToDeliveryInquiry({
      context,
      inquiry: {
        ...inquiry,
        choices: [],
        selectedVariantId: null,
        step: "awaiting_product",
        updatedAt: new Date().toISOString(),
      },
      reply:
        "That product is no longer available in the same form. Send the product name or cylinder size again and I will recheck it.",
    });
  }

  const postalCode = inquiry.postalCode ?? inquiry.address?.postalCode ?? null;

  if (!postalCode) {
    return respondToDeliveryInquiry({
      context,
      inquiry: {
        ...inquiry,
        step: "awaiting_postal_code",
        updatedAt: new Date().toISOString(),
      },
      reply: `That item uses Jurgens Energy local delivery. Send the four-digit delivery postal code so I can check ${inquiry.quantity} x ${item.productTitle} accurately.`,
    });
  }

  let availability: Awaited<
    ReturnType<typeof checkJurgensDeliveryAvailability>
  >;

  try {
    availability = await checkJurgensDeliveryAvailability({
      declaredValue: item.lineTotalZar,
      postalCode,
    });
  } catch {
    return respondToDeliveryInquiry({
      context,
      inquiry: {
        ...inquiry,
        step: "awaiting_postal_code",
        updatedAt: new Date().toISOString(),
      },
      reply:
        "I could not read the Jurgens Energy delivery settings right now. That does not mean delivery is unavailable. Reply RETRY in a moment or ask for a human.",
    });
  }
  const itemLabel = `${inquiry.quantity} x ${item.productTitle}${
    item.variantTitle !== item.productTitle ? ` - ${item.variantTitle}` : ""
  }`;
  const nextStep = getDeliveryResultNextStep(
    context.conversationState,
    item,
  );

  if (availability.eligible) {
    const reply = [
      `Yes — ${itemLabel} can be delivered to postal code ${availability.postalCode} through ${availability.zone.name}.`,
      `Delivery fee: ${formatMoney(availability.deliveryFee)}.`,
      availability.zone.deliveryInformation?.slice(0, 500),
      nextStep,
    ]
      .filter(Boolean)
      .join("\n");

    return respondToDeliveryInquiry({
      context,
      inquiry: createResolvedDeliveryInquiry({ inquiry, reply }),
      reply,
    });
  }

  if (availability.unavailableCode === "postal_code_unavailable") {
    const reply = [
      `No — Jurgens Energy local delivery for ${itemLabel} is not currently available to postal code ${availability.postalCode}.`,
      "That answer applies to this specific product; courier-fulfilled products use a separate live courier check.",
      getUnavailableDeliveryNextStep(),
    ].join("\n");

    return respondToDeliveryInquiry({
      context,
      inquiry: createResolvedDeliveryInquiry({ inquiry, reply }),
      reply,
    });
  }

  if (availability.unavailableCode === "minimum_order_not_met") {
    const reply = [
      `Postal code ${availability.postalCode} is covered by ${availability.zone?.name ?? "a Jurgens Energy delivery zone"}, but ${itemLabel} does not meet that zone's minimum order yet.`,
      availability.unavailableReason,
      "Send a larger quantity or a different product and I will recalculate it, or ask for a human.",
    ].join("\n");

    return respondToDeliveryInquiry({
      context,
      inquiry: createResolvedDeliveryInquiry({ inquiry, reply }),
      reply,
    });
  }

  return respondToDeliveryInquiry({
    context,
    inquiry: {
      ...inquiry,
      step: "awaiting_postal_code",
      updatedAt: new Date().toISOString(),
    },
    reply:
      "I could not confirm Jurgens Energy delivery right now because delivery quoting is not fully available. Reply RETRY in a moment or ask for a human; I will not guess about coverage.",
  });
}

async function getBobGoCollectionProfile(sellerId: string) {
  const [seller] = await db
    .select({
      addressLine1: sellerFulfillmentProfiles.addressLine1,
      addressLine2: sellerFulfillmentProfiles.addressLine2,
      city: sellerFulfillmentProfiles.city,
      countryCode: sellerFulfillmentProfiles.countryCode,
      displayName: sellers.displayName,
      postalCode: sellerFulfillmentProfiles.postalCode,
      province: sellerFulfillmentProfiles.province,
      suburb: sellerFulfillmentProfiles.suburb,
    })
    .from(sellers)
    .leftJoin(
      sellerFulfillmentProfiles,
      eq(sellerFulfillmentProfiles.sellerId, sellers.id),
    )
    .where(eq(sellers.id, sellerId))
    .limit(1);

  if (
    !seller?.addressLine1 ||
    !seller.city ||
    !seller.postalCode ||
    !seller.province ||
    !seller.suburb
  ) {
    return null;
  }

  return {
    addressLine1: seller.addressLine1,
    addressLine2: seller.addressLine2,
    city: seller.city,
    countryCode: seller.countryCode ?? "ZA",
    displayName: seller.displayName,
    postalCode: seller.postalCode,
    province: seller.province,
    suburb: seller.suburb,
  };
}

function isPositiveNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

async function claimBobGoDeliveryProbe(
  conversationId: string,
  inquiry: WhatsappDeliveryInquiry,
) {
  const cutoff = new Date(Date.now() - 60 * 1000).toISOString();
  const [claimed] = await db
    .update(whatsappConversations)
    .set({
      state: drizzleSql`jsonb_set(COALESCE(${whatsappConversations.state}, '{}'::jsonb), '{deliveryInquiry}', ${JSON.stringify(inquiry)}::jsonb, true)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(whatsappConversations.id, conversationId),
        drizzleSql`COALESCE(${whatsappConversations.state} #>> '{deliveryInquiry,lastProbeAt}', '') < ${cutoff}`,
      ),
    )
    .returning({ id: whatsappConversations.id });

  return Boolean(claimed);
}

function bobGoProbeInputsChanged(
  current: WhatsappDeliveryInquiry | undefined,
  next: WhatsappDeliveryInquiry,
) {
  return (
    current?.selectedVariantId !== next.selectedVariantId ||
    current?.quantity !== next.quantity ||
    !deliveryAddressDraftsEqual(current?.address, next.address)
  );
}

async function checkBobGoDeliveryInquiry({
  context,
  inquiry,
}: {
  context: DeliveryInquiryContext;
  inquiry: WhatsappDeliveryInquiry;
}) {
  const item = await loadDeliveryInquiryItem(inquiry);

  if (!item) {
    return respondToDeliveryInquiry({
      context,
      inquiry: {
        ...inquiry,
        choices: [],
        selectedVariantId: null,
        step: "awaiting_product",
        updatedAt: new Date().toISOString(),
      },
      reply:
        "That product is no longer available in the same form. Send the product name again and I will recheck it.",
    });
  }

  const address = getCompleteDeliveryAddress(inquiry.address);

  if (!address) {
    return respondToDeliveryInquiry({
      context,
      inquiry: {
        ...inquiry,
        step: "awaiting_address",
        updatedAt: new Date().toISOString(),
      },
      reply: buildDeliveryAddressPrompt(
        getMissingDeliveryAddressFields(inquiry.address),
      ),
    });
  }

  const heightMm = item.heightMm;
  const lengthMm = item.lengthMm;
  const weightGrams = item.weightGrams;
  const widthMm = item.widthMm;
  const parcelComplete =
    isPositiveNumber(heightMm) &&
    isPositiveNumber(lengthMm) &&
    isPositiveNumber(weightGrams) &&
    isPositiveNumber(widthMm);

  if (!item.sellerId || !parcelComplete) {
    return respondToDeliveryInquiry({
      context,
      inquiry: {
        ...inquiry,
        step: "awaiting_address",
        updatedAt: new Date().toISOString(),
      },
      reply:
        "I cannot confirm courier delivery for this item because its seller or parcel shipping details are incomplete. Ask for a human and the team can check it manually.",
    });
  }

  const collection = await getBobGoCollectionProfile(item.sellerId);

  if (!collection) {
    return respondToDeliveryInquiry({
      context,
      inquiry: {
        ...inquiry,
        step: "awaiting_address",
        updatedAt: new Date().toISOString(),
      },
      reply:
        "I cannot confirm courier delivery because the seller's collection address is not ready. Ask for a human and the team can check it manually.",
    });
  }

  const previousProbeAt = inquiry.lastProbeAt
    ? new Date(inquiry.lastProbeAt).getTime()
    : 0;
  const changedProbeInputs = bobGoProbeInputsChanged(
    context.conversationState.deliveryInquiry,
    inquiry,
  );

  if (
    Number.isFinite(previousProbeAt) &&
    Date.now() - previousProbeAt < 60 * 1000
  ) {
    if (changedProbeInputs) {
      const deferredAt = new Date().toISOString();

      await updateDeliveryInquiryState(context.conversationId, {
        ...inquiry,
        lastProbeAt: deferredAt,
        lastResult: null,
        step: "awaiting_address",
        updatedAt: deferredAt,
      });
    }

    return respond({
      conversationId: context.conversationId,
      provider: context.provider,
      reply: changedProbeInputs
        ? "I saved the changed item, quantity or address. Please wait a minute, then reply RETRY so I can request a fresh courier result for those new details."
        : "I have already asked the courier for this address. Please wait a minute before retrying so we do not send duplicate rate requests.",
      status: "support_answer",
    });
  }

  const probeStartedAt = new Date().toISOString();
  const probingInquiry: WhatsappDeliveryInquiry = {
    ...inquiry,
    lastProbeAt: probeStartedAt,
    lastResult: null,
    step: "awaiting_address",
    updatedAt: probeStartedAt,
  };

  const probeClaimed = await claimBobGoDeliveryProbe(
    context.conversationId,
    probingInquiry,
  );

  if (!probeClaimed) {
    const changedInputs = bobGoProbeInputsChanged(
      context.conversationState.deliveryInquiry,
      inquiry,
    );

    if (changedInputs) {
      await updateDeliveryInquiryState(context.conversationId, {
        ...inquiry,
        lastProbeAt: probeStartedAt,
        lastResult: null,
        step: "awaiting_address",
        updatedAt: probeStartedAt,
      });
    }

    return respond({
      conversationId: context.conversationId,
      provider: context.provider,
      reply: changedInputs
        ? "I saved the changed item, quantity or address, but a courier check already ran within the last minute. Please wait a minute, then reply RETRY for the new details."
        : "A courier check has already run for this conversation within the last minute. Please wait a minute, then reply RETRY.",
      status: "support_answer",
    });
  }

  try {
    const result = await probeBobGoCheckoutRates({
      collectionAddress: {
        city: collection.city,
        code: collection.postalCode,
        company: collection.displayName,
        country: collection.countryCode ?? "ZA",
        local_area: collection.suburb,
        street_address: [collection.addressLine1, collection.addressLine2]
          .filter(Boolean)
          .join(", "),
        zone: collection.province,
      },
      declaredValue: item.lineTotalZar,
      deliveryAddress: {
        city: address.city,
        code: address.postalCode,
        country: address.countryCode,
        local_area: address.suburb,
        street_address: [address.addressLine1, address.addressLine2]
          .filter(Boolean)
          .join(", "),
        zone: address.province,
      },
      handlingTime: 2,
      items: [
        {
          description: `${item.productTitle} - ${item.variantTitle}`,
          heightMm,
          lengthMm,
          price: item.unitPriceZar,
          quantity: item.quantity,
          weightGrams,
          widthMm,
        },
      ],
      sellerId: item.sellerId,
    });
    const itemLabel = `${item.quantity} x ${item.productTitle}${
      item.variantTitle !== item.productTitle ? ` - ${item.variantTitle}` : ""
    }`;
    const nextStep = getDeliveryResultNextStep(
      context.conversationState,
      item,
    );

    if (result.mode !== "live") {
      const reply = [
        `I reached Bob Go's test environment for ${itemLabel} to ${address.suburb}, ${address.postalCode}.`,
        "Test rates cannot confirm real courier availability, so I will not present them as a delivery promise.",
        "Ask for a human to confirm delivery, or try again once the Bob Go integration is in live mode.",
      ].join("\n");

      return respondToDeliveryInquiry({
        context,
        expectedProbeAt: probeStartedAt,
        inquiry: createResolvedDeliveryInquiry({
          expiresAt: result.expiresAt.toISOString(),
          inquiry: probingInquiry,
          reply,
        }),
        reply,
      });
    }

    if (result.rates.length === 0) {
      const reply = [
        `Bob Go returned no current courier options for ${itemLabel} to ${address.suburb}, ${address.postalCode}.`,
        "That result applies to this exact item, quantity and address.",
        getUnavailableDeliveryNextStep(),
      ].join("\n");

      return respondToDeliveryInquiry({
        context,
        expectedProbeAt: probeStartedAt,
        inquiry: createResolvedDeliveryInquiry({
          expiresAt: result.expiresAt.toISOString(),
          inquiry: probingInquiry,
          reply,
        }),
        reply,
      });
    }

    const sortedRates = [...result.rates].sort(
      (first, second) => first.customerAmount - second.customerAmount,
    );
    const reply = [
      `Yes — Bob Go currently returns courier options for ${itemLabel} to ${address.suburb}, ${address.postalCode}:`,
      ...sortedRates
        .slice(0, 3)
        .map((rate) => `- ${rate.serviceName}: ${formatMoney(rate.customerAmount)}`),
      `These live estimates expire at ${new Intl.DateTimeFormat("en-ZA", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Johannesburg",
      }).format(result.expiresAt)} and will be confirmed again at checkout.`,
      nextStep,
    ].join("\n");

    return respondToDeliveryInquiry({
      context,
      expectedProbeAt: probeStartedAt,
      inquiry: createResolvedDeliveryInquiry({
        expiresAt: result.expiresAt.toISOString(),
        inquiry: probingInquiry,
        reply,
      }),
      reply,
    });
  } catch {
    return respondToDeliveryInquiry({
      context,
      expectedProbeAt: probeStartedAt,
      inquiry: probingInquiry,
      reply:
        "I could not confirm courier availability right now. That does not mean delivery is unavailable. Please reply RETRY after a minute, use the secure checkout, or ask for a human.",
    });
  }
}

async function continueDeliveryInquiryForSelectedProduct({
  context,
  inquiry,
}: {
  context: DeliveryInquiryContext;
  inquiry: WhatsappDeliveryInquiry;
}) {
  const item = await loadDeliveryInquiryItem(inquiry);

  if (!item) {
    return respondToDeliveryInquiry({
      context,
      inquiry: {
        ...inquiry,
        choices: [],
        selectedVariantId: null,
        step: "awaiting_product",
        updatedAt: new Date().toISOString(),
      },
      reply:
        "That selected product is no longer available. Send the product name or cylinder size again and I will show current options.",
    });
  }

  if (item.quantity !== inquiry.quantity) {
    return respondToDeliveryInquiry({
      context,
      inquiry: {
        ...inquiry,
        choices: [],
        selectedVariantId: null,
        step: "awaiting_product",
        updatedAt: new Date().toISOString(),
      },
      reply: `Only ${item.maxQuantity} unit${item.maxQuantity === 1 ? " is" : "s are"} currently available. Send the product and a quantity up to ${item.maxQuantity} so I can check delivery accurately.`,
    });
  }

  return item.fulfillmentMode === "piessang_fulfilled"
    ? checkJurgensDeliveryInquiry({ context, inquiry })
    : checkBobGoDeliveryInquiry({ context, inquiry });
}

async function handleDeliveryInquiryMessage(
  context: DeliveryInquiryContext,
): Promise<WhatsappAssistantResult | null> {
  const existingInquiry = context.conversationState.deliveryInquiry;
  const destinationResetRequested = Boolean(
    existingInquiry && isDeliveryDestinationChangeRequest(context.message),
  );
  const isDeliveryQuestion =
    destinationResetRequested ||
    isDeliveryCoverageQuestion(context.message) ||
    (context.interpretation.intent === "support" &&
      (context.interpretation.supportTopic === "delivery_areas" ||
        context.interpretation.supportTopic === "shipping_rates"));

  if (!existingInquiry && !isDeliveryQuestion) {
    return null;
  }

  const now = new Date().toISOString();
  const normalizedMessage = normalizeText(context.message);
  const isRetry = normalizedMessage === "retry";
  const initialAddressMerge = mergeDeliveryAddressDraft({
    current: existingInquiry?.address,
    message: context.message,
  });
  const addressReplyExpected =
    existingInquiry !== undefined &&
    (existingInquiry.step === "awaiting_address" ||
      existingInquiry.step === "resolved") &&
    initialAddressMerge.matched &&
    !isDeliveryQuestion;

  if (
    isDeliveryInquiryControlIntent(context.interpretation) &&
    !addressReplyExpected &&
    !(isDeliveryQuestion && context.interpretation.supportTopic === "location")
  ) {
    return null;
  }

  if (
    context.interpretation.intent === "confirm" &&
    context.conversationState.pendingOrder
  ) {
    return null;
  }

  const newDestinationHint = extractDeliveryDestinationHint(context.message);
  const allowBarePostalCode = Boolean(existingInquiry);
  const extractedPostalCode = extractSouthAfricanPostalCode(context.message, {
    allowBare: allowBarePostalCode,
  });
  const destinationHintChanged = Boolean(
    existingInquiry &&
      newDestinationHint &&
      normalizeText(newDestinationHint) !==
        normalizeText(existingInquiry.destinationHint ?? ""),
  );
  const postalCodeChanged = Boolean(
    existingInquiry &&
      extractedPostalCode &&
      extractedPostalCode !== existingInquiry.postalCode,
  );
  const baseAddress = destinationHintChanged || destinationResetRequested
    ? undefined
    : existingInquiry?.address;
  const mergedAddress = mergeDeliveryAddressDraft({
    current: baseAddress,
    message: context.message,
  });
  const addressChanged =
    mergedAddress.matched &&
    !deliveryAddressDraftsEqual(baseAddress, mergedAddress.address);
  const explicitQuantity = parseExplicitQuantity(context.message);
  const quantity =
    explicitQuantity ??
    existingInquiry?.quantity ??
    context.interpretation.quantity;
  const quantityChanged = Boolean(
    existingInquiry && quantity !== existingInquiry.quantity,
  );
  const destinationHint =
    newDestinationHint ??
    (destinationResetRequested || postalCodeChanged || addressChanged
      ? null
      : existingInquiry?.destinationHint ?? null);
  const postalCode =
    extractedPostalCode ??
    mergedAddress.address?.postalCode ??
    (destinationHintChanged || destinationResetRequested
      ? null
      : existingInquiry?.postalCode ?? null);
  const deliveryInputChanged =
    destinationResetRequested ||
    destinationHintChanged ||
    postalCodeChanged ||
    addressChanged ||
    quantityChanged;
  let inquiry: WhatsappDeliveryInquiry = existingInquiry
    ? {
        ...existingInquiry,
        address: mergedAddress.matched
          ? mergedAddress.address
          : destinationHintChanged || destinationResetRequested
            ? undefined
            : existingInquiry.address,
        customerPrompt: appendDeliveryCustomerPrompt(
          existingInquiry.customerPrompt,
          context.message,
        ),
        destinationHint,
        postalCode,
        quantity,
        ...(deliveryInputChanged ? { lastResult: null } : {}),
        updatedAt: now,
      }
    : {
        ...(mergedAddress.matched ? { address: mergedAddress.address } : {}),
        choices: [],
        customerPrompt: context.message.slice(0, 1500),
        destinationHint,
        lastProbeAt: null,
        lastResult: null,
        postalCode,
        quantity,
        selectedVariantId: null,
        step: "awaiting_product",
        updatedAt: now,
      };

  const explicitProductChange =
    /\b(?:another|different|other)\s+(?:product|item|variant|cylinder|bottle|heater|stove)\b/.test(
      normalizedMessage,
    ) ||
    /\b(?:change|switch)(?:\s+(?:the|to|my))?\s+(?:product|item|variant|cylinder|bottle|heater|stove)\b/.test(
      normalizedMessage,
    );
  const productSearchContext = getDeliveryProductSearchContext({
    interpretation: context.interpretation,
    query: context.message,
  });
  const correctionNamesProduct =
    productSearchContext.sizeKg !== null ||
    productSearchContext.purchaseType !== null ||
    /\b(product|item|variant|cylinder|bottle|heater|stove|cooker|regulator|accessory|gas|lpg)\b/.test(
      normalizedMessage,
    );
  const changingProduct =
    !destinationResetRequested &&
    (explicitProductChange ||
      (/\b(?:meant|use|prefer|want)\b/.test(normalizedMessage) &&
        productSearchContext.hasProductSignal &&
        (correctionNamesProduct ||
          /\b(?:instead|rather)\b/.test(normalizedMessage))));
  const explicitOrderRequest = /\b(order|buy|purchase|get|take)\b/.test(
    normalizedMessage,
  );
  const genericOrderContinuation =
    Boolean(existingInquiry) &&
    !isDeliveryQuestion &&
    (context.interpretation.intent === "confirm" ||
      context.interpretation.intent === "repeat" ||
      (context.interpretation.intent === "order" &&
        !changingProduct &&
        (Boolean(context.conversationState.partialOrder) ||
          explicitOrderRequest ||
          (productSearchContext.terms.length === 0 &&
            productSearchContext.sizeKg === null))));

  if (genericOrderContinuation) {
    return null;
  }

  const expectsProduct =
    !existingInquiry ||
    existingInquiry.step === "awaiting_product" ||
    existingInquiry.step === "awaiting_product_choice";
  const shouldSearchForProduct =
    !destinationResetRequested &&
    (!addressReplyExpected || productSearchContext.hasProductSignal) &&
    (expectsProduct ||
      isDeliveryQuestion ||
      changingProduct ||
      context.interpretation.intent === "order" ||
      context.interpretation.intent === "repeat" ||
      context.interpretation.intent === "product_search");
  const productSearchRequested =
    shouldSearchForProduct && productSearchContext.hasProductSignal;
  const productChoices = productSearchRequested
    ? await findDeliveryProductChoices({
        interpretation: context.interpretation,
        query: context.message,
      })
    : [];
  const referencesSameSelectedProduct = Boolean(
    existingInquiry?.selectedVariantId &&
      productChoices.length === 1 &&
      productChoices[0]?.variantId === existingInquiry.selectedVariantId,
  );
  const productPivotRequested = Boolean(
    existingInquiry?.selectedVariantId &&
      (changingProduct ||
        (productSearchRequested && !referencesSameSelectedProduct)),
  );

  if (existingInquiry?.step === "resolved") {
    const resultStillFresh = existingInquiry.lastResult
      ? !existingInquiry.lastResult.expiresAt ||
        new Date(existingInquiry.lastResult.expiresAt).getTime() > Date.now()
      : false;
    const canReuseResult =
      resultStillFresh &&
      !isRetry &&
      !deliveryInputChanged &&
      !productPivotRequested &&
      (!productSearchRequested || referencesSameSelectedProduct);

    if (
      canReuseResult &&
      (isDeliveryQuestion ||
        initialAddressMerge.matched ||
        Boolean(extractedPostalCode))
    ) {
      return respond({
        conversationId: context.conversationId,
        provider: context.provider,
        reply: existingInquiry.lastResult!.reply,
        status: "support_answer",
      });
    }

    const hasRelevantResolvedInput =
      isDeliveryQuestion ||
      isRetry ||
      initialAddressMerge.matched ||
      Boolean(extractedPostalCode) ||
      explicitQuantity !== null ||
      productSearchRequested ||
      changingProduct;

    if (!hasRelevantResolvedInput) {
      return null;
    }
  }

  if (productPivotRequested) {
    inquiry = {
      ...inquiry,
      choices: productChoices,
      lastResult: null,
      selectedVariantId: null,
      step:
        productChoices.length > 0
          ? "awaiting_product_choice"
          : "awaiting_product",
      updatedAt: now,
    };

    return respondToDeliveryInquiry({
      context,
      inquiry,
      reply:
        productChoices.length > 0
          ? buildDeliveryProductChoiceReply({
              choices: productChoices,
              quantity: inquiry.quantity,
            })
          : 'I could not match that product. Send the exact product and quantity, for example "1 x 9kg exchange", and I will show the available choices.',
    });
  }

  if (
    !existingInquiry &&
    context.conversationState.pendingOrder &&
    !productSearchRequested
  ) {
    inquiry = {
      ...inquiry,
      quantity:
        explicitQuantity ??
        context.conversationState.pendingOrder.candidate.quantity,
      selectedVariantId:
        context.conversationState.pendingOrder.candidate.variantId,
    };

    return continueDeliveryInquiryForSelectedProduct({ context, inquiry });
  }

  if (inquiry.step === "awaiting_product_choice") {
    const choiceIndex = parseDeliveryProductChoice(
      context.message,
      inquiry.choices.length,
    );

    if (choiceIndex !== null) {
      inquiry = {
        ...inquiry,
        choices: [],
        selectedVariantId: inquiry.choices[choiceIndex]!.variantId,
        updatedAt: now,
      };

      return continueDeliveryInquiryForSelectedProduct({ context, inquiry });
    }

    if (!productSearchRequested) {
      return respondToDeliveryInquiry({
        context,
        inquiry,
        reply: buildDeliveryProductChoiceReply({
          choices: inquiry.choices,
          quantity: inquiry.quantity,
        }),
      });
    }
  }

  if (
    inquiry.step === "awaiting_product" ||
    inquiry.step === "awaiting_product_choice"
  ) {
    if (productChoices.length === 0) {
      return respondToDeliveryInquiry({
        context,
        inquiry: {
          ...inquiry,
          choices: [],
          step: "awaiting_product",
          updatedAt: now,
        },
        reply: [
          "I need the exact product before I can check the correct delivery method.",
          destinationHint ? `I have noted the destination as ${destinationHint}.` : null,
          'Send the product and quantity, for example "1 x 9kg exchange" or "2 x gas heaters".',
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }

    inquiry = {
      ...inquiry,
      choices: productChoices,
      step: "awaiting_product_choice",
      updatedAt: now,
    };

    return respondToDeliveryInquiry({
      context,
      inquiry,
      reply: buildDeliveryProductChoiceReply({
        choices: productChoices,
        quantity: inquiry.quantity,
      }),
    });
  }

  if (inquiry.step === "awaiting_postal_code") {
    if (!inquiry.postalCode) {
      return respondToDeliveryInquiry({
        context,
        inquiry,
        reply:
          "Send the four-digit delivery postal code, for example 7646. A suburb name alone is not precise enough for the configured delivery zones.",
      });
    }

    return continueDeliveryInquiryForSelectedProduct({ context, inquiry });
  }

  if (inquiry.step === "awaiting_address") {
    const address = getCompleteDeliveryAddress(inquiry.address);

    if (!address) {
      return respondToDeliveryInquiry({
        context,
        inquiry,
        reply: buildDeliveryAddressPrompt(
          getMissingDeliveryAddressFields(inquiry.address),
        ),
      });
    }

    return continueDeliveryInquiryForSelectedProduct({ context, inquiry });
  }

  if (inquiry.step === "resolved" && inquiry.selectedVariantId) {
    return continueDeliveryInquiryForSelectedProduct({ context, inquiry });
  }

  return null;
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
      return answerContactDetails();
    case "delivery_areas":
      return answerDeliveryAreas();
    case "location":
      return answerLocation();
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
    await updateConversationModerationState(
      conversation.id,
      conversationState.moderation!,
    );
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
    await updateConversationModerationState(
      conversation.id,
      conversationState.moderation!,
    );
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
    await updateConversationModerationState(
      conversation.id,
      conversationState.moderation!,
    );
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

  await updateConversationModerationState(
    conversation.id,
    conversationState.moderation!,
  );

  if (
    conversationState.deliveryInquiry ||
    isDeliveryCoverageQuestion(input.body)
  ) {
    const fallbackInterpretation = mergeInterpretationWithPartialOrder({
      interpretation: interpretMessage(input.body),
      partialOrder: conversationState.partialOrder,
    });

    await updateConversationAfterMessage({
      conversationId: conversation.id,
      direction: "inbound",
      intent: "delivery_inquiry",
    });

    const deliveryReply = await handleDeliveryInquiryMessage({
      conversationId: conversation.id,
      conversationState,
      interpretation: fallbackInterpretation,
      message: input.body,
      provider: input.provider,
    });

    if (deliveryReply) {
      return deliveryReply;
    }
  }

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
    const cancelledItem = conversationState.pendingOrder
      ? "pending WhatsApp order"
      : conversationState.deliveryInquiry
        ? "delivery check"
        : "pending request";

    await clearPendingOrder(conversation.id, conversationState);

    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply: `No problem, I have cleared that ${cancelledItem}. Tell me what you need when you are ready.`,
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

  const deliveryReply = await handleDeliveryInquiryMessage({
    conversationId: conversation.id,
    conversationState,
    interpretation,
    message: input.body,
    provider: input.provider,
  });

  if (deliveryReply) {
    return deliveryReply;
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
      await updateConversationModerationState(
        conversation.id,
        conversationState.moderation!,
      );

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
    const nextConversationState: WhatsappConversationState = {
      ...conversationState,
      partialOrder: buildPartialOrderState({
        interpretation,
        message: input.body,
        partialOrder: conversationState.partialOrder,
      }),
    };
    delete nextConversationState.deliveryInquiry;

    await updateConversationState(conversation.id, nextConversationState);

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

    const nextConversationState: WhatsappConversationState = {
      ...conversationState,
      ...(!interpretation.sizeKg
        ? {
        partialOrder: buildPartialOrderState({
          interpretation,
          message: input.body,
          partialOrder: conversationState.partialOrder,
        }),
          }
        : {}),
    };
    delete nextConversationState.deliveryInquiry;

    await updateConversationState(conversation.id, nextConversationState);

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
    const nextConversationState = { ...conversationState };
    delete nextConversationState.deliveryInquiry;
    await updateConversationState(conversation.id, nextConversationState);

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
  delete nextConversationState.deliveryInquiry;
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
