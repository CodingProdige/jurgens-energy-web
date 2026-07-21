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
  shipments,
  whatsappConversations,
  whatsappMessages,
  whatsappOrderDrafts,
} from "@/src/db/schema";
import { env } from "@/src/config/env";
import { getBusinessCollectionAddress } from "@/src/modules/business-information";
import { validateCartLines } from "@/src/modules/cart/server";
import { formatFromZar } from "@/src/modules/currency";
import { getCustomerSupportContactDetails } from "@/src/modules/customer-support/server";
import { getMediaPublicUrl } from "@/src/modules/media/paths";
import { getOpenAiIntegrationConfig } from "@/src/modules/marketplace/settings";
import {
  deliveryInformation,
  privacyPolicy,
  returnsAndRefundsPolicy,
  termsAndConditions,
  type PolicyDocument,
} from "@/src/modules/marketplace/policies/documents";
import { probeBobGoCheckoutRates } from "@/src/modules/shipping/bobgo-client";
import { checkJurgensDeliveryAvailability } from "@/src/modules/shipping/jurgens-delivery";
import {
  send360DialogTextMessage,
  type WhatsappMediaMessageAttachment,
} from "@/src/modules/whatsapp-ordering/360dialog";
import {
  answerWhatsappQuestionWithAi,
  interpretWhatsappMessageWithAi,
  validateWhatsappAgentReply,
  type WhatsappConversationTurn,
} from "@/src/modules/whatsapp-ordering/ai";
import {
  runJurgensWhatsappAgentTurn,
  type WhatsappAgentAdapterResult,
  type WhatsappAgentOrderProposal,
} from "@/src/modules/whatsapp-ordering/agent-integration";
import {
  buildWhatsappModelMemory,
  classifyWhatsappConfirmation,
  normalizeWhatsappRollingMemory,
  updateWhatsappRollingMemory,
  type WhatsappPendingAction,
  type WhatsappRollingMemory,
} from "@/src/modules/whatsapp-ordering/conversation-memory";
import { classifyWhatsappContextualProductRequest } from "@/src/modules/whatsapp-ordering/contextual-product-request";
import {
  resolveWhatsappCustomerContext,
  sanitizeWhatsappDisplayName,
} from "@/src/modules/whatsapp-ordering/customer-context";
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
import {
  buildWhatsappPendingOfferFollowUp,
  classifyWhatsappPendingOfferFollowUp,
  matchesWhatsappPendingOfferContext,
} from "@/src/modules/whatsapp-ordering/pending-offer-follow-up";
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
const southAfricaDeliveryTimingFacts = [
  "Handling takes 0–1 business day after payment confirmation.",
  "The order cutoff is 2:00 PM SAST; orders placed after the cutoff start processing on the next business day.",
  "Shipping takes 1–3 business days after dispatch, for a combined estimated delivery time of 1–4 business days.",
] as const;
const southAfricaDeliveryFacts = [
  "Jurgens Energy is an online store.",
  "Jurgens Energy delivers eligible online-store orders within South Africa.",
  ...southAfricaDeliveryTimingFacts,
  "Delivery fees are shown at checkout.",
  "Jurgens Energy has no public walk-in shop, customer collection counter or returns desk.",
] as const;
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
  media?: WhatsappAssistantMedia[];
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

export type WhatsappAssistantMedia = WhatsappMediaMessageAttachment & {
  assetId: string;
  caption?: string | null;
};

type WhatsappReplyContent = {
  grounded?: boolean;
  media: WhatsappAssistantMedia[];
  reply: string;
};

function textReply(reply: string): WhatsappReplyContent {
  return { media: [], reply };
}

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
  mediaId: string | null;
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
  memory?: WhatsappRollingMemory;
  providerProfileName?: string;
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

function createWhatsappProductMediaUrl(mediaId: string) {
  return createStoreUrl(`/api/whatsapp/product-media/${mediaId}`);
}

