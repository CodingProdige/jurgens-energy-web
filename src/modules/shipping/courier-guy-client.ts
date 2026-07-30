import { z } from "zod";

export const COURIER_GUY_LIVE_API_BASE_URL =
  "https://api.portal.thecourierguy.co.za/v2";
export const COURIER_GUY_SANDBOX_API_BASE_URL =
  "https://api.shiplogic.com/v2";

const identifierSchema = z.union([
  z.string().trim().min(1),
  z.number().int().nonnegative(),
]);

const providerNumberSchema = z
  .union([
    z.number().finite(),
    z
      .string()
      .trim()
      .regex(/^-?\d+(?:\.\d+)?$/, "Expected a numeric provider value."),
  ])
  .transform((value) => Number(value))
  .pipe(z.number().finite());

const dateOrDateTimeSchema = z.string().trim().refine(
  (value) => {
    if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
      return false;
    }

    return Number.isFinite(Date.parse(value));
  },
  { message: "Expected an ISO date or date-time." },
);

const timeSchema = z
  .string()
  .trim()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Expected a time in HH:mm format.");

export const courierGuyClientConfigSchema = z
  .object({
    apiBaseUrl: z
      .string()
      .trim()
      .url()
      .superRefine((value, context) => {
        const url = new URL(value);
        const isLocalHttp =
          url.protocol === "http:" &&
          (url.hostname === "localhost" || url.hostname === "127.0.0.1");

        if (url.protocol !== "https:" && !isLocalHttp) {
          context.addIssue({
            code: "custom",
            message: "Courier Guy API base URL must use HTTPS.",
          });
        }

        if (url.search || url.hash) {
          context.addIssue({
            code: "custom",
            message: "Courier Guy API base URL cannot contain a query or hash.",
          });
        }
      })
      .transform((value) => value.replace(/\/+$/, "")),
    apiKey: z.string().trim().min(1, "Courier Guy API key is required."),
    timeoutMs: z.number().int().min(100).max(120_000).default(15_000),
  })
  .strict();

export const courierGuyAddressSchema = z
  .object({
    addressType: z.enum(["business", "residential"]),
    city: z.string().trim().min(1).max(255),
    company: z.string().trim().max(255).optional(),
    countryCode: z
      .string()
      .trim()
      .length(2)
      .transform((value) => value.toUpperCase())
      .default("ZA"),
    latitude: z.number().finite().min(-90).max(90).optional(),
    localArea: z.string().trim().min(1).max(255),
    longitude: z.number().finite().min(-180).max(180).optional(),
    postalCode: z.string().trim().min(1).max(32),
    streetAddress: z.string().trim().min(1).max(255),
    zone: z.string().trim().min(1).max(255),
  })
  .strict()
  .superRefine((address, context) => {
    if (
      (address.latitude === undefined) !==
      (address.longitude === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Latitude and longitude must be provided together.",
      });
    }
  });

export const courierGuyContactSchema = z
  .object({
    email: z.string().trim().email().max(255).optional(),
    mobileNumber: z.string().trim().min(5).max(255).optional(),
    name: z.string().trim().min(1).max(255),
  })
  .strict()
  .superRefine((contact, context) => {
    if (!contact.email && !contact.mobileNumber) {
      context.addIssue({
        code: "custom",
        message: "A contact email or mobile number is required.",
      });
    }
  });

export const courierGuyParcelSchema = z
  .object({
    description: z.string().trim().min(1).max(255),
    heightMm: z.number().finite().positive(),
    itemCount: z.number().int().positive().optional(),
    lengthMm: z.number().finite().positive(),
    packaging: z.string().trim().min(1).max(255).optional(),
    weightGrams: z.number().finite().positive(),
    widthMm: z.number().finite().positive(),
  })
  .strict();

export const courierGuyCollectionOriginSchema = z.discriminatedUnion("kind", [
  z
    .object({
      address: courierGuyAddressSchema,
      kind: z.literal("address"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("pickup_point"),
      pickupPointId: z.string().trim().min(1).max(120),
      provider: z.string().trim().min(1).max(80),
    })
    .strict(),
]);

export const courierGuyRatesInputSchema = z
  .object({
    collectionMinDate: dateOrDateTimeSchema.optional(),
    collectionOrigin: courierGuyCollectionOriginSchema,
    declaredValue: z.number().finite().nonnegative().optional(),
    deliveryAddress: courierGuyAddressSchema,
    deliveryMinDate: dateOrDateTimeSchema.optional(),
    parcels: z.array(courierGuyParcelSchema).min(1).max(100),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      input.collectionOrigin.kind === "pickup_point" &&
      input.declaredValue !== undefined
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Courier Guy pickup-point shipments do not support a declared value.",
        path: ["declaredValue"],
      });
    }
  });

