import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { marketplaceSettings } from "@/src/db/schema";
import { env } from "@/src/config/env";
import { hashPassword, verifyPassword } from "@/src/modules/auth/service";
import { encryptSecret } from "@/src/modules/security/secrets";

export const marketplaceComingSoonCookieName = "piessang_marketplace_preview";

type MarketplaceSettings = {
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

const defaultSettings: MarketplaceSettings = {
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

async function getRawMarketplaceSettings() {
  const [settings] = await db
    .select({
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
