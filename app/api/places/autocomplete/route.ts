import { z } from "zod";

import { getGooglePlacesIntegrationConfig } from "@/src/modules/marketplace/settings";
import {
  GooglePlacesApiError,
  createGooglePlacesClient,
  isSameOriginGooglePlacesRequest,
} from "@/src/modules/places/google-places";
import {
  GooglePlacesProxyRequestError,
  beginGooglePlacesAutocompleteSession,
  getGooglePlacesAllowedOrigins,
  getGooglePlacesCapability,
  readGooglePlacesJsonBody,
  registerGooglePlacesSuggestions,
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
    input: z.string().trim().min(3).max(240),
    sessionToken: z.string().uuid(),
  })
  .strict();

function unavailableResponse(status = 503) {
  return Response.json(
    {
      error: "places_unavailable",
      message:
        "Address suggestions are temporarily unavailable. Enter the address manually.",
    },
    { headers: noStoreHeaders, status },
  );
}

function disabledResponse() {
  return Response.json(
    { enabled: false, suggestions: [] },
    { headers: noStoreHeaders },
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
        message: "Address suggestions must be requested from this website.",
      },
      { headers: noStoreHeaders, status: 403 },
    );
  }

  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit({
    key: `places-autocomplete:${clientIp}`,
    limit: 60,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: "rate_limited",
        message: "Please wait before requesting more address suggestions.",
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
        message: "The address suggestion request was invalid.",
      },
      { headers: noStoreHeaders, status },
    );
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "invalid_request",
        message:
          "Enter at least three address characters and start a new suggestion session.",
      },
      { headers: noStoreHeaders, status: 400 },
    );
  }

  try {
    const config = await getGooglePlacesIntegrationConfig();

    if (!config.enabled || !config.apiKey) {
      return disabledResponse();
    }

    const capability = getGooglePlacesCapability(request);
    const withinSessionLimit = await beginGooglePlacesAutocompleteSession({
      capabilityId: capability.id,
      sessionToken: parsed.data.sessionToken,
    });

    if (!withinSessionLimit) {
      return Response.json(
        {
          error: "rate_limited",
          message:
            "Start a new address search or continue entering the address manually.",
        },
        {
          headers: {
            ...noStoreHeaders,
            ...(capability.setCookieHeader
              ? { "Set-Cookie": capability.setCookieHeader }
              : {}),
          },
          status: 429,
        },
      );
    }

    const globalRateLimit = await checkRateLimit({
      key: "places-autocomplete:global",
      limit: 300,
      windowSeconds: 60,
    });

    if (!globalRateLimit.allowed) {
      return Response.json(
        {
          error: "places_capacity_reached",
          message:
            "Address suggestions are busy right now. Continue entering the address manually.",
        },
        {
          headers: {
            ...noStoreHeaders,
            ...(capability.setCookieHeader
              ? { "Set-Cookie": capability.setCookieHeader }
              : {}),
            "Retry-After": String(globalRateLimit.retryAfterSeconds),
          },
          status: 429,
        },
      );
    }

    const client = createGooglePlacesClient({
      apiKey: config.apiKey,
    });
    const suggestions = await client.autocomplete({
      includedRegionCodes: [config.countryCode],
      input: parsed.data.input,
      sessionToken: parsed.data.sessionToken,
    });
    await registerGooglePlacesSuggestions({
      capabilityId: capability.id,
      placeIds: suggestions.map((suggestion) => suggestion.placeId),
      sessionToken: parsed.data.sessionToken,
    });

    return Response.json(
      { enabled: true, suggestions },
      {
        headers: {
          ...noStoreHeaders,
          ...(capability.setCookieHeader
            ? { "Set-Cookie": capability.setCookieHeader }
            : {}),
        },
      },
    );
  } catch (error) {
    if (error instanceof GooglePlacesApiError) {
      console.error("Google Places autocomplete request failed.", {
        code: error.code,
        status: error.status,
      });

      return unavailableResponse(error.code === "timeout" ? 504 : 503);
    }

    console.error("Google Places autocomplete request failed.");
    return unavailableResponse();
  }
}