export const courierGuyCreateShipmentInputSchema = z
  .object({
    collectionAfter: timeSchema.optional(),
    collectionBefore: timeSchema.optional(),
    collectionContact: courierGuyContactSchema,
    collectionMinDate: dateOrDateTimeSchema.optional(),
    collectionOrigin: courierGuyCollectionOriginSchema,
    customTrackingReference: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(
        /^[A-Za-z0-9-]+$/,
        "Custom tracking reference can contain only letters, numbers and dashes.",
      )
      .optional(),
    customerReference: z.string().trim().min(1).max(255),
    customerReferenceName: z.string().trim().min(1).max(120).optional(),
    declaredValue: z.number().finite().nonnegative().optional(),
    deliveryAddress: courierGuyAddressSchema,
    deliveryAfter: timeSchema.optional(),
    deliveryBefore: timeSchema.optional(),
    deliveryContact: courierGuyContactSchema,
    deliveryMinDate: dateOrDateTimeSchema.optional(),
    dueDate: dateOrDateTimeSchema.optional(),
    muteNotifications: z.boolean().default(false),
    parcels: z.array(courierGuyParcelSchema).min(1).max(100),
    serviceLevelCode: z.string().trim().min(1).max(120).optional(),
    serviceLevelId: identifierSchema.optional(),
    specialInstructionsDelivery: z
      .string()
      .trim()
      .max(2_000)
      .optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const serviceLevelCount =
      Number(input.serviceLevelCode !== undefined) +
      Number(input.serviceLevelId !== undefined);

    if (serviceLevelCount !== 1) {
      context.addIssue({
        code: "custom",
        message:
          "Provide exactly one Courier Guy service level code or service level ID.",
        path: ["serviceLevelCode"],
      });
    }

    if (input.collectionOrigin.kind !== "pickup_point") {
      return;
    }

    if (input.customTrackingReference !== undefined) {
      context.addIssue({
        code: "custom",
        message:
          "Courier Guy assigns tracking references for pickup-point drop-offs.",
        path: ["customTrackingReference"],
      });
    }

    if (input.declaredValue !== undefined) {
      context.addIssue({
        code: "custom",
        message:
          "Courier Guy pickup-point shipments do not support a declared value.",
        path: ["declaredValue"],
      });
    }

    if (input.parcels.length > 1) {
      context.addIssue({
        code: "custom",
        message: "Courier Guy pickup-point shipments support one parcel.",
        path: ["parcels"],
      });
    }
  });

export const courierGuyLabelInputSchema = z
  .object({
    collectionContactNumber: z.string().trim().min(5).max(255).optional(),
    collectionEmail: z.string().trim().email().max(255).optional(),
    kind: z.enum(["waybill", "sticker"]).default("waybill"),
    shipmentId: identifierSchema.optional(),
    trackingReference: z.string().trim().min(1).max(255).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.shipmentId === undefined && !input.trackingReference) {
      context.addIssue({
        code: "custom",
        message: "A shipment ID or tracking reference is required.",
      });
    }
  });

export const courierGuyTrackingInputSchema = z
  .object({
    trackingReference: z.string().trim().min(1).max(255),
  })
  .strict();

export const courierGuyCancelShipmentInputSchema = z
  .object({
    trackingReference: z.string().trim().min(1).max(255),
  })
  .strict();

export const courierGuyPickupPointsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(50).default(20),
    offset: z.number().int().min(0).default(0),
    pickupPointId: z.string().trim().min(1).max(120).optional(),
    pickupPointProvider: z.string().trim().min(1).max(80).optional(),
    search: z.string().trim().min(1).max(120).optional(),
    type: z.enum(["locker", "counter", "point"]).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const hasPickupPointId = input.pickupPointId !== undefined;
    const hasPickupPointProvider = input.pickupPointProvider !== undefined;

    if (!input.search && !hasPickupPointId) {
      context.addIssue({
        code: "custom",
        message: "Provide a search term or pickup-point ID.",
        path: ["search"],
      });
    }

    if (hasPickupPointId !== hasPickupPointProvider) {
      context.addIssue({
        code: "custom",
        message:
          "Pickup-point ID and pickup-point provider must be provided together.",
        path: ["pickupPointId"],
      });
    }
  });

const providerServiceLevelSchema = z
  .object({
    code: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    id: identifierSchema.nullable().optional(),
    name: z.string().trim().min(1).optional(),
  })
  .passthrough();

