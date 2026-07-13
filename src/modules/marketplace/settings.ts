import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { marketplaceSettings } from "@/src/db/schema";
import { env } from "@/src/config/env";
import { hashPassword, verifyPassword } from "@/src/modules/auth/service";
import { decryptSecret, encryptSecret } from "@/src/modules/security/secrets";

export const marketplaceComingSoonCookieName = "piessang_marketplace_preview";

const defaultWhatsappMessageUrl = "https://waba-v2.360dialog.io";
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
    "Hi, just checking in. If you still need gas, send the cylinder size, quantity, and delivery suburb and we will help you finish it.",
  draft:
    "Hi, just checking in. Would you like to continue with this order? Reply YES to confirm, or tell us what to change.",
  support:
    "Hi, just checking in. Did you still need help with delivery, a gas order, or anything else from Jurgens Energy?",
} as const;

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

export type MarketplaceSettings = {
  bobgoBookingMode: "disabled" | "quote_only" | "quote_and_book";
  comingSoonEnabled: boolean;
  comingSoonPasswordHash: string | null;
  facebookUrl: string | null;
  freeStorageQuotaMb: number;
  googleAdsConversionId: string | null;
  googleAdsConversionLabel: string | null;
  googleAnalyticsMeasurementId: string | null;
  googleMerchantCenterId: string | null;
  googleReviewUrl: string | null;
  googleSiteVerificationToken: string | null;
  googleTagManagerId: string | null;
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
  jurgensDeliveryCutoffTime: string;
  bobgoWebhookFulfillmentCreated: boolean;
  bobgoWebhookShipmentChargedAmountChanged: boolean;
  bobgoWebhookShipmentChargedWeightChanged: boolean;
  bobgoWebhookShipmentHealthStatusUpdated: boolean;
  bobgoWebhookShipmentSubmissionStatusUpdated: boolean;
  bobgoWebhookTrackingUpdated: boolean;
  shippingBufferBps: number;
  shippingEnabled: boolean;
  shippingMarginBps: number;
  payfastLiveMerchantId: string | null;
  payfastMode: "live" | "sandbox";
  payfastOnsiteEnabled: boolean;
  payfastSandboxMerchantId: string | null;
  payfastTokenizationEnabled: boolean;
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
  hasWhatsappWebhookVerifyToken: boolean;
  whatsappBusinessPhoneNumber: string | null;
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
  bobgoLiveApiKey: string | null;
  bobgoLiveWebhookSecret: string | null;
  openAiApiKey: string | null;
  bobgoSandboxApiKey: string | null;
  bobgoSandboxWebhookSecret: string | null;
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
  comingSoonEnabled: false,
  comingSoonPasswordHash: null,
  facebookUrl: null,
  freeStorageQuotaMb: 512,
  googleAdsConversionId: null,
  googleAdsConversionLabel: null,
  googleAnalyticsMeasurementId: null,
  googleMerchantCenterId: null,
  googleReviewUrl: null,
  googleSiteVerificationToken: null,
  googleTagManagerId: null,
  hasOpenAiApiKey: Boolean(env.OPENAI_API_KEY),
  imageCompressionQuality: 78,
  instagramUrl: null,
  maxImageWidth: 2000,
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
  jurgensDeliveryCutoffTime: "14:00",
  bobgoWebhookFulfillmentCreated: true,
  bobgoWebhookShipmentChargedAmountChanged: true,
  bobgoWebhookShipmentChargedWeightChanged: true,
  bobgoWebhookShipmentHealthStatusUpdated: true,
  bobgoWebhookShipmentSubmissionStatusUpdated: true,
  bobgoWebhookTrackingUpdated: true,
  shippingBufferBps: 0,
  shippingEnabled: false,
  shippingMarginBps: 0,
  payfastLiveMerchantId: null,
  payfastMode: "sandbox",
  payfastOnsiteEnabled: false,
  payfastSandboxMerchantId: null,
  payfastTokenizationEnabled: false,
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
  hasWhatsappWebhookVerifyToken: Boolean(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
  whatsappBusinessPhoneNumber: env.WHATSAPP_ORDERING_PHONE_NUMBER ?? null,
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

export async function getMarketplaceSettings(): Promise<MarketplaceSettings> {
  const [settings] = await db
    .select({
      comingSoonEnabled: marketplaceSettings.comingSoonEnabled,
      comingSoonPasswordHash: marketplaceSettings.comingSoonPasswordHash,
      facebookUrl: marketplaceSettings.facebookUrl,
      freeStorageQuotaMb: marketplaceSettings.freeStorageQuotaMb,
      googleAdsConversionId: marketplaceSettings.googleAdsConversionId,
      googleAdsConversionLabel: marketplaceSettings.googleAdsConversionLabel,
      googleAnalyticsMeasurementId:
        marketplaceSettings.googleAnalyticsMeasurementId,
      googleMerchantCenterId: marketplaceSettings.googleMerchantCenterId,
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
      shippingBufferBps: marketplaceSettings.shippingBufferBps,
      shippingEnabled: marketplaceSettings.shippingEnabled,
      shippingMarginBps: marketplaceSettings.shippingMarginBps,
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
    })
    .from(marketplaceSettings)
    .where(eq(marketplaceSettings.id, 1))
    .limit(1);

  if (!settings) {
    return defaultSettings;
  }

  return {
    ...settings,
    bobgoBookingMode: normalizeBobgoBookingMode(settings.bobgoBookingMode),
    bobgoMode: settings.bobgoMode === "live" ? "live" : "sandbox",
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
    hasOpenAiApiKey: Boolean(
      settings.openAiApiKeyEncrypted ?? env.OPENAI_API_KEY,
    ),
    openAiEnabled: settings.openAiEnabled ?? true,
    openAiModel: settings.openAiModel || env.OPENAI_MODEL,
    openAiReasoningEffort: normalizeOpenAiReasoningEffort(
      settings.openAiReasoningEffort,
    ),
    payfastMode: settings.payfastMode === "live" ? "live" : "sandbox",
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
    hasWhatsappWebhookVerifyToken: Boolean(
      settings.whatsappWebhookVerifyTokenEncrypted ??
        env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    ),
    whatsappBusinessPhoneNumber:
      settings.whatsappBusinessPhoneNumber ??
      env.WHATSAPP_ORDERING_PHONE_NUMBER ??
      null,
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
}

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

export async function updateMarketplaceShippingSettings({
  bobgoApiKey,
  bobgoBookingMode,
  bobgoEnabled,
  bobgoLiveApiKey,
  bobgoLiveWebhookSecret,
  bobgoMode,
  bobgoSandboxApiKey,
  bobgoSandboxWebhookSecret,
  bobgoWebhookFulfillmentCreated,
  bobgoWebhookSecret,
  bobgoWebhookShipmentChargedAmountChanged,
  bobgoWebhookShipmentChargedWeightChanged,
  bobgoWebhookShipmentHealthStatusUpdated,
  bobgoWebhookShipmentSubmissionStatusUpdated,
  bobgoWebhookTrackingUpdated,
  jurgensDeliveryCutoffTime,
  shippingBufferBps,
  shippingEnabled,
  shippingMarginBps,
}: {
  bobgoApiKey?: string;
  bobgoBookingMode: "disabled" | "quote_only" | "quote_and_book";
  bobgoEnabled: boolean;
  bobgoLiveApiKey?: string;
  bobgoLiveWebhookSecret?: string;
  bobgoMode: "live" | "sandbox";
  bobgoSandboxApiKey?: string;
  bobgoSandboxWebhookSecret?: string;
  bobgoWebhookFulfillmentCreated: boolean;
  bobgoWebhookSecret?: string;
  bobgoWebhookShipmentChargedAmountChanged: boolean;
  bobgoWebhookShipmentChargedWeightChanged: boolean;
  bobgoWebhookShipmentHealthStatusUpdated: boolean;
  bobgoWebhookShipmentSubmissionStatusUpdated: boolean;
  bobgoWebhookTrackingUpdated: boolean;
  jurgensDeliveryCutoffTime: string;
  shippingBufferBps: number;
  shippingEnabled: boolean;
  shippingMarginBps: number;
}) {
  if (shippingMarginBps < 0 || shippingMarginBps > 10000) {
    return {
      ok: false,
      message: "Shipping margin must be between 0% and 100%.",
    };
  }

  if (shippingBufferBps < 0 || shippingBufferBps > 10000) {
    return {
      ok: false,
      message: "Shipping buffer must be between 0% and 100%.",
    };
  }

  const existing = await getRawMarketplaceSettings();
  const nextBobgoApiKey =
    bobgoApiKey && bobgoApiKey.length > 0
      ? encryptSecret(bobgoApiKey)
      : (existing?.bobgoApiKeyEncrypted ??
        existing?.bobgoSandboxApiKeyEncrypted);
  const nextBobgoWebhookSecret =
    bobgoWebhookSecret && bobgoWebhookSecret.length > 0
      ? encryptSecret(bobgoWebhookSecret)
      : (existing?.bobgoWebhookSecretEncrypted ??
        existing?.bobgoSandboxWebhookSecretEncrypted);
  const nextBobgoLiveApiKey =
    bobgoLiveApiKey && bobgoLiveApiKey.length > 0
      ? encryptSecret(bobgoLiveApiKey)
      : existing?.bobgoLiveApiKeyEncrypted;
  const nextBobgoLiveWebhookSecret =
    bobgoLiveWebhookSecret && bobgoLiveWebhookSecret.length > 0
      ? encryptSecret(bobgoLiveWebhookSecret)
      : existing?.bobgoLiveWebhookSecretEncrypted;
  const nextBobgoSandboxApiKey =
    bobgoSandboxApiKey && bobgoSandboxApiKey.length > 0
      ? encryptSecret(bobgoSandboxApiKey)
      : (existing?.bobgoSandboxApiKeyEncrypted ??
        existing?.bobgoApiKeyEncrypted);
  const nextBobgoSandboxWebhookSecret =
    bobgoSandboxWebhookSecret && bobgoSandboxWebhookSecret.length > 0
      ? encryptSecret(bobgoSandboxWebhookSecret)
      : (existing?.bobgoSandboxWebhookSecretEncrypted ??
        existing?.bobgoWebhookSecretEncrypted);

  await db
    .insert(marketplaceSettings)
    .values({
      id: 1,
      bobgoApiKeyEncrypted: nextBobgoApiKey ?? null,
      bobgoBookingMode,
      bobgoEnabled,
      bobgoLiveApiKeyEncrypted: nextBobgoLiveApiKey ?? null,
      bobgoLiveWebhookSecretEncrypted: nextBobgoLiveWebhookSecret ?? null,
      bobgoMode,
      bobgoWebhookSecretEncrypted: nextBobgoWebhookSecret ?? null,
      bobgoWebhookFulfillmentCreated,
      bobgoWebhookShipmentChargedAmountChanged,
      bobgoWebhookShipmentChargedWeightChanged,
      bobgoWebhookShipmentHealthStatusUpdated,
      bobgoWebhookShipmentSubmissionStatusUpdated,
      bobgoWebhookTrackingUpdated,
      bobgoSandboxApiKeyEncrypted: nextBobgoSandboxApiKey ?? null,
      bobgoSandboxWebhookSecretEncrypted:
        nextBobgoSandboxWebhookSecret ?? null,
      jurgensDeliveryCutoffTime,
      shippingBufferBps,
      shippingEnabled,
      shippingMarginBps,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: marketplaceSettings.id,
      set: {
        bobgoApiKeyEncrypted: nextBobgoApiKey ?? null,
        bobgoBookingMode,
        bobgoEnabled,
        bobgoLiveApiKeyEncrypted: nextBobgoLiveApiKey ?? null,
        bobgoLiveWebhookSecretEncrypted: nextBobgoLiveWebhookSecret ?? null,
        bobgoMode,
        bobgoWebhookSecretEncrypted: nextBobgoWebhookSecret ?? null,
        bobgoWebhookFulfillmentCreated,
        bobgoWebhookShipmentChargedAmountChanged,
        bobgoWebhookShipmentChargedWeightChanged,
        bobgoWebhookShipmentHealthStatusUpdated,
        bobgoWebhookShipmentSubmissionStatusUpdated,
        bobgoWebhookTrackingUpdated,
        bobgoSandboxApiKeyEncrypted: nextBobgoSandboxApiKey ?? null,
        bobgoSandboxWebhookSecretEncrypted:
          nextBobgoSandboxWebhookSecret ?? null,
        jurgensDeliveryCutoffTime,
        shippingBufferBps,
        shippingEnabled,
        shippingMarginBps,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "Shipping settings saved." };
}

export async function updateMarketplaceWhatsappSettings({
  apiKey,
  businessPhoneNumber,
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
  provider,
  webhookVerifyToken,
}: {
  apiKey?: string;
  businessPhoneNumber?: string;
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
  provider: "360dialog";
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

  await db
    .insert(marketplaceSettings)
    .values({
      id: 1,
      whatsappApiKeyEncrypted: nextApiKey,
      whatsappBusinessPhoneNumber: businessPhoneNumber || null,
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
      whatsappOrderingEnabled: enabled,
      whatsappProvider: provider,
      whatsappWebhookVerifyTokenEncrypted: nextWebhookVerifyToken,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: marketplaceSettings.id,
      set: {
        whatsappApiKeyEncrypted: nextApiKey,
        whatsappBusinessPhoneNumber: businessPhoneNumber || null,
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
        whatsappOrderingEnabled: enabled,
        whatsappProvider: provider,
        whatsappWebhookVerifyTokenEncrypted: nextWebhookVerifyToken,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "WhatsApp ordering settings saved." };
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
    webhookVerifyToken,
    whatsappOrderingEnabled: settings.whatsappOrderingEnabled,
  };
}

export async function getMarketplaceAdminSecrets(): Promise<MarketplaceAdminSecrets> {
  const rawSettings = await getRawMarketplaceSettings();

  return {
    bobgoLiveApiKey: decryptOptionalSecret(rawSettings?.bobgoLiveApiKeyEncrypted),
    bobgoLiveWebhookSecret: decryptOptionalSecret(
      rawSettings?.bobgoLiveWebhookSecretEncrypted,
    ),
    openAiApiKey:
      decryptOptionalSecret(rawSettings?.openAiApiKeyEncrypted) ??
      env.OPENAI_API_KEY ??
      null,
    bobgoSandboxApiKey: decryptOptionalSecret(
      rawSettings?.bobgoSandboxApiKeyEncrypted ??
        rawSettings?.bobgoApiKeyEncrypted,
    ),
    bobgoSandboxWebhookSecret: decryptOptionalSecret(
      rawSettings?.bobgoSandboxWebhookSecretEncrypted ??
        rawSettings?.bobgoWebhookSecretEncrypted,
    ),
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
        googleMerchantCenterId: googleMerchantCenterId || null,
        googleSiteVerificationToken: googleSiteVerificationToken || null,
        googleTagManagerId: googleTagManagerId || null,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "Google tag settings saved." };
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
