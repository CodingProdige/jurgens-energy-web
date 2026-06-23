import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { marketplaceSettings } from "@/src/db/schema";
import { env } from "@/src/config/env";
import { hashPassword, verifyPassword } from "@/src/modules/auth/service";
import { decryptSecret, encryptSecret } from "@/src/modules/security/secrets";

export const marketplaceComingSoonCookieName = "piessang_marketplace_preview";

type MarketplaceSettings = {
  bobgoBookingMode: "disabled" | "quote_only" | "quote_and_book";
  comingSoonEnabled: boolean;
  comingSoonPasswordHash: string | null;
  facebookUrl: string | null;
  freeStorageQuotaMb: number;
  imageCompressionQuality: number;
  instagramUrl: string | null;
  maxImageWidth: number;
  maxUploadFileMb: number;
  maxVideoUploadFileMb: number;
  maxVideoWidth: number;
  premiumStorageQuotaMb: number;
  bobgoEnabled: boolean;
  bobgoMode: "live" | "sandbox";
  hasBobgoApiKey: boolean;
  hasBobgoWebhookSecret: boolean;
  hasBobgoLiveApiKey: boolean;
  hasBobgoLiveWebhookSecret: boolean;
  hasBobgoSandboxApiKey: boolean;
  hasBobgoSandboxWebhookSecret: boolean;
  bobgoWebhookFulfillmentCreated: boolean;
  bobgoWebhookShipmentChargedAmountChanged: boolean;
  bobgoWebhookShipmentChargedWeightChanged: boolean;
  bobgoWebhookShipmentHealthStatusUpdated: boolean;
  bobgoWebhookShipmentSubmissionStatusUpdated: boolean;
  bobgoWebhookTrackingUpdated: boolean;
  shippingBufferBps: number;
  shippingEnabled: boolean;
  shippingMarginBps: number;
  stripeLivePublishableKey: string | null;
  stripeMode: "live" | "sandbox";
  stripeSandboxPublishableKey: string | null;
  twitterUrl: string | null;
  hasStripeLiveSecretKey: boolean;
  hasStripeLiveWebhookSecret: boolean;
  hasStripeSandboxSecretKey: boolean;
  hasStripeSandboxWebhookSecret: boolean;
  videoCompressionCrf: number;
};

export type MarketplaceAdminSecrets = {
  bobgoLiveApiKey: string | null;
  bobgoLiveWebhookSecret: string | null;
  bobgoSandboxApiKey: string | null;
  bobgoSandboxWebhookSecret: string | null;
  stripeLiveSecretKey: string | null;
  stripeLiveWebhookSecret: string | null;
  stripeSandboxSecretKey: string | null;
  stripeSandboxWebhookSecret: string | null;
};

const defaultSettings: MarketplaceSettings = {
  bobgoBookingMode: "disabled",
  comingSoonEnabled: false,
  comingSoonPasswordHash: null,
  facebookUrl: null,
  freeStorageQuotaMb: 512,
  imageCompressionQuality: 78,
  instagramUrl: null,
  maxImageWidth: 2000,
  maxUploadFileMb: 10,
  maxVideoUploadFileMb: 100,
  maxVideoWidth: 1280,
  premiumStorageQuotaMb: 5120,
  bobgoEnabled: false,
  bobgoMode: "sandbox",
  hasBobgoApiKey: false,
  hasBobgoWebhookSecret: false,
  hasBobgoLiveApiKey: false,
  hasBobgoLiveWebhookSecret: false,
  hasBobgoSandboxApiKey: false,
  hasBobgoSandboxWebhookSecret: false,
  bobgoWebhookFulfillmentCreated: true,
  bobgoWebhookShipmentChargedAmountChanged: true,
  bobgoWebhookShipmentChargedWeightChanged: true,
  bobgoWebhookShipmentHealthStatusUpdated: true,
  bobgoWebhookShipmentSubmissionStatusUpdated: true,
  bobgoWebhookTrackingUpdated: true,
  shippingBufferBps: 0,
  shippingEnabled: false,
  shippingMarginBps: 0,
  stripeLivePublishableKey: null,
  stripeMode: "sandbox",
  stripeSandboxPublishableKey: null,
  twitterUrl: null,
  hasStripeLiveSecretKey: false,
  hasStripeLiveWebhookSecret: false,
  hasStripeSandboxSecretKey: false,
  hasStripeSandboxWebhookSecret: false,
  videoCompressionCrf: 28,
};