function createWhatsappProductImage({
  mediaId,
  title,
}: {
  mediaId: string | null;
  title: string;
}): WhatsappAssistantMedia | null {
  if (!mediaId) {
    return null;
  }

  return {
    assetId: mediaId,
    caption: title,
    fileName: `${title.slice(0, 120)}.jpg`,
    mimeType: "image/jpeg",
    type: "image",
    url: createWhatsappProductMediaUrl(mediaId),
  };
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

  if (requiresHumanHandover(text, quantity)) {
    return createInterpretation({
      intent: "human",
      quantity,
      query: message,
      sizeKg,
    });
  }

  if (/^(\s*)?(yes|yes please|yep|yeah|correct|confirm|confirmed|go ahead|send (it|link)|send the link|pay now|ja|ja asseblief|bevestig|gaan voort|stuur (dit|die link))(\s*)?$/.test(text)) {
    return createInterpretation({ intent: "confirm", quantity, sizeKg });
  }

  if (/^(\s*)?(no|nope|cancel|wrong|never mind|nevermind|nee|nee dankie|kanselleer|los dit|verkeerd)(\s*)?$/.test(text)) {
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

  if (
    classifyWhatsappContextualProductRequest(message) === "product_image"
  ) {
    return createInterpretation({
      intent: "product_search",
      query: message,
      quantity,
      sizeKg,
    });
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
    !/(\bempty\b|\bexchange\b|\bswap\b|\brefill\b|\breplace(?:ment)?\b|\btop ?up\b|\btopup\b)/.test(
      text,
    );
  const wantsExchange =
    /(\bexchange\b|\bswap\b|\brefill\b|\breplace(?:ment)?\b|\btop ?up\b|\btopup\b|\bempty\b)/.test(
      text,
    );
  const wantsRepeat =
    /(\bagain\b|\bsame\b|\banother\b|\blast\b|\busual\b)/.test(
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

function requiresHumanHandover(normalizedMessage: string, quantity: number) {
  const safetyOrTechnicalConcern =
    /\b(?:gas\s+leak|leaking\s+gas|smell(?:s|ing)?\s+(?:of\s+)?gas|hissing|gas\s+fire|cylinder\s+(?:is\s+)?damaged|emergency|unsafe|how\s+(?:do\s+i|to)\s+(?:install|connect|repair|fix)|faulty\s+(?:cylinder|regulator|valve))\b/.test(
      normalizedMessage,
    );
  const complaintOrPaymentDispute =
    /\b(?:complaint|refund|money\s+back|chargeback|charged\s+(?:twice|double)|payment\s+dispute|wrong\s+charge|unacceptable)\b/.test(
      normalizedMessage,
    );
  const commercialRequest =
    /\b(?:bulk|wholesale|commercial|restaurant|business\s+(?:order|quote)|formal\s+quote|quotation)\b/.test(
      normalizedMessage,
    );

  return (
    safetyOrTechnicalConcern ||
    complaintOrPaymentDispute ||
    commercialRequest ||
    quantity >= 6
  );
}

async function interpretMessageWithAiFallback(
  message: string,
  {
    recentTurns = [],
    workflowSummary = null,
  }: {
    recentTurns?: WhatsappConversationTurn[];
    workflowSummary?: string | null;
  } = {},
): Promise<MessageInterpretation> {
  const fallback = interpretMessage(message);

  if (fallback.intent === "stop") {
    return fallback;
  }

  const aiInterpretation = await interpretWhatsappMessageWithAi({
    fallback,
    message,
    recentTurns,
    workflowSummary,
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
  const providerProfileName = sanitizeWhatsappDisplayName(
    state.providerProfileName,
  );
  const memory = normalizeWhatsappRollingMemory(state.memory);

  if (providerProfileName) {
    nextState.providerProfileName = providerProfileName;
  }

  if (memory.summary || memory.facts.length > 0) {
    nextState.memory = memory;
  }

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

async function claimPendingOrderForCheckout({
  conversationId,
  pendingOrder,
}: {
  conversationId: string;
  pendingOrder: NonNullable<WhatsappConversationState["pendingOrder"]>;
}) {
  const [claimed] = await db
    .update(whatsappConversations)
    .set({
      state: drizzleSql`COALESCE(${whatsappConversations.state}, '{}'::jsonb) - 'pendingOrder' - 'partialOrder' - 'deliveryInquiry'`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(whatsappConversations.id, conversationId),
        drizzleSql`${whatsappConversations.state} #>> '{pendingOrder,candidate,variantId}' = ${pendingOrder.candidate.variantId}`,
        drizzleSql`${whatsappConversations.state} #>> '{pendingOrder,candidate,purchaseType}' = ${pendingOrder.candidate.purchaseType}`,
        drizzleSql`${whatsappConversations.state} #>> '{pendingOrder,candidate,quantity}' = ${String(pendingOrder.candidate.quantity)}`,
      ),
    )
    .returning({ state: whatsappConversations.state });

  return claimed ? getConversationState(claimed.state) : null;
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
      mediaId: media.id,
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
    .leftJoin(
      media,
      and(eq(media.id, productVariants.mediaId), eq(media.isPublic, true)),
    )
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
  let imageMediaId = row.mediaId;

  if (!imageUrl) {
    const [cover] = await db
      .select({
        id: media.id,
        relativePath: media.relativePath,
        thumbnailRelativePath: media.thumbnailRelativePath,
      })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(
        and(eq(productMedia.productId, row.productId), eq(media.isPublic, true)),
      )
      .orderBy(desc(productMedia.isCover), asc(productMedia.sortOrder))
      .limit(1);

    imageUrl =
      cover ? toMediaUrl(cover.relativePath, cover.thumbnailRelativePath) : null;
    imageMediaId = cover?.id ?? null;
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
    mediaId: imageMediaId,
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

async function findProductCoverMediaId(productId: string) {
  const [cover] = await db
    .select({ id: media.id })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(
      and(eq(productMedia.productId, productId), eq(media.isPublic, true)),
    )
    .orderBy(desc(productMedia.isCover), asc(productMedia.sortOrder))
    .limit(1);

  return cover?.id ?? null;
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
      ? "This is an exchange, so please have an acceptable empty cylinder ready to hand over on delivery."
      : "This is a full/new cylinder, so there is no empty-cylinder handover.";
  const intro =
    interpretation.intent === "repeat"
      ? "I found your previous order — is this what you want again?"
      : "Perfect — here is what I have for you:";

  return [
    intro,
    `${snapshot.quantity} x ${snapshot.title}`,
    typeLabel,
    `${snapshot.priceLabel} each, ${snapshot.totalLabel} product subtotal.`,
    "I will calculate delivery from your address on the secure checkout step.",
    `Reply YES and I will send the secure review/payment link, or tell me what to change. The link will expire in ${checkoutLinkExpiryLabel}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function answerPendingOrderFollowUp({
  conversationId,
  message,
  provider,
  state,
}: {
  conversationId: string;
  message: string;
  provider: WhatsappProvider;
  state: WhatsappConversationState;
}): Promise<WhatsappAssistantResult | null> {
  const followUpKind = classifyWhatsappPendingOfferFollowUp(message);
  const pendingOrder = state.pendingOrder;

  if (!followUpKind || !pendingOrder) {
    return null;
  }

  const snapshot = await getVariantSnapshot({
    purchaseType: pendingOrder.candidate.purchaseType,
    quantity: pendingOrder.candidate.quantity,
    variantId: pendingOrder.candidate.variantId,
  });

  if (!snapshot) {
    return null;
  }

  if (
    !matchesWhatsappPendingOfferContext({
      message,
      offer: {
        brandName: null,
        purchaseType: snapshot.purchaseType,
        title: snapshot.productTitle,
      },
    })
  ) {
    return null;
  }

  const followUp = buildWhatsappPendingOfferFollowUp({
    kind: followUpKind,
    offer: {
      brandName: null,
      hasImage: Boolean(snapshot.mediaId),
      priceLabel: snapshot.priceLabel,
      purchaseType: snapshot.purchaseType,
      quantity: snapshot.quantity,
      title: snapshot.productTitle,
      totalLabel: snapshot.totalLabel,
    },
  });
  const productImage = followUp.attachImage
    ? createWhatsappProductImage({
        mediaId: snapshot.mediaId,
        title: snapshot.title,
      })
    : null;

  await updateConversationAfterMessage({
    conversationId,
    direction: "inbound",
    intent: "pending_order_follow_up",
  });

  return respond({
    conversationId,
    media: productImage ? [productImage] : [],
    provider,
    reply: followUp.reply,
    status: "draft_confirmation",
  });
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
        return "Hi, welcome back. I still have the delivery address details, but the last delivery check did not complete. Reply RETRY and I will try again, or ask for a human.";
      }

      return [
        "Hi, welcome back.",
        buildDeliveryAddressPrompt(
          getMissingDeliveryAddressFields(deliveryInquiry.address),
        ),
      ].join("\n");
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
    "Hi, this is Jurgens Energy, a South African online store.",
    "Do you need a gas top-up, cylinder exchange or another gas product today?",
    "Send the product, size and quantity you need.",
  ].join("\n");
}

async function respond({
  conversationId,
  draftUrl = null,
  media: outboundMedia = [],
  provider,
  reply,
  status,
}: {
  conversationId: string | null;
  draftUrl?: string | null;
  media?: WhatsappAssistantMedia[];
  provider: WhatsappProvider;
  reply: string;
  status: WhatsappAssistantResult["status"];
}) {
  let finalReply = reply.trim();

  if (conversationId) {
    const [[conversationRow], customerContext] = await Promise.all([
      db
        .select({
          lastOutboundAt: whatsappConversations.lastOutboundAt,
        })
        .from(whatsappConversations)
        .where(eq(whatsappConversations.id, conversationId))
        .limit(1),
      resolveWhatsappCustomerContext({ conversationId }),
    ]);

    if (
      customerContext.firstName &&
      (customerContext.outboundCount === 0 ||
        !conversationRow?.lastOutboundAt ||
        Date.now() - conversationRow.lastOutboundAt.getTime() > 4 * 60 * 60 * 1000 ||
        /^(?:hi|hello|hey)\b/i.test(finalReply))
    ) {
      finalReply = addCustomerFirstName(
        finalReply,
        customerContext.firstName,
      );
    }

    for (const attachment of outboundMedia) {
      await recordWhatsappMessage({
        body: attachment.caption?.trim() || attachment.fileName || "Product image",
        conversationId,
        direction: "outbound",
        payload: { attachment },
        provider,
      });
    }

    await recordWhatsappMessage({
      body: finalReply,
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
    ...(outboundMedia.length > 0 ? { media: outboundMedia } : {}),
    reply: finalReply,
    status,
  };
}

function addCustomerFirstName(reply: string, firstName: string) {
  if (new RegExp(`\\b${escapeRegExp(firstName)}\\b`, "i").test(reply)) {
    return reply;
  }

  const greetingMatch = reply.match(/^(hi|hello|hey)\b[\s,!.-]*/i);

  if (greetingMatch) {
    return `${greetingMatch[1]} ${firstName}, ${reply.slice(greetingMatch[0].length)}`.trim();
  }

  const shouldKeepInitialCapital =
    /^(?:I\b|Jurgens\b|PayFast\b|WhatsApp\b|South Africa\b|https?:\/\/)/.test(
      reply,
    );
  const namedReply = shouldKeepInitialCapital
    ? reply
    : `${reply.charAt(0).toLowerCase()}${reply.slice(1)}`;

  return `${firstName}, ${namedReply}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  return [
    "Jurgens Energy delivers eligible online-store orders within South Africa.",
    ...southAfricaDeliveryTimingFacts,
    "Exact product eligibility and delivery fees are confirmed at checkout from the complete delivery address.",
  ].join("\n");
}

async function answerShippingRates() {
  return [
    "Delivery fees are shown at checkout after you enter the complete South African delivery address.",
    "Jurgens Energy delivers eligible online-store orders within South Africa.",
    ...southAfricaDeliveryTimingFacts,
  ].join("\n");
}

async function answerContactDetails() {
  const support = await getCustomerSupportContactDetails();
  const details = [
    support.email ? `Email: ${support.email}` : null,
    support.phoneNumbers.length > 0
      ? `Phone: ${support.phoneNumbers.join(" / ")}`
      : null,
    support.whatsappPhone ? `WhatsApp: ${support.whatsappPhone}` : null,
    support.businessAddress
      ? `Registered business address: ${support.businessAddress}`
      : null,
    `Website: ${createStoreUrl("/")}`,
    `${support.businessName} is an online store with no public walk-in shop, customer collection counter or returns desk. The registered address is not a return address.`,
  ].filter(Boolean);

  return details.length > 0
    ? [`You can contact ${support.businessName} here:`, ...details].join("\n")
    : `You can contact ${support.businessName} through the online store: ${createStoreUrl("/")}`;
}

async function answerLocation() {
  const support = await getCustomerSupportContactDetails();

  return [
    `${support.businessName} is a South African online store delivering eligible orders within South Africa.`,
    support.businessAddress
      ? `Registered business address: ${support.businessAddress}`
      : null,
    "There is no public walk-in shop, customer collection counter or returns desk.",
    support.email ? `Email: ${support.email}` : null,
    support.phoneNumbers.length > 0
      ? `Phone: ${support.phoneNumbers.join(" / ")}`
      : null,
    support.whatsappPhone ? `WhatsApp: ${support.whatsappPhone}` : null,
    `For help or an approved return, contact us through ${createStoreUrl("/contact")} before sending anything to the registered address.`,
  ]
    .filter(Boolean)
    .join("\n");
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
    "image",
    "looking",
    "me",
    "need",
    "of",
    "photo",
    "photograph",
    "pic",
    "picture",
    "please",
    "product",
    "send",
    "sell",
    "show",
    "stock",
    "the",
    "want",
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
    /\b(exchange|swap|refill|replace|replacement|top up|topup|empty)\b/.test(
      text,
    );
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
  const labelledAsExchange =
    /\b(exchange|refill|replace|replacement|swap|top\s*up)\b/.test(
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
        ? "exchange refill replacement replace swap top up"
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

async function answerProductSearch(
  query: string | null,
): Promise<WhatsappReplyContent> {
  const terms = searchTerms(query);

  if (terms.length === 0) {
    return {
      media: [],
      reply: `Tell me what product you are looking for, for example "do you have 9kg LPG cylinders?" or "do you sell gas stoves?".`,
    };
  }

  const rows = await db
    .select({
      brandName: brands.name,
      categoryPath: categories.path,
      continueSellingOutOfStock: productVariants.continueSellingOutOfStock,
      mediaId: media.id,
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
    .leftJoin(
      media,
      and(eq(media.id, productVariants.mediaId), eq(media.isPublic, true)),
    );

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
    return {
      media: [],
      reply: `I could not find a matching product for "${query}". Try another product name, or ask for a human and we can check manually.`,
    };
  }

  const productImages = (
    await Promise.all(
      topMatches.map(async ({ row }) => {
        const mediaId =
          row.mediaId ?? (await findProductCoverMediaId(row.productId));

        return createWhatsappProductImage({
          mediaId,
          title: row.productTitle,
        });
      }),
    )
  ).filter((attachment): attachment is WhatsappAssistantMedia => Boolean(attachment));

  return {
    media: productImages,
    reply: [
    "I found these matching products:",
    ...topMatches.map(({ row }, index) => {
      const inStock = row.continueSellingOutOfStock || row.stockOnHand > 0;

      return [
        `${index + 1}. ${row.productTitle} - ${formatMoney(row.price)} - ${
          inStock ? "in stock" : "currently out of stock"
        }`,
        createStoreUrl(`/products/${row.productSlug}`),
      ]
        .filter(Boolean)
        .join("\n");
    }),
    "Reply with the product, quantity, and whether it is exchange or full/new if you want me to help build the order.",
    ].join("\n"),
  };
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
    "I need the complete South African delivery address to confirm delivery for this online-store item.",
    missingFields?.length
      ? `Still needed: ${missingFields.join(", ")}.`
      : null,
    "Send it in this format:",
    "Street address: [street number and name]",
    "Suburb: [suburb]",
    "City: [city]",
    "Province: [province]",
    "Postal code: [four digits]",
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

  if (!matchesPendingOrder) {
    return `View the product or continue to checkout here: ${createStoreUrl(`/products/${item.productSlug}`)}`;
  }

  return [
    pendingCandidate.purchaseType === "exchange"
      ? "This is an exchange, so please have an acceptable empty cylinder ready to hand over on delivery."
      : null,
    "Reply YES to confirm this order and I will send the secure checkout link.",
  ]
    .filter(Boolean)
    .join("\n");
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

async function attachPendingOrderToDeliveryContext({
  context,
  inquiry,
}: {
  context: DeliveryInquiryContext;
  inquiry: WhatsappDeliveryInquiry;
}) {
  const item = await loadDeliveryInquiryItem(inquiry);

  if (!item) {
    return context;
  }

  const nextState: WhatsappConversationState = {
    ...context.conversationState,
    pendingOrder: {
      candidate: {
        exchangeEmptyConfirmed: item.purchaseType === "exchange",
        intent: "delivery_inquiry_order",
        productId: item.productId,
        purchaseType: item.purchaseType,
        quantity: item.quantity,
        variantId: item.variantId,
      },
      customerPrompt: inquiry.customerPrompt,
    },
  };
  delete nextState.partialOrder;

  await updateConversationState(context.conversationId, nextState);

  return { ...context, conversationState: nextState };
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

  const itemLabel = `${inquiry.quantity} x ${item.productTitle}${
    item.variantTitle !== item.productTitle ? ` - ${item.variantTitle}` : ""
  }`;
  const nextStep = getDeliveryResultNextStep(
    context.conversationState,
    item,
  );
  const postalCode = inquiry.postalCode ?? inquiry.address?.postalCode ?? null;

  if (!postalCode) {
    const reply = [
      `Delivery for ${itemLabel} is confirmed at checkout from the complete South African delivery address.`,
      "Jurgens Energy delivers eligible online-store orders within South Africa.",
      ...southAfricaDeliveryTimingFacts,
      "The delivery fee will be shown before payment.",
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
  if (availability.eligible) {
    const reply = [
      `Yes — delivery is available for ${itemLabel} to the address you supplied.`,
      "Jurgens Energy delivers eligible online-store orders within South Africa.",
      ...southAfricaDeliveryTimingFacts,
      "The delivery fee will be shown at checkout.",
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
      `I could not confirm delivery for ${itemLabel} to the address you supplied.`,
      "Jurgens Energy delivers eligible online-store orders within South Africa; exact product eligibility is confirmed from the complete address at checkout.",
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
      `I could not confirm delivery for ${itemLabel} to the address you supplied at this quantity.`,
      "Delivery availability and the fee are confirmed at checkout from the complete address.",
      "Send a larger quantity or a different product and I will check again, or ask for a human.",
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
      "I could not confirm delivery for this item and address right now. Reply RETRY in a moment, continue through checkout, or ask for a human; I will not guess about item-specific availability.",
  });
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

  if (!parcelComplete) {
    return respondToDeliveryInquiry({
      context,
      inquiry: {
        ...inquiry,
        step: "awaiting_address",
        updatedAt: new Date().toISOString(),
      },
      reply:
        "I cannot confirm courier delivery for this item because its parcel shipping details are incomplete. Ask for a human and the team can check it manually.",
    });
  }

  const collection = await getBusinessCollectionAddress();

  if (!collection) {
    return respondToDeliveryInquiry({
      context,
      inquiry: {
        ...inquiry,
        step: "awaiting_address",
        updatedAt: new Date().toISOString(),
      },
      reply:
        "I cannot confirm courier delivery because the configured business dispatch details are incomplete. Ask for a human and the team can check it manually.",
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
        : "I have already asked the courier for this address. Please wait a minute before retrying so we do not send duplicate delivery checks.",
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
        company: collection.company,
        country: collection.countryCode,
        local_area: collection.suburb || collection.city,
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
        `The courier connection is in test mode for ${itemLabel} and the delivery address you supplied.`,
        "A test result cannot confirm real delivery availability, so I will not present it as a delivery promise.",
        "Ask for a human to confirm delivery, or try again once live courier checking is available.",
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
        `The courier returned no current delivery options for ${itemLabel} and the delivery address you supplied.`,
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

    const reply = [
      `Yes — courier delivery is available for ${itemLabel} to the address you supplied.`,
      "Jurgens Energy delivers eligible online-store orders within South Africa.",
      ...southAfricaDeliveryTimingFacts,
      "The delivery fee and final delivery option will be shown at checkout.",
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
  const deliveryWorkflowNeedsProduct = Boolean(
    existingInquiry &&
      (existingInquiry.step === "awaiting_product" ||
        existingInquiry.step === "awaiting_product_choice") &&
      productSearchContext.hasProductSignal,
  );
  const genericOrderContinuation =
    Boolean(existingInquiry) &&
    !isDeliveryQuestion &&
    !deliveryWorkflowNeedsProduct &&
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
      const pendingContext = await attachPendingOrderToDeliveryContext({
        context,
        inquiry,
      });

      return continueDeliveryInquiryForSelectedProduct({
        context: pendingContext,
        inquiry,
      });
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
      const partialOrder = context.conversationState.partialOrder;
      const needsOnlyCylinderSize = Boolean(
        partialOrder?.purchaseType && !partialOrder.sizeKg,
      );

      return respondToDeliveryInquiry({
        context,
        inquiry: {
          ...inquiry,
          choices: [],
          step: "awaiting_product",
          updatedAt: now,
        },
        reply: needsOnlyCylinderSize
          ? [
              destinationHint
                ? `I have ${destinationHint} noted for delivery.`
                : "I have the delivery question noted.",
              partialOrder?.purchaseType === "exchange"
                ? "I also remember that this is a refill/exchange. What size is the empty cylinder you are handing over, for example 9kg or 14kg?"
                : "What cylinder size do you need, for example 9kg or 14kg?",
            ].join("\n")
          : [
              destinationHint
                ? `I have ${destinationHint} noted.`
                : "I have the delivery question noted.",
              "The delivery method depends on the exact item. What product and quantity do you need?",
            ].join("\n"),
      });
    }

    if (productChoices.length === 1) {
      inquiry = {
        ...inquiry,
        choices: [],
        selectedVariantId: productChoices[0]!.variantId,
        updatedAt: now,
      };
      const pendingContext = await attachPendingOrderToDeliveryContext({
        context,
        inquiry,
      });

      return continueDeliveryInquiryForSelectedProduct({
        context: pendingContext,
        inquiry,
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
        reply: buildDeliveryAddressPrompt(
          getMissingDeliveryAddressFields(inquiry.address),
        ),
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

async function getWhatsappKnowledgeFacts(question: string) {
  const [support, catalogRows] = await Promise.all([
    getCustomerSupportContactDetails(),
    db
      .select({
        brandName: brands.name,
        categoryPath: categories.path,
        continueSellingOutOfStock: productVariants.continueSellingOutOfStock,
        price: productVariants.price,
        productSlug: products.slug,
        productTitle: products.title,
        requiresExchangeEmpty: productVariants.requiresExchangeEmpty,
        shortDescription: products.shortDescription,
        stockOnHand: productVariants.stockOnHand,
        variantTitle: productVariants.title,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(
        and(
          eq(productVariants.isActive, true),
          eq(productVariants.status, "active"),
          or(eq(products.status, "active"), eq(products.status, "live")),
        ),
      )
      .orderBy(asc(products.title), asc(productVariants.price))
      .limit(28),
  ]);
  const publicName = support.businessName;
  const facts = [
    `${publicName} is a South African online store for LPG cylinders, eligible cylinder exchanges, and gas-related products.`,
    ...southAfricaDeliveryFacts,
    support.legalName && support.legalName !== publicName
      ? `${publicName} is the trading name of ${support.legalName}.`
      : null,
    support.companyRegistrationNumber
      ? `Company registration number: ${support.companyRegistrationNumber}.`
      : null,
    support.vatRegistrationNumber
      ? `VAT registration number: ${support.vatRegistrationNumber}.`
      : null,
    support.email ? `Customer support email: ${support.email}.` : null,
    support.phoneNumbers[0]
      ? `Primary customer support phone: ${support.phoneNumbers[0]}.`
      : null,
    support.phoneNumbers[1]
      ? `Secondary customer support phone: ${support.phoneNumbers[1]}.`
      : null,
    support.whatsappPhone
      ? `Customer support WhatsApp phone: ${support.whatsappPhone}.`
      : null,
    support.businessAddress
      ? `Registered business address: ${support.businessAddress}. This is not a public shop, customer collection counter or returns address.`
      : null,
    `Online store: ${createStoreUrl("/")}`,
    `All products: ${createStoreUrl("/products")}`,
    `Shipping and delivery policy: ${createStoreUrl("/delivery-information")}`,
    `Frequently asked questions: ${createStoreUrl("/faq")}`,
    `Returns and refunds policy: ${createStoreUrl("/returns-and-refunds")}`,
    ...getRelevantPolicyFacts(question),
    ...catalogRows.map((row) => {
      const variantLabel =
        row.variantTitle && row.variantTitle !== row.productTitle
          ? `, variant ${row.variantTitle}`
          : "";
      const stock =
        row.continueSellingOutOfStock || row.stockOnHand > 0
          ? "currently available to order"
          : "currently out of stock";
      return `${row.brandName ? `${row.brandName} ` : ""}${row.productTitle}${variantLabel}: ${formatMoney(row.price)}, ${stock}, delivery availability and fees confirmed at checkout${row.requiresExchangeEmpty ? ", exchange requires an eligible empty cylinder handover" : ""}${row.categoryPath ? `, category ${row.categoryPath}` : ""}. ${row.shortDescription?.slice(0, 220) ?? ""} Product page: ${createStoreUrl(`/products/${row.productSlug}`)}`;
    }),
  ].filter((fact): fact is string => Boolean(fact));

  return facts.slice(0, 40);
}

function getRelevantPolicyFacts(question: string) {
  const normalizedQuestion = normalizeText(question);
  const relevantDocuments: PolicyDocument[] = [];

  if (/\b(?:deliver|delivery|shipping|courier|handover|exchange)\b/.test(normalizedQuestion)) {
    relevantDocuments.push(deliveryInformation);
  }

  if (/\b(?:return|refund|cancel|cancellation|damaged|defective)\b/.test(normalizedQuestion)) {
    relevantDocuments.push(returnsAndRefundsPolicy);
  }

  if (/\b(?:privacy|personal information|data|popia)\b/.test(normalizedQuestion)) {
    relevantDocuments.push(privacyPolicy);
  }

  if (/\b(?:terms|condition|legal|agreement)\b/.test(normalizedQuestion)) {
    relevantDocuments.push(termsAndConditions);
  }

  return relevantDocuments.flatMap((document) => [
    `${document.title}: ${document.description}`,
    ...document.sections.slice(0, 10).map((section) =>
      [
        `${document.shortTitle} — ${section.title}:`,
        ...section.paragraphs,
        ...(section.bullets ?? []),
        section.note,
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 900),
    ),
  ]);
}

async function answerSupportQuestion({
  interpretation,
  phone,
  question,
  recentTurns,
  userId,
}: {
  interpretation: MessageInterpretation;
  phone: string;
  question: string;
  recentTurns: WhatsappConversationTurn[];
  userId: string | null;
}): Promise<WhatsappReplyContent> {
  if (interpretation.intent === "invoice") {
    return textReply(await answerLastInvoice({ phone, userId }));
  }

  if (interpretation.intent === "product_search") {
    return answerProductSearch(interpretation.query);
  }

  switch (interpretation.supportTopic) {
    case "account_setup":
      return textReply(`You can create a Jurgens Energy online-store account here: ${createStoreUrl("/register")}. If you already have one, sign in here: ${createStoreUrl("/sign-in")}.`);
    case "business_info":
      {
        const answer = await answerWhatsappQuestionWithAi({
          knowledgeFacts: await getWhatsappKnowledgeFacts(question),
          question,
          recentTurns,
        });

        return answer
          ? { grounded: true, media: [], reply: answer }
          : textReply([
              "Jurgens Energy is a South African online store for LPG cylinders, eligible cylinder exchanges and gas-related products.",
              "Eligible online-store orders are delivered within South Africa.",
              ...southAfricaDeliveryTimingFacts,
              "Delivery fees are shown at checkout.",
            ].join(" "));
      }
    case "contact":
      return textReply(await answerContactDetails());
    case "delivery_areas":
      return textReply(await answerDeliveryAreas());
    case "location":
      return textReply(await answerLocation());
    case "shipping_rates":
      return textReply(await answerShippingRates());
    case "last_invoice":
      return textReply(await answerLastInvoice({ phone, userId }));
    case "unknown":
    default:
      {
        const answer = await answerWhatsappQuestionWithAi({
          knowledgeFacts: await getWhatsappKnowledgeFacts(question),
          question,
          recentTurns,
        });

        return answer
          ? { grounded: true, media: [], reply: answer }
          : textReply(
              "I do not have enough verified information to answer that confidently. Would you like a Jurgens Energy team member to help?",
            );
      }
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

type WhatsappAgentRuntime = {
  authoritativeStatus: WhatsappAssistantResult["status"];
  conversationState: WhatsappConversationState;
  draftUrl: string | null;
  fallbackReply: string | null;
  media: WhatsappAssistantMedia[];
};

function createWhatsappAgentAdapterResult({
  data = null,
  facts,
  status,
}: WhatsappAgentAdapterResult): WhatsappAgentAdapterResult {
  return {
    data,
    facts: facts.map((fact) => fact.trim()).filter(Boolean).slice(0, 40),
    status,
  };
}

function getPendingWhatsappAction(
  state: WhatsappConversationState,
): WhatsappPendingAction | null {
  return state.pendingOrder ? "confirm_order" : null;
}

function withWhatsappMemory({
  facts,
  state,
  summary,
}: {
  facts?: string[];
  state: WhatsappConversationState;
  summary?: string;
}): WhatsappConversationState {
  return {
    ...state,
    memory: updateWhatsappRollingMemory({
      current: state.memory,
      summary,
      verifiedFacts: facts,
    }),
  };
}

async function checkDeliveryAreaForAgent(): Promise<WhatsappAgentAdapterResult> {
  return createWhatsappAgentAdapterResult({
    data: {
      countryCode: "ZA",
      exactAddressConfirmedAtCheckout: true,
    },
    facts: [
      ...southAfricaDeliveryFacts,
      "Exact product eligibility is confirmed at checkout from the customer's complete South African delivery address.",
    ],
    status: "checkout_confirmation_required",
  });
}

async function proposeWhatsappOrderForAgent({
  conversationId,
  currentMessage,
  proposal,
  runtime,
  phone,
}: {
  conversationId: string;
  currentMessage: string;
  phone: string;
  proposal: WhatsappAgentOrderProposal;
  runtime: WhatsappAgentRuntime;
}): Promise<WhatsappAgentAdapterResult> {
  const interpretation: MessageInterpretation = {
    intent: proposal.repeatLastOrder ? "repeat" : "order",
    purchaseType: proposal.purchaseType,
    query: null,
    quantity: proposal.quantity,
    sizeKg: proposal.sizeKg,
    supportTopic: null,
  };

  if (!proposal.purchaseType) {
    const nextState = withWhatsappMemory({
      facts: [
        `The customer requested ${proposal.quantity} cylinder${proposal.quantity === 1 ? "" : "s"}${proposal.sizeKg ? ` of ${proposal.sizeKg}kg` : ""}, but has not specified exchange or full/new.`,
      ],
      state: {
        ...runtime.conversationState,
        partialOrder: buildPartialOrderState({
          interpretation,
          message: currentMessage,
          partialOrder: runtime.conversationState.partialOrder,
        }),
      },
      summary: "The customer is choosing between an exchange and a full/new cylinder.",
    });
    delete nextState.deliveryInquiry;
    runtime.conversationState = nextState;
    runtime.authoritativeStatus = "ask_for_size";
    runtime.fallbackReply =
      "Got it. Should that be an exchange where you hand over an empty cylinder, or a full/new cylinder with no empty return?";
    await updateConversationState(conversationId, nextState);

    return createWhatsappAgentAdapterResult({
      data: { missing: "purchase_type" },
      facts: [
        "The order cannot be priced until the customer chooses exchange or full/new.",
        "Exchange means the customer hands over an acceptable empty cylinder on delivery. Full/new means no empty-cylinder handover.",
      ],
      status: "needs_purchase_type",
    });
  }

  const candidate = proposal.repeatLastOrder
    ? await findLastOrderCandidate({
        phone,
        purchaseType: proposal.purchaseType,
        sizeKg: proposal.sizeKg,
      })
    : await findCatalogCandidate({
        purchaseType: proposal.purchaseType,
        quantity: proposal.quantity,
        sizeKg: proposal.sizeKg,
      });

  if (!candidate) {
    const nextState = withWhatsappMemory({
      facts: [
        `The customer requested ${proposal.quantity} x ${proposal.sizeKg ? `${proposal.sizeKg}kg ` : ""}${proposal.purchaseType === "exchange" ? "exchange" : "full/new"} cylinder.`,
      ],
      state: {
        ...runtime.conversationState,
        ...(!proposal.sizeKg
          ? {
              partialOrder: buildPartialOrderState({
                interpretation,
                message: currentMessage,
                partialOrder: runtime.conversationState.partialOrder,
              }),
            }
          : {}),
      },
      summary: "A cylinder request is active but still needs a matching live catalogue option.",
    });
    delete nextState.deliveryInquiry;
    runtime.conversationState = nextState;
    runtime.authoritativeStatus = proposal.sizeKg ? "no_match" : "ask_for_size";
    runtime.fallbackReply = proposal.sizeKg
      ? `I could not find an available ${proposal.sizeKg}kg ${proposal.purchaseType === "exchange" ? "exchange" : "full/new"} cylinder right now. Tell me another size, or ask for a team member.`
      : `What size ${proposal.purchaseType === "exchange" ? "cylinder are you exchanging" : "full/new cylinder do you need"}?`;
    await updateConversationState(conversationId, nextState);

    return createWhatsappAgentAdapterResult({
      data: { missing: proposal.sizeKg ? null : "size_kg" },
      facts: proposal.sizeKg
        ? [
            `No currently available ${proposal.sizeKg}kg ${proposal.purchaseType === "exchange" ? "exchange" : "full/new"} cylinder option matched the live catalogue.`,
          ]
        : [
            "The cylinder size is still required before a live catalogue option can be selected.",
            "Common examples are 9kg, 14kg, 19kg and 48kg, but availability must come from the live catalogue.",
          ],
      status: proposal.sizeKg ? "no_match" : "needs_size",
    });
  }

  const snapshot = await getVariantSnapshot({
    purchaseType: candidate.purchaseType,
    quantity: candidate.quantity,
    variantId: candidate.variantId,
  });

  if (!snapshot) {
    runtime.authoritativeStatus = "no_match";
    runtime.fallbackReply =
      "That product changed before I could prepare the offer. Please send the cylinder size and type again, for example '9kg exchange'.";

    return createWhatsappAgentAdapterResult({
      facts: [
        "The selected product changed or became unavailable before the offer could be prepared. No order or payment link was created.",
      ],
      status: "product_changed",
    });
  }

  const offerFacts = [
    `Offer: ${snapshot.quantity} x ${snapshot.title}.`,
    `Type: ${snapshot.purchaseType === "exchange" ? "Exchange — an acceptable empty cylinder must be handed over on delivery" : "Full/new cylinder — no empty-cylinder handover"}.`,
    `Unit price: ${snapshot.priceLabel}.`,
    `Product subtotal: ${snapshot.totalLabel}.`,
    "Delivery is calculated from the selected product and address during secure checkout.",
    "The customer must explicitly confirm this exact offer before a secure checkout link can be created. Ask them to reply YES or JA to confirm, or state what should change.",
  ];
  const nextState = withWhatsappMemory({
    facts: offerFacts.slice(0, 4),
    state: {
      ...runtime.conversationState,
      pendingOrder: {
        candidate,
        customerPrompt: buildOrderCustomerPrompt({
          message: currentMessage,
          partialOrder: runtime.conversationState.partialOrder,
        }),
      },
    },
    summary: `The customer is reviewing ${snapshot.quantity} x ${snapshot.title} (${snapshot.purchaseType === "exchange" ? "exchange" : "full/new"}).`,
  });
  delete nextState.deliveryInquiry;
  delete nextState.partialOrder;
  runtime.conversationState = nextState;
  runtime.authoritativeStatus = "draft_confirmation";
  runtime.fallbackReply = buildOrderConfirmationReply({
    interpretation,
    snapshot,
  });
  await updateConversationState(conversationId, nextState);

  const productImage = createWhatsappProductImage({
    mediaId: snapshot.mediaId,
    title: snapshot.title,
  });

  if (productImage) {
    runtime.media.push(productImage);
  }

  return createWhatsappAgentAdapterResult({
    data: {
      purchaseType: snapshot.purchaseType,
      quantity: snapshot.quantity,
      status: "awaiting_confirmation",
    },
    facts: offerFacts,
    status: "awaiting_confirmation",
  });
}

async function confirmWhatsappOrderForAgent({
  conversationId,
  currentMessage,
  phone,
  runtime,
  userId,
}: {
  conversationId: string;
  currentMessage: string;
  phone: string;
  runtime: WhatsappAgentRuntime;
  userId: string | null;
}): Promise<WhatsappAgentAdapterResult> {
  const pendingOrder = runtime.conversationState.pendingOrder;

  if (!pendingOrder) {
    runtime.authoritativeStatus = "ask_for_size";
    runtime.fallbackReply =
      "I do not have an order waiting for confirmation yet. Tell me what you need, for example '9kg exchange'.";

    return createWhatsappAgentAdapterResult({
      facts: [
        "There is no persisted WhatsApp order offer waiting for confirmation, so no checkout link was created.",
      ],
      status: "no_pending_offer",
    });
  }

  const claimedState = await claimPendingOrderForCheckout({
    conversationId,
    pendingOrder,
  });

  if (!claimedState) {
    runtime.authoritativeStatus = "support_answer";
    runtime.fallbackReply =
      "That confirmation has already been processed or is no longer waiting. If you did not receive the checkout link, ask me to resend it.";

    return createWhatsappAgentAdapterResult({
      facts: [
        "The pending offer could not be claimed because it was already processed or no longer exists. No additional checkout link was created.",
      ],
      status: "already_processed",
    });
  }

  runtime.conversationState = claimedState;

  const snapshot = await getVariantSnapshot({
    purchaseType: pendingOrder.candidate.purchaseType,
    quantity: pendingOrder.candidate.quantity,
    variantId: pendingOrder.candidate.variantId,
  });

  if (!snapshot) {
    runtime.authoritativeStatus = "no_match";
    runtime.fallbackReply =
      "That product changed before checkout could be prepared. Please send the cylinder size and type again.";

    return createWhatsappAgentAdapterResult({
      facts: [
        "The product changed or became unavailable before checkout creation. The pending offer was cleared and no checkout link was created.",
      ],
      status: "product_changed",
    });
  }

  const draft = await createWhatsappOrderDraft({
    candidate: pendingOrder.candidate,
    conversationId,
    customerPrompt: pendingOrder.customerPrompt || currentMessage,
    phone,
    userId,
  });
  let nextState = runtime.conversationState;
  const checkoutFacts = [
    `Secure checkout prepared for ${snapshot.quantity} x ${snapshot.title} (${snapshot.purchaseType === "exchange" ? "exchange" : "full/new"}).`,
    `Product subtotal: ${snapshot.totalLabel}.`,
    `Secure review and payment link: ${draft.draftUrl}`,
    `The checkout link expires in ${checkoutLinkExpiryLabel}.`,
  ];
  nextState = withWhatsappMemory({
    facts: checkoutFacts,
    state: nextState,
    summary: "The confirmed WhatsApp offer now has a secure checkout link.",
  });
  runtime.conversationState = nextState;
  runtime.authoritativeStatus = "draft_created";
  runtime.draftUrl = draft.draftUrl;
  runtime.fallbackReply = buildDraftReply({
    draftUrl: draft.draftUrl,
    interpretation: createInterpretation({
      intent: pendingOrder.candidate.intent === "repeat" ? "repeat" : "order",
      purchaseType: snapshot.purchaseType,
      quantity: snapshot.quantity,
    }),
    snapshot,
  });
  await updateConversationState(conversationId, nextState);

  return createWhatsappAgentAdapterResult({
    data: { checkoutUrl: draft.draftUrl, status: "created" },
    facts: checkoutFacts,
    status: "created",
  });
}

async function tryProcessWhatsappMessageWithAgent({
  conversationId,
  conversationState,
  currentMessage,
  interpretation,
  modelMemory,
  phone,
  provider,
  userId,
}: {
  conversationId: string;
  conversationState: WhatsappConversationState;
  currentMessage: string;
  interpretation: MessageInterpretation;
  modelMemory: ReturnType<typeof buildWhatsappModelMemory>;
  phone: string;
  provider: WhatsappProvider;
  userId: string | null;
}): Promise<WhatsappAssistantResult | null> {
  const openAiConfig = await getOpenAiIntegrationConfig();

  if (!openAiConfig.isConfigured || !openAiConfig.apiKey) {
    return null;
  }

  const runtime: WhatsappAgentRuntime = {
    authoritativeStatus: "support_answer",
    conversationState,
    draftUrl: null,
    fallbackReply: null,
    media: [],
  };
  const pendingAction = getPendingWhatsappAction(conversationState);
  const confirmation = classifyWhatsappConfirmation({
    message: currentMessage,
    pendingAction,
  });
  const deterministicIntent = interpretMessage(currentMessage).intent;
  const isOrderRequest =
    interpretation.intent === "order" ||
    interpretation.intent === "repeat" ||
    deterministicIntent === "order" ||
    deterministicIntent === "repeat";
  const adapters = {
    cancelPendingRequest: async () => {
      const cancelledItem = runtime.conversationState.pendingOrder
        ? "pending WhatsApp order"
        : runtime.conversationState.deliveryInquiry
          ? "delivery check"
          : "pending request";
      runtime.conversationState = withWhatsappMemory({
        facts: [`The customer cancelled the ${cancelledItem}.`],
        state: await clearPendingOrder(
          conversationId,
          runtime.conversationState,
        ),
        summary: "There is no pending WhatsApp order or delivery request.",
      });
      await updateConversationState(conversationId, runtime.conversationState);
      runtime.fallbackReply = `No problem, I have cleared that ${cancelledItem}. Tell me what you need when you are ready.`;

      return createWhatsappAgentAdapterResult({
        facts: [`The ${cancelledItem} was cleared successfully.`],
        status: "cancelled",
      });
    },
    checkDeliveryArea: () => checkDeliveryAreaForAgent(),
    confirmOrderAndCreateCheckout: () =>
      confirmWhatsappOrderForAgent({
        conversationId,
        currentMessage,
        phone,
        runtime,
        userId,
      }),
    getBusinessInformation: async (question: string) =>
      createWhatsappAgentAdapterResult({
        facts: await getWhatsappKnowledgeFacts(question),
        status: "verified",
      }),
    getLatestInvoice: async () => {
      const answer = await answerLastInvoice({ phone, userId });

      return createWhatsappAgentAdapterResult({
        facts: [answer],
        status: "verified",
      });
    },
    getOrderStatus: async () => {
      const answer = await answerOrderStatus({ phone, userId });

      return createWhatsappAgentAdapterResult({
        facts: [answer],
        status: "verified",
      });
    },
    proposeOrder: (proposal: WhatsappAgentOrderProposal) =>
      proposeWhatsappOrderForAgent({
        conversationId,
        currentMessage,
        phone,
        proposal,
        runtime,
      }),
    renewPaymentLink: async () => {
      const replacementDraft = await renewLatestWhatsappDraft({
        conversationId,
        customerPrompt: currentMessage,
        phone,
        userId,
      });

      if (!replacementDraft) {
        runtime.authoritativeStatus = "no_match";
        runtime.fallbackReply =
          "I could not find a recent unpaid WhatsApp checkout link to renew. Tell me what you need and I will build a fresh order.";

        return createWhatsappAgentAdapterResult({
          facts: [
            "No recent eligible unpaid WhatsApp checkout draft was found, so no replacement payment link was created.",
          ],
          status: "not_found",
        });
      }

      runtime.draftUrl = replacementDraft.draftUrl;
      runtime.authoritativeStatus = "draft_created";
      runtime.fallbackReply = `Here is a fresh secure review and payment link for ${replacementDraft.snapshot.quantity} x ${replacementDraft.snapshot.title}. It expires in ${checkoutLinkExpiryLabel}: ${replacementDraft.draftUrl}`;
      const facts = [
        `Replacement secure checkout prepared for ${replacementDraft.snapshot.quantity} x ${replacementDraft.snapshot.title}.`,
        `Product subtotal: ${replacementDraft.snapshot.totalLabel}.`,
        `Secure review and payment link: ${replacementDraft.draftUrl}`,
        `The checkout link expires in ${checkoutLinkExpiryLabel}.`,
      ];
      runtime.conversationState = withWhatsappMemory({
        facts,
        state: runtime.conversationState,
        summary: "The customer has a refreshed secure WhatsApp checkout link.",
      });
      await updateConversationState(conversationId, runtime.conversationState);

      return createWhatsappAgentAdapterResult({
        data: { checkoutUrl: replacementDraft.draftUrl },
        facts,
        status: "created",
      });
    },
    requestHumanHandover: async (reason: string) => {
      const isSafetyConcern =
        /\b(?:gas\s+leak|leaking\s+gas|smell(?:s|ing)?\s+(?:of\s+)?gas|hissing|gas\s+fire|cylinder\s+(?:is\s+)?damaged|emergency|unsafe|faulty\s+(?:cylinder|regulator|valve))\b/.test(
          normalizeText(currentMessage),
        );
      const nextState: WhatsappConversationState = {
        ...runtime.conversationState,
        moderation: {
          ...runtime.conversationState.moderation,
          automationPausedAt: new Date().toISOString(),
          automationPausedBy: "system",
          lastFlagReason: reason.slice(0, 200),
          lastFlaggedAt: new Date().toISOString(),
        },
      };
      runtime.conversationState = nextState;
      runtime.authoritativeStatus = "human_handoff";
      runtime.fallbackReply = isSafetyConcern
        ? "This needs urgent human help, so I have paused automated replies and passed it to the Jurgens Energy team. If there may be an immediate LPG danger, move away from the hazard and contact local emergency services rather than troubleshooting it here."
        : "This needs a Jurgens Energy team member to assist properly. I have paused automated replies and passed the conversation to the team.";
      await updateConversationState(conversationId, nextState);

      return createWhatsappAgentAdapterResult({
        facts: [
          "Automated replies are now paused for this conversation and it has been handed to the Jurgens Energy team.",
          ...(isSafetyConcern
            ? [
                "For a possible immediate LPG danger, the customer should move away from the hazard and contact local emergency services rather than troubleshoot it in chat.",
              ]
            : []),
          "A staff reply time has not been promised.",
        ],
        status: "handed_over",
      });
    },
    searchProducts: async (query: string) => {
      const answer = await answerProductSearch(query);
      runtime.media.push(...answer.media);

      return createWhatsappAgentAdapterResult({
        facts: [answer.reply],
        status: "verified",
      });
    },
    stopWhatsappAutomation: async () => {
      await db
        .update(whatsappConversations)
        .set({ state: {}, status: "closed", updatedAt: new Date() })
        .where(eq(whatsappConversations.id, conversationId));
      runtime.conversationState = {};
      runtime.authoritativeStatus = "opted_out";
      runtime.fallbackReply =
        "No problem. I have stopped the automated WhatsApp conversation. You can start a new one whenever you need us.";

      return createWhatsappAgentAdapterResult({
        facts: [
          "The automated WhatsApp ordering conversation was stopped and closed successfully. The customer can start a new conversation later.",
        ],
        status: "stopped",
      });
    },
  } satisfies Parameters<typeof runJurgensWhatsappAgentTurn>[0]["adapters"];
  const workflowContext = [
    modelMemory.rollingMemory.summary,
    ...modelMemory.rollingMemory.facts,
    modelMemory.workflowSummary,
    `Deterministic fallback intent: ${interpretation.intent}. This is advisory only and never authorizes a write.`,
  ]
    .filter(Boolean)
    .join("\n");
  const agentResult = await runJurgensWhatsappAgentTurn({
    adapters,
    authorizeWrite: ({ toolName }) => {
      switch (toolName) {
        case "propose_order":
          return isOrderRequest;
        case "confirm_order_and_create_checkout":
          return confirmation === "confirmed";
        case "cancel_pending_request":
          return (
            confirmation === "declined" ||
            deterministicIntent === "cancel" ||
            interpretation.intent === "cancel"
          );
        case "renew_payment_link":
          return (
            deterministicIntent === "payment_link" ||
            interpretation.intent === "payment_link"
          );
        case "request_human_handover":
          return (
            deterministicIntent === "human" || interpretation.intent === "human"
          );
        case "stop_whatsapp_automation":
          return deterministicIntent === "stop" || interpretation.intent === "stop";
        default:
          return false;
      }
    },
    config: {
      apiKey: openAiConfig.apiKey,
      model: openAiConfig.model,
      reasoningEffort: openAiConfig.reasoningEffort,
    },
    currentMessage: modelMemory.currentInbound,
    recentTurns: modelMemory.recentTurns,
    validateReply: (reply, facts) => {
      const replyIsGrounded = validateWhatsappAgentReply({
        authoritativeFacts: facts,
        customerMessage: modelMemory.currentInbound,
        reply,
      });
      const includesRequiredCheckoutLink =
        runtime.authoritativeStatus !== "draft_created" ||
        !runtime.draftUrl ||
        reply.includes(runtime.draftUrl);

      return replyIsGrounded && includesRequiredCheckoutLink;
    },
    workflowContext,
  });

  if (!agentResult) {
    return runtime.fallbackReply
      ? respond({
          conversationId,
          draftUrl: runtime.draftUrl,
          media: runtime.media,
          provider,
          reply: runtime.fallbackReply,
          status: runtime.authoritativeStatus,
        })
      : null;
  }

  if (runtime.authoritativeStatus !== "opted_out") {
    runtime.conversationState = withWhatsappMemory({
      facts: agentResult.authoritativeFacts,
      state: runtime.conversationState,
    });
    await updateConversationState(conversationId, runtime.conversationState);
  }

  return respond({
    conversationId,
    draftUrl: runtime.draftUrl,
    media: runtime.media,
    provider,
    reply: agentResult.reply,
    status: runtime.authoritativeStatus,
  });
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

  const providerProfileName = sanitizeWhatsappDisplayName(input.profileName);
  let baseConversationState = conversation.state;

  if (
    providerProfileName &&
    providerProfileName !== conversation.state.providerProfileName
  ) {
    baseConversationState = {
      ...conversation.state,
      providerProfileName,
    };
    await updateConversationState(conversation.id, baseConversationState);
  }

  let conversationState = updateRepeatedMessageState(
    baseConversationState,
    input.body,
  );

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

  const customerContext = await resolveWhatsappCustomerContext({
    conversationId: conversation.id,
    providerProfileName,
  });
  const recentTurns = customerContext.messages.map((message) => ({
    body: message.body,
    direction:
      message.direction === "assistant"
        ? ("outbound" as const)
        : ("inbound" as const),
  }));
  const modelMemory = buildWhatsappModelMemory({
    currentInbound: input.body,
    knownNames: [customerContext.displayName, customerContext.firstName],
    recentTurns,
    rollingMemory: conversationState.memory,
    workflowState: conversationState,
  });
  const ruleBasedInterpretation = mergeInterpretationWithPartialOrder({
    interpretation: interpretMessage(input.body),
    partialOrder: conversationState.partialOrder,
  });
  const confirmationSemantics = classifyWhatsappConfirmation({
    message: input.body,
    pendingAction: getPendingWhatsappAction(conversationState),
  });
  const deterministicInterpretation: MessageInterpretation = {
    ...ruleBasedInterpretation,
    intent:
      confirmationSemantics === "confirmed"
        ? "confirm"
        : confirmationSemantics === "declined"
          ? "cancel"
          : ruleBasedInterpretation.intent,
  };
  const canAnswerPendingOrderFollowUp =
    deterministicInterpretation.intent === "order" ||
    deterministicInterpretation.intent === "product_search" ||
    deterministicInterpretation.intent === "repeat" ||
    deterministicInterpretation.intent === "support";
  const pendingOrderFollowUp = canAnswerPendingOrderFollowUp
    ? await answerPendingOrderFollowUp({
        conversationId: conversation.id,
        message: input.body,
        provider: input.provider,
        state: conversationState,
      })
    : null;

  if (pendingOrderFollowUp) {
    return pendingOrderFollowUp;
  }

  // Active address/quote collection remains deterministic. All other turns
  // may be phrased naturally by the agent, while every business read or write
  // still goes through an authorised application tool.
  if (!conversationState.deliveryInquiry) {
    const agentReply = await tryProcessWhatsappMessageWithAgent({
      conversationId: conversation.id,
      conversationState,
      currentMessage: input.body,
      interpretation: deterministicInterpretation,
      modelMemory,
      phone,
      provider: input.provider,
      userId: link.userId,
    });

    if (agentReply) {
      await updateConversationAfterMessage({
        conversationId: conversation.id,
        direction: "inbound",
        intent: `agent_${deterministicInterpretation.intent}`,
      });

      return agentReply;
    }
  }

  const priorTurns: WhatsappConversationTurn[] = modelMemory.recentTurns;
  const rawInterpretation = conversationState.deliveryInquiry
    ? await interpretMessageWithAiFallback(input.body, {
        recentTurns: priorTurns,
        workflowSummary: modelMemory.workflowSummary,
      })
    : deterministicInterpretation;
  const interpretation = mergeInterpretationWithPartialOrder({
    interpretation: rawInterpretation,
    partialOrder: conversationState.partialOrder,
  });

  if (
    conversationState.deliveryInquiry ||
    isDeliveryCoverageQuestion(input.body)
  ) {
    await updateConversationAfterMessage({
      conversationId: conversation.id,
      direction: "inbound",
      intent: "delivery_inquiry",
    });

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
  }

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
    const claimedState = await claimPendingOrderForCheckout({
      conversationId: conversation.id,
      pendingOrder,
    });

    if (!claimedState) {
      return respond({
        conversationId: conversation.id,
        provider: input.provider,
        reply:
          "That confirmation has already been processed or is no longer waiting. If you did not receive the checkout link, ask me to resend it.",
        status: "support_answer",
      });
    }

    const snapshot = await getVariantSnapshot({
      purchaseType: pendingOrder.candidate.purchaseType,
      quantity: pendingOrder.candidate.quantity,
      variantId: pendingOrder.candidate.variantId,
    });

    if (!snapshot) {
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
    const now = new Date().toISOString();
    const nextState: WhatsappConversationState = {
      ...conversationState,
      moderation: {
        ...conversationState.moderation,
        automationPausedAt: now,
        automationPausedBy: "system",
        lastFlagReason: input.body.slice(0, 200),
        lastFlaggedAt: now,
      },
    };
    await updateConversationState(conversation.id, nextState);

    return respond({
      conversationId: conversation.id,
      provider: input.provider,
      reply:
        "This needs a Jurgens Energy team member to assist properly. I have paused the automated replies and passed the conversation to the team.",
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
    const answer = await answerSupportQuestion({
      interpretation,
      phone,
      question: input.body,
      recentTurns: priorTurns,
      userId: link.userId,
    });
    let reply = answer.reply;

    if (
      interpretation.intent === "support" &&
      interpretation.supportTopic === "unknown" &&
      !answer.grounded
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
      media: answer.media,
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
      : interpretation.purchaseType === "exchange"
        ? "Absolutely. What size cylinder are you exchanging—for example 9kg, 14kg, 19kg, or 48kg?"
        : "Sure. What size full/new cylinder do you need—for example 9kg, 14kg, 19kg, or 48kg?";

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
  const productImage = createWhatsappProductImage({
    mediaId: snapshot.mediaId,
    title: snapshot.title,
  });

  return respond({
    conversationId: conversation.id,
    draftUrl: null,
    media: productImage ? [productImage] : [],
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
