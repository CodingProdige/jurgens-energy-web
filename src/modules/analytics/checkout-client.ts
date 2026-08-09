"use client";

import type {
  CheckoutAnalyticsEventInput,
  CheckoutAnalyticsEventName,
} from "@/src/modules/analytics/checkout-contracts";

const CHECKOUT_ANALYTICS_ENDPOINT = "/api/analytics/checkout";
const CHECKOUT_ANALYTICS_SESSION_STORAGE_KEY =
  "jurgens:analytics:checkout-session:v1";
const CHECKOUT_ANALYTICS_SESSION_TTL_MS = 30 * 60 * 1_000;

type StoredCheckoutAnalyticsSession = {
  cartSignature: string;
  lastActivityAt: number;
  sessionId: string;
  version: 1;
};

export type CheckoutAnalyticsCartSnapshot = NonNullable<
  CheckoutAnalyticsEventInput["cart"]
>;

function createUuid() {
  if (typeof crypto === "undefined" || !crypto.randomUUID) {
    return null;
  }

  return crypto.randomUUID();
}

function readStoredSession(): StoredCheckoutAnalyticsSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem(
      CHECKOUT_ANALYTICS_SESSION_STORAGE_KEY,
    );

    if (!value) {
      return null;
    }

    const parsed = JSON.parse(value) as Partial<StoredCheckoutAnalyticsSession>;

    if (
      parsed.version !== 1 ||
      typeof parsed.cartSignature !== "string" ||
      typeof parsed.lastActivityAt !== "number" ||
      !Number.isFinite(parsed.lastActivityAt) ||
      typeof parsed.sessionId !== "string"
    ) {
      return null;
    }

    return parsed as StoredCheckoutAnalyticsSession;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredCheckoutAnalyticsSession) {
  try {
    window.sessionStorage.setItem(
      CHECKOUT_ANALYTICS_SESSION_STORAGE_KEY,
      JSON.stringify(session),
    );
  } catch {
    // Analytics must never block checkout when storage is unavailable.
  }
}

export function getOrCreateCheckoutAnalyticsSession(
  cartSignature: string,
  now = Date.now(),
) {
  if (typeof window === "undefined" || !cartSignature) {
    return null;
  }

  const existing = readStoredSession();

  if (
    existing &&
    existing.cartSignature === cartSignature &&
    now - existing.lastActivityAt <= CHECKOUT_ANALYTICS_SESSION_TTL_MS
  ) {
    const refreshed = { ...existing, lastActivityAt: now };
    writeStoredSession(refreshed);
    return refreshed.sessionId;
  }

  const sessionId = createUuid();

  if (!sessionId) {
    return null;
  }

  writeStoredSession({
    cartSignature,
    lastActivityAt: now,
    sessionId,
    version: 1,
  });

  return sessionId;
}

function getReferrerHost() {
  if (!document.referrer) {
    return undefined;
  }

  try {
    const referrer = new URL(document.referrer);

    if (referrer.origin === window.location.origin) {
      return undefined;
    }

    return referrer.host.toLowerCase() || undefined;
  } catch {
    return undefined;
  }
}

export function recordCheckoutAnalyticsEvent({
  cart,
  errorCode,
  event,
  sessionId,
}: {
  cart?: CheckoutAnalyticsCartSnapshot;
  errorCode?: string;
  event: CheckoutAnalyticsEventName;
  sessionId: string | null;
}) {
  if (typeof window === "undefined" || !sessionId) {
    return;
  }

  const eventId = createUuid();

  if (!eventId) {
    return;
  }

  const stored = readStoredSession();

  if (stored?.sessionId === sessionId) {
    writeStoredSession({ ...stored, lastActivityAt: Date.now() });
  }

  const payload: CheckoutAnalyticsEventInput = {
    ...(cart ? { cart } : {}),
    ...(errorCode ? { errorCode } : {}),
    event,
    eventId,
    ...(event === "started"
      ? {
          landingPath: window.location.pathname,
          referrerHost: getReferrerHost(),
        }
      : {}),
    sessionId,
  };

  void fetch(CHECKOUT_ANALYTICS_ENDPOINT, {
    body: JSON.stringify(payload),
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => {
    // First-party telemetry is best effort and must never interrupt checkout.
  });
}
