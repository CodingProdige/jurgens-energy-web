import { z } from "zod";

export const GOOGLE_PLACES_API_BASE_URL = "https://places.googleapis.com/v1";
export const GOOGLE_PLACES_AUTOCOMPLETE_FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text.text",
  "suggestions.placePrediction.structuredFormat.mainText.text",
  "suggestions.placePrediction.structuredFormat.secondaryText.text",
].join(",");
export const GOOGLE_PLACE_DETAILS_FIELD_MASK = [
  "id",
  "formattedAddress",
  "addressComponents",
].join(",");

const defaultTimeoutMs = 7_000;
const maximumSuggestions = 8;

const clientConfigSchema = z
  .object({
    apiBaseUrl: z
      .string()
      .trim()
      .url()
      .default(GOOGLE_PLACES_API_BASE_URL)
      .transform((value) => value.replace(/\/+$/, "")),
    apiKey: z.string().trim().min(1, "A Google Places API key is required."),
    timeoutMs: z.number().int().min(250).max(30_000).default(defaultTimeoutMs),
  })
  .strict();

const regionCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/)
  .transform((value) => value.toLowerCase());

const googleTextSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
});

const googleAutocompleteResponseSchema = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string().trim().min(1).max(300),
            structuredFormat: z
              .object({
                mainText: googleTextSchema.optional(),
                secondaryText: googleTextSchema.optional(),
              })
              .optional(),
            text: googleTextSchema,
          })
          .optional(),
      }),
    )
    .max(20)
    .default([]),
});

const googleAddressComponentSchema = z.object({
  longText: z.string().trim().max(500).default(""),
  shortText: z.string().trim().max(500).default(""),
  types: z.array(z.string().trim().max(100)).max(20).default([]),
});

const googlePlaceDetailsResponseSchema = z.object({
  addressComponents: z.array(googleAddressComponentSchema).max(100).default([]),
  formattedAddress: z.string().trim().max(2_000).default(""),
  id: z.string().trim().min(1).max(300),
});

type GoogleAddressComponent = z.infer<typeof googleAddressComponentSchema>;

export type GooglePlacesFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type GooglePlacesClientConfig = {
  apiBaseUrl?: string;
  apiKey: string;
  timeoutMs?: number;
};

export type GooglePlacesAutocompleteInput = {
  includedRegionCodes?: string[];
  input: string;
  sessionToken?: string;
};

export type GooglePlaceDetailsInput = {
  placeId: string;
  regionCode?: string;
  sessionToken?: string;
};

export type GooglePlaceSuggestion = {
  mainText: string;
  placeId: string;
  secondaryText: string;
  text: string;
};

export type ResolvedGooglePostalAddress = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  countryCode: string;
  formattedAddress: string;
  placeId: string;
  postalCode: string;
  province: string;
  suburb: string;
};

export type GooglePlacesErrorCode =
  | "configuration_error"
  | "invalid_provider_response"
  | "provider_error"
  | "timeout";

export function isSameOriginGooglePlacesRequest({
  allowedOrigins,
  origin,
  requestHost,
}: {
  allowedOrigins?: ReadonlySet<string>;
  origin: string | null;
  requestHost: string | null;
}) {
  if (!origin || !requestHost) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    const normalizedRequestHost = requestHost
      .split(",", 1)[0]
      ?.trim()
      .toLowerCase();

    if (
      !normalizedRequestHost ||
      originUrl.origin !== origin ||
      originUrl.host.toLowerCase() !== normalizedRequestHost
    ) {
      return false;
    }

    return allowedOrigins ? allowedOrigins.has(originUrl.origin) : true;
  } catch {
    return false;
  }
}

export class GooglePlacesApiError extends Error {
  readonly code: GooglePlacesErrorCode;
  readonly status: number | null;

  constructor({
    code,
    message,
    status,
  }: {
    code: GooglePlacesErrorCode;
    message: string;
    status?: number;
  }) {
    super(message);
    this.name = "GooglePlacesApiError";
    this.code = code;
    this.status = status ?? null;
  }
}