const providerRateSchema = z
  .object({
    estimated_delivery_from: z.string().nullable().optional(),
    estimated_delivery_to: z.string().nullable().optional(),
    rate: providerNumberSchema.pipe(z.number().nonnegative()),
    rate_excluding_vat: providerNumberSchema
      .pipe(z.number().nonnegative())
      .nullable()
      .optional(),
    service_level: providerServiceLevelSchema,
  })
  .passthrough();

const providerRatesResponseSchema = z
  .object({
    message: z.string().optional(),
    rates: z.array(providerRateSchema),
  })
  .passthrough();

const providerShipmentResponseSchema = z
  .object({
    custom_tracking_reference: z.string().nullable().optional(),
    id: identifierSchema,
    rate: providerNumberSchema
      .pipe(z.number().nonnegative())
      .nullable()
      .optional(),
    short_tracking_reference: z.string().trim().min(1),
    status: z.string().trim().min(1).optional(),
  })
  .passthrough();

const providerTrackingEventSchema = z
  .object({
    data: z.unknown().optional(),
    date: z.string().nullable().optional(),
    id: identifierSchema.nullable().optional(),
    location: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
    parcel_id: identifierSchema.nullable().optional(),
    source: z.string().nullable().optional(),
    status: z.string().trim().min(1),
  })
  .passthrough();

const providerTrackingShipmentSchema = z
  .object({
    custom_tracking_reference: z.string().nullable().optional(),
    shipment_id: identifierSchema.nullable().optional(),
    shipment_collected_date: z.string().nullable().optional(),
    shipment_delivered_date: z.string().nullable().optional(),
    short_tracking_reference: z.string().nullable().optional(),
    status: z.string().trim().min(1),
    tracking_events: z.array(providerTrackingEventSchema).default([]),
  })
  .passthrough();

const providerTrackingResponseSchema = z.union([
  providerTrackingShipmentSchema,
  z
    .object({
      shipments: z.array(providerTrackingShipmentSchema).min(1),
    })
    .passthrough()
    .transform((response) => response.shipments[0]!),
  z
    .array(providerTrackingShipmentSchema)
    .min(1)
    .transform((response) => response[0]!),
]);

const providerLabelResponseSchema = z
  .object({
    url: z.string().trim().url(),
  })
  .passthrough();

const providerCancellationResponseSchema = z
  .record(z.string(), z.unknown())
  .nullable();

const providerPickupPointAddressSchema = z
  .object({
    city: z.string().nullable().optional(),
    code: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    entered_address: z.string().nullable().optional(),
    lat: providerNumberSchema.nullable().optional(),
    lng: providerNumberSchema.nullable().optional(),
    local_area: z.string().nullable().optional(),
    street_address: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    zone: z.string().nullable().optional(),
  })
  .passthrough();

const providerPickupPointSchema = z
  .object({
    address: providerPickupPointAddressSchema.nullable().optional(),
    description: z.string().nullable().optional(),
    is_hidden: z.boolean().nullable().optional(),
    lat: providerNumberSchema.nullable().optional(),
    lng: providerNumberSchema.nullable().optional(),
    name: z.string().nullable().optional(),
    pickup_point_id: identifierSchema,
    pickup_point_provider: z.string().trim().min(1),
    status: z.string().nullable().optional(),
    trading_hours: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
  })
  .passthrough();

const providerPickupPointsResponseSchema = z
  .object({
    count: providerNumberSchema
      .pipe(z.number().int().nonnegative())
      .nullable()
      .optional(),
    pickup_points: z.array(z.unknown()).nullable().optional(),
  })
  .passthrough();

export type CourierGuyClientConfig = z.input<
  typeof courierGuyClientConfigSchema
>;
export type CourierGuyAddress = z.infer<typeof courierGuyAddressSchema>;
export type CourierGuyContact = z.infer<typeof courierGuyContactSchema>;
export type CourierGuyParcel = z.infer<typeof courierGuyParcelSchema>;
export type CourierGuyCollectionOrigin = z.infer<
  typeof courierGuyCollectionOriginSchema
>;
export type CourierGuyRatesInput = z.input<
  typeof courierGuyRatesInputSchema
>;
export type CourierGuyCreateShipmentInput = z.input<
  typeof courierGuyCreateShipmentInputSchema
>;
export type CourierGuyLabelInput = z.input<
  typeof courierGuyLabelInputSchema
>;
export type CourierGuyTrackingInput = z.input<
  typeof courierGuyTrackingInputSchema
>;
export type CourierGuyCancelShipmentInput = z.input<
  typeof courierGuyCancelShipmentInputSchema
>;
export type CourierGuyPickupPointsInput = z.input<
  typeof courierGuyPickupPointsInputSchema
>;

