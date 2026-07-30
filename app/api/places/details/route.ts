import { z } from "zod";

import { getGooglePlacesIntegrationConfig } from "@/src/modules/marketplace/settings";
import {
  GooglePlacesApiError,
  createGooglePlacesClient,
  isSameOriginGooglePlacesRequest,
} from "@/src/modules/places/google-places";
import {
  GooglePlacesProxyRequestError,
  closeGooglePlacesSession,
  consumeGooglePlaceSuggestion,
  getGooglePlacesAllowedOrigins,
  isGooglePlaceSuggestionAllowed,
  readGooglePlacesJsonBody,
  requireGooglePlacesCapability,
} from "@/src/modules/places/google-places-proxy";
import {
  checkRateLimit,
  getClientIp,
} from "@/src/modules/security/rate-limit";

export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

const requestSchema = z
  .object({
    countryCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .transform((value) => value.toUpperCase())
      .refine((value) => value === "ZA")
      .default("ZA"),
    placeId: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .regex(/^[A-Za-z0-9_-]+$/),
    sessionToken: z.string().uuid(),
  })
  .strict();

function unavailableResponse(status = 503) {
  return Response.json(
    {
      error: "places_unavailable",
      message:
        "That address could not be filled automatically. Enter the address manually.",
    },
    { headers: noStoreHeaders, status },
  );
}

export async function POST(request: Request) {
  if (
    !isSameOriginGooglePlacesRequest({
      allowedOrigins: getGooglePlacesAllowedOrigins(),
      origin: request.headers.get("origin"),
      requestUrl: request.url,
    })
  ) {
    return Response.json(
      {
        error: "forbidden_origin",
        message: "Address details must be requested from this website.",
      },
      { headers: noStoreHeaders, status: 403 },
    );
  }

  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit({
    key: `places-details:${clientIp}`,
    limit: 30,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: "rate_limited",
        message: "Please wait before selecting another address.",
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
    body = await readGooglePlacesJsonBody(request);
  } catch (error) {
    const status =
      error instanceof GooglePlacesProxyRequestError ? error.status : 400;

    return Response.json(
      {
        error: status === 413 ? "request_too_large" : "invalid_json",
        message: "The address selection request was invalid.",
      },
      { headers: noStoreHeaders, status },
    );
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "invalid_request",
        message: "Choose a valid address suggestion.",
      },
      { headers: noStoreHeaders, status: 400 },
    );
  }

  try {
    const capability = requireGooglePlacesCapability(request);

    if (!capability) {
      return Response.json(
        {
          error: "invalid_places_session",
          message:
            "That address-search session expired. Search again or finish the address manually.",
        },
        { headers: noStoreHeaders, status: 403 },
      );
    }

    const config = await getGooglePlacesIntegrationConfig();

    if (!config.enabled || !config.apiKey) {
      return unavailableResponse();
    }

    const allowedSuggestion = await isGooglePlaceSuggestionAllowed({
      capabilityId: capability.id,
      placeId: parsed.data.placeId,
      sessionToken: parsed.data.sessionToken,
    });

    if (!allowedSuggestion) {
      return Response.json(
        {
          error: "invalid_places_session",
          message:
            "Choose an address from the current suggestions or finish it manually.",
        },
        { headers: noStoreHeaders, status: 403 },
      );
    }

    const globalRateLimit = await checkRateLimit({
      key: "places-details:global",
      limit: 150,
      windowSeconds: 60,
    });

    if (!globalRateLimit.allowed) {
      return Response.json(
        {
          error: "places_capacity_reached",
          message:
            "Address selection is busy right now. Review and finish the address manually.",
        },
        {
          headers: {
            ...noStoreHeaders,
            "Retry-After": String(globalRateLimit.retryAfterSeconds),
          },
          status: 429,
        },
      );
    }

    const consumedSuggestion = await consumeGooglePlaceSuggestion({
      capabilityId: capability.id,
      placeId: parsed.data.placeId,
      sessionToken: parsed.data.sessionToken,
    });

    if (!consumedSuggestion) {
      return Response.json(
        {
          error: "invalid_places_session",
          message:
            "Choose an address from the current suggestions or finish it manually.",
        },
        { headers: noStoreHeaders, status: 403 },
      );
    }

    const client = createGooglePlacesClient({
      apiKey: config.apiKey,
    });
    const address = await client.details({
      placeId: parsed.data.placeId,
      regionCode: config.countryCode,
      sessionToken: parsed.data.sessionToken,
    });

    try {
      await closeGooglePlacesSession({
        capabilityId: capability.id,
        sessionToken: parsed.data.sessionToken,
      });
    } catch {
      console.error(
        "Google Places session cleanup failed after a successful details request.",
      );
    }

    if (address.countryCode !== config.countryCode) {
      return Response.json(
        {
          error: "country_mismatch",
          message: "Choose an address in the selected country.",
        },
        { headers: noStoreHeaders, status: 400 },
      );
    }

    return Response.json(
      { address },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof GooglePlacesApiError) {
      console.error("Google Places details request failed.", {
        code: error.code,
        status: error.status,
      });

      return unavailableResponse(error.code === "timeout" ? 504 : 503);
    }

    console.error("Google Places details request failed.");
    return unavailableResponse();
  }
}
