import { createHmac } from "node:crypto";

import { cookies } from "next/headers";

import { auth } from "@/auth";
import { env } from "@/src/config/env";
import {
  CheckoutAnalyticsCompletedSessionError,
  CheckoutAnalyticsConflictError,
  CheckoutAnalyticsOrderNotFoundError,
  CheckoutAnalyticsProductNotFoundError,
  recordCheckoutAnalyticsEvent,
} from "@/src/modules/analytics/checkout";
import {
  checkoutAnalyticsPublicEventInputSchema,
  classifyCheckoutDevice,
  isSameOriginCheckoutAnalyticsRequest,
} from "@/src/modules/analytics/checkout-contracts";
import {
  CAMPAIGN_ATTRIBUTION_COOKIE_NAME,
  parseCampaignAttributionCookie,
} from "@/src/modules/marketing/campaign-attribution";
import {
  checkRateLimit,
  getClientIp,
} from "@/src/modules/security/rate-limit";

export const runtime = "nodejs";

const maximumRequestBodyBytes = 16 * 1_024;
const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

class CheckoutAnalyticsRequestError extends Error {
  readonly status: 400 | 413 | 415;

  constructor(message: string, status: 400 | 413 | 415) {
    super(message);
    this.name = "CheckoutAnalyticsRequestError";
    this.status = status;
  }
}

function getAllowedOrigins() {
  return new Set([new URL(env.APP_URL).origin]);
}

function createRateLimitIdentity(clientIp: string) {
  return createHmac(
    "sha256",
    env.AUTH_SECRET ?? "jurgens-checkout-analytics-rate-limit",
  )
    .update(clientIp)
    .digest("hex");
}

async function readJsonBody(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];

  if (contentType?.trim().toLowerCase() !== "application/json") {
    throw new CheckoutAnalyticsRequestError(
      "Checkout analytics requires a JSON request body.",
      415,
    );
  }

  const contentLength = request.headers.get("content-length");

  if (contentLength) {
    const parsedLength = Number(contentLength);

    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      throw new CheckoutAnalyticsRequestError(
        "Checkout analytics request size is invalid.",
        400,
      );
    }

    if (parsedLength > maximumRequestBodyBytes) {
      throw new CheckoutAnalyticsRequestError(
        "Checkout analytics request is too large.",
        413,
      );
    }
  }

  const body = await request.text();

  if (new TextEncoder().encode(body).byteLength > maximumRequestBodyBytes) {
    throw new CheckoutAnalyticsRequestError(
      "Checkout analytics request is too large.",
      413,
    );
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new CheckoutAnalyticsRequestError(
      "Checkout analytics request is invalid JSON.",
      400,
    );
  }
}

export async function POST(request: Request) {
  if (
    !isSameOriginCheckoutAnalyticsRequest({
      allowedOrigins: getAllowedOrigins(),
      origin: request.headers.get("origin"),
      requestHost:
        request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    })
  ) {
    return Response.json(
      {
        error: "forbidden_origin",
        message: "Checkout analytics must be sent from this website.",
      },
      { headers: noStoreHeaders, status: 403 },
    );
  }

  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit({
    key: `checkout-analytics:${createRateLimitIdentity(clientIp)}`,
    limit: 120,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: "rate_limited",
        message: "Too many checkout analytics events were submitted.",
      },
      {
        headers: {
          ...noStoreHeaders,
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
        status: 429,
      },
    );
  }

  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    const status =
      error instanceof CheckoutAnalyticsRequestError ? error.status : 400;

    return Response.json(
      {
        error:
          status === 413
            ? "request_too_large"
            : status === 415
              ? "unsupported_media_type"
              : "invalid_json",
        message: "The checkout analytics request could not be read.",
      },
      { headers: noStoreHeaders, status },
    );
  }

  const parsed = checkoutAnalyticsPublicEventInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "invalid_event",
        message: "The checkout analytics event was invalid.",
      },
      { headers: noStoreHeaders, status: 400 },
    );
  }

  try {
    const [session, cookieStore] = await Promise.all([auth(), cookies()]);
    const campaignAttribution = parseCampaignAttributionCookie(
      cookieStore.get(CAMPAIGN_ATTRIBUTION_COOKIE_NAME)?.value,
    );
    const result = await recordCheckoutAnalyticsEvent(parsed.data, {
      campaignAttribution,
      deviceCategory: classifyCheckoutDevice(
        request.headers.get("user-agent"),
      ),
      userId: session?.user?.id ?? null,
    });

    return Response.json(
      { ok: true, ...result },
      {
        headers: noStoreHeaders,
        status: result.duplicate ? 200 : 201,
      },
    );
  } catch (error) {
    if (error instanceof CheckoutAnalyticsCompletedSessionError) {
      return Response.json(
        {
          error: "analytics_session_completed",
          message: "A new commerce journey is required.",
        },
        { headers: noStoreHeaders, status: 409 },
      );
    }

    if (
      error instanceof CheckoutAnalyticsConflictError ||
      error instanceof CheckoutAnalyticsOrderNotFoundError ||
      error instanceof CheckoutAnalyticsProductNotFoundError
    ) {
      return Response.json(
        {
          error: "analytics_conflict",
          message: "The checkout analytics event could not be linked safely.",
        },
        { headers: noStoreHeaders, status: 409 },
      );
    }

    console.error("[checkout-analytics] event persistence failed", {
      error: error instanceof Error ? error.name : "unknown_error",
    });

    return Response.json(
      {
        error: "analytics_unavailable",
        message: "Checkout analytics is temporarily unavailable.",
      },
      { headers: noStoreHeaders, status: 503 },
    );
  }
}