export type CourierGuyRate = {
  currency: "ZAR";
  estimatedDeliveryFrom: string | null;
  estimatedDeliveryTo: string | null;
  providerAmount: number;
  providerAmountExcludingVat: number | null;
  serviceCode: string;
  serviceDescription: string | null;
  serviceLevelId: string | null;
  serviceName: string;
};

export type CourierGuyShipment = {
  currency: "ZAR";
  customTrackingReference: string | null;
  providerCostAmount: number | null;
  providerShipmentId: string;
  status: string | null;
  trackingReference: string;
};

export type CourierGuyTrackingEvent = {
  data: unknown;
  location: string | null;
  message: string | null;
  occurredAt: string | null;
  parcelId: string | null;
  providerEventId: string | null;
  source: string | null;
  status: string;
};

export type CourierGuyTracking = {
  collectedAt: string | null;
  customTrackingReference: string | null;
  deliveredAt: string | null;
  events: CourierGuyTrackingEvent[];
  providerShipmentId: string | null;
  status: string;
  trackingReference: string;
};

export type CourierGuyPickupPoint = {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  name: string;
  pickupPointId: string;
  pickupPointProvider: string;
  status: string | null;
  tradingHours: string | null;
  type: string | null;
};

export type CourierGuyApiErrorCode =
  | "invalid_configuration"
  | "invalid_request"
  | "invalid_response"
  | "network_error"
  | "provider_error"
  | "timeout";

type CourierGuyValidationDetail = {
  message: string;
  path: string;
};

export class CourierGuyApiError extends Error {
  readonly code: CourierGuyApiErrorCode;
  readonly details: readonly CourierGuyValidationDetail[];
  readonly operation: string;
  readonly requestId: string | null;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor({
    code,
    details = [],
    message,
    operation,
    requestId = null,
    retryable = false,
    status = null,
  }: {
    code: CourierGuyApiErrorCode;
    details?: readonly CourierGuyValidationDetail[];
    message: string;
    operation: string;
    requestId?: string | null;
    retryable?: boolean;
    status?: number | null;
  }) {
    super(message);
    this.name = "CourierGuyApiError";
    this.code = code;
    this.details = details;
    this.operation = operation;
    this.requestId = requestId;
    this.retryable = retryable;
    this.status = status;
  }
}

const ambiguousMutationHttpStatuses = new Set([408, 409, 425, 429]);

export function isCourierGuyRequestDefinitelyRejected(error: unknown) {
  if (!(error instanceof CourierGuyApiError)) {
    return false;
  }

  if (
    error.code === "invalid_configuration" ||
    error.code === "invalid_request"
  ) {
    return true;
  }

  return (
    error.code === "provider_error" &&
    error.status !== null &&
    error.status >= 400 &&
    error.status < 500 &&
    !ambiguousMutationHttpStatuses.has(error.status)
  );
}

type CourierGuyFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type CourierGuyClientDependencies = {
  fetchImpl?: CourierGuyFetch;
};

export function createCourierGuyClient(
  configInput: CourierGuyClientConfig,
  dependencies: CourierGuyClientDependencies = {},
) {
  const config = parseBoundary(
    courierGuyClientConfigSchema,
    configInput,
    "configure Courier Guy",
    "invalid_configuration",
  );
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;

  if (!fetchImpl) {
    throw new CourierGuyApiError({
      code: "invalid_configuration",
      message: "Fetch is unavailable for Courier Guy requests.",
      operation: "configure Courier Guy",
    });
  }

  return {
    cancelShipment: (input: CourierGuyCancelShipmentInput) =>
      cancelShipment(config, input, fetchImpl),
    createShipment: (input: CourierGuyCreateShipmentInput) =>
      createShipment(config, input, fetchImpl),
    getLabel: (input: CourierGuyLabelInput) =>
      getShipmentLabel(config, input, fetchImpl),
    getPickupPoints: (input: CourierGuyPickupPointsInput) =>
      getPickupPoints(config, input, fetchImpl),
    getRates: (input: CourierGuyRatesInput) =>
      getRates(config, input, fetchImpl),
    trackShipment: (input: CourierGuyTrackingInput) =>
      trackShipment(config, input, fetchImpl),
  };
}

export async function getCourierGuyRates(
  config: CourierGuyClientConfig,
  input: CourierGuyRatesInput,
  dependencies?: CourierGuyClientDependencies,
) {
  return createCourierGuyClient(config, dependencies).getRates(input);
}

export async function createCourierGuyShipment(
  config: CourierGuyClientConfig,
  input: CourierGuyCreateShipmentInput,
  dependencies?: CourierGuyClientDependencies,
) {
  return createCourierGuyClient(config, dependencies).createShipment(input);
}

