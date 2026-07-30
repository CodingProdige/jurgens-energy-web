import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { getRedis } from "@/src/cache/redis";
import { env } from "@/src/config/env";

const capabilityCookieName = "jurgens_places_capability";
const capabilityLifetimeSeconds = 30 * 60;
const sessionLifetimeSeconds = 10 * 60;
const maximumAutocompleteRequestsPerSession = 20;
export const GOOGLE_PLACES_MAX_REQUEST_BODY_BYTES = 8 * 1024;

export class GooglePlacesProxyRequestError extends Error {
  readonly status: 400 | 413 | 415;

  constructor(message: string, status: 400 | 413 | 415) {
    super(message);
    this.name = "GooglePlacesProxyRequestError";
    this.status = status;
  }
}

function normalizedConfiguredOrigin(
  value: string | undefined,
  baseUrl: URL,
) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  try {
    if (/^https?:\/\//i.test(normalized)) {
      return new URL(normalized).origin;
    }

    const hostname = normalized
      .split("/")[0]
      ?.replace(/^\.+/, "")
      .toLowerCase();

    if (!hostname) {
      return null;
    }

    return `${baseUrl.protocol}//${hostname}${
      hostname.includes(":") ? "" : baseUrl.port ? `:${baseUrl.port}` : ""
    }`;
  } catch {
    return null;
  }
}

export function getGooglePlacesAllowedOrigins() {
  const appUrl = new URL(env.APP_URL);
  const allowedOrigins = new Set<string>([appUrl.origin]);

  for (const configuredHostname of [
    process.env.ADMIN_HOSTNAME,
    process.env.SELLER_HOSTNAME,
  ]) {
    const origin = normalizedConfiguredOrigin(configuredHostname, appUrl);

    if (origin) {
      allowedOrigins.add(origin);
    }
  }

  return allowedOrigins;
}

function parseContentLength(request: Request) {
  const rawValue = request.headers.get("content-length");

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new GooglePlacesProxyRequestError(
      "The address request size was invalid.",
      400,
    );
  }

  return value;
}

export async function readGooglePlacesJsonBody(request: Request) {
  const contentType =
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() ?? "";

  if (contentType !== "application/json") {
    throw new GooglePlacesProxyRequestError(
      "The address request must use JSON.",
      415,
    );
  }

  const declaredLength = parseContentLength(request);

  if (
    declaredLength !== null &&
    declaredLength > GOOGLE_PLACES_MAX_REQUEST_BODY_BYTES
  ) {
    throw new GooglePlacesProxyRequestError(
      "The address request was too large.",
      413,
    );
  }

  if (!request.body) {
    throw new GooglePlacesProxyRequestError(
      "The address request was invalid.",
      400,
    );
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > GOOGLE_PLACES_MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        throw new GooglePlacesProxyRequestError(
          "The address request was too large.",
          413,
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(body),
    ) as unknown;
  } catch {
    throw new GooglePlacesProxyRequestError(
      "The address request was invalid.",
      400,
    );
  }
}

function signCapabilityPayload(payload: string) {
  if (!env.AUTH_SECRET) {
    throw new Error(
      "AUTH_SECRET is required to protect Google Places guest capabilities.",
    );
  }

  return createHmac("sha256", env.AUTH_SECRET)
    .update(payload)
    .digest("base64url");
}

function createCapabilityToken() {
  const id = randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + capabilityLifetimeSeconds;
  const payload = `${id}.${expiresAt}`;

  return {
    id,
    token: `${payload}.${signCapabilityPayload(payload)}`,
  };
}

function parseCapabilityToken(value: string | null) {
  if (!value) {
    return null;
  }

  const [id, rawExpiresAt, signature, ...rest] = value.split(".");

  if (
    rest.length > 0 ||
    !id ||
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !rawExpiresAt ||
    !signature
  ) {
    return null;
  }

  const expiresAt = Number(rawExpiresAt);

  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  const payload = `${id}.${rawExpiresAt}`;
  const expectedSignature = signCapabilityPayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  return { id };
}

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const candidateName = part.slice(0, separatorIndex).trim();

    if (candidateName === name) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }

  return null;
}

function serializeCapabilityCookie(token: string) {
  return [
    `${capabilityCookieName}=${encodeURIComponent(token)}`,
    "Path=/api/places",
    `Max-Age=${capabilityLifetimeSeconds}`,
    "HttpOnly",
    "SameSite=Strict",
    process.env.NODE_ENV === "production" ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

export function getGooglePlacesCapability(request: Request) {
  const existing = parseCapabilityToken(
    cookieValue(request, capabilityCookieName),
  );

  if (existing) {
    return {
      id: existing.id,
      setCookieHeader: null,
    };
  }

  const created = createCapabilityToken();

  return {
    id: created.id,
    setCookieHeader: serializeCapabilityCookie(created.token),
  };
}

export function requireGooglePlacesCapability(request: Request) {
  return parseCapabilityToken(cookieValue(request, capabilityCookieName));
}

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function autocompleteSessionCountKey(capabilityId: string, sessionToken: string) {
  return `places:autocomplete-session-count:${stableHash(capabilityId)}:${stableHash(
    sessionToken,
  )}`;
}

function allowedPlacesKey(capabilityId: string, sessionToken: string) {
  return `places:allowed-place:${stableHash(capabilityId)}:${stableHash(
    sessionToken,
  )}`;
}

export async function beginGooglePlacesAutocompleteSession({
  capabilityId,
  sessionToken,
}: {
  capabilityId: string;
  sessionToken: string;
}) {
  const redis = await getRedis();
  const key = autocompleteSessionCountKey(capabilityId, sessionToken);
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, sessionLifetimeSeconds);
  }

  return count <= maximumAutocompleteRequestsPerSession;
}

export async function registerGooglePlacesSuggestions({
  capabilityId,
  placeIds,
  sessionToken,
}: {
  capabilityId: string;
  placeIds: string[];
  sessionToken: string;
}) {
  if (placeIds.length === 0) {
    return;
  }

  const redis = await getRedis();
  const key = allowedPlacesKey(capabilityId, sessionToken);

  await redis.sAdd(key, placeIds.map(stableHash));
  await redis.expire(key, sessionLifetimeSeconds);
}

export async function consumeGooglePlaceSuggestion({
  capabilityId,
  placeId,
  sessionToken,
}: {
  capabilityId: string;
  placeId: string;
  sessionToken: string;
}) {
  const redis = await getRedis();
  const key = allowedPlacesKey(capabilityId, sessionToken);

  return (await redis.sRem(key, stableHash(placeId))) === 1;
}

export async function isGooglePlaceSuggestionAllowed({
  capabilityId,
  placeId,
  sessionToken,
}: {
  capabilityId: string;
  placeId: string;
  sessionToken: string;
}) {
  const redis = await getRedis();
  const key = allowedPlacesKey(capabilityId, sessionToken);

  return await redis.sIsMember(key, stableHash(placeId));
}

export async function closeGooglePlacesSession({
  capabilityId,
  sessionToken,
}: {
  capabilityId: string;
  sessionToken: string;
}) {
  const redis = await getRedis();

  await redis.del([
    autocompleteSessionCountKey(capabilityId, sessionToken),
    allowedPlacesKey(capabilityId, sessionToken),
  ]);
}
