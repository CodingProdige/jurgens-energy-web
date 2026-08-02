import crypto from "node:crypto";

import {
  and,
  eq,
  inArray,
  isNull,
  notInArray,
  or,
} from "drizzle-orm";
import { cache } from "react";

import { db } from "@/src/db";
import {
  auditLogs,
  marketplaceSettings,
  media,
  shipments,
} from "@/src/db/schema";
import { env } from "@/src/config/env";
import { hashPassword, verifyPassword } from "@/src/modules/auth/service";
import { getMediaPublicUrl } from "@/src/modules/media/paths";
import { normalizePhoneNumber } from "@/src/modules/phone";
import { decryptSecret, encryptSecret } from "@/src/modules/security/secrets";
import {
  COURIER_GUY_LIVE_API_BASE_URL,
  COURIER_GUY_SANDBOX_API_BASE_URL,
  createCourierGuyClient,
} from "@/src/modules/shipping/courier-guy-client";
import { hasCourierGuyCredentialsForIdentity } from "@/src/modules/shipping/courier-guy-operations";
import { normalizeFreeShippingThreshold } from "@/src/modules/shipping/customer-shipping-policy";

export const marketplaceComingSoonCookieName =
  "jurgens_energy_marketplace_preview";
export const legacyMarketplaceComingSoonCookieName =
  `${"pies"}${"sang"}_marketplace_preview`;

const defaultWhatsappMessageUrl = "https://waba-v2.360dialog.io";
const defaultFooterPaymentMethodLabels = [
  "VISA",
  "Mastercard",
  "zapper",
  "mobicred",
] as const;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const openAiReasoningEfforts = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;
export type OpenAiReasoningEffort = (typeof openAiReasoningEfforts)[number];
export const defaultWhatsappFollowUpMessages = {
  default:
    "Hi, just checking in. If you still need help choosing a product or finishing your order, reply here and we will help.",
  draft:
    "Hi, just checking in. Would you like to continue with this order? Reply YES to confirm, or tell us what to change.",
  support:
    "Hi, just checking in. Did you still need help with delivery, an online order, or anything else from Jurgens Energy?",
} as const;
export const maxWhatsappEmailNotificationRecipients = 20;
export const maxWhatsappOrderNotificationRecipients = 10;
export const marketplaceReturnAcceptanceOptions = [
  "defective_and_non_defective",
  "defective_only",
  "none",
] as const;
export const marketplaceReturnProductConditionOptions = [
  "only_new",
  "new_and_slightly_used",
] as const;
export const marketplaceReturnMethodOptions = [
  "by_post",
  "dropoff",
  "in_store",
] as const;
export const marketplaceReturnLabelResponsibilityOptions = [
  "customer",
  "merchant",
] as const;
export const marketplaceReturnRestockingFeeOptions = [
  "none",
  "fixed",
  "percentage",
] as const;
export type MarketplaceReturnAcceptance =
  (typeof marketplaceReturnAcceptanceOptions)[number];
export type MarketplaceReturnProductCondition =
  (typeof marketplaceReturnProductConditionOptions)[number];
export type MarketplaceReturnMethod =
  (typeof marketplaceReturnMethodOptions)[number];
export type MarketplaceReturnLabelResponsibility =
  (typeof marketplaceReturnLabelResponsibilityOptions)[number];
export type MarketplaceReturnRestockingFee =
  (typeof marketplaceReturnRestockingFeeOptions)[number];

function getWhatsappWebhookUrl() {
  return new URL("/api/webhooks/whatsapp", env.APP_URL).toString();
}

function normalizeWhatsappProvider(value: string | null | undefined): "360dialog" {
  return value === "360dialog" ? "360dialog" : "360dialog";
}

function normalizeOpenAiReasoningEffort(
  value: string | null | undefined,
): OpenAiReasoningEffort {
  return openAiReasoningEfforts.includes(value as OpenAiReasoningEffort)
    ? (value as OpenAiReasoningEffort)
    : env.OPENAI_REASONING_EFFORT;
}

function normalizeReturnAcceptance(
  value: string | null | undefined,
): MarketplaceReturnAcceptance {
  return marketplaceReturnAcceptanceOptions.includes(
    value as MarketplaceReturnAcceptance,
  )
    ? (value as MarketplaceReturnAcceptance)
    : "defective_and_non_defective";
}

function normalizeReturnProductCondition(
  value: string | null | undefined,
): MarketplaceReturnProductCondition {
  return marketplaceReturnProductConditionOptions.includes(
    value as MarketplaceReturnProductCondition,
  )
    ? (value as MarketplaceReturnProductCondition)
    : "only_new";
}

function normalizeReturnLabelResponsibility(
  value: string | null | undefined,
): MarketplaceReturnLabelResponsibility {
  return marketplaceReturnLabelResponsibilityOptions.includes(
    value as MarketplaceReturnLabelResponsibility,
  )
    ? (value as MarketplaceReturnLabelResponsibility)
    : "customer";
}

function normalizeReturnRestockingFeeType(
  value: string | null | undefined,
): MarketplaceReturnRestockingFee {
  return marketplaceReturnRestockingFeeOptions.includes(
    value as MarketplaceReturnRestockingFee,
  )
    ? (value as MarketplaceReturnRestockingFee)
    : "none";
}