export async function getCourierGuyShipmentLabel(
  config: CourierGuyClientConfig,
  input: CourierGuyLabelInput,
  dependencies?: CourierGuyClientDependencies,
) {
  return createCourierGuyClient(config, dependencies).getLabel(input);
}

export async function getCourierGuyPickupPoints(
  config: CourierGuyClientConfig,
  input: CourierGuyPickupPointsInput,
  dependencies?: CourierGuyClientDependencies,
) {
  return createCourierGuyClient(config, dependencies).getPickupPoints(input);
}

export async function trackCourierGuyShipment(
  config: CourierGuyClientConfig,
  input: CourierGuyTrackingInput,
  dependencies?: CourierGuyClientDependencies,
) {
  return createCourierGuyClient(config, dependencies).trackShipment(input);
}

export async function cancelCourierGuyShipment(
  config: CourierGuyClientConfig,
  input: CourierGuyCancelShipmentInput,
  dependencies?: CourierGuyClientDependencies,
) {
  return createCourierGuyClient(config, dependencies).cancelShipment(input);
}

async function getPickupPoints(
  config: z.output<typeof courierGuyClientConfigSchema>,
  input: CourierGuyPickupPointsInput,
  fetchImpl: CourierGuyFetch,
) {
  const operation = "search Courier Guy pickup points";
  const parsed = parseBoundary(
    courierGuyPickupPointsInputSchema,
    input,
    operation,
    "invalid_request",
  );
  const query = new URLSearchParams();

  if (parsed.search) {
    query.set("search", parsed.search);
  }

  if (parsed.type) {
    query.set("type", parsed.type);
  }

  if (parsed.pickupPointId) {
    query.set("pickup_point_id", parsed.pickupPointId);
    query.set("pickup_point_provider", parsed.pickupPointProvider!);
  }

  query.set("limit", String(parsed.limit));
  query.set("offset", String(parsed.offset));

  const providerPayload = await requestCourierGuy({
    config,
    fetchImpl,
    method: "GET",
    operation,
    path: `pickup-points?${query.toString()}`,
  });
  const response = parseBoundary(
    providerPickupPointsResponseSchema,
    providerPayload,
    operation,
    "invalid_response",
  );
  const pickupPoints = (response.pickup_points ?? [])
    .flatMap((value) => {
      const result = providerPickupPointSchema.safeParse(value);

      if (!result.success) {
        return [];
      }

      const point = result.data;
      const normalizedStatus =
        normalizeOptionalText(point.status, 64)?.toLowerCase();
      const pickupPointId = String(point.pickup_point_id).trim();
      const pickupPointProvider = normalizeOptionalText(
        point.pickup_point_provider,
        80,
      )?.toLowerCase();

      if (
        point.is_hidden === true ||
        normalizedStatus === "offline" ||
        !pickupPointId ||
        pickupPointId.length > 120 ||
        pickupPointProvider !== "tcg-locker"
      ) {
        return [];
      }

      const address = point.address;
      const name =
        normalizeOptionalText(point.name, 250) ??
        normalizeOptionalText(address?.company, 250) ??
        `Courier Guy pickup point ${pickupPointId}`;
      const enteredAddress = normalizeOptionalText(
        address?.entered_address,
        500,
      );
      const fallbackAddress = [
        address?.street_address,
        address?.local_area,
        address?.city,
        address?.zone,
        address?.code,
        address?.country,
      ]
        .map((value) => normalizeOptionalText(value, 255))
        .filter((value): value is string => value !== null)
        .join(", ");

      return [
        {
          address:
            enteredAddress ?? normalizeOptionalText(fallbackAddress, 500),
          latitude: point.lat ?? address?.lat ?? null,
          longitude: point.lng ?? address?.lng ?? null,
          name,
          pickupPointId,
          pickupPointProvider,
          status: normalizedStatus ?? null,
          tradingHours: normalizeOptionalText(point.trading_hours, 2_000),
          type:
            normalizeOptionalText(point.type, 64)?.toLowerCase() ??
            normalizeOptionalText(address?.type, 64)?.toLowerCase() ??
            null,
        } satisfies CourierGuyPickupPoint,
      ];
    })
    .slice(0, parsed.limit);

  return {
    count: response.count ?? pickupPoints.length,
    pickupPoints,
  };
}

