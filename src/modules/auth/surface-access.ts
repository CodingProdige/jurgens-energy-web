import { createHmac, timingSafeEqual } from "node:crypto";

import {
  adminSurfaceAccessCookieName,
  sellerSurfaceAccessCookieName,
  surfaceAccessRememberSeconds,
} from "@/src/modules/auth/constants";
import type { AccessCapability } from "@/src/modules/auth/service";

type ProtectedSurface = Extract<AccessCapability, "admin" | "seller">;

function getSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is required.");
  }

  return secret;
}

function signSurfaceAccess(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function getSurfaceAccessCookieName(surface: ProtectedSurface) {
  return surface === "admin"
    ? adminSurfaceAccessCookieName
    : sellerSurfaceAccessCookieName;
}

export function createSurfaceAccessToken({
  remember,
  surface,
  userId,
}: {
  remember: boolean;
  surface: ProtectedSurface;
  userId: string;
}) {
  const expiresAt = remember
    ? String(Date.now() + surfaceAccessRememberSeconds * 1000)
    : "session";
  const payload = [userId, surface, expiresAt].join(".");
  const signature = signSurfaceAccess(payload);

  return `${payload}.${signature}`;
}

export function verifySurfaceAccessToken({
  surface,
  token,
  userId,
}: {
  surface: ProtectedSurface;
  token: string | undefined;
  userId: string;
}) {
  if (!token) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 4) {
    return false;
  }

  const [tokenUserId, tokenSurface, expiresAt, signature] = parts;

  if (tokenUserId !== userId || tokenSurface !== surface) {
    return false;
  }

  if (expiresAt !== "session") {
    const expiry = Number(expiresAt);

    if (!Number.isFinite(expiry) || expiry <= Date.now()) {
      return false;
    }
  }

  const expectedSignature = signSurfaceAccess(
    [tokenUserId, tokenSurface, expiresAt].join("."),
  );
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return (
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer)
  );
}