function normalizeComparable(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const southAfricanProvinceAliases: Array<
  [province: string, aliases: readonly string[]]
> = [
  ["Eastern Cape", ["Eastern Cape", "EC"]],
  ["Free State", ["Free State", "FS"]],
  ["Gauteng", ["Gauteng", "GP", "GT"]],
  ["KwaZulu-Natal", ["KwaZulu-Natal", "KwaZulu Natal", "KZN", "Natal"]],
  ["Limpopo", ["Limpopo", "LP"]],
  ["Mpumalanga", ["Mpumalanga", "MP"]],
  ["North West", ["North West", "North-West", "NW"]],
  ["Northern Cape", ["Northern Cape", "NC"]],
  ["Western Cape", ["Western Cape", "WC"]],
];

const southAfricanProvinceByAlias = new Map<string, string>(
  southAfricanProvinceAliases.flatMap(([province, aliases]) =>
    aliases.map(
      (alias) => [normalizeComparable(alias), province] as const,
    ),
  ),
);

export function normalizeSouthAfricanProvince(
  value: string | null | undefined,
) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  return southAfricanProvinceByAlias.get(normalizeComparable(trimmed)) ?? trimmed;
}

function componentForType(
  components: GoogleAddressComponent[],
  ...types: string[]
) {
  for (const type of types) {
    const component = components.find((candidate) =>
      candidate.types.includes(type),
    );

    if (component) {
      return component;
    }
  }

  return null;
}

function componentLongText(
  components: GoogleAddressComponent[],
  ...types: string[]
) {
  return componentForType(components, ...types)?.longText.trim() ?? "";
}

function componentShortText(
  components: GoogleAddressComponent[],
  ...types: string[]
) {
  const component = componentForType(components, ...types);

  return component?.shortText.trim() || component?.longText.trim() || "";
}

function joinDistinctParts(parts: string[]) {
  const seen = new Set<string>();

  return parts
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) {
        return false;
      }

      const comparable = normalizeComparable(part);

      if (!comparable || seen.has(comparable)) {
        return false;
      }

      seen.add(comparable);
      return true;
    })
    .join(", ");
}

export function parseGooglePlaceAddress(
  rawPlace: unknown,
): ResolvedGooglePostalAddress {
  const parsed = googlePlaceDetailsResponseSchema.safeParse(rawPlace);

  if (!parsed.success) {
    throw new GooglePlacesApiError({
      code: "invalid_provider_response",
      message:
        "Google Places returned address information in an unsupported format.",
    });
  }

  const place = parsed.data;
  const components = place.addressComponents;
  const streetNumber = componentLongText(components, "street_number");
  const route = componentLongText(components, "route");
  const premise = componentLongText(components, "premise");
  const subpremise = componentLongText(components, "subpremise");
  const streetAddress = [streetNumber, route].filter(Boolean).join(" ").trim();
  const formattedAddressFirstLine =
    place.formattedAddress.split(",")[0]?.trim() ?? "";
  const addressLine1 =
    streetAddress || premise || subpremise || formattedAddressFirstLine;
  const addressLine2 = streetAddress
    ? joinDistinctParts([subpremise, premise])
    : premise
      ? subpremise
      : formattedAddressFirstLine
        ? joinDistinctParts([subpremise, premise])
      : "";
  const city = componentLongText(
    components,
    "locality",
    "postal_town",
    "administrative_area_level_3",
    "administrative_area_level_2",
  );
  const suburbCandidate = componentLongText(
    components,
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
  );
  const suburb =
    normalizeComparable(suburbCandidate) === normalizeComparable(city)
      ? ""
      : suburbCandidate;
  const provinceComponent = componentForType(
    components,
    "administrative_area_level_1",
  );
  const province = normalizeSouthAfricanProvince(
    provinceComponent?.longText || provinceComponent?.shortText,
  );
  const countryCode = componentShortText(components, "country").toUpperCase();
  const postalCode = componentLongText(components, "postal_code");
  const postalCodeSuffix = componentLongText(
    components,
    "postal_code_suffix",
  );

  return {
    addressLine1,
    addressLine2,
    city,
    countryCode,
    formattedAddress: place.formattedAddress,
    placeId: place.id,
    postalCode:
      postalCode && postalCodeSuffix
        ? `${postalCode}-${postalCodeSuffix}`
        : postalCode,
    province,
    suburb,
  };
}

function safeProviderMessage(operation: "autocomplete" | "details") {
  return operation === "autocomplete"
    ? "Address suggestions are temporarily unavailable. Enter the address manually."
    : "That address could not be filled automatically. Enter the address manually.";
}