async function getRates(
  config: z.output<typeof courierGuyClientConfigSchema>,
  input: CourierGuyRatesInput,
  fetchImpl: CourierGuyFetch,
) {
  const operation = "get Courier Guy rates";
  const parsed = parseBoundary(
    courierGuyRatesInputSchema,
    input,
    operation,
    "invalid_request",
  );
  const payload = {
    ...toCollectionOriginPayload(parsed.collectionOrigin),
    ...(parsed.collectionMinDate
      ? { collection_min_date: parsed.collectionMinDate }
      : {}),
    ...(parsed.declaredValue === undefined
      ? {}
      : { declared_value: roundMoney(parsed.declaredValue) }),
    delivery_address: toAddressPayload(parsed.deliveryAddress),
    ...(parsed.deliveryMinDate
      ? { delivery_min_date: parsed.deliveryMinDate }
      : {}),
    parcels: parsed.parcels.map(toParcelPayload),
  };
  const providerPayload = await requestCourierGuy({
    body: payload,
    config,
    fetchImpl,
    method: "POST",
    operation,
    path: "rates",
  });
  const response = parseBoundary(
    providerRatesResponseSchema,
    providerPayload,
    operation,
    "invalid_response",
  );

  return {
    rates: response.rates.map<CourierGuyRate>((rate) => ({
      currency: "ZAR",
      estimatedDeliveryFrom: rate.estimated_delivery_from ?? null,
      estimatedDeliveryTo: rate.estimated_delivery_to ?? null,
      providerAmount: roundMoney(rate.rate),
      providerAmountExcludingVat:
        rate.rate_excluding_vat === null ||
        rate.rate_excluding_vat === undefined
          ? null
          : roundMoney(rate.rate_excluding_vat),
      serviceCode: rate.service_level.code,
      serviceDescription: rate.service_level.description ?? null,
      serviceLevelId:
        rate.service_level.id === null ||
        rate.service_level.id === undefined
          ? null
          : String(rate.service_level.id),
      serviceName:
        rate.service_level.name ??
        rate.service_level.description ??
        rate.service_level.code,
    })),
    raw: response,
  };
}

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  return normalized ? normalized.slice(0, maxLength) : null;
}

async function createShipment(
  config: z.output<typeof courierGuyClientConfigSchema>,
  input: CourierGuyCreateShipmentInput,
  fetchImpl: CourierGuyFetch,
) {
  const operation = "create Courier Guy shipment";
  const parsed = parseBoundary(
    courierGuyCreateShipmentInputSchema,
    input,
    operation,
    "invalid_request",
  );
  const payload = {
    ...toCollectionOriginPayload(parsed.collectionOrigin),
    ...(parsed.collectionAfter
      ? { collection_after: parsed.collectionAfter }
      : {}),
    ...(parsed.collectionBefore
      ? { collection_before: parsed.collectionBefore }
      : {}),
    collection_contact: toContactPayload(parsed.collectionContact),
    ...(parsed.collectionMinDate
      ? { collection_min_date: parsed.collectionMinDate }
      : {}),
    ...(parsed.customTrackingReference
      ? { custom_tracking_reference: parsed.customTrackingReference }
      : {}),
    customer_reference: parsed.customerReference,
    ...(parsed.customerReferenceName
      ? { customer_reference_name: parsed.customerReferenceName }
      : {}),
    ...(parsed.declaredValue === undefined
      ? {}
      : { declared_value: roundMoney(parsed.declaredValue) }),
    delivery_address: toAddressPayload(parsed.deliveryAddress),
    ...(parsed.deliveryAfter
      ? { delivery_after: parsed.deliveryAfter }
      : {}),
    ...(parsed.deliveryBefore
      ? { delivery_before: parsed.deliveryBefore }
      : {}),
    delivery_contact: toContactPayload(parsed.deliveryContact),
    ...(parsed.deliveryMinDate
      ? { delivery_min_date: parsed.deliveryMinDate }
      : {}),
    ...(parsed.dueDate ? { due_date: parsed.dueDate } : {}),
    mute_notifications: parsed.muteNotifications,
    parcels: parsed.parcels.map(toParcelPayload),
    ...(parsed.serviceLevelCode
      ? { service_level_code: parsed.serviceLevelCode }
      : {}),
    ...(parsed.serviceLevelId === undefined
      ? {}
      : { service_level_id: parsed.serviceLevelId }),
    ...(parsed.specialInstructionsDelivery
      ? {
          special_instructions_delivery:
            parsed.specialInstructionsDelivery,
        }
      : {}),
  };

  // Shipment creation is deliberately not retried. Pickup-point origins cannot
  // use a custom tracking reference, so an automatic retry could double-book.
  const providerPayload = await requestCourierGuy({
    body: payload,
    config,
    fetchImpl,
    method: "POST",
    operation,
    path: "shipments",
  });
  const response = parseBoundary(
    providerShipmentResponseSchema,
    providerPayload,
    operation,
    "invalid_response",
  );

  return {
    currency: "ZAR",
    customTrackingReference: response.custom_tracking_reference ?? null,
    providerCostAmount:
      response.rate === null || response.rate === undefined
        ? null
        : roundMoney(response.rate),
    providerShipmentId: String(response.id),
    raw: response,
    status: response.status ?? null,
    trackingReference: response.short_tracking_reference,
  } satisfies CourierGuyShipment & { raw: typeof response };
}

