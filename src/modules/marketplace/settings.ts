import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { marketplaceSettings } from "@/src/db/schema";
import { env } from "@/src/config/env";
import { hashPassword, verifyPassword } from "@/src/modules/auth/service";

export const marketplaceComingSoonCookieName = "piessang_marketplace_preview";

type MarketplaceSettings = {
  comingSoonEnabled: boolean;
  comingSoonPasswordHash: string | null;
};

const defaultSettings: MarketplaceSettings = {
  comingSoonEnabled: false,
  comingSoonPasswordHash: null,
};

export async function getMarketplaceSettings(): Promise<MarketplaceSettings> {
  const [settings] = await db
    .select({
      comingSoonEnabled: marketplaceSettings.comingSoonEnabled,
      comingSoonPasswordHash: marketplaceSettings.comingSoonPasswordHash,
    })
    .from(marketplaceSettings)
    .where(eq(marketplaceSettings.id, 1))
    .limit(1);

  return settings ?? defaultSettings;
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
