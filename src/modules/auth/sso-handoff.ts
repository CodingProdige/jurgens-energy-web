import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

type SsoHandoffPayload = {
  email: string;
  exp: number;
  name?: string | null;
  userId: string;
};

function getSigningSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is required for SSO handoff tokens.");
  }

  return secret;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createSsoHandoffToken(
  payload: Omit<SsoHandoffPayload, "exp">,
  maxAgeSeconds = 10 * 60,
) {
  const encodedPayload = encodeBase64Url(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    } satisfies SsoHandoffPayload),
  );

  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifySsoHandoffToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      decodeBase64Url(encodedPayload),
    ) as SsoHandoffPayload;

    if (
      typeof payload.email !== "string" ||
      typeof payload.exp !== "number" ||
      typeof payload.userId !== "string" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