async function getShipmentLabel(
  config: z.output<typeof courierGuyClientConfigSchema>,
  input: CourierGuyLabelInput,
  fetchImpl: CourierGuyFetch,
) {
  const operation = "get Courier Guy shipment label";
  const parsed = parseBoundary(
    courierGuyLabelInputSchema,
    input,
    operation,
    "invalid_request",
  );
  const query = new URLSearchParams();

  if (parsed.shipmentId !== undefined) {
    query.set("id", String(parsed.shipmentId));
  }

  if (parsed.trackingReference) {
    query.set("tracking_reference", parsed.trackingReference);
  }

  if (parsed.collectionEmail) {
    query.set("collection_email", parsed.collectionEmail);
  }

  if (parsed.collectionContactNumber) {
    query.set(
      "collection_contact_number",
      parsed.collectionContactNumber,
    );
  }

  const providerPayload = await requestCourierGuy({
    config,
    fetchImpl,
    method: "GET",
    operation,
    path:
      parsed.kind === "sticker"
        ? `shipments/label/stickers?${query}`
        : `shipments/label?${query}`,
  });
  const response = parseBoundary(
    providerLabelResponseSchema,
    providerPayload,
    operation,
    "invalid_response",
  );

  return {
    kind: parsed.kind,
    raw: response,
    url: response.url,
  };
}

async function trackShipment(
  config: z.output<typeof courierGuyClientConfigSchema>,
  input: CourierGuyTrackingInput,
  fetchImpl: CourierGuyFetch,
) {
  const operation = "track Courier Guy shipment";
  const parsed = parseBoundary(
    courierGuyTrackingInputSchema,
    input,
    operation,
    "invalid_request",
  );
  const query = new URLSearchParams({
    tracking_reference: parsed.trackingReference,
  });
  const providerPayload = await requestCourierGuy({
    config,
    fetchImpl,
    method: "GET",
    operation,
    path: `tracking/shipments?${query}`,
  });
  const response = parseBoundary(
    providerTrackingResponseSchema,
    providerPayload,
    operation,
    "invalid_response",
  );

  return {
    collectedAt: response.shipment_collected_date ?? null,
    customTrackingReference: response.custom_tracking_reference ?? null,
    deliveredAt: response.shipment_delivered_date ?? null,
    events: response.tracking_events.map<CourierGuyTrackingEvent>(
      (event) => ({
        data: event.data,
        location: event.location ?? null,
        message: event.message ?? null,
        occurredAt: event.date ?? null,
        parcelId:
          event.parcel_id === null || event.parcel_id === undefined
            ? null
            : String(event.parcel_id),
        providerEventId:
          event.id === null || event.id === undefined
            ? null
            : String(event.id),
        source: event.source ?? null,
        status: event.status,
      }),
    ),
    providerShipmentId:
      response.shipment_id === null ||
      response.shipment_id === undefined
        ? null
        : String(response.shipment_id),
    raw: response,
    status: response.status,
    trackingReference:
      response.short_tracking_reference ?? parsed.trackingReference,
  } satisfies CourierGuyTracking & { raw: typeof response };
}

async function cancelShipment(
  config: z.output<typeof courierGuyClientConfigSchema>,
  input: CourierGuyCancelShipmentInput,
  fetchImpl: CourierGuyFetch,
) {
  const operation = "cancel Courier Guy shipment";
  const parsed = parseBoundary(
    courierGuyCancelShipmentInputSchema,
    input,
    operation,
    "invalid_request",
  );
  const providerPayload = await requestCourierGuy({
    body: { tracking_reference: parsed.trackingReference },
    config,
    fetchImpl,
    method: "POST",
    operation,
    path: "shipments/cancel",
  });
  const response = parseBoundary(
    providerCancellationResponseSchema,
    providerPayload,
    operation,
    "invalid_response",
  );
  const responseStatus =
    typeof response?.status === "string"
      ? response.status.trim().toLowerCase()
      : null;

  if (responseStatus && responseStatus !== "cancelled") {
    throw new CourierGuyApiError({
      code: "invalid_response",
      message: "Courier Guy returned an unexpected cancellation status.",
      operation,
    });
  }

  return {
    cancelled: true as const,
    raw: response,
    trackingReference: parsed.trackingReference,
  };
}