function normalizeReturnCountryCodes(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim().startsWith("[")
      ? (() => {
          try {
            const parsed = JSON.parse(value) as unknown;

            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : typeof value === "string"
        ? value.split(/[\n,]+/g)
        : [];

  const countryCodes = Array.from(
    new Set(
      rawValues
        .map((item) =>
          typeof item === "string" ? item.trim().toUpperCase() : "",
        )
        .filter((item) => /^[A-Z]{2}$/.test(item)),
    ),
  ).slice(0, 20);

  return countryCodes.length > 0 ? countryCodes : ["ZA"];
}

function normalizeReturnMethodCodes(value: unknown): MarketplaceReturnMethod[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim().startsWith("[")
      ? (() => {
          try {
            const parsed = JSON.parse(value) as unknown;

            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : typeof value === "string"
        ? value.split(/[\n,]+/g)
        : [];

  const methods = Array.from(
    new Set(
      rawValues.filter((item): item is MarketplaceReturnMethod =>
        marketplaceReturnMethodOptions.includes(
          item as MarketplaceReturnMethod,
        ),
      ),
    ),
  );

  return methods.length > 0 ? methods : ["by_post"];
}

function normalizeReturnPolicyUrl(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (trimmedValue?.startsWith("https://") && trimmedValue.length <= 500) {
    return trimmedValue;
  }

  return new URL("/returns-and-refunds", env.APP_URL).toString();
}

function normalizeWholeNumber(
  value: number | null | undefined,
  fallback: number,
) {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

export type MarketplacePaymentMethodBadge = {
  iconUrl: string | null;
  label: string;
  mediaId: string | null;
};

export type MarketplacePaymentMethodBadgeInput = Omit<
  MarketplacePaymentMethodBadge,
  "iconUrl"
>;

function defaultFooterPaymentMethodBadges(): MarketplacePaymentMethodBadgeInput[] {
  return defaultFooterPaymentMethodLabels.map((label) => ({
    label,
    mediaId: null,
  }));
}

function normalizePaymentMethodBadge(
  value: unknown,
): MarketplacePaymentMethodBadgeInput | null {
  if (typeof value === "string") {
    const label = value.trim();

    return label ? { label: label.slice(0, 40), mediaId: null } : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { label?: unknown; mediaId?: unknown };
  const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
  const mediaId =
    typeof candidate.mediaId === "string" && uuidPattern.test(candidate.mediaId)
      ? candidate.mediaId
      : null;

  return label ? { label: label.slice(0, 40), mediaId } : null;
}

function parsePaymentMethodBadges(
  value: string | null | undefined,
): MarketplacePaymentMethodBadgeInput[] {
  if (value === null || typeof value === "undefined") {
    return defaultFooterPaymentMethodBadges();
  }

  const trimmedValue = value.trim();

  if (trimmedValue.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmedValue) as unknown;

      if (Array.isArray(parsed)) {
        return parsed
          .map(normalizePaymentMethodBadge)
          .filter(
            (item): item is MarketplacePaymentMethodBadgeInput => Boolean(item),
          )
          .slice(0, 12);
      }
    } catch {
      // Fall through to the legacy newline/comma format.
    }
  }

  return value
    .split(/[\n,]+/g)
    .map(normalizePaymentMethodBadge)
    .filter(
      (item): item is MarketplacePaymentMethodBadgeInput => Boolean(item),
    )
    .slice(0, 12);
}

function serializePaymentMethodBadges(
  values: MarketplacePaymentMethodBadgeInput[],
) {
  return JSON.stringify(
    values
      .map(normalizePaymentMethodBadge)
      .filter(
        (item): item is MarketplacePaymentMethodBadgeInput => Boolean(item),
      )
      .slice(0, 12),
  );
}

function normalizeWhatsappNotificationRecipient(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();

  return email || null;
}

function parseWhatsappEmailNotificationRecipients(
  value: unknown,
) {
  let recipients: unknown[] = [];

  if (Array.isArray(value)) {
    recipients = value;
  } else if (typeof value === "string" && value.trim()) {
    const trimmedValue = value.trim();
    let parsedJsonArray = false;

    if (trimmedValue.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmedValue) as unknown;

        if (Array.isArray(parsed)) {
          recipients = parsed;
          parsedJsonArray = true;
        }
      } catch {
        // Fall through to the legacy newline/comma format.
      }
    }

    if (!parsedJsonArray) {
      recipients = value.split(/[\n,]+/g);
    }
  }

  return Array.from(
    new Set(
      recipients
        .map(normalizeWhatsappNotificationRecipient)
        .filter((email): email is string => Boolean(email)),
    ),
  ).slice(0, maxWhatsappEmailNotificationRecipients);
}

function normalizeWhatsappOrderNotificationRecipient(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return normalizePhoneNumber(value, { defaultCountryCode: "ZA" });
}

function parseWhatsappOrderNotificationRecipients(value: unknown) {
  let recipients: unknown[] = [];

  if (Array.isArray(value)) {
    recipients = value;
  } else if (typeof value === "string" && value.trim()) {
    const trimmedValue = value.trim();
    let parsedJsonArray = false;

    if (trimmedValue.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmedValue) as unknown;

        if (Array.isArray(parsed)) {
          recipients = parsed;
          parsedJsonArray = true;
        }
      } catch {
        // Fall through to the newline/comma format.
      }
    }

    if (!parsedJsonArray) {
      recipients = value.split(/[\n,]+/g);
    }
  }

  return Array.from(
    new Set(
      recipients
        .map(normalizeWhatsappOrderNotificationRecipient)
        .filter((phone): phone is string => Boolean(phone)),
    ),
  ).slice(0, maxWhatsappOrderNotificationRecipients);
}

async function resolvePaymentMethodBadges(
  value: string | null | undefined,
): Promise<MarketplacePaymentMethodBadge[]> {
  const badges = parsePaymentMethodBadges(value);
  const mediaIds = Array.from(
    new Set(
      badges
        .map((badge) => badge.mediaId)
        .filter((mediaId): mediaId is string => Boolean(mediaId)),
    ),
  );

  if (mediaIds.length === 0) {
    return badges.map((badge) => ({ ...badge, iconUrl: null }));
  }

  const assets = await db
    .select({
      id: media.id,
      isPublic: media.isPublic,
      mimeType: media.mimeType,
      relativePath: media.relativePath,
    })
    .from(media)
    .where(inArray(media.id, mediaIds));
  const iconUrlByMediaId = new Map(
    assets
      .filter(
        (asset) =>
          asset.isPublic &&
          asset.mimeType.startsWith("image/") &&
          asset.relativePath.startsWith("admin-media/"),
      )
      .map((asset) => [asset.id, getMediaPublicUrl(asset.relativePath)]),
  );

  return badges.map((badge) => ({
    ...badge,
    iconUrl: badge.mediaId
      ? (iconUrlByMediaId.get(badge.mediaId) ?? null)
      : null,
  }));
}

export type MarketplaceSettings = {
  bobgoBookingMode: "disabled" | "quote_only" | "quote_and_book";
  courierGuyDefaultServiceCode: string | null;
  courierGuyDropoffPickupPointId: string | null;
  courierGuyDropoffPickupPointLabel: string | null;
  courierGuyDropoffProvider: string;
  courierGuyDropoffType:
    | "generic_kiosk"
    | "generic_locker"
    | "specific_pickup_point";
  courierGuyEnabled: boolean;
  courierGuyLiveAccountCode: string | null;
  courierGuyMode: "live" | "sandbox";
  courierGuySandboxAccountCode: string | null;
  courierGuyWebhookUrl: string;
  comingSoonEnabled: boolean;
  comingSoonPasswordHash: string | null;
  contactEmail: string;
  contactPhonePrimary: string;
  contactPhoneSecondary: string;
  facebookUrl: string | null;
  footerTagline: string;
  freeStorageQuotaMb: number;
  googleAdsConversionId: string | null;
  googleAdsConversionLabel: string | null;
  googleAnalyticsMeasurementId: string | null;
  googleLocalInventoryCustomerAccessible: boolean;
  googleLocalInventoryEnabled: boolean;
  googleLocalInventoryStoreCode: string | null;
  googleMerchantCenterId: string | null;
  googlePlacesEnabled: boolean;
  googleReviewUrl: string | null;
  googleSiteVerificationToken: string | null;
  googleTagManagerId: string | null;
  hasGooglePlacesApiKey: boolean;
  hasOpenAiApiKey: boolean;
  imageCompressionQuality: number;
  instagramUrl: string | null;
  maxImageWidth: number;
  maxUploadFileMb: number;
  maxVideoUploadFileMb: number;
  maxVideoWidth: number;
  bobgoEnabled: boolean;
  bobgoMode: "live" | "sandbox";
  hasBobgoApiKey: boolean;
  hasBobgoWebhookSecret: boolean;
  hasBobgoLiveApiKey: boolean;
  hasBobgoLiveWebhookSecret: boolean;
  hasBobgoSandboxApiKey: boolean;
  hasBobgoSandboxWebhookSecret: boolean;
  hasCourierGuyLiveApiKey: boolean;
  hasCourierGuySandboxApiKey: boolean;
  hasCourierGuyWebhookToken: boolean;
  jurgensDeliveryCutoffTime: string;
  bobgoWebhookFulfillmentCreated: boolean;
  bobgoWebhookShipmentChargedAmountChanged: boolean;
  bobgoWebhookShipmentChargedWeightChanged: boolean;
  bobgoWebhookShipmentHealthStatusUpdated: boolean;
  bobgoWebhookShipmentSubmissionStatusUpdated: boolean;
  bobgoWebhookTrackingUpdated: boolean;
  shippingBufferBps: number;
  shippingEnabled: boolean;
  shippingFlatRate: number;
  shippingFreeOverAmount: number | null;
  shippingHandlingMaxBusinessDays: number;
  shippingHandlingMinBusinessDays: number;
  shippingMarginBps: number;
  shippingTransitMaxBusinessDays: number;
  shippingTransitMinBusinessDays: number;
  returnsAcceptance: MarketplaceReturnAcceptance;
  returnsCountryCodes: string[];
  returnsCurrencyCode: string;
  returnsExchangesEnabled: boolean;
  returnsHazardousGoodsNoteEnabled: boolean;
  returnsLabelResponsibility: MarketplaceReturnLabelResponsibility;
  returnsMethodCodes: MarketplaceReturnMethod[];
  returnsPolicyUrl: string;
  returnsProductCondition: MarketplaceReturnProductCondition;
  returnsRefundProcessingDays: number;
  returnsRestockingFeeAmount: number | null;
  returnsRestockingFeePercent: number | null;
  returnsRestockingFeeType: MarketplaceReturnRestockingFee;
  returnsWindowDays: number;
  payfastLiveMerchantId: string | null;
  payfastMode: "live" | "sandbox";
  payfastOnsiteEnabled: boolean;
  payfastSandboxMerchantId: string | null;
  payfastTokenizationEnabled: boolean;
  paymentMethodBadges: MarketplacePaymentMethodBadge[];
  openAiEnabled: boolean;
  openAiModel: string;
  openAiReasoningEffort: OpenAiReasoningEffort;
  hasPayfastLiveMerchantKey: boolean;
  hasPayfastLivePassphrase: boolean;
  hasPayfastSandboxMerchantKey: boolean;
  hasPayfastSandboxPassphrase: boolean;
  stripeLivePublishableKey: string | null;
  stripeMode: "live" | "sandbox";
  stripeSandboxPublishableKey: string | null;
  twitterUrl: string | null;
  hasStripeLiveSecretKey: boolean;
  hasStripeLiveWebhookSecret: boolean;
  hasStripeSandboxSecretKey: boolean;
  hasStripeSandboxWebhookSecret: boolean;
  videoCompressionCrf: number;
  hasWhatsappApiKey: boolean;
  hasWhatsappWebhookSigningSecret: boolean;
  hasWhatsappWebhookVerifyToken: boolean;
  whatsappBusinessPhoneNumber: string | null;
  whatsappEmailNotificationRecipients: string[];
  whatsappEmailNotificationsEnabled: boolean;
  whatsappEmailNotifyInboundMessage: boolean;
  whatsappEmailNotifyNewConversation: boolean;
  whatsappOrderNotificationRecipients: string[];
  whatsappOrderNotificationsEnabled: boolean;
  whatsappFollowUpDefaultMessage: string;
  whatsappFollowUpDelayMinutes: number;
  whatsappFollowUpDraftMessage: string;
  whatsappFollowUpMaxCount: number;
  whatsappFollowUpQuietHoursEnabled: boolean;
  whatsappFollowUpQuietHoursEnd: string | null;
  whatsappFollowUpQuietHoursStart: string | null;
  whatsappFollowUpSupportMessage: string;
  whatsappFollowUpsEnabled: boolean;
  whatsappMessageUrl: string;
  whatsappOrderingEnabled: boolean;
  whatsappProvider: "360dialog";
  whatsappWebhookUrl: string;
};

export type WhatsappFollowUpSettings = Pick<
  MarketplaceSettings,
  | "whatsappFollowUpDefaultMessage"
  | "whatsappFollowUpDelayMinutes"
  | "whatsappFollowUpDraftMessage"
  | "whatsappFollowUpMaxCount"
  | "whatsappFollowUpQuietHoursEnabled"
  | "whatsappFollowUpQuietHoursEnd"
  | "whatsappFollowUpQuietHoursStart"
  | "whatsappFollowUpSupportMessage"
  | "whatsappFollowUpsEnabled"
>;

export type MarketplaceAdminSecrets = {
  courierGuyLiveApiKey: string | null;
  courierGuySandboxApiKey: string | null;
  courierGuyWebhookToken: string | null;
  googlePlacesApiKey: string | null;
  openAiApiKey: string | null;
  payfastLiveMerchantKey: string | null;
  payfastLivePassphrase: string | null;
  payfastSandboxMerchantKey: string | null;
  payfastSandboxPassphrase: string | null;
  stripeLiveSecretKey: string | null;
  stripeLiveWebhookSecret: string | null;
  stripeSandboxSecretKey: string | null;
  stripeSandboxWebhookSecret: string | null;
  whatsappApiKey: string | null;
  whatsappWebhookVerifyToken: string | null;
};

const defaultSettings: MarketplaceSettings = {
  bobgoBookingMode: "disabled",
  courierGuyDefaultServiceCode: null,
  courierGuyDropoffPickupPointId: "K0000",
  courierGuyDropoffPickupPointLabel: null,
  courierGuyDropoffProvider: "tcg-locker",
  courierGuyDropoffType: "generic_kiosk",
  courierGuyEnabled: false,
  courierGuyLiveAccountCode: null,
  courierGuyMode: "sandbox",
  courierGuySandboxAccountCode: null,
  courierGuyWebhookUrl: new URL(
    "/api/webhooks/courier-guy",
    env.APP_URL,
  ).toString(),
  comingSoonEnabled: false,
  comingSoonPasswordHash: null,
  contactEmail: "",
  contactPhonePrimary: "",
  contactPhoneSecondary: "",
  facebookUrl: null,
  footerTagline:
    "South African online store for home, energy, outdoor, appliance and lifestyle products.",
  freeStorageQuotaMb: 512,
  googleAdsConversionId: null,
  googleAdsConversionLabel: null,
  googleAnalyticsMeasurementId: null,
  googleLocalInventoryCustomerAccessible: false,
  googleLocalInventoryEnabled: false,
  googleLocalInventoryStoreCode: null,
  googleMerchantCenterId: null,
  googlePlacesEnabled: false,
  googleReviewUrl: null,
  googleSiteVerificationToken: null,
  googleTagManagerId: null,
  hasGooglePlacesApiKey: false,
  hasOpenAiApiKey: Boolean(env.OPENAI_API_KEY),
  imageCompressionQuality: 90,
  instagramUrl: null,
  maxImageWidth: 2560,
  maxUploadFileMb: 10,
  maxVideoUploadFileMb: 100,
  maxVideoWidth: 1280,
  bobgoEnabled: false,
  bobgoMode: "sandbox",
  hasBobgoApiKey: false,
  hasBobgoWebhookSecret: false,
  hasBobgoLiveApiKey: false,
  hasBobgoLiveWebhookSecret: false,
  hasBobgoSandboxApiKey: false,
  hasBobgoSandboxWebhookSecret: false,
  hasCourierGuyLiveApiKey: false,
  hasCourierGuySandboxApiKey: false,
  hasCourierGuyWebhookToken: false,
  jurgensDeliveryCutoffTime: "14:00",
  bobgoWebhookFulfillmentCreated: true,
  bobgoWebhookShipmentChargedAmountChanged: true,
  bobgoWebhookShipmentChargedWeightChanged: true,
  bobgoWebhookShipmentHealthStatusUpdated: true,
  bobgoWebhookShipmentSubmissionStatusUpdated: true,
  bobgoWebhookTrackingUpdated: true,
  shippingBufferBps: 0,
  shippingEnabled: false,
  shippingFlatRate: 0,
  shippingFreeOverAmount: null,
  shippingHandlingMaxBusinessDays: 1,
  shippingHandlingMinBusinessDays: 0,
  shippingMarginBps: 0,
  shippingTransitMaxBusinessDays: 3,
  shippingTransitMinBusinessDays: 1,
  returnsAcceptance: "defective_and_non_defective",
  returnsCountryCodes: ["ZA"],
  returnsCurrencyCode: "ZAR",
  returnsExchangesEnabled: true,
  returnsHazardousGoodsNoteEnabled: true,
  returnsLabelResponsibility: "customer",
  returnsMethodCodes: ["by_post"],
  returnsPolicyUrl: new URL("/returns-and-refunds", env.APP_URL).toString(),
  returnsProductCondition: "only_new",
  returnsRefundProcessingDays: 7,
  returnsRestockingFeeAmount: null,
  returnsRestockingFeePercent: null,
  returnsRestockingFeeType: "none",
  returnsWindowDays: 7,
  payfastLiveMerchantId: null,
  payfastMode: "sandbox",
  payfastOnsiteEnabled: false,
  payfastSandboxMerchantId: null,
  payfastTokenizationEnabled: false,
  paymentMethodBadges: defaultFooterPaymentMethodBadges().map((badge) => ({
    ...badge,
    iconUrl: null,
  })),
  openAiEnabled: true,
  openAiModel: env.OPENAI_MODEL,
  openAiReasoningEffort: env.OPENAI_REASONING_EFFORT,
  hasPayfastLiveMerchantKey: false,
  hasPayfastLivePassphrase: false,
  hasPayfastSandboxMerchantKey: false,
  hasPayfastSandboxPassphrase: false,
  stripeLivePublishableKey: null,
  stripeMode: "sandbox",
  stripeSandboxPublishableKey: null,
  twitterUrl: null,
  hasStripeLiveSecretKey: false,
  hasStripeLiveWebhookSecret: false,
  hasStripeSandboxSecretKey: false,
  hasStripeSandboxWebhookSecret: false,
  videoCompressionCrf: 28,
  hasWhatsappApiKey: Boolean(env.DIALOGUE_API_KEY),
  hasWhatsappWebhookSigningSecret: Boolean(
    env.WHATSAPP_WEBHOOK_SIGNING_SECRET,
  ),
  hasWhatsappWebhookVerifyToken: Boolean(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
  whatsappBusinessPhoneNumber: env.WHATSAPP_ORDERING_PHONE_NUMBER ?? null,
  whatsappEmailNotificationRecipients: [],
  whatsappEmailNotificationsEnabled: false,
  whatsappEmailNotifyInboundMessage: true,
  whatsappEmailNotifyNewConversation: true,
  whatsappOrderNotificationRecipients: [],
  whatsappOrderNotificationsEnabled: false,
  whatsappFollowUpDefaultMessage: defaultWhatsappFollowUpMessages.default,
  whatsappFollowUpDelayMinutes: 30,
  whatsappFollowUpDraftMessage: defaultWhatsappFollowUpMessages.draft,
  whatsappFollowUpMaxCount: 1,
  whatsappFollowUpQuietHoursEnabled: false,
  whatsappFollowUpQuietHoursEnd: null,
  whatsappFollowUpQuietHoursStart: null,
  whatsappFollowUpSupportMessage: defaultWhatsappFollowUpMessages.support,
  whatsappFollowUpsEnabled: true,
  whatsappMessageUrl: env.DIALOGUE_MESSAGE_URL ?? defaultWhatsappMessageUrl,
  whatsappOrderingEnabled: false,
  whatsappProvider: "360dialog",
  whatsappWebhookUrl: getWhatsappWebhookUrl(),
};

const readMarketplaceSettings = async (): Promise<MarketplaceSettings> => {
  const [settings] = await db
    .select({
      comingSoonEnabled: marketplaceSettings.comingSoonEnabled,
      comingSoonPasswordHash: marketplaceSettings.comingSoonPasswordHash,
      contactEmail: marketplaceSettings.contactEmail,
      contactPhonePrimary: marketplaceSettings.contactPhonePrimary,
      contactPhoneSecondary: marketplaceSettings.contactPhoneSecondary,
      facebookUrl: marketplaceSettings.facebookUrl,
      footerTagline: marketplaceSettings.footerTagline,
      freeStorageQuotaMb: marketplaceSettings.freeStorageQuotaMb,
      googleAdsConversionId: marketplaceSettings.googleAdsConversionId,
      googleAdsConversionLabel: marketplaceSettings.googleAdsConversionLabel,
      googleAnalyticsMeasurementId:
        marketplaceSettings.googleAnalyticsMeasurementId,
      googleLocalInventoryCustomerAccessible:
        marketplaceSettings.googleLocalInventoryCustomerAccessible,
      googleLocalInventoryEnabled:
        marketplaceSettings.googleLocalInventoryEnabled,
      googleLocalInventoryStoreCode:
        marketplaceSettings.googleLocalInventoryStoreCode,
      googleMerchantCenterId: marketplaceSettings.googleMerchantCenterId,
      googlePlacesApiKeyEncrypted:
        marketplaceSettings.googlePlacesApiKeyEncrypted,
      googlePlacesEnabled: marketplaceSettings.googlePlacesEnabled,
      googleReviewUrl: marketplaceSettings.googleReviewUrl,
      googleSiteVerificationToken:
        marketplaceSettings.googleSiteVerificationToken,
      googleTagManagerId: marketplaceSettings.googleTagManagerId,
      openAiApiKeyEncrypted: marketplaceSettings.openAiApiKeyEncrypted,
      openAiEnabled: marketplaceSettings.openAiEnabled,
      openAiModel: marketplaceSettings.openAiModel,
      openAiReasoningEffort: marketplaceSettings.openAiReasoningEffort,
      imageCompressionQuality: marketplaceSettings.imageCompressionQuality,
      instagramUrl: marketplaceSettings.instagramUrl,
      maxImageWidth: marketplaceSettings.maxImageWidth,
      maxUploadFileMb: marketplaceSettings.maxUploadFileMb,
      maxVideoUploadFileMb: marketplaceSettings.maxVideoUploadFileMb,
      maxVideoWidth: marketplaceSettings.maxVideoWidth,
      bobgoApiKeyEncrypted: marketplaceSettings.bobgoApiKeyEncrypted,
      bobgoBookingMode: marketplaceSettings.bobgoBookingMode,
      bobgoEnabled: marketplaceSettings.bobgoEnabled,
      bobgoLiveApiKeyEncrypted: marketplaceSettings.bobgoLiveApiKeyEncrypted,
      bobgoLiveWebhookSecretEncrypted:
        marketplaceSettings.bobgoLiveWebhookSecretEncrypted,
      bobgoMode: marketplaceSettings.bobgoMode,
      bobgoSandboxApiKeyEncrypted:
        marketplaceSettings.bobgoSandboxApiKeyEncrypted,
      bobgoSandboxWebhookSecretEncrypted:
        marketplaceSettings.bobgoSandboxWebhookSecretEncrypted,
      bobgoWebhookSecretEncrypted:
        marketplaceSettings.bobgoWebhookSecretEncrypted,
      bobgoWebhookFulfillmentCreated:
        marketplaceSettings.bobgoWebhookFulfillmentCreated,
      bobgoWebhookShipmentChargedAmountChanged:
        marketplaceSettings.bobgoWebhookShipmentChargedAmountChanged,
      bobgoWebhookShipmentChargedWeightChanged:
        marketplaceSettings.bobgoWebhookShipmentChargedWeightChanged,
      bobgoWebhookShipmentHealthStatusUpdated:
        marketplaceSettings.bobgoWebhookShipmentHealthStatusUpdated,
      bobgoWebhookShipmentSubmissionStatusUpdated:
        marketplaceSettings.bobgoWebhookShipmentSubmissionStatusUpdated,
      bobgoWebhookTrackingUpdated:
        marketplaceSettings.bobgoWebhookTrackingUpdated,
      courierGuyDefaultServiceCode:
        marketplaceSettings.courierGuyDefaultServiceCode,
      courierGuyDropoffPickupPointId:
        marketplaceSettings.courierGuyDropoffPickupPointId,
      courierGuyDropoffPickupPointLabel:
        marketplaceSettings.courierGuyDropoffPickupPointLabel,
      courierGuyDropoffProvider:
        marketplaceSettings.courierGuyDropoffProvider,
      courierGuyDropoffType: marketplaceSettings.courierGuyDropoffType,
      courierGuyEnabled: marketplaceSettings.courierGuyEnabled,
      courierGuyLiveAccountCode:
        marketplaceSettings.courierGuyLiveAccountCode,
      courierGuyLiveApiKeyEncrypted:
        marketplaceSettings.courierGuyLiveApiKeyEncrypted,
      courierGuyMode: marketplaceSettings.courierGuyMode,
      courierGuySandboxAccountCode:
        marketplaceSettings.courierGuySandboxAccountCode,
      courierGuySandboxApiKeyEncrypted:
        marketplaceSettings.courierGuySandboxApiKeyEncrypted,
      courierGuyWebhookTokenEncrypted:
        marketplaceSettings.courierGuyWebhookTokenEncrypted,
      shippingBufferBps: marketplaceSettings.shippingBufferBps,
      shippingEnabled: marketplaceSettings.shippingEnabled,
      shippingFlatRate: marketplaceSettings.shippingFlatRate,
      shippingFreeOverAmount: marketplaceSettings.shippingFreeOverAmount,
      shippingHandlingMaxBusinessDays:
        marketplaceSettings.shippingHandlingMaxBusinessDays,
      shippingHandlingMinBusinessDays:
        marketplaceSettings.shippingHandlingMinBusinessDays,
      shippingMarginBps: marketplaceSettings.shippingMarginBps,
      shippingTransitMaxBusinessDays:
        marketplaceSettings.shippingTransitMaxBusinessDays,
      shippingTransitMinBusinessDays:
        marketplaceSettings.shippingTransitMinBusinessDays,
      returnsAcceptance: marketplaceSettings.returnsAcceptance,
      returnsCountryCodes: marketplaceSettings.returnsCountryCodes,
      returnsCurrencyCode: marketplaceSettings.returnsCurrencyCode,
      returnsExchangesEnabled: marketplaceSettings.returnsExchangesEnabled,
      returnsHazardousGoodsNoteEnabled:
        marketplaceSettings.returnsHazardousGoodsNoteEnabled,
      returnsLabelResponsibility:
        marketplaceSettings.returnsLabelResponsibility,
      returnsMethodCodes: marketplaceSettings.returnsMethodCodes,
      returnsPolicyUrl: marketplaceSettings.returnsPolicyUrl,
      returnsProductCondition: marketplaceSettings.returnsProductCondition,
      returnsRefundProcessingDays:
        marketplaceSettings.returnsRefundProcessingDays,
      returnsRestockingFeeAmount:
        marketplaceSettings.returnsRestockingFeeAmount,
      returnsRestockingFeePercent:
        marketplaceSettings.returnsRestockingFeePercent,
      returnsRestockingFeeType:
        marketplaceSettings.returnsRestockingFeeType,
      returnsWindowDays: marketplaceSettings.returnsWindowDays,
      jurgensDeliveryCutoffTime: marketplaceSettings.jurgensDeliveryCutoffTime,
      payfastLiveMerchantId: marketplaceSettings.payfastLiveMerchantId,
      payfastLiveMerchantKeyEncrypted:
        marketplaceSettings.payfastLiveMerchantKeyEncrypted,
      payfastLivePassphraseEncrypted:
        marketplaceSettings.payfastLivePassphraseEncrypted,
      payfastMode: marketplaceSettings.payfastMode,
      payfastOnsiteEnabled: marketplaceSettings.payfastOnsiteEnabled,
      payfastSandboxMerchantId: marketplaceSettings.payfastSandboxMerchantId,
      payfastSandboxMerchantKeyEncrypted:
        marketplaceSettings.payfastSandboxMerchantKeyEncrypted,
      payfastSandboxPassphraseEncrypted:
        marketplaceSettings.payfastSandboxPassphraseEncrypted,
      payfastTokenizationEnabled:
        marketplaceSettings.payfastTokenizationEnabled,
      paymentMethodBadges: marketplaceSettings.paymentMethodBadges,
      stripeLivePublishableKey: marketplaceSettings.stripeLivePublishableKey,
      stripeLiveSecretKeyEncrypted:
        marketplaceSettings.stripeLiveSecretKeyEncrypted,
      stripeLiveWebhookSecretEncrypted:
        marketplaceSettings.stripeLiveWebhookSecretEncrypted,
      stripeMode: marketplaceSettings.stripeMode,
      stripeSandboxPublishableKey:
        marketplaceSettings.stripeSandboxPublishableKey,
      stripeSandboxSecretKeyEncrypted:
        marketplaceSettings.stripeSandboxSecretKeyEncrypted,
      stripeSandboxWebhookSecretEncrypted:
        marketplaceSettings.stripeSandboxWebhookSecretEncrypted,
      twitterUrl: marketplaceSettings.twitterUrl,
      videoCompressionCrf: marketplaceSettings.videoCompressionCrf,
      whatsappApiKeyEncrypted: marketplaceSettings.whatsappApiKeyEncrypted,
      whatsappBusinessPhoneNumber:
        marketplaceSettings.whatsappBusinessPhoneNumber,
      whatsappEmailNotificationRecipients:
        marketplaceSettings.whatsappEmailNotificationRecipients,
      whatsappEmailNotificationsEnabled:
        marketplaceSettings.whatsappEmailNotificationsEnabled,
      whatsappEmailNotifyInboundMessage:
        marketplaceSettings.whatsappEmailNotifyInboundMessage,
      whatsappEmailNotifyNewConversation:
        marketplaceSettings.whatsappEmailNotifyNewConversation,
      whatsappOrderNotificationRecipients:
        marketplaceSettings.whatsappOrderNotificationRecipients,
      whatsappOrderNotificationsEnabled:
        marketplaceSettings.whatsappOrderNotificationsEnabled,
      whatsappFollowUpDefaultMessage:
        marketplaceSettings.whatsappFollowUpDefaultMessage,
      whatsappFollowUpDelayMinutes:
        marketplaceSettings.whatsappFollowUpDelayMinutes,
      whatsappFollowUpDraftMessage:
        marketplaceSettings.whatsappFollowUpDraftMessage,
      whatsappFollowUpMaxCount: marketplaceSettings.whatsappFollowUpMaxCount,
      whatsappFollowUpQuietHoursEnabled:
        marketplaceSettings.whatsappFollowUpQuietHoursEnabled,
      whatsappFollowUpQuietHoursEnd:
        marketplaceSettings.whatsappFollowUpQuietHoursEnd,
      whatsappFollowUpQuietHoursStart:
        marketplaceSettings.whatsappFollowUpQuietHoursStart,
      whatsappFollowUpSupportMessage:
        marketplaceSettings.whatsappFollowUpSupportMessage,
      whatsappFollowUpsEnabled: marketplaceSettings.whatsappFollowUpsEnabled,
      whatsappMessageUrl: marketplaceSettings.whatsappMessageUrl,
      whatsappOrderingEnabled: marketplaceSettings.whatsappOrderingEnabled,
      whatsappProvider: marketplaceSettings.whatsappProvider,
      whatsappWebhookVerifyTokenEncrypted:
        marketplaceSettings.whatsappWebhookVerifyTokenEncrypted,
      whatsappWebhookSigningSecretEncrypted:
        marketplaceSettings.whatsappWebhookSigningSecretEncrypted,
    })
    .from(marketplaceSettings)
    .where(eq(marketplaceSettings.id, 1))
    .limit(1);

  if (!settings) {
    return defaultSettings;
  }

  const paymentMethodBadges = await resolvePaymentMethodBadges(
    settings.paymentMethodBadges,
  );
  const {
    googlePlacesApiKeyEncrypted,
    ...settingsWithoutGooglePlacesApiKey
  } = settings;

  return {
    ...settingsWithoutGooglePlacesApiKey,
    bobgoBookingMode: normalizeBobgoBookingMode(settings.bobgoBookingMode),
    bobgoMode: settings.bobgoMode === "live" ? "live" : "sandbox",
    contactEmail: settings.contactEmail ?? defaultSettings.contactEmail,
    contactPhonePrimary:
      settings.contactPhonePrimary ?? defaultSettings.contactPhonePrimary,
    contactPhoneSecondary:
      settings.contactPhoneSecondary ?? defaultSettings.contactPhoneSecondary,
    footerTagline: settings.footerTagline ?? defaultSettings.footerTagline,
    hasBobgoApiKey: Boolean(
      settings.bobgoApiKeyEncrypted ?? settings.bobgoSandboxApiKeyEncrypted,
    ),
    hasBobgoWebhookSecret: Boolean(
      settings.bobgoWebhookSecretEncrypted ??
        settings.bobgoSandboxWebhookSecretEncrypted,
    ),
    hasBobgoLiveApiKey: Boolean(settings.bobgoLiveApiKeyEncrypted),
    hasBobgoLiveWebhookSecret: Boolean(
      settings.bobgoLiveWebhookSecretEncrypted,
    ),
    hasBobgoSandboxApiKey: Boolean(
      settings.bobgoSandboxApiKeyEncrypted ?? settings.bobgoApiKeyEncrypted,
    ),
    hasBobgoSandboxWebhookSecret: Boolean(
      settings.bobgoSandboxWebhookSecretEncrypted ??
        settings.bobgoWebhookSecretEncrypted,
    ),
    courierGuyDefaultServiceCode:
      settings.courierGuyDefaultServiceCode?.trim() || null,
    courierGuyDropoffPickupPointId:
      settings.courierGuyDropoffPickupPointId?.trim() || null,
    courierGuyDropoffPickupPointLabel:
      settings.courierGuyDropoffPickupPointLabel?.trim() || null,
    courierGuyDropoffProvider:
      settings.courierGuyDropoffProvider?.trim() || "tcg-locker",
    courierGuyDropoffType:
      settings.courierGuyDropoffType === "generic_locker" ||
      settings.courierGuyDropoffType === "specific_pickup_point"
        ? settings.courierGuyDropoffType
        : "generic_kiosk",
    courierGuyEnabled: settings.courierGuyEnabled ?? false,
    courierGuyLiveAccountCode:
      settings.courierGuyLiveAccountCode?.trim() || null,
    courierGuyMode:
      settings.courierGuyMode === "live" ? "live" : "sandbox",
    courierGuySandboxAccountCode:
      settings.courierGuySandboxAccountCode?.trim() || null,
    courierGuyWebhookUrl: new URL(
      "/api/webhooks/courier-guy",
      env.APP_URL,
    ).toString(),
    hasCourierGuyLiveApiKey: Boolean(
      settings.courierGuyLiveApiKeyEncrypted,
    ),
    hasCourierGuySandboxApiKey: Boolean(
      settings.courierGuySandboxApiKeyEncrypted,
    ),
    hasCourierGuyWebhookToken: Boolean(
      settings.courierGuyWebhookTokenEncrypted,
    ),
    hasGooglePlacesApiKey: Boolean(
      decryptOptionalSecret(googlePlacesApiKeyEncrypted),
    ),
    shippingFlatRate: Math.max(0, Number(settings.shippingFlatRate) || 0),
    shippingFreeOverAmount:
      settings.shippingFreeOverAmount === null ||
      settings.shippingFreeOverAmount === undefined ||
      Number(settings.shippingFreeOverAmount) <= 0
        ? null
        : Number(settings.shippingFreeOverAmount),
    returnsAcceptance: normalizeReturnAcceptance(settings.returnsAcceptance),
    returnsCountryCodes: normalizeReturnCountryCodes(
      settings.returnsCountryCodes,
    ),
    returnsCurrencyCode:
      typeof settings.returnsCurrencyCode === "string" &&
      /^[A-Z]{3}$/.test(settings.returnsCurrencyCode.trim().toUpperCase())
        ? settings.returnsCurrencyCode.trim().toUpperCase()
        : "ZAR",
    returnsExchangesEnabled: settings.returnsExchangesEnabled ?? true,
    returnsHazardousGoodsNoteEnabled:
      settings.returnsHazardousGoodsNoteEnabled ?? true,
    returnsLabelResponsibility: normalizeReturnLabelResponsibility(
      settings.returnsLabelResponsibility,
    ),
    returnsMethodCodes: normalizeReturnMethodCodes(
      settings.returnsMethodCodes,
    ),
    returnsPolicyUrl: normalizeReturnPolicyUrl(settings.returnsPolicyUrl),
    returnsProductCondition: normalizeReturnProductCondition(
      settings.returnsProductCondition,
    ),
    returnsRefundProcessingDays: Math.min(
      60,
      Math.max(
        0,
        normalizeWholeNumber(settings.returnsRefundProcessingDays, 7),
      ),
    ),
    returnsRestockingFeeAmount:
      settings.returnsRestockingFeeAmount === null ||
      settings.returnsRestockingFeeAmount === undefined
        ? null
        : Math.max(0, Number(settings.returnsRestockingFeeAmount) || 0),
    returnsRestockingFeePercent:
      settings.returnsRestockingFeePercent === null ||
      settings.returnsRestockingFeePercent === undefined
        ? null
        : Math.min(
            100,
            Math.max(0, Number(settings.returnsRestockingFeePercent) || 0),
          ),
    returnsRestockingFeeType: normalizeReturnRestockingFeeType(
      settings.returnsRestockingFeeType,
    ),
    returnsWindowDays: Math.min(
      365,
      Math.max(1, normalizeWholeNumber(settings.returnsWindowDays, 7)),
    ),
    hasOpenAiApiKey: Boolean(
      settings.openAiApiKeyEncrypted ?? env.OPENAI_API_KEY,
    ),
    openAiEnabled: settings.openAiEnabled ?? true,
    openAiModel: settings.openAiModel || env.OPENAI_MODEL,
    openAiReasoningEffort: normalizeOpenAiReasoningEffort(
      settings.openAiReasoningEffort,
    ),
    payfastMode: settings.payfastMode === "live" ? "live" : "sandbox",
    paymentMethodBadges,
    hasPayfastLiveMerchantKey: Boolean(
      settings.payfastLiveMerchantKeyEncrypted,
    ),
    hasPayfastLivePassphrase: Boolean(settings.payfastLivePassphraseEncrypted),
    hasPayfastSandboxMerchantKey: Boolean(
      settings.payfastSandboxMerchantKeyEncrypted,
    ),
    hasPayfastSandboxPassphrase: Boolean(
      settings.payfastSandboxPassphraseEncrypted,
    ),
    stripeMode: settings.stripeMode === "live" ? "live" : "sandbox",
    hasStripeLiveSecretKey: Boolean(settings.stripeLiveSecretKeyEncrypted),
    hasStripeLiveWebhookSecret: Boolean(
      settings.stripeLiveWebhookSecretEncrypted,
    ),
    hasStripeSandboxSecretKey: Boolean(
      settings.stripeSandboxSecretKeyEncrypted,
    ),
    hasStripeSandboxWebhookSecret: Boolean(
      settings.stripeSandboxWebhookSecretEncrypted,
    ),
    hasWhatsappApiKey: Boolean(
      settings.whatsappApiKeyEncrypted ?? env.DIALOGUE_API_KEY,
    ),
    hasWhatsappWebhookSigningSecret: Boolean(
      settings.whatsappWebhookSigningSecretEncrypted ??
        env.WHATSAPP_WEBHOOK_SIGNING_SECRET,
    ),
    hasWhatsappWebhookVerifyToken: Boolean(
      settings.whatsappWebhookVerifyTokenEncrypted ??
        env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    ),
    whatsappBusinessPhoneNumber:
      settings.whatsappBusinessPhoneNumber ??
      env.WHATSAPP_ORDERING_PHONE_NUMBER ??
      null,
    whatsappEmailNotificationRecipients:
      parseWhatsappEmailNotificationRecipients(
        settings.whatsappEmailNotificationRecipients,
      ),
    whatsappEmailNotificationsEnabled:
      settings.whatsappEmailNotificationsEnabled ?? false,
    whatsappEmailNotifyInboundMessage:
      settings.whatsappEmailNotifyInboundMessage ?? true,
    whatsappEmailNotifyNewConversation:
      settings.whatsappEmailNotifyNewConversation ?? true,
    whatsappOrderNotificationRecipients:
      parseWhatsappOrderNotificationRecipients(
        settings.whatsappOrderNotificationRecipients,
      ),
    whatsappOrderNotificationsEnabled:
      settings.whatsappOrderNotificationsEnabled ?? false,
    whatsappFollowUpDefaultMessage:
      settings.whatsappFollowUpDefaultMessage ??
      defaultWhatsappFollowUpMessages.default,
    whatsappFollowUpDelayMinutes: Math.max(
      1,
      settings.whatsappFollowUpDelayMinutes ?? 30,
    ),
    whatsappFollowUpDraftMessage:
      settings.whatsappFollowUpDraftMessage ??
      defaultWhatsappFollowUpMessages.draft,
    whatsappFollowUpMaxCount: Math.max(1, settings.whatsappFollowUpMaxCount ?? 1),
    whatsappFollowUpQuietHoursEnabled:
      settings.whatsappFollowUpQuietHoursEnabled ?? false,
    whatsappFollowUpQuietHoursEnd:
      settings.whatsappFollowUpQuietHoursEnd ?? null,
    whatsappFollowUpQuietHoursStart:
      settings.whatsappFollowUpQuietHoursStart ?? null,
    whatsappFollowUpSupportMessage:
      settings.whatsappFollowUpSupportMessage ??
      defaultWhatsappFollowUpMessages.support,
    whatsappFollowUpsEnabled: settings.whatsappFollowUpsEnabled ?? true,
    whatsappMessageUrl:
      settings.whatsappMessageUrl ??
      env.DIALOGUE_MESSAGE_URL ??
      defaultWhatsappMessageUrl,
    whatsappProvider: normalizeWhatsappProvider(settings.whatsappProvider),
    whatsappWebhookUrl: getWhatsappWebhookUrl(),
  };
};

export const getMarketplaceSettings = cache(readMarketplaceSettings);

export async function updateMarketplaceMediaSettings({
  freeStorageQuotaMb,
  imageCompressionQuality,
  maxImageWidth,
  maxUploadFileMb,
  maxVideoUploadFileMb,
  maxVideoWidth,
  videoCompressionCrf,
}: {
  freeStorageQuotaMb: number;
  imageCompressionQuality: number;
  maxImageWidth: number;
  maxUploadFileMb: number;
  maxVideoUploadFileMb: number;
  maxVideoWidth: number;
  videoCompressionCrf: number;
}) {
  await db
    .insert(marketplaceSettings)
    .values({
      id: 1,
      freeStorageQuotaMb,
      imageCompressionQuality,
      maxImageWidth,
      maxUploadFileMb,
      maxVideoUploadFileMb,
      maxVideoWidth,
      videoCompressionCrf,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: marketplaceSettings.id,
      set: {
        freeStorageQuotaMb,
        imageCompressionQuality,
        maxImageWidth,
        maxUploadFileMb,
        maxVideoUploadFileMb,
        maxVideoWidth,
        videoCompressionCrf,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "Media storage settings saved." };
}

export async function updateMarketplacePayFastSettings({
  liveMerchantId,
  liveMerchantKey,
  livePassphrase,
  mode,
  onsiteEnabled,
  sandboxMerchantId,
  sandboxMerchantKey,
  sandboxPassphrase,
  tokenizationEnabled,
}: {
  liveMerchantId?: string;
  liveMerchantKey?: string;
  livePassphrase?: string;
  mode: "live" | "sandbox";
  onsiteEnabled: boolean;
  sandboxMerchantId?: string;
  sandboxMerchantKey?: string;
  sandboxPassphrase?: string;
  tokenizationEnabled: boolean;
}) {
  const existing = await getRawMarketplaceSettings();
  const nextLiveMerchantKey =
    liveMerchantKey && liveMerchantKey.length > 0
      ? encryptSecret(liveMerchantKey)
      : existing?.payfastLiveMerchantKeyEncrypted;
  const nextLivePassphrase =
    livePassphrase && livePassphrase.length > 0
      ? encryptSecret(livePassphrase)
      : existing?.payfastLivePassphraseEncrypted;
  const nextSandboxMerchantKey =
    sandboxMerchantKey && sandboxMerchantKey.length > 0
      ? encryptSecret(sandboxMerchantKey)
      : existing?.payfastSandboxMerchantKeyEncrypted;
  const nextSandboxPassphrase =
    sandboxPassphrase && sandboxPassphrase.length > 0
      ? encryptSecret(sandboxPassphrase)
      : existing?.payfastSandboxPassphraseEncrypted;

  await db
    .insert(marketplaceSettings)
    .values({
      id: 1,
      payfastLiveMerchantId: liveMerchantId || null,
      payfastLiveMerchantKeyEncrypted: nextLiveMerchantKey ?? null,
      payfastLivePassphraseEncrypted: nextLivePassphrase ?? null,
      payfastMode: mode,
      payfastOnsiteEnabled: onsiteEnabled,
      payfastSandboxMerchantId: sandboxMerchantId || null,
      payfastSandboxMerchantKeyEncrypted: nextSandboxMerchantKey ?? null,
      payfastSandboxPassphraseEncrypted: nextSandboxPassphrase ?? null,
      payfastTokenizationEnabled: tokenizationEnabled,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: marketplaceSettings.id,
      set: {
        payfastLiveMerchantId: liveMerchantId || null,
        payfastLiveMerchantKeyEncrypted: nextLiveMerchantKey ?? null,
        payfastLivePassphraseEncrypted: nextLivePassphrase ?? null,
        payfastMode: mode,
        payfastOnsiteEnabled: onsiteEnabled,
        payfastSandboxMerchantId: sandboxMerchantId || null,
        payfastSandboxMerchantKeyEncrypted: nextSandboxMerchantKey ?? null,
        payfastSandboxPassphraseEncrypted: nextSandboxPassphrase ?? null,
        payfastTokenizationEnabled: tokenizationEnabled,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "PayFast payment settings saved." };
}

async function getCourierGuyCredentialChangeBlock(
  environments: Array<"live" | "sandbox">,
) {
  if (environments.length === 0) {
    return null;
  }

  const [blockingShipment] = await db
    .select({
      environment: shipments.providerEnvironment,
    })
    .from(shipments)
    .where(
      and(
        eq(shipments.provider, "courier_guy"),
        or(
          inArray(shipments.providerEnvironment, environments),
          and(
            eq(shipments.status, "booking"),
            isNull(shipments.providerEnvironment),
          ),
        ),
        notInArray(shipments.status, [
          "cancelled",
          "delivered",
          "returned",
          "undeliverable",
        ]),
      ),
    )
    .limit(1);

  if (!blockingShipment) {
    return null;
  }

  return blockingShipment.environment
    ? `The ${blockingShipment.environment} Courier Guy account code or bearer token cannot be changed while active ${blockingShipment.environment} shipments still need tracking, waybills, or cancellation. Complete or cancel those shipments first.`
    : "Courier Guy credentials cannot be changed while a booking is in progress. Wait for it to finish, then try again.";
}

export async function updateMarketplaceCourierGuyCredentials({
  actorUserId,
  courierGuyLiveAccountCode,
  courierGuyLiveApiKey,
  courierGuyMode,
  courierGuySandboxAccountCode,
  courierGuySandboxApiKey,
  courierGuyWebhookToken,
}: {
  actorUserId: string;
  courierGuyLiveAccountCode: string | null;
  courierGuyLiveApiKey?: string;
  courierGuyMode: "live" | "sandbox";
  courierGuySandboxAccountCode: string | null;
  courierGuySandboxApiKey?: string;
  courierGuyWebhookToken?: string;
}) {
  const normalizedLiveAccountCode =
    courierGuyLiveAccountCode?.trim() || null;
  const normalizedSandboxAccountCode =
    courierGuySandboxAccountCode?.trim() || null;

  if (
    [normalizedLiveAccountCode, normalizedSandboxAccountCode].some(
      (accountCode) => accountCode !== null && accountCode.length > 64,
    )
  ) {
    return {
      ok: false as const,
      message: "Courier Guy account codes must be 64 characters or less.",
    };
  }

  if (
    [courierGuyLiveApiKey, courierGuySandboxApiKey].some(
      (apiKey) => apiKey !== undefined && apiKey.length > 1_000,
    )
  ) {
    return {
      ok: false as const,
      message: "Courier Guy bearer tokens must be 1,000 characters or less.",
    };
  }

  if (
    courierGuyWebhookToken &&
    (courierGuyWebhookToken.trim().length < 24 ||
      courierGuyWebhookToken.trim().length > 1_000)
  ) {
    return {
      ok: false as const,
      message:
        "Courier Guy webhook tokens must be between 24 and 1,000 characters.",
    };
  }

  const existing = await getRawMarketplaceSettings();
  const existingLiveApiKey = decryptOptionalSecret(
    existing?.courierGuyLiveApiKeyEncrypted,
  );
  const existingSandboxApiKey = decryptOptionalSecret(
    existing?.courierGuySandboxApiKeyEncrypted,
  );
  const existingWebhookToken = decryptOptionalSecret(
    existing?.courierGuyWebhookTokenEncrypted,
  );
  const liveApiKeyChanged =
    courierGuyLiveApiKey !== undefined &&
    courierGuyLiveApiKey !== existingLiveApiKey;
  const sandboxApiKeyChanged =
    courierGuySandboxApiKey !== undefined &&
    courierGuySandboxApiKey !== existingSandboxApiKey;
  const webhookTokenChanged =
    courierGuyWebhookToken !== undefined &&
    courierGuyWebhookToken !== existingWebhookToken;
  const liveCredentialsChanged =
    normalizedLiveAccountCode !==
      (existing?.courierGuyLiveAccountCode?.trim() || null) ||
    liveApiKeyChanged;
  const sandboxCredentialsChanged =
    normalizedSandboxAccountCode !==
      (existing?.courierGuySandboxAccountCode?.trim() || null) ||
    sandboxApiKeyChanged;
  const changedEnvironments: Array<"live" | "sandbox"> = [];

  if (liveCredentialsChanged) {
    changedEnvironments.push("live");
  }

  if (sandboxCredentialsChanged) {
    changedEnvironments.push("sandbox");
  }

  const credentialChangeBlock =
    await getCourierGuyCredentialChangeBlock(changedEnvironments);

  if (credentialChangeBlock) {
    return {
      ok: false as const,
      message: credentialChangeBlock,
    };
  }

  const nextLiveApiKeyEncrypted = liveApiKeyChanged && courierGuyLiveApiKey
    ? encryptSecret(courierGuyLiveApiKey)
    : existing?.courierGuyLiveApiKeyEncrypted;
  const nextSandboxApiKeyEncrypted =
    sandboxApiKeyChanged && courierGuySandboxApiKey
    ? encryptSecret(courierGuySandboxApiKey)
    : existing?.courierGuySandboxApiKeyEncrypted;
  const nextWebhookTokenEncrypted =
    webhookTokenChanged && courierGuyWebhookToken
    ? encryptSecret(courierGuyWebhookToken)
    : existing?.courierGuyWebhookTokenEncrypted;
  const now = new Date();
  const values = {
    courierGuyLiveAccountCode: normalizedLiveAccountCode,
    courierGuyLiveApiKeyEncrypted: nextLiveApiKeyEncrypted ?? null,
    courierGuySandboxAccountCode: normalizedSandboxAccountCode,
    courierGuySandboxApiKeyEncrypted: nextSandboxApiKeyEncrypted ?? null,
    courierGuyWebhookTokenEncrypted: nextWebhookTokenEncrypted ?? null,
    updatedAt: now,
  };

  await db.transaction(async (tx) => {
    await tx
      .insert(marketplaceSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({
        target: marketplaceSettings.id,
        set: values,
      });

    await tx.insert(auditLogs).values({
      action: "marketplace.courier_guy_credentials.updated",
      actorUserId,
      entityType: "marketplace_settings",
      metadata: JSON.stringify({
        courierGuyLiveAccountCode: normalizedLiveAccountCode,
        credentialEditorMode: courierGuyMode,
        courierGuySandboxAccountCode: normalizedSandboxAccountCode,
        liveCredentialsChanged,
        sandboxCredentialsChanged,
        webhookTokenChanged,
      }),
    });
  });

  return {
    courierGuyCredentials: {
      hasLiveApiKey: Boolean(nextLiveApiKeyEncrypted),
      hasSandboxApiKey: Boolean(nextSandboxApiKeyEncrypted),
      hasWebhookToken: Boolean(nextWebhookTokenEncrypted),
    },
    ok: true as const,
    message: `Courier Guy credentials saved. ${courierGuyMode === "live" ? "Live" : "Sandbox"} pickup-point search is ready.`,
  };
}

export async function updateMarketplaceShippingSettings({
  actorUserId,
  courierGuyDefaultServiceCode,
  courierGuyDropoffPickupPointId,
  courierGuyDropoffPickupPointLabel,
  courierGuyDropoffProvider,
  courierGuyDropoffType,
  courierGuyEnabled,
  courierGuyLiveAccountCode,
  courierGuyLiveApiKey,
  courierGuyMode,
  courierGuySandboxAccountCode,
  courierGuySandboxApiKey,
  courierGuyWebhookToken,
  jurgensDeliveryCutoffTime,
  shippingEnabled,
  shippingFlatRate,
  shippingFreeOverAmount,
  shippingHandlingMaxBusinessDays,
  shippingHandlingMinBusinessDays,
  shippingTransitMaxBusinessDays,
  shippingTransitMinBusinessDays,
}: {
  actorUserId: string;
  courierGuyDefaultServiceCode?: string;
  courierGuyDropoffPickupPointId?: string;
  courierGuyDropoffPickupPointLabel?: string;
  courierGuyDropoffProvider: string;
  courierGuyDropoffType:
    | "generic_kiosk"
    | "generic_locker"
    | "specific_pickup_point";
  courierGuyEnabled: boolean;
  courierGuyLiveAccountCode: string | null;
  courierGuyLiveApiKey?: string;
  courierGuyMode: "live" | "sandbox";
  courierGuySandboxAccountCode: string | null;
  courierGuySandboxApiKey?: string;
  courierGuyWebhookToken?: string;
  jurgensDeliveryCutoffTime: string;
  shippingEnabled: boolean;
  shippingFlatRate: number;
  shippingFreeOverAmount: number | null;
  shippingHandlingMaxBusinessDays: number;
  shippingHandlingMinBusinessDays: number;
  shippingTransitMaxBusinessDays: number;
  shippingTransitMinBusinessDays: number;
}) {
  const normalizedDropoffProvider = courierGuyDropoffProvider.trim();
  const normalizedSubmittedPickupPointLabel =
    courierGuyDropoffPickupPointLabel?.replace(/\s+/g, " ").trim() || null;

  if (normalizedDropoffProvider !== "tcg-locker") {
    return {
      ok: false,
      message:
        "Courier Guy drop-off bookings must use the tcg-locker pickup-point provider.",
    };
  }

  if (
    normalizedSubmittedPickupPointLabel &&
    normalizedSubmittedPickupPointLabel.length > 500
  ) {
    return {
      ok: false,
      message: "Courier Guy pickup-point labels must be 500 characters or less.",
    };
  }

  if (
    courierGuyWebhookToken &&
    courierGuyWebhookToken.trim().length < 24
  ) {
    return {
      ok: false,
      message: "Courier Guy webhook tokens must be at least 24 characters.",
    };
  }

  if (
    !Number.isFinite(shippingFlatRate) ||
    shippingFlatRate < 0 ||
    shippingFlatRate > 1_000_000
  ) {
    return {
      ok: false,
      message: "Flat shipping must be between R0 and R1,000,000.",
    };
  }

  if (
    !Number.isInteger(shippingHandlingMinBusinessDays) ||
    !Number.isInteger(shippingHandlingMaxBusinessDays) ||
    shippingHandlingMinBusinessDays < 0 ||
    shippingHandlingMaxBusinessDays > 30 ||
    shippingHandlingMinBusinessDays > shippingHandlingMaxBusinessDays
  ) {
    return {
      ok: false,
      message:
        "Handling time must use whole business days from 0 to 30, with the minimum no greater than the maximum.",
    };
  }

  if (
    !Number.isInteger(shippingTransitMinBusinessDays) ||
    !Number.isInteger(shippingTransitMaxBusinessDays) ||
    shippingTransitMinBusinessDays < 0 ||
    shippingTransitMaxBusinessDays > 60 ||
    shippingTransitMinBusinessDays > shippingTransitMaxBusinessDays
  ) {
    return {
      ok: false,
      message:
        "Transit time must use whole business days from 0 to 60, with the minimum no greater than the maximum.",
    };
  }

  let normalizedFreeShippingAmount: number | null = null;

  try {
    normalizedFreeShippingAmount = normalizeFreeShippingThreshold(
      shippingFreeOverAmount,
    );
  } catch {
    return {
      ok: false,
      message:
        "The free-shipping threshold must round to at least R0.01.",
    };
  }

  if (
    normalizedFreeShippingAmount !== null &&
    normalizedFreeShippingAmount > 1_000_000
  ) {
    return {
      ok: false,
      message:
        "The free-shipping threshold must be no more than R1,000,000.",
    };
  }

  const normalizedLiveAccountCode =
    courierGuyLiveAccountCode?.trim() || null;
  const normalizedSandboxAccountCode =
    courierGuySandboxAccountCode?.trim() || null;

  if (
    [normalizedLiveAccountCode, normalizedSandboxAccountCode].some(
      (accountCode) => accountCode !== null && accountCode.length > 64,
    )
  ) {
    return {
      ok: false,
      message: "Courier Guy account codes must be 64 characters or less.",
    };
  }

  const existing = await getRawMarketplaceSettings();
  const existingLiveApiKey = decryptOptionalSecret(
    existing?.courierGuyLiveApiKeyEncrypted,
  );
  const existingSandboxApiKey = decryptOptionalSecret(
    existing?.courierGuySandboxApiKeyEncrypted,
  );
  const existingWebhookToken = decryptOptionalSecret(
    existing?.courierGuyWebhookTokenEncrypted,
  );
  const protectedCredentialEnvironments: Array<"live" | "sandbox"> = [];
  const liveApiKeyChanged =
    courierGuyLiveApiKey !== undefined &&
    courierGuyLiveApiKey !== existingLiveApiKey;
  const sandboxApiKeyChanged =
    courierGuySandboxApiKey !== undefined &&
    courierGuySandboxApiKey !== existingSandboxApiKey;
  const webhookTokenChanged =
    courierGuyWebhookToken !== undefined &&
    courierGuyWebhookToken !== existingWebhookToken;
  const liveCredentialsChanged =
    normalizedLiveAccountCode !==
      (existing?.courierGuyLiveAccountCode?.trim() || null) ||
    liveApiKeyChanged;
  const sandboxCredentialsChanged =
    normalizedSandboxAccountCode !==
      (existing?.courierGuySandboxAccountCode?.trim() || null) ||
    sandboxApiKeyChanged;
  const activeCredentialsChanged =
    courierGuyMode === "live"
      ? liveCredentialsChanged
      : sandboxCredentialsChanged;

  if (liveCredentialsChanged) {
    protectedCredentialEnvironments.push("live");
  }

  if (sandboxCredentialsChanged) {
    protectedCredentialEnvironments.push("sandbox");
  }

  const credentialChangeBlock = await getCourierGuyCredentialChangeBlock(
    protectedCredentialEnvironments,
  );

  if (credentialChangeBlock) {
    return {
      ok: false,
      message: credentialChangeBlock,
    };
  }

  const nextLiveApiKeyPlain = courierGuyLiveApiKey ?? existingLiveApiKey;
  const nextSandboxApiKeyPlain =
    courierGuySandboxApiKey ?? existingSandboxApiKey;
  const nextLiveApiKeyEncrypted = liveApiKeyChanged && courierGuyLiveApiKey
    ? encryptSecret(courierGuyLiveApiKey)
    : existing?.courierGuyLiveApiKeyEncrypted;
  const nextSandboxApiKeyEncrypted =
    sandboxApiKeyChanged && courierGuySandboxApiKey
    ? encryptSecret(courierGuySandboxApiKey)
    : existing?.courierGuySandboxApiKeyEncrypted;
  const nextWebhookToken = webhookTokenChanged && courierGuyWebhookToken
    ? encryptSecret(courierGuyWebhookToken)
    : existing?.courierGuyWebhookTokenEncrypted;
  const activeApiKey =
    courierGuyMode === "live"
      ? nextLiveApiKeyPlain
      : nextSandboxApiKeyPlain;
  const activeAccountCode =
    courierGuyMode === "live"
      ? normalizedLiveAccountCode
      : normalizedSandboxAccountCode;
  const resolvedPickupPointId =
    courierGuyDropoffType === "generic_kiosk"
      ? "K0000"
      : courierGuyDropoffType === "generic_locker"
        ? "CG0000"
        : courierGuyDropoffPickupPointId?.trim() || null;
  let resolvedPickupPointLabel: string | null = null;

  if (
    courierGuyDropoffType === "specific_pickup_point" &&
    resolvedPickupPointId
  ) {
    const existingPickupPointId =
      existing?.courierGuyDropoffPickupPointId?.trim() || null;
    const existingPickupPointProvider =
      existing?.courierGuyDropoffProvider?.trim() || "tcg-locker";
    const existingPickupPointLabel =
      existing?.courierGuyDropoffPickupPointLabel?.trim() || null;
    const existingMode =
      existing?.courierGuyMode === "live" ? "live" : "sandbox";
    const pickupPointChanged =
      resolvedPickupPointId !== existingPickupPointId ||
      normalizedDropoffProvider !== existingPickupPointProvider ||
      courierGuyMode !== existingMode ||
      !existingPickupPointLabel ||
      activeCredentialsChanged ||
      (courierGuyEnabled && existing?.courierGuyEnabled !== true);

    if (pickupPointChanged) {
      if (!activeApiKey) {
        return {
          ok: false,
          message: `Save the ${courierGuyMode} Courier Guy bearer token before choosing a specific pickup point.`,
        };
      }

      try {
        const client = createCourierGuyClient({
          apiBaseUrl:
            courierGuyMode === "live"
              ? COURIER_GUY_LIVE_API_BASE_URL
              : COURIER_GUY_SANDBOX_API_BASE_URL,
          apiKey: activeApiKey,
        });
        const result = await client.getPickupPoints({
          limit: 5,
          pickupPointId: resolvedPickupPointId,
          pickupPointProvider: normalizedDropoffProvider,
        });
        const verifiedPickupPoint = result.pickupPoints.find(
          (pickupPoint) =>
            pickupPoint.pickupPointId === resolvedPickupPointId &&
            pickupPoint.pickupPointProvider === normalizedDropoffProvider,
        );

        if (!verifiedPickupPoint) {
          return {
            ok: false,
            message:
              "That Courier Guy pickup point is unavailable. Search for and choose another point.",
          };
        }

        resolvedPickupPointLabel = [
          verifiedPickupPoint.name,
          verifiedPickupPoint.address,
        ]
          .filter(Boolean)
          .join(" — ")
          .slice(0, 500);
      } catch {
        return {
          ok: false,
          message:
            "Courier Guy could not verify that pickup point. Try searching again before saving.",
        };
      }
    } else {
      resolvedPickupPointLabel =
        existingPickupPointLabel ??
        normalizedSubmittedPickupPointLabel ??
        resolvedPickupPointId;
    }
  }

  if (courierGuyEnabled && !activeApiKey) {
    return {
      ok: false,
      message: `Add the ${courierGuyMode} Courier Guy API key before enabling the integration.`,
    };
  }

  if (courierGuyEnabled && !activeAccountCode) {
    return {
      ok: false,
      message: `Add the ${courierGuyMode} Courier Guy account code before enabling the integration.`,
    };
  }

  if (courierGuyEnabled && !resolvedPickupPointId) {
    return {
      ok: false,
      message: "Choose or enter the Courier Guy drop-off pickup point.",
    };
  }

  const now = new Date();
  const values = {
    bobgoBookingMode: "disabled" as const,
    bobgoEnabled: false,
    courierGuyDefaultServiceCode:
      courierGuyDefaultServiceCode?.trim() || null,
    courierGuyDropoffPickupPointId: resolvedPickupPointId,
    courierGuyDropoffPickupPointLabel: resolvedPickupPointLabel,
    courierGuyDropoffProvider: normalizedDropoffProvider,
    courierGuyDropoffType,
    courierGuyEnabled,
    courierGuyLiveAccountCode: normalizedLiveAccountCode,
    courierGuyLiveApiKeyEncrypted: nextLiveApiKeyEncrypted ?? null,
    courierGuyMode,
    courierGuySandboxAccountCode: normalizedSandboxAccountCode,
    courierGuySandboxApiKeyEncrypted: nextSandboxApiKeyEncrypted ?? null,
    courierGuyWebhookTokenEncrypted: nextWebhookToken ?? null,
    jurgensDeliveryCutoffTime,
    shippingBufferBps: 0,
    shippingEnabled,
    shippingFlatRate: Number(shippingFlatRate.toFixed(2)),
    shippingFreeOverAmount: normalizedFreeShippingAmount,
    shippingHandlingMaxBusinessDays,
    shippingHandlingMinBusinessDays,
    shippingMarginBps: 0,
    shippingTransitMaxBusinessDays,
    shippingTransitMinBusinessDays,
    updatedAt: now,
  };

  await db.transaction(async (tx) => {
    await tx
      .insert(marketplaceSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({
        target: marketplaceSettings.id,
        set: values,
      });

    await tx.insert(auditLogs).values({
      action: "marketplace.shipping_settings.updated",
      actorUserId,
      entityType: "marketplace_settings",
      metadata: JSON.stringify({
        courierGuyDropoffType,
        courierGuyEnabled,
        courierGuyLiveAccountCode: normalizedLiveAccountCode,
        courierGuyMode,
        courierGuySandboxAccountCode: normalizedSandboxAccountCode,
        freeShippingEnabled: shippingFreeOverAmount !== null,
        shippingEnabled,
        shippingHandlingMaxBusinessDays,
        shippingHandlingMinBusinessDays,
        shippingTransitMaxBusinessDays,
        shippingTransitMinBusinessDays,
      }),
    });
  });

  return {
    courierGuyCredentials: {
      hasLiveApiKey: Boolean(nextLiveApiKeyEncrypted),
      hasSandboxApiKey: Boolean(nextSandboxApiKeyEncrypted),
      hasWebhookToken: Boolean(nextWebhookToken),
    },
    ok: true,
    message: "Shipping settings saved.",
  };
}

export async function updateMarketplaceReturnsSettings({
  actorUserId,
  returnsAcceptance,
  returnsCountryCodes,
  returnsCurrencyCode,
  returnsExchangesEnabled,
  returnsHazardousGoodsNoteEnabled,
  returnsLabelResponsibility,
  returnsMethodCodes,
  returnsPolicyUrl,
  returnsProductCondition,
  returnsRefundProcessingDays,
  returnsRestockingFeeAmount,
  returnsRestockingFeePercent,
  returnsRestockingFeeType,
  returnsWindowDays,
}: {
  actorUserId: string;
  returnsAcceptance: MarketplaceReturnAcceptance;
  returnsCountryCodes: string[];
  returnsCurrencyCode: string;
  returnsExchangesEnabled: boolean;
  returnsHazardousGoodsNoteEnabled: boolean;
  returnsLabelResponsibility: MarketplaceReturnLabelResponsibility;
  returnsMethodCodes: MarketplaceReturnMethod[];
  returnsPolicyUrl: string;
  returnsProductCondition: MarketplaceReturnProductCondition;
  returnsRefundProcessingDays: number;
  returnsRestockingFeeAmount: number | null;
  returnsRestockingFeePercent: number | null;
  returnsRestockingFeeType: MarketplaceReturnRestockingFee;
  returnsWindowDays: number;
}) {
  const normalizedReturnsPolicyUrl = normalizeReturnPolicyUrl(returnsPolicyUrl);
  const normalizedCountryCodes = normalizeReturnCountryCodes(
    returnsCountryCodes,
  );
  const normalizedMethodCodes = normalizeReturnMethodCodes(returnsMethodCodes);
  const normalizedCurrencyCode = returnsCurrencyCode.trim().toUpperCase();
  const normalizedRestockingFeeAmount =
    returnsRestockingFeeType === "fixed"
      ? Math.max(0, Number(returnsRestockingFeeAmount) || 0)
      : null;
  const normalizedRestockingFeePercent =
    returnsRestockingFeeType === "percentage"
      ? Math.min(100, Math.max(0, Number(returnsRestockingFeePercent) || 0))
      : null;

  if (normalizedReturnsPolicyUrl !== returnsPolicyUrl.trim()) {
    return {
      ok: false as const,
      message: "Use a full https:// URL for the return policy.",
    };
  }

  if (!normalizedCountryCodes.includes("ZA")) {
    return {
      ok: false as const,
      message:
        "The marketplace return policy must include South Africa while the store ships to South Africa.",
    };
  }

  if (!/^[A-Z]{3}$/.test(normalizedCurrencyCode)) {
    return {
      ok: false as const,
      message: "Use a valid three-letter currency code, for example ZAR.",
    };
  }

  if (
    !Number.isInteger(returnsWindowDays) ||
    returnsWindowDays < 1 ||
    returnsWindowDays > 365
  ) {
    return {
      ok: false as const,
      message: "The return window must be between 1 and 365 days.",
    };
  }

  if (
    !Number.isInteger(returnsRefundProcessingDays) ||
    returnsRefundProcessingDays < 0 ||
    returnsRefundProcessingDays > 60
  ) {
    return {
      ok: false as const,
      message: "Refund processing time must be between 0 and 60 days.",
    };
  }

  const values = {
    returnsAcceptance,
    returnsCountryCodes: normalizedCountryCodes,
    returnsCurrencyCode: normalizedCurrencyCode,
    returnsExchangesEnabled,
    returnsHazardousGoodsNoteEnabled,
    returnsLabelResponsibility,
    returnsMethodCodes: normalizedMethodCodes,
    returnsPolicyUrl: normalizedReturnsPolicyUrl,
    returnsProductCondition,
    returnsRefundProcessingDays,
    returnsRestockingFeeAmount: normalizedRestockingFeeAmount,
    returnsRestockingFeePercent: normalizedRestockingFeePercent,
    returnsRestockingFeeType,
    returnsWindowDays,
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    await tx
      .insert(marketplaceSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({
        target: marketplaceSettings.id,
        set: values,
      });

    await tx.insert(auditLogs).values({
      action: "marketplace.returns_settings.updated",
      actorUserId,
      entityType: "marketplace_settings",
      metadata: JSON.stringify({
        returnsAcceptance,
        returnsCountryCodes: normalizedCountryCodes,
        returnsExchangesEnabled,
        returnsLabelResponsibility,
        returnsMethodCodes: normalizedMethodCodes,
        returnsProductCondition,
        returnsRefundProcessingDays,
        returnsRestockingFeeType,
        returnsWindowDays,
      }),
    });
  });

  return {
    ok: true as const,
    message: "Returns policy settings saved.",
  };
}

export async function updateMarketplaceWhatsappSettings({
  actorUserId,
  apiKey,
  businessPhoneNumber,
  emailNotificationRecipients,
  emailNotificationsEnabled,
  emailNotifyInboundMessage,
  emailNotifyNewConversation,
  enabled,
  followUpDefaultMessage,
  followUpDelayMinutes,
  followUpDraftMessage,
  followUpMaxCount,
  followUpQuietHoursEnabled,
  followUpQuietHoursEnd,
  followUpQuietHoursStart,
  followUpSupportMessage,
  followUpsEnabled,
  messageUrl,
  orderNotificationRecipients,
  orderNotificationsEnabled,
  provider,
  webhookSigningSecret,
  webhookVerifyToken,
}: {
  actorUserId: string;
  apiKey?: string;
  businessPhoneNumber?: string;
  emailNotificationRecipients: string[];
  emailNotificationsEnabled: boolean;
  emailNotifyInboundMessage: boolean;
  emailNotifyNewConversation: boolean;
  enabled: boolean;
  followUpDefaultMessage: string;
  followUpDelayMinutes: number;
  followUpDraftMessage: string;
  followUpMaxCount: number;
  followUpQuietHoursEnabled: boolean;
  followUpQuietHoursEnd: string | null;
  followUpQuietHoursStart: string | null;
  followUpSupportMessage: string;
  followUpsEnabled: boolean;
  messageUrl?: string;
  orderNotificationRecipients: string[];
  orderNotificationsEnabled: boolean;
  provider: "360dialog";
  webhookSigningSecret?: string;
  webhookVerifyToken?: string;
}) {
  const existing = await getRawMarketplaceSettings();
  const nextApiKey =
    apiKey && apiKey.length > 0
      ? encryptSecret(apiKey)
      : (existing?.whatsappApiKeyEncrypted ??
        (env.DIALOGUE_API_KEY ? encryptSecret(env.DIALOGUE_API_KEY) : null));
  const nextWebhookVerifyToken =
    webhookVerifyToken && webhookVerifyToken.length > 0
      ? encryptSecret(webhookVerifyToken)
      : (existing?.whatsappWebhookVerifyTokenEncrypted ??
        (env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
          ? encryptSecret(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)
          : null));
  const nextWebhookSigningSecret =
    webhookSigningSecret && webhookSigningSecret.length > 0
      ? encryptSecret(webhookSigningSecret)
      : (existing?.whatsappWebhookSigningSecretEncrypted ??
        (env.WHATSAPP_WEBHOOK_SIGNING_SECRET
          ? encryptSecret(env.WHATSAPP_WEBHOOK_SIGNING_SECRET)
          : null));

  if (enabled && !businessPhoneNumber) {
    return {
      ok: false,
      message: "Add the WhatsApp business phone number before enabling ordering.",
    };
  }

  if (enabled && !nextApiKey) {
    return {
      ok: false,
      message: "Add the 360dialog API key before enabling WhatsApp ordering.",
    };
  }

  const normalizedEmailNotificationRecipients =
    parseWhatsappEmailNotificationRecipients(emailNotificationRecipients);
  const normalizedOrderNotificationRecipients =
    parseWhatsappOrderNotificationRecipients(orderNotificationRecipients);

  if (
    emailNotificationsEnabled &&
    normalizedEmailNotificationRecipients.length === 0
  ) {
    return {
      ok: false,
      message:
        "Add at least one notification email address before enabling email alerts.",
    };
  }

  if (
    emailNotificationsEnabled &&
    !emailNotifyNewConversation &&
    !emailNotifyInboundMessage
  ) {
    return {
      ok: false,
      message: "Choose at least one WhatsApp email alert type.",
    };
  }

  if (
    orderNotificationsEnabled &&
    normalizedOrderNotificationRecipients.length === 0
  ) {
    return {
      ok: false,
      message:
        "Add at least one internal WhatsApp phone number before enabling paid-order WhatsApp alerts.",
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(marketplaceSettings)
      .values({
        id: 1,
        whatsappApiKeyEncrypted: nextApiKey,
        whatsappBusinessPhoneNumber: businessPhoneNumber || null,
        whatsappEmailNotificationRecipients:
          normalizedEmailNotificationRecipients,
        whatsappEmailNotificationsEnabled: emailNotificationsEnabled,
        whatsappEmailNotifyInboundMessage: emailNotifyInboundMessage,
        whatsappEmailNotifyNewConversation: emailNotifyNewConversation,
        whatsappFollowUpDefaultMessage: followUpDefaultMessage,
        whatsappFollowUpDelayMinutes: followUpDelayMinutes,
        whatsappFollowUpDraftMessage: followUpDraftMessage,
        whatsappFollowUpMaxCount: followUpMaxCount,
        whatsappFollowUpQuietHoursEnabled: followUpQuietHoursEnabled,
        whatsappFollowUpQuietHoursEnd: followUpQuietHoursEnabled
          ? followUpQuietHoursEnd
          : null,
        whatsappFollowUpQuietHoursStart: followUpQuietHoursEnabled
          ? followUpQuietHoursStart
          : null,
        whatsappFollowUpSupportMessage: followUpSupportMessage,
        whatsappFollowUpsEnabled: followUpsEnabled,
        whatsappMessageUrl: messageUrl || defaultWhatsappMessageUrl,
        whatsappOrderNotificationRecipients:
          normalizedOrderNotificationRecipients,
        whatsappOrderNotificationsEnabled: orderNotificationsEnabled,
        whatsappOrderingEnabled: enabled,
        whatsappProvider: provider,
        whatsappWebhookSigningSecretEncrypted: nextWebhookSigningSecret,
        whatsappWebhookVerifyTokenEncrypted: nextWebhookVerifyToken,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: marketplaceSettings.id,
        set: {
          whatsappApiKeyEncrypted: nextApiKey,
          whatsappBusinessPhoneNumber: businessPhoneNumber || null,
          whatsappEmailNotificationRecipients:
            normalizedEmailNotificationRecipients,
          whatsappEmailNotificationsEnabled: emailNotificationsEnabled,
          whatsappEmailNotifyInboundMessage: emailNotifyInboundMessage,
          whatsappEmailNotifyNewConversation: emailNotifyNewConversation,
          whatsappFollowUpDefaultMessage: followUpDefaultMessage,
          whatsappFollowUpDelayMinutes: followUpDelayMinutes,
          whatsappFollowUpDraftMessage: followUpDraftMessage,
          whatsappFollowUpMaxCount: followUpMaxCount,
          whatsappFollowUpQuietHoursEnabled: followUpQuietHoursEnabled,
          whatsappFollowUpQuietHoursEnd: followUpQuietHoursEnabled
            ? followUpQuietHoursEnd
            : null,
          whatsappFollowUpQuietHoursStart: followUpQuietHoursEnabled
            ? followUpQuietHoursStart
            : null,
          whatsappFollowUpSupportMessage: followUpSupportMessage,
          whatsappFollowUpsEnabled: followUpsEnabled,
          whatsappMessageUrl: messageUrl || defaultWhatsappMessageUrl,
          whatsappOrderNotificationRecipients:
            normalizedOrderNotificationRecipients,
          whatsappOrderNotificationsEnabled: orderNotificationsEnabled,
          whatsappOrderingEnabled: enabled,
          whatsappProvider: provider,
          whatsappWebhookSigningSecretEncrypted: nextWebhookSigningSecret,
          whatsappWebhookVerifyTokenEncrypted: nextWebhookVerifyToken,
          updatedAt: new Date(),
        },
      });

    await tx.insert(auditLogs).values({
      action: "marketplace.whatsapp_settings.updated",
      actorUserId,
      entityType: "marketplace_settings",
      metadata: JSON.stringify({
        emailNotificationsEnabled,
        emailNotifyInboundMessage,
        emailNotifyNewConversation,
        followUpsEnabled,
        orderNotificationRecipientCount:
          normalizedOrderNotificationRecipients.length,
        orderNotificationsEnabled,
        orderingEnabled: enabled,
        recipientCount: normalizedEmailNotificationRecipients.length,
      }),
    });
  });

  return { ok: true, message: "WhatsApp settings saved." };
}

export async function getWhatsappEmailNotificationSettings(): Promise<{
  enabled: boolean;
  notifyInboundMessage: boolean;
  notifyNewConversation: boolean;
  recipients: string[];
}> {
  const settings = await getMarketplaceSettings();

  return {
    enabled: settings.whatsappEmailNotificationsEnabled,
    notifyInboundMessage: settings.whatsappEmailNotifyInboundMessage,
    notifyNewConversation: settings.whatsappEmailNotifyNewConversation,
    recipients: settings.whatsappEmailNotificationRecipients,
  };
}

export async function getWhatsappOrderNotificationSettings(): Promise<{
  enabled: boolean;
  recipients: string[];
}> {
  const settings = await getMarketplaceSettings();

  return {
    enabled: settings.whatsappOrderNotificationsEnabled,
    recipients: settings.whatsappOrderNotificationRecipients,
  };
}

export async function getWhatsappFollowUpSettings(): Promise<WhatsappFollowUpSettings> {
  const settings = await getMarketplaceSettings();

  return {
    whatsappFollowUpDefaultMessage: settings.whatsappFollowUpDefaultMessage,
    whatsappFollowUpDelayMinutes: settings.whatsappFollowUpDelayMinutes,
    whatsappFollowUpDraftMessage: settings.whatsappFollowUpDraftMessage,
    whatsappFollowUpMaxCount: settings.whatsappFollowUpMaxCount,
    whatsappFollowUpQuietHoursEnabled:
      settings.whatsappFollowUpQuietHoursEnabled,
    whatsappFollowUpQuietHoursEnd: settings.whatsappFollowUpQuietHoursEnd,
    whatsappFollowUpQuietHoursStart: settings.whatsappFollowUpQuietHoursStart,
    whatsappFollowUpSupportMessage: settings.whatsappFollowUpSupportMessage,
    whatsappFollowUpsEnabled: settings.whatsappFollowUpsEnabled,
  };
}

export async function getBobGoWebhookSecret() {
  const [settings, rawSettings] = await Promise.all([
    getMarketplaceSettings(),
    getRawMarketplaceSettings(),
  ]);
  const encryptedSecret =
    settings.bobgoMode === "live"
      ? (rawSettings?.bobgoLiveWebhookSecretEncrypted ??
        rawSettings?.bobgoWebhookSecretEncrypted)
      : (rawSettings?.bobgoSandboxWebhookSecretEncrypted ??
        rawSettings?.bobgoWebhookSecretEncrypted);

  return encryptedSecret ? decryptSecret(encryptedSecret) : null;
}

export async function getBobGoIntegrationConfig() {
  const rawSettings = await getRawMarketplaceSettings();
  const settings = await getMarketplaceSettings();
  const encryptedApiKey =
    settings.bobgoMode === "live"
      ? (rawSettings?.bobgoLiveApiKeyEncrypted ??
        rawSettings?.bobgoApiKeyEncrypted)
      : (rawSettings?.bobgoSandboxApiKeyEncrypted ??
        rawSettings?.bobgoApiKeyEncrypted);
  const apiKey = encryptedApiKey ? decryptSecret(encryptedApiKey) : null;

  return {
    apiBaseUrl:
      settings.bobgoMode === "sandbox"
        ? "https://api.sandbox.bobgo.co.za"
        : "https://api.bobgo.co.za",
    apiKey,
    bookingMode: settings.bobgoBookingMode,
    bobgoEnabled: settings.bobgoEnabled,
    mode: settings.bobgoMode,
    shippingBufferBps: settings.shippingBufferBps,
    shippingEnabled: settings.shippingEnabled,
    shippingMarginBps: settings.shippingMarginBps,
  };
}

export async function getCourierGuyWebhookToken() {
  const rawSettings = await getRawMarketplaceSettings();

  return decryptOptionalSecret(rawSettings?.courierGuyWebhookTokenEncrypted);
}

export async function getCourierGuyPickupPointLookupConfig(
  mode: "live" | "sandbox",
) {
  const rawSettings = await getRawMarketplaceSettings();
  const encryptedApiKey =
    mode === "live"
      ? rawSettings?.courierGuyLiveApiKeyEncrypted
      : rawSettings?.courierGuySandboxApiKeyEncrypted;

  return {
    apiBaseUrl:
      mode === "live"
        ? COURIER_GUY_LIVE_API_BASE_URL
        : COURIER_GUY_SANDBOX_API_BASE_URL,
    apiKey: decryptOptionalSecret(encryptedApiKey),
    mode,
  };
}

type CourierGuyOperationalConfigInput = {
  accountCode: string | null;
  mode: "live" | "sandbox" | null;
};

async function resolveCourierGuyIntegrationConfig(
  shipmentIdentity: CourierGuyOperationalConfigInput | null,
  requireEnabledDropoff: boolean,
) {
  const [rawSettings, settings] = await Promise.all([
    getRawMarketplaceSettings(),
    getMarketplaceSettings(),
  ]);
  const mode = shipmentIdentity?.mode ?? settings.courierGuyMode;
  const encryptedApiKey =
    mode === "live"
      ? rawSettings?.courierGuyLiveApiKeyEncrypted
      : rawSettings?.courierGuySandboxApiKeyEncrypted;
  const apiKey = decryptOptionalSecret(encryptedApiKey);
  const configuredAccountCode =
    mode === "live"
      ? settings.courierGuyLiveAccountCode?.trim() || null
      : settings.courierGuySandboxAccountCode?.trim() || null;
  const hasCredentials =
    hasCourierGuyCredentialsForIdentity({
      configuredAccountCode,
      hasApiKey: Boolean(apiKey),
      ...(shipmentIdentity
        ? { shipmentIdentity }
        : {}),
    });

  return {
    accountCode: configuredAccountCode,
    apiBaseUrl:
      mode === "live"
        ? COURIER_GUY_LIVE_API_BASE_URL
        : COURIER_GUY_SANDBOX_API_BASE_URL,
    apiKey,
    defaultServiceCode: settings.courierGuyDefaultServiceCode,
    dropoffPickupPointId: settings.courierGuyDropoffPickupPointId,
    dropoffProvider: settings.courierGuyDropoffProvider,
    dropoffType: settings.courierGuyDropoffType,
    enabled: settings.courierGuyEnabled,
    hasCredentials,
    isConfigured: Boolean(
      hasCredentials &&
        (!requireEnabledDropoff ||
          (settings.courierGuyEnabled &&
            settings.courierGuyDropoffPickupPointId)),
    ),
    mode,
  };
}

export async function getCourierGuyIntegrationConfig() {
  return resolveCourierGuyIntegrationConfig(null, true);
}

export async function getCourierGuyOperationalConfig(
  input: CourierGuyOperationalConfigInput,
) {
  return resolveCourierGuyIntegrationConfig(input, false);
}

export async function getPayFastIntegrationConfig() {
  const [rawSettings, settings] = await Promise.all([
    getRawMarketplaceSettings(),
    getMarketplaceSettings(),
  ]);
  const encryptedMerchantKey =
    settings.payfastMode === "live"
      ? rawSettings?.payfastLiveMerchantKeyEncrypted
      : rawSettings?.payfastSandboxMerchantKeyEncrypted;
  const encryptedPassphrase =
    settings.payfastMode === "live"
      ? rawSettings?.payfastLivePassphraseEncrypted
      : rawSettings?.payfastSandboxPassphraseEncrypted;
  const merchantId =
    settings.payfastMode === "live"
      ? settings.payfastLiveMerchantId
      : settings.payfastSandboxMerchantId;
  const merchantKey = encryptedMerchantKey
    ? decryptSecret(encryptedMerchantKey)
    : null;
  const passphrase = encryptedPassphrase
    ? decryptSecret(encryptedPassphrase)
    : null;

  return {
    isConfigured: Boolean(merchantId && merchantKey),
    merchantId,
    merchantKey,
    mode: settings.payfastMode,
    onsiteEnabled: settings.payfastOnsiteEnabled,
    passphrase,
    processUrl:
      settings.payfastMode === "live"
        ? "https://www.payfast.co.za/eng/process"
        : "https://sandbox.payfast.co.za/eng/process",
    tokenizationEnabled: settings.payfastTokenizationEnabled,
    validationUrl:
      settings.payfastMode === "live"
        ? "https://www.payfast.co.za/eng/query/validate"
        : "https://sandbox.payfast.co.za/eng/query/validate",
  };
}

export async function getOpenAiIntegrationConfig() {
  const [rawSettings, settings] = await Promise.all([
    getRawMarketplaceSettings(),
    getMarketplaceSettings(),
  ]);
  const apiKey = rawSettings?.openAiApiKeyEncrypted
    ? decryptOptionalSecret(rawSettings.openAiApiKeyEncrypted)
    : (env.OPENAI_API_KEY ?? null);

  return {
    apiKey,
    enabled: settings.openAiEnabled,
    isConfigured: Boolean(settings.openAiEnabled && apiKey),
    model: settings.openAiModel || env.OPENAI_MODEL,
    reasoningEffort: settings.openAiReasoningEffort,
  };
}

export async function getWhatsappIntegrationConfig() {
  const [rawSettings, settings] = await Promise.all([
    getRawMarketplaceSettings(),
    getMarketplaceSettings(),
  ]);
  const encryptedApiKey = rawSettings?.whatsappApiKeyEncrypted;
  const apiKey = encryptedApiKey
    ? decryptOptionalSecret(encryptedApiKey)
    : (env.DIALOGUE_API_KEY ?? null);
  const encryptedVerifyToken =
    rawSettings?.whatsappWebhookVerifyTokenEncrypted;
  const webhookVerifyToken = encryptedVerifyToken
    ? decryptOptionalSecret(encryptedVerifyToken)
    : (env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? null);
  const encryptedSigningSecret =
    rawSettings?.whatsappWebhookSigningSecretEncrypted;
  const webhookSigningSecret = encryptedSigningSecret
    ? decryptOptionalSecret(encryptedSigningSecret)
    : (env.WHATSAPP_WEBHOOK_SIGNING_SECRET ?? null);
  const businessPhoneNumber =
    settings.whatsappBusinessPhoneNumber ??
    env.WHATSAPP_ORDERING_PHONE_NUMBER ??
    null;
  const messageUrl =
    settings.whatsappMessageUrl ??
    env.DIALOGUE_MESSAGE_URL ??
    defaultWhatsappMessageUrl;

  return {
    apiKey,
    businessPhoneNumber,
    isConfigured: Boolean(
      settings.whatsappOrderingEnabled && apiKey && businessPhoneNumber,
    ),
    messageUrl,
    provider: settings.whatsappProvider,
    webhookUrl: getWhatsappWebhookUrl(),
    webhookSigningSecret,
    webhookVerifyToken,
    whatsappOrderingEnabled: settings.whatsappOrderingEnabled,
  };
}

export type GooglePlacesIntegrationConfig = {
  apiKey: string | null;
  countryCode: "ZA";
  enabled: boolean;
  isConfigured: boolean;
  languageCode: "en";
};

export async function getGooglePlacesIntegrationConfig(): Promise<
  GooglePlacesIntegrationConfig
> {
  const rawSettings = await getRawMarketplaceSettings();
  const apiKey = decryptOptionalSecret(
    rawSettings?.googlePlacesApiKeyEncrypted,
  );
  const enabled = Boolean(rawSettings?.googlePlacesEnabled && apiKey);

  return {
    apiKey,
    countryCode: "ZA",
    enabled,
    isConfigured: enabled,
    languageCode: "en",
  };
}

export async function getMarketplaceAdminSecrets(): Promise<MarketplaceAdminSecrets> {
  const rawSettings = await getRawMarketplaceSettings();

  return {
    courierGuyLiveApiKey: decryptOptionalSecret(
      rawSettings?.courierGuyLiveApiKeyEncrypted,
    ),
    courierGuySandboxApiKey: decryptOptionalSecret(
      rawSettings?.courierGuySandboxApiKeyEncrypted,
    ),
    courierGuyWebhookToken: decryptOptionalSecret(
      rawSettings?.courierGuyWebhookTokenEncrypted,
    ),
    googlePlacesApiKey: decryptOptionalSecret(
      rawSettings?.googlePlacesApiKeyEncrypted,
    ),
    openAiApiKey:
      decryptOptionalSecret(rawSettings?.openAiApiKeyEncrypted) ??
      env.OPENAI_API_KEY ??
      null,
    payfastLiveMerchantKey: decryptOptionalSecret(
      rawSettings?.payfastLiveMerchantKeyEncrypted,
    ),
    payfastLivePassphrase: decryptOptionalSecret(
      rawSettings?.payfastLivePassphraseEncrypted,
    ),
    payfastSandboxMerchantKey: decryptOptionalSecret(
      rawSettings?.payfastSandboxMerchantKeyEncrypted,
    ),
    payfastSandboxPassphrase: decryptOptionalSecret(
      rawSettings?.payfastSandboxPassphraseEncrypted,
    ),
    stripeLiveSecretKey: decryptOptionalSecret(
      rawSettings?.stripeLiveSecretKeyEncrypted,
    ),
    stripeLiveWebhookSecret: decryptOptionalSecret(
      rawSettings?.stripeLiveWebhookSecretEncrypted,
    ),
    stripeSandboxSecretKey: decryptOptionalSecret(
      rawSettings?.stripeSandboxSecretKeyEncrypted,
    ),
    stripeSandboxWebhookSecret: decryptOptionalSecret(
      rawSettings?.stripeSandboxWebhookSecretEncrypted,
    ),
    whatsappApiKey:
      decryptOptionalSecret(rawSettings?.whatsappApiKeyEncrypted) ??
      env.DIALOGUE_API_KEY ??
      null,
    whatsappWebhookVerifyToken:
      decryptOptionalSecret(rawSettings?.whatsappWebhookVerifyTokenEncrypted) ??
      env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ??
      null,
  };
}

async function getRawMarketplaceSettings() {
  const [settings] = await db
    .select({
      bobgoApiKeyEncrypted: marketplaceSettings.bobgoApiKeyEncrypted,
      bobgoLiveApiKeyEncrypted: marketplaceSettings.bobgoLiveApiKeyEncrypted,
      bobgoLiveWebhookSecretEncrypted:
        marketplaceSettings.bobgoLiveWebhookSecretEncrypted,
      bobgoSandboxApiKeyEncrypted:
        marketplaceSettings.bobgoSandboxApiKeyEncrypted,
      bobgoSandboxWebhookSecretEncrypted:
        marketplaceSettings.bobgoSandboxWebhookSecretEncrypted,
      bobgoWebhookSecretEncrypted:
        marketplaceSettings.bobgoWebhookSecretEncrypted,
      courierGuyLiveAccountCode:
        marketplaceSettings.courierGuyLiveAccountCode,
      courierGuyLiveApiKeyEncrypted:
        marketplaceSettings.courierGuyLiveApiKeyEncrypted,
      courierGuyDropoffPickupPointId:
        marketplaceSettings.courierGuyDropoffPickupPointId,
      courierGuyDropoffPickupPointLabel:
        marketplaceSettings.courierGuyDropoffPickupPointLabel,
      courierGuyDropoffProvider:
        marketplaceSettings.courierGuyDropoffProvider,
      courierGuyEnabled: marketplaceSettings.courierGuyEnabled,
      courierGuyMode: marketplaceSettings.courierGuyMode,
      courierGuySandboxAccountCode:
        marketplaceSettings.courierGuySandboxAccountCode,
      courierGuySandboxApiKeyEncrypted:
        marketplaceSettings.courierGuySandboxApiKeyEncrypted,
      courierGuyWebhookTokenEncrypted:
        marketplaceSettings.courierGuyWebhookTokenEncrypted,
      googlePlacesApiKeyEncrypted:
        marketplaceSettings.googlePlacesApiKeyEncrypted,
      googlePlacesEnabled: marketplaceSettings.googlePlacesEnabled,
      payfastLiveMerchantKeyEncrypted:
        marketplaceSettings.payfastLiveMerchantKeyEncrypted,
      payfastLivePassphraseEncrypted:
        marketplaceSettings.payfastLivePassphraseEncrypted,
      payfastSandboxMerchantKeyEncrypted:
        marketplaceSettings.payfastSandboxMerchantKeyEncrypted,
      payfastSandboxPassphraseEncrypted:
        marketplaceSettings.payfastSandboxPassphraseEncrypted,
      stripeLiveSecretKeyEncrypted:
        marketplaceSettings.stripeLiveSecretKeyEncrypted,
      stripeLiveWebhookSecretEncrypted:
        marketplaceSettings.stripeLiveWebhookSecretEncrypted,
      stripeSandboxSecretKeyEncrypted:
        marketplaceSettings.stripeSandboxSecretKeyEncrypted,
      stripeSandboxWebhookSecretEncrypted:
        marketplaceSettings.stripeSandboxWebhookSecretEncrypted,
      openAiApiKeyEncrypted: marketplaceSettings.openAiApiKeyEncrypted,
      whatsappApiKeyEncrypted: marketplaceSettings.whatsappApiKeyEncrypted,
      whatsappWebhookVerifyTokenEncrypted:
        marketplaceSettings.whatsappWebhookVerifyTokenEncrypted,
      whatsappWebhookSigningSecretEncrypted:
        marketplaceSettings.whatsappWebhookSigningSecretEncrypted,
    })
    .from(marketplaceSettings)
    .where(eq(marketplaceSettings.id, 1))
    .limit(1);

  return settings;
}

function decryptOptionalSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return decryptSecret(value);
  } catch {
    return null;
  }
}

function normalizeBobgoBookingMode(
  value: string | null,
): "disabled" | "quote_only" | "quote_and_book" {
  if (value === "quote_only" || value === "quote_and_book") {
    return value;
  }

  return "disabled";
}

export async function updateMarketplaceComingSoonSettings({
  enabled,
  password,
}: {
  enabled: boolean;
  password?: string;
}) {
  const existing = await getMarketplaceSettings();

  if (password && password.length < 8) {
    return {
      ok: false,
      message: "Use at least 8 characters for the preview password.",
    };
  }

  const passwordHash = password ? await hashPassword(password) : undefined;

  if (enabled && !passwordHash && !existing.comingSoonPasswordHash) {
    return {
      ok: false,
      message: "Set a coming soon password before enabling the gate.",
    };
  }

  await db
    .insert(marketplaceSettings)
    .values({
      id: 1,
      comingSoonEnabled: enabled,
      comingSoonPasswordHash:
        passwordHash ?? existing.comingSoonPasswordHash ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: marketplaceSettings.id,
      set: {
        comingSoonEnabled: enabled,
        ...(passwordHash ? { comingSoonPasswordHash: passwordHash } : {}),
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "Marketplace gate settings saved." };
}

export async function updateMarketplaceSocialLinks({
  facebookUrl,
  googleReviewUrl,
  instagramUrl,
  twitterUrl,
}: {
  facebookUrl?: string;
  googleReviewUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
}) {
  await db
    .insert(marketplaceSettings)
    .values({
      id: 1,
      facebookUrl: facebookUrl || null,
      googleReviewUrl: googleReviewUrl || null,
      instagramUrl: instagramUrl || null,
      twitterUrl: twitterUrl || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: marketplaceSettings.id,
      set: {
        facebookUrl: facebookUrl || null,
        googleReviewUrl: googleReviewUrl || null,
        instagramUrl: instagramUrl || null,
        twitterUrl: twitterUrl || null,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "Social links saved." };
}

export async function updateMarketplaceFooterSettings({
  contactEmail,
  contactPhonePrimary,
  contactPhoneSecondary,
  facebookUrl,
  footerTagline,
  googleReviewUrl,
  instagramUrl,
  paymentMethodBadges,
  twitterUrl,
}: {
  contactEmail: string;
  contactPhonePrimary: string;
  contactPhoneSecondary: string;
  facebookUrl?: string;
  footerTagline: string;
  googleReviewUrl?: string;
  instagramUrl?: string;
  paymentMethodBadges: MarketplacePaymentMethodBadgeInput[];
  twitterUrl?: string;
}) {
  const paymentMethodMediaIds = Array.from(
    new Set(
      paymentMethodBadges
        .map((badge) => badge.mediaId)
        .filter((mediaId): mediaId is string => Boolean(mediaId)),
    ),
  );

  if (paymentMethodMediaIds.length > 0) {
    const selectedAssets = await db
      .select({
        id: media.id,
        isPublic: media.isPublic,
        mimeType: media.mimeType,
        relativePath: media.relativePath,
      })
      .from(media)
      .where(inArray(media.id, paymentMethodMediaIds));
    const validAssetIds = new Set(
      selectedAssets
        .filter(
          (asset) =>
            asset.isPublic &&
            asset.mimeType.startsWith("image/") &&
            asset.relativePath.startsWith("admin-media/"),
        )
        .map((asset) => asset.id),
    );

    if (
      paymentMethodMediaIds.some((mediaId) => !validAssetIds.has(mediaId))
    ) {
      return {
        ok: false,
        message: "One or more payment icons are unavailable. Choose them again.",
      };
    }
  }

  const paymentMethodBadgesValue = serializePaymentMethodBadges(
    paymentMethodBadges,
  );

  await db
    .insert(marketplaceSettings)
    .values({
      id: 1,
      contactEmail,
      contactPhonePrimary,
      contactPhoneSecondary,
      facebookUrl: facebookUrl || null,
      footerTagline,
      googleReviewUrl: googleReviewUrl || null,
      instagramUrl: instagramUrl || null,
      paymentMethodBadges: paymentMethodBadgesValue,
      twitterUrl: twitterUrl || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: marketplaceSettings.id,
      set: {
        contactEmail,
        contactPhonePrimary,
        contactPhoneSecondary,
        facebookUrl: facebookUrl || null,
        footerTagline,
        googleReviewUrl: googleReviewUrl || null,
        instagramUrl: instagramUrl || null,
        paymentMethodBadges: paymentMethodBadgesValue,
        twitterUrl: twitterUrl || null,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "Footer details saved." };
}

export async function updateMarketplaceGoogleMarketingSettings({
  googleAdsConversionId,
  googleAdsConversionLabel,
  googleAnalyticsMeasurementId,
  googleMerchantCenterId,
  googleSiteVerificationToken,
  googleTagManagerId,
}: {
  googleAdsConversionId?: string;
  googleAdsConversionLabel?: string;
  googleAnalyticsMeasurementId?: string;
  googleMerchantCenterId?: string;
  googleSiteVerificationToken?: string;
  googleTagManagerId?: string;
}) {
  await db
    .insert(marketplaceSettings)
    .values({
      id: 1,
      googleAdsConversionId: googleAdsConversionId || null,
      googleAdsConversionLabel: googleAdsConversionLabel || null,
      googleAnalyticsMeasurementId: googleAnalyticsMeasurementId || null,
      googleLocalInventoryCustomerAccessible: false,
      googleLocalInventoryEnabled: false,
      googleLocalInventoryStoreCode: null,
      googleMerchantCenterId: googleMerchantCenterId || null,
      googleSiteVerificationToken: googleSiteVerificationToken || null,
      googleTagManagerId: googleTagManagerId || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: marketplaceSettings.id,
      set: {
        googleAdsConversionId: googleAdsConversionId || null,
        googleAdsConversionLabel: googleAdsConversionLabel || null,
        googleAnalyticsMeasurementId: googleAnalyticsMeasurementId || null,
        googleLocalInventoryCustomerAccessible: false,
        googleLocalInventoryEnabled: false,
        googleLocalInventoryStoreCode: null,
        googleMerchantCenterId: googleMerchantCenterId || null,
        googleSiteVerificationToken: googleSiteVerificationToken || null,
        googleTagManagerId: googleTagManagerId || null,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "Google and Merchant Center settings saved." };
}

export async function updateMarketplaceGooglePlacesSettings({
  actorUserId,
  apiKey,
  enabled,
  removeApiKey = false,
}: {
  actorUserId: string;
  apiKey?: string;
  enabled: boolean;
  removeApiKey?: boolean;
}) {
  const existing = await getRawMarketplaceSettings();
  const existingApiKey = decryptOptionalSecret(
    existing?.googlePlacesApiKeyEncrypted,
  );
  const normalizedApiKey = apiKey?.trim() || undefined;

  if (
    removeApiKey &&
    normalizedApiKey &&
    normalizedApiKey !== existingApiKey
  ) {
    return {
      ok: false as const,
      message:
        "Choose either a replacement Google Places API key or remove the saved key.",
    };
  }

  if (!env.AUTH_SECRET && (enabled || Boolean(normalizedApiKey))) {
    return {
      ok: false as const,
      message:
        "Configure the server AUTH_SECRET before storing or enabling Google Places.",
    };
  }

  const apiKeyChanged =
    !removeApiKey &&
    normalizedApiKey !== undefined &&
    normalizedApiKey !== existingApiKey;
  const apiKeyRemoved =
    removeApiKey && Boolean(existing?.googlePlacesApiKeyEncrypted);
  const nextApiKey = removeApiKey
    ? null
    : (normalizedApiKey ?? existingApiKey);
  const nextApiKeyEncrypted = removeApiKey
    ? null
    : apiKeyChanged && normalizedApiKey
      ? encryptSecret(normalizedApiKey)
      : (existing?.googlePlacesApiKeyEncrypted ?? null);

  if (enabled && (!nextApiKey || !nextApiKeyEncrypted)) {
    return {
      ok: false as const,
      message:
        "Add a Google Places server API key before enabling address autocomplete.",
    };
  }

  const values = {
    googlePlacesApiKeyEncrypted: nextApiKeyEncrypted,
    googlePlacesEnabled: enabled,
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    await tx
      .insert(marketplaceSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({
        target: marketplaceSettings.id,
        set: values,
      });

    await tx.insert(auditLogs).values({
      action: "marketplace.google_places_settings.updated",
      actorUserId,
      entityType: "marketplace_settings",
      metadata: JSON.stringify({
        apiKeyChanged,
        apiKeyRemoved,
        enabled,
      }),
    });
  });

  return {
    ok: true as const,
    message: apiKeyRemoved
      ? "Google Places API key removed and autocomplete disabled."
      : "Google Places settings saved.",
  };
}

export async function updateMarketplaceOpenAiSettings({
  apiKey,
  enabled,
  model,
  reasoningEffort,
}: {
  apiKey?: string;
  enabled: boolean;
  model: string;
  reasoningEffort: OpenAiReasoningEffort;
}) {
  const existing = await getRawMarketplaceSettings();
  const nextApiKey =
    apiKey && apiKey.length > 0
      ? encryptSecret(apiKey)
      : (existing?.openAiApiKeyEncrypted ??
        (env.OPENAI_API_KEY ? encryptSecret(env.OPENAI_API_KEY) : null));

  if (enabled && !nextApiKey) {
    return {
      ok: false,
      message: "Add an OpenAI API key before enabling ChatGPT features.",
    };
  }

  await db
    .insert(marketplaceSettings)
    .values({
      id: 1,
      openAiApiKeyEncrypted: nextApiKey,
      openAiEnabled: enabled,
      openAiModel: model,
      openAiReasoningEffort: reasoningEffort,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: marketplaceSettings.id,
      set: {
        openAiApiKeyEncrypted: nextApiKey,
        openAiEnabled: enabled,
        openAiModel: model,
        openAiReasoningEffort: reasoningEffort,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "ChatGPT integration settings saved." };
}

export async function verifyMarketplaceComingSoonPassword(password: string) {
  const settings = await getMarketplaceSettings();

  if (!settings.comingSoonPasswordHash) {
    return false;
  }

  return verifyPassword(password, settings.comingSoonPasswordHash);
}

export function createMarketplacePreviewToken(passwordHash: string) {
  if (!env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required for marketplace preview access.");
  }

  return crypto
    .createHmac("sha256", env.AUTH_SECRET)
    .update(passwordHash)
    .digest("base64url");
}

export async function isMarketplacePreviewTokenValid(token?: string) {
  if (!token) {
    return false;
  }

  const settings = await getMarketplaceSettings();

  if (!settings.comingSoonPasswordHash) {
    return false;
  }

  const expectedToken = createMarketplacePreviewToken(
    settings.comingSoonPasswordHash,
  );

  const tokenBuffer = Buffer.from(token);
  const expectedTokenBuffer = Buffer.from(expectedToken);

  if (tokenBuffer.length !== expectedTokenBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, expectedTokenBuffer);
}