export async function getMarketplaceSettings(): Promise<MarketplaceSettings> {
  const [settings] = await db
    .select({
      comingSoonEnabled: marketplaceSettings.comingSoonEnabled,
      comingSoonPasswordHash: marketplaceSettings.comingSoonPasswordHash,
      facebookUrl: marketplaceSettings.facebookUrl,
      freeStorageQuotaMb: marketplaceSettings.freeStorageQuotaMb,
      imageCompressionQuality: marketplaceSettings.imageCompressionQuality,
      instagramUrl: marketplaceSettings.instagramUrl,
      maxImageWidth: marketplaceSettings.maxImageWidth,
      maxUploadFileMb: marketplaceSettings.maxUploadFileMb,
      maxVideoUploadFileMb: marketplaceSettings.maxVideoUploadFileMb,
      maxVideoWidth: marketplaceSettings.maxVideoWidth,
      premiumStorageQuotaMb: marketplaceSettings.premiumStorageQuotaMb,
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
  };
}

export async function updateMarketplaceMediaSettings({
  freeStorageQuotaMb,
  imageCompressionQuality,
  maxImageWidth,
  maxUploadFileMb,
  maxVideoUploadFileMb,
  maxVideoWidth,
  premiumStorageQuotaMb,
  videoCompressionCrf,
}: {
  freeStorageQuotaMb: number;
  imageCompressionQuality: number;
  maxImageWidth: number;
  maxUploadFileMb: number;
  maxVideoUploadFileMb: number;
  maxVideoWidth: number;
  premiumStorageQuotaMb: number;
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
      premiumStorageQuotaMb,
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
        premiumStorageQuotaMb,
        videoCompressionCrf,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "Media and premium storage settings saved." };
}

export async function updateMarketplaceStripeSettings({
  livePublishableKey,
  liveSecretKey,
  liveWebhookSecret,
  mode,
  sandboxPublishableKey,
  sandboxSecretKey,
  sandboxWebhookSecret,
}: {
  livePublishableKey?: string;
  liveSecretKey?: string;
  liveWebhookSecret?: string;
  mode: "live" | "sandbox";
  sandboxPublishableKey?: string;
  sandboxSecretKey?: string;
  sandboxWebhookSecret?: string;
}) {
  const existing = await getRawMarketplaceSettings();
  const nextLiveSecret =
    liveSecretKey && liveSecretKey.length > 0
      ? encryptSecret(liveSecretKey)
      : existing?.stripeLiveSecretKeyEncrypted;
  const nextLiveWebhookSecret =
    liveWebhookSecret && liveWebhookSecret.length > 0
      ? encryptSecret(liveWebhookSecret)
      : existing?.stripeLiveWebhookSecretEncrypted;
  const nextSandboxSecret =
    sandboxSecretKey && sandboxSecretKey.length > 0
      ? encryptSecret(sandboxSecretKey)
      : existing?.stripeSandboxSecretKeyEncrypted;
  const nextSandboxWebhookSecret =
    sandboxWebhookSecret && sandboxWebhookSecret.length > 0
      ? encryptSecret(sandboxWebhookSecret)
      : existing?.stripeSandboxWebhookSecretEncrypted;

  await db
    .insert(marketplaceSettings)
    .values({
      id: 1,
      stripeLivePublishableKey: livePublishableKey || null,
      stripeLiveSecretKeyEncrypted: nextLiveSecret ?? null,
      stripeLiveWebhookSecretEncrypted: nextLiveWebhookSecret ?? null,
      stripeMode: mode,
      stripeSandboxPublishableKey: sandboxPublishableKey || null,
      stripeSandboxSecretKeyEncrypted: nextSandboxSecret ?? null,
      stripeSandboxWebhookSecretEncrypted: nextSandboxWebhookSecret ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: marketplaceSettings.id,
      set: {
        stripeLivePublishableKey: livePublishableKey || null,
        stripeLiveSecretKeyEncrypted: nextLiveSecret ?? null,
        stripeLiveWebhookSecretEncrypted: nextLiveWebhookSecret ?? null,
        stripeMode: mode,
        stripeSandboxPublishableKey: sandboxPublishableKey || null,
        stripeSandboxSecretKeyEncrypted: nextSandboxSecret ?? null,
        stripeSandboxWebhookSecretEncrypted: nextSandboxWebhookSecret ?? null,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "Stripe payment settings saved." };
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
        shippingBufferBps,
        shippingEnabled,
        shippingMarginBps,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "Shipping settings saved." };
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

export async function getMarketplaceAdminSecrets(): Promise<MarketplaceAdminSecrets> {
  const rawSettings = await getRawMarketplaceSettings();

  return {
    bobgoLiveApiKey: decryptOptionalSecret(rawSettings?.bobgoLiveApiKeyEncrypted),
    bobgoLiveWebhookSecret: decryptOptionalSecret(
      rawSettings?.bobgoLiveWebhookSecretEncrypted,
    ),
    bobgoSandboxApiKey: decryptOptionalSecret(
      rawSettings?.bobgoSandboxApiKeyEncrypted ??
        rawSettings?.bobgoApiKeyEncrypted,
    ),
    bobgoSandboxWebhookSecret: decryptOptionalSecret(
      rawSettings?.bobgoSandboxWebhookSecretEncrypted ??
        rawSettings?.bobgoWebhookSecretEncrypted,
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
      stripeLiveSecretKeyEncrypted:
        marketplaceSettings.stripeLiveSecretKeyEncrypted,
      stripeLiveWebhookSecretEncrypted:
        marketplaceSettings.stripeLiveWebhookSecretEncrypted,
      stripeSandboxSecretKeyEncrypted:
        marketplaceSettings.stripeSandboxSecretKeyEncrypted,
      stripeSandboxWebhookSecretEncrypted:
        marketplaceSettings.stripeSandboxWebhookSecretEncrypted,
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
  instagramUrl,
  twitterUrl,
}: {
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
}) {
  await db
    .insert(marketplaceSettings)
    .values({
      id: 1,
      facebookUrl: facebookUrl || null,
      instagramUrl: instagramUrl || null,
      twitterUrl: twitterUrl || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: marketplaceSettings.id,
      set: {
        facebookUrl: facebookUrl || null,
        instagramUrl: instagramUrl || null,
        twitterUrl: twitterUrl || null,
        updatedAt: new Date(),
      },
    });

  return { ok: true, message: "Social links saved." };
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