async function requestGooglePlaces({
  apiKey,
  fetchImpl,
  init,
  operation,
  timeoutMs,
  url,
}: {
  apiKey: string;
  fetchImpl: GooglePlacesFetch;
  init: RequestInit;
  operation: "autocomplete" | "details";
  timeoutMs: number;
  url: URL;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-Goog-Api-Key": apiKey,
        ...init.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new GooglePlacesApiError({
        code: "provider_error",
        message: safeProviderMessage(operation),
        status: response.status,
      });
    }

    try {
      return await response.json();
    } catch {
      throw new GooglePlacesApiError({
        code: "invalid_provider_response",
        message: safeProviderMessage(operation),
      });
    }
  } catch (error) {
    if (error instanceof GooglePlacesApiError) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new GooglePlacesApiError({
        code: "timeout",
        message: safeProviderMessage(operation),
      });
    }

    throw new GooglePlacesApiError({
      code: "provider_error",
      message: safeProviderMessage(operation),
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeRegionCodes(values: string[] | undefined) {
  const parsed = z.array(regionCodeSchema).min(1).max(15).safeParse(
    values?.length ? values : ["za"],
  );

  if (!parsed.success) {
    throw new GooglePlacesApiError({
      code: "configuration_error",
      message: "Google Places received an invalid region configuration.",
    });
  }

  return Array.from(new Set(parsed.data));
}

export function createGooglePlacesClient(
  rawConfig: GooglePlacesClientConfig,
  fetchImpl: GooglePlacesFetch = fetch,
) {
  const parsedConfig = clientConfigSchema.safeParse(rawConfig);

  if (!parsedConfig.success) {
    throw new GooglePlacesApiError({
      code: "configuration_error",
      message: "Google Places is not configured.",
    });
  }

  const config = parsedConfig.data;

  return {
    async autocomplete(
      input: GooglePlacesAutocompleteInput,
    ): Promise<GooglePlaceSuggestion[]> {
      const query = input.input.trim();

      if (query.length < 3 || query.length > 240) {
        throw new GooglePlacesApiError({
          code: "configuration_error",
          message: "Enter at least three characters for address suggestions.",
        });
      }

      const includedRegionCodes = normalizeRegionCodes(
        input.includedRegionCodes,
      );
      const body = {
        includePureServiceAreaBusinesses: false,
        includeQueryPredictions: false,
        includedRegionCodes,
        input: query,
        languageCode: "en",
        regionCode: includedRegionCodes[0],
        ...(input.sessionToken ? { sessionToken: input.sessionToken } : {}),
      };
      const payload = await requestGooglePlaces({
        apiKey: config.apiKey,
        fetchImpl,
        init: {
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
            "X-Goog-FieldMask": GOOGLE_PLACES_AUTOCOMPLETE_FIELD_MASK,
          },
          method: "POST",
        },
        operation: "autocomplete",
        timeoutMs: config.timeoutMs,
        url: new URL(`${config.apiBaseUrl}/places:autocomplete`),
      });
      const parsed = googleAutocompleteResponseSchema.safeParse(payload);

      if (!parsed.success) {
        throw new GooglePlacesApiError({
          code: "invalid_provider_response",
          message: safeProviderMessage("autocomplete"),
        });
      }

      return parsed.data.suggestions
        .flatMap((suggestion) => {
          const prediction = suggestion.placePrediction;

          if (!prediction) {
            return [];
          }

          return [
            {
              mainText:
                prediction.structuredFormat?.mainText?.text ??
                prediction.text.text,
              placeId: prediction.placeId,
              secondaryText:
                prediction.structuredFormat?.secondaryText?.text ?? "",
              text: prediction.text.text,
            },
          ];
        })
        .slice(0, maximumSuggestions);
    },

    async details(
      input: GooglePlaceDetailsInput,
    ): Promise<ResolvedGooglePostalAddress> {
      const placeId = input.placeId.trim();

      if (!placeId || placeId.length > 300 || !/^[A-Za-z0-9_-]+$/.test(placeId)) {
        throw new GooglePlacesApiError({
          code: "configuration_error",
          message: "Choose a valid address suggestion.",
        });
      }

      const regionCode = regionCodeSchema.safeParse(input.regionCode ?? "za");

      if (!regionCode.success) {
        throw new GooglePlacesApiError({
          code: "configuration_error",
          message: "Google Places received an invalid region configuration.",
        });
      }

      const url = new URL(
        `${config.apiBaseUrl}/places/${encodeURIComponent(placeId)}`,
      );
      url.searchParams.set("languageCode", "en");
      url.searchParams.set("regionCode", regionCode.data);

      if (input.sessionToken) {
        url.searchParams.set("sessionToken", input.sessionToken);
      }

      const payload = await requestGooglePlaces({
        apiKey: config.apiKey,
        fetchImpl,
        init: {
          headers: {
            "X-Goog-FieldMask": GOOGLE_PLACE_DETAILS_FIELD_MASK,
          },
          method: "GET",
        },
        operation: "details",
        timeoutMs: config.timeoutMs,
        url,
      });

      return parseGooglePlaceAddress(payload);
    },
  };
}
