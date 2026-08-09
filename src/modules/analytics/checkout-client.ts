"use client";

import type {
  CheckoutAnalyticsEventInput,
  CheckoutAnalyticsEventName,
} from "@/src/modules/analytics/checkout-contracts";

const CHECKOUT_ANALYTICS_ENDPOINT = "/api/analytics/checkout";
const LEGACY_CHECKOUT_ANALYTICS_SESSION_STORAGE_KEY =
  "jurgens:analytics:checkout-session:v1";
const CHECKOUT_ANALYTICS_SESSION_STORAGE_KEY =
  "jurgens:analytics:commerce-session:v2";
const CHECKOUT_ANALYTICS_SESSION_TTL_MS = 30 * 60 * 1_000;

type StoredCheckoutAnalyticsSession = {
  checkoutStartedAt?: number;
  lastActivityAt: number;
  sessionId: string;
  version: 2;
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

function parseStoredSession(value: string): StoredCheckoutAnalyticsSession | null {
  const parsed = JSON.parse(value) as {
    checkoutStartedAt?: unknown;
    lastActivityAt?: unknown;
    sessionId?: unknown;
    version?: unknown;
  };

  if (
    (parsed.version !== 1 && parsed.version !== 2) ||
    typeof parsed.lastActivityAt !== "number" ||
    !Number.isFinite(parsed.lastActivityAt) ||
    typeof parsed.sessionId !== "string"
  ) {
    return null;
  }

  return {
    ...(typeof parsed.checkoutStartedAt === "number" &&
    Number.isFinite(parsed.checkoutStartedAt)
      ? { checkoutStartedAt: parsed.checkoutStartedAt }
      : {}),
    lastActivityAt: parsed.lastActivityAt,
    sessionId: parsed.sessionId,
    version: 2,
  };
}

function readStoredSession(): StoredCheckoutAnalyticsSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const currentValue = window.sessionStorage.getItem(
      CHECKOUT_ANALYTICS_SESSION_STORAGE_KEY,
    );

    if (currentValue) {
      return parseStoredSession(currentValue);
    }

    const legacyValue = window.sessionStorage.getItem(
      LEGACY_CHECKOUT_ANALYTICS_SESSION_STORAGE_KEY,
    );

    if (!legacyValue) {
      return null;
    }

    const migrated = parseStoredSession(legacyValue);

    if (migrated) {
      writeStoredSession(migrated);
      window.sessionStorage.removeItem(
        LEGACY_CHECKOUT_ANALYTICS_SESSION_STORAGE_KEY,
      );
    }

    return migrated;
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
  _cartSignature = "commerce-journey",
  now = Date.now(),
) {
  if (typeof window === "undefined") {
    return null;
  }

  // Kept for checkout call-site compatibility; journey identity no longer
  // changes whenever the cart contents change.
  void _cartSignature;

  const existing = readStoredSession();

  if (
    existing &&
    now >= existing.lastActivityAt &&
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
    lastActivityAt: now,
    sessionId,
    version: 2,
  });

  return sessionId;
}

export function completeCheckoutAnalyticsSession(sessionId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const stored = readStoredSession();

    if (!sessionId || stored?.sessionId === sessionId) {
      window.sessionStorage.removeItem(
        CHECKOUT_ANALYTICS_SESSION_STORAGE_KEY,
      );
      window.sessionStorage.removeItem(
        LEGACY_CHECKOUT_ANALYTICS_SESSION_STORAGE_KEY,
      );
    }
  } catch {
    // Journey cleanup is best effort and must never interrupt confirmation.
  }
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
    writeStoredSession({
      ...stored,
      ...(event === "started" && !stored.checkoutStartedAt
        ? { checkoutStartedAt: Date.now() }
        : {}),
      lastActivityAt: Date.now(),
    });
  }

  const payload: CheckoutAnalyticsEventInput = {
    ...(cart ? { cart } : {}),
    ...(errorCode ? { errorCode } : {}),
    event,
    eventId,
    ...(event === "started" || event === "add_to_cart"
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

export function recordAddToCartAnalyticsEvent({
  productId,
  quantity,
  variantId,
}: {
  productId: string;
  quantity: number;
  variantId: string;
}) {
  const sessionId = getOrCreateCheckoutAnalyticsSession();

  if (!sessionId) {
    return;
  }

  void sendAddToCartAnalyticsEvent({
    allowSessionRefresh: true,
    productId,
    quantity,
    sessionId,
    variantId,
  }).catch(() => {
    // Cart behavior must remain reliable when telemetry is unavailable.
  });
}

async function sendAddToCartAnalyticsEvent({
  allowSessionRefresh,
  productId,
  quantity,
  sessionId,
  variantId,
}: {
  allowSessionRefresh: boolean;
  productId: string;
  quantity: number;
  sessionId: string;
  variantId: string;
}) {

  const eventId = createUuid();

  if (!eventId) {
    return;
  }

  const payload: CheckoutAnalyticsEventInput = {
    event: "add_to_cart",
    eventId,
    landingPath: window.location.pathname,
    product: { productId, quantity, variantId },
    referrerHost: getReferrerHost(),
    sessionId,
  };

  const response = await fetch(CHECKOUT_ANALYTICS_ENDPOINT, {
    body: JSON.stringify(payload),
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  });

  if (!allowSessionRefresh || response.status !== 409) {
    return;
  }

  const result = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;

  if (result?.error !== "analytics_session_completed") {
    return;
  }

  completeCheckoutAnalyticsSession(sessionId);
  const replacementSessionId = getOrCreateCheckoutAnalyticsSession();

  if (!replacementSessionId || replacementSessionId === sessionId) {
    return;
  }

  await sendAddToCartAnalyticsEvent({
    allowSessionRefresh: false,
    productId,
    quantity,
    sessionId: replacementSessionId,
    variantId,
  });
}