function toAddressPayload(address: CourierGuyAddress) {
  return {
    type: address.addressType,
    ...(address.company ? { company: address.company } : {}),
    street_address: address.streetAddress,
    local_area: address.localArea,
    city: address.city,
    zone: address.zone,
    country: address.countryCode,
    code: address.postalCode,
    ...(address.latitude === undefined
      ? {}
      : { lat: address.latitude, lng: address.longitude }),
  };
}

function toCollectionOriginPayload(origin: CourierGuyCollectionOrigin) {
  if (origin.kind === "address") {
    return { collection_address: toAddressPayload(origin.address) };
  }

  return {
    collection_pickup_point_id: origin.pickupPointId,
    collection_pickup_point_provider: origin.provider,
  };
}

function toContactPayload(contact: CourierGuyContact) {
  return {
    name: contact.name,
    ...(contact.mobileNumber
      ? { mobile_number: contact.mobileNumber }
      : {}),
    ...(contact.email ? { email: contact.email } : {}),
  };
}

function toParcelPayload(parcel: CourierGuyParcel) {
  return {
    parcel_description: parcel.description,
    submitted_length_cm: roundMetric(parcel.lengthMm / 10),
    submitted_width_cm: roundMetric(parcel.widthMm / 10),
    submitted_height_cm: roundMetric(parcel.heightMm / 10),
    submitted_weight_kg: roundMetric(parcel.weightGrams / 1_000),
    ...(parcel.packaging ? { packaging: parcel.packaging } : {}),
    ...(parcel.itemCount === undefined
      ? {}
      : { item_count: parcel.itemCount }),
  };
}

async function requestCourierGuy({
  body,
  config,
  fetchImpl,
  method,
  operation,
  path,
}: {
  body?: unknown;
  config: z.output<typeof courierGuyClientConfigSchema>;
  fetchImpl: CourierGuyFetch;
  method: "GET" | "POST" | "PUT";
  operation: string;
  path: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  let response: Response;
  let responsePayload: unknown;

  try {
    response = await fetchImpl(
      new URL(path.replace(/^\/+/, ""), `${config.apiBaseUrl}/`),
      {
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          ...(body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
        },
        method,
        signal: controller.signal,
      },
    );
    responsePayload = await readResponsePayload(response);
  } catch {
    if (controller.signal.aborted) {
      throw new CourierGuyApiError({
        code: "timeout",
        message: `Courier Guy request timed out while trying to ${operation}.`,
        operation,
        retryable: true,
      });
    }

    throw new CourierGuyApiError({
      code: "network_error",
      message: `Courier Guy could not be reached while trying to ${operation}.`,
      operation,
      retryable: true,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const providerMessage = redactSecret(
      getProviderMessage(responsePayload),
      config.apiKey,
    );
    const requestId =
      response.headers.get("ship-logic-request-id") ??
      response.headers.get("x-request-id") ??
      response.headers.get("apigw-requestid");
    const retryable =
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500;

    throw new CourierGuyApiError({
      code: "provider_error",
      message: providerMessage
        ? `Courier Guy request failed while trying to ${operation}: ${providerMessage}`
        : `Courier Guy request failed while trying to ${operation} (HTTP ${response.status}).`,
      operation,
      requestId,
      retryable,
      status: response.status,
    });
  }

  return responsePayload;
}

async function readResponsePayload(response: Response) {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

function getProviderMessage(payload: unknown) {
  if (typeof payload === "string") {
    return sanitizeProviderMessage(payload);
  }

  if (!isRecord(payload)) {
    return null;
  }

  for (const key of ["message", "error", "detail", "title"]) {
    const value = payload[key];

    if (typeof value === "string" && value.trim()) {
      return sanitizeProviderMessage(value);
    }
  }

  const errors = payload.errors;

  if (Array.isArray(errors)) {
    const messages = errors
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);

    if (messages.length > 0) {
      return sanitizeProviderMessage(messages.join("; "));
    }
  }

  return null;
}

function sanitizeProviderMessage(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 500) : null;
}

function redactSecret(value: string | null, secret: string) {
  if (!value) {
    return null;
  }

  return value.replaceAll(secret, "[REDACTED]");
}

function parseBoundary<T>(
  schema: z.ZodType<T>,
  value: unknown,
  operation: string,
  code: Extract<
    CourierGuyApiErrorCode,
    "invalid_configuration" | "invalid_request" | "invalid_response"
  >,
) {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  throw new CourierGuyApiError({
    code,
    details: result.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.map(String).join(".") || "value",
    })),
    message:
      code === "invalid_response"
        ? `Courier Guy returned an invalid response while trying to ${operation}.`
        : `Invalid Courier Guy data supplied while trying to ${operation}.`,
    operation,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function roundMetric(value: number) {
  return Number(value.toFixed(3));
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}
