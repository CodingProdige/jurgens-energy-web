import { z } from "zod";

export const checkoutAnalyticsEventNames = [
  "started",
  "address_completed",
  "shipping_completed",
  "payment_reached",
  "payment_attempted",
  "payfast_redirected",
  "order_created",
  "payment_confirmed",
  "checkout_failed",
  "payment_cancelled",
] as const;

export const checkoutAnalyticsSessionStatuses = [
  "active",
  "completed",
  "failed",
] as const;

export const checkoutAnalyticsDeviceCategories = [
  "desktop",
  "mobile",
  "tablet",
  "unknown",
] as const;

export type CheckoutAnalyticsEventName =
  (typeof checkoutAnalyticsEventNames)[number];
export type CheckoutAnalyticsSessionStatus =
  (typeof checkoutAnalyticsSessionStatuses)[number];
export type CheckoutAnalyticsDeviceCategory =
  (typeof checkoutAnalyticsDeviceCategories)[number];

export const checkoutAnalyticsProgressEventNames = [
  "started",
  "address_completed",
  "shipping_completed",
  "payment_reached",
  "payment_attempted",
  "payfast_redirected",
  "order_created",
  "payment_confirmed",
] as const satisfies readonly CheckoutAnalyticsEventName[];

const checkoutAnalyticsProgressRank = new Map<
  CheckoutAnalyticsEventName,
  number
>(
  checkoutAnalyticsProgressEventNames.map(
    (event, index) => [event, index] as const,
  ),
);

const safePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("?") &&
      !value.includes("#") &&
      !/[\u0000-\u001f\u007f]/u.test(value),
    "Landing path must be a path without query parameters or fragments.",
  );

const referrerHostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^(?:localhost|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*)(?::\d{1,5})?$/,
    "Referrer host must be a hostname with an optional port.",
  );

const errorCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9][a-z0-9._:-]*$/,
    "Error code may only contain lowercase letters, numbers, dots, colons, underscores, and hyphens.",
  );

const checkoutCartSnapshotSchema = z
  .object({
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase()),
    itemCount: z.number().int().min(0).max(1_000),
    totalQuantity: z.number().int().min(0).max(10_000),
    value: z
      .number()
      .finite()
      .min(0)
      .max(9_999_999_999.99)
      .transform((value) => Math.round((value + Number.EPSILON) * 100) / 100),
  })
  .strict();

const publicCheckoutAnalyticsEventFields = {
  cart: checkoutCartSnapshotSchema.optional(),
  errorCode: errorCodeSchema.optional(),
  event: z.enum(checkoutAnalyticsEventNames),
  eventId: z.string().uuid(),
  landingPath: safePathSchema.optional(),
  referrerHost: referrerHostSchema.optional(),
  sessionId: z.string().uuid(),
};

function validateCheckoutAnalyticsEvent(
  value: {
    errorCode?: string;
    event: CheckoutAnalyticsEventName;
  },
  context: z.RefinementCtx,
) {
  const failureEvent =
    value.event === "checkout_failed" || value.event === "payment_cancelled";

  if (value.event === "checkout_failed" && !value.errorCode) {
    context.addIssue({
      code: "custom",
      message: "Checkout failures require a stable error code.",
      path: ["errorCode"],
    });
  }

  if (!failureEvent && value.errorCode) {
    context.addIssue({
      code: "custom",
      message: "Error codes are only accepted for failed checkout events.",
      path: ["errorCode"],
    });
  }
}

export const checkoutAnalyticsPublicEventInputSchema = z
  .object(publicCheckoutAnalyticsEventFields)
  .strict()
  .superRefine(validateCheckoutAnalyticsEvent);

export const checkoutAnalyticsEventInputSchema = z
  .object({
    ...publicCheckoutAnalyticsEventFields,
    orderId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine(validateCheckoutAnalyticsEvent);

export type CheckoutAnalyticsPublicEventInput = z.infer<
  typeof checkoutAnalyticsPublicEventInputSchema
>;

export type CheckoutAnalyticsEventInput = z.infer<
  typeof checkoutAnalyticsEventInputSchema
>;

export type CheckoutAnalyticsLifecycle = {
  completedAt: Date | null;
  failedAt: Date | null;
  latestStep: CheckoutAnalyticsEventName;
  status: CheckoutAnalyticsSessionStatus;
};

export function advanceCheckoutAnalyticsLifecycle({
  current,
  event,
  occurredAt,
}: {
  current: CheckoutAnalyticsLifecycle;
  event: CheckoutAnalyticsEventName;
  occurredAt: Date;
}): CheckoutAnalyticsLifecycle {
  if (current.status === "completed") {
    return current;
  }

  if (event === "payment_confirmed") {
    return {
      completedAt: current.completedAt ?? occurredAt,
      failedAt: current.failedAt,
      latestStep: event,
      status: "completed",
    };
  }

  if (event === "checkout_failed" || event === "payment_cancelled") {
    return {
      completedAt: current.completedAt,
      failedAt: current.failedAt ?? occurredAt,
      latestStep: event,
      status: "failed",
    };
  }

  if (current.status === "active") {
    const currentRank = checkoutAnalyticsProgressRank.get(current.latestStep);
    const eventRank = checkoutAnalyticsProgressRank.get(event);

    if (
      currentRank !== undefined &&
      eventRank !== undefined &&
      eventRank <= currentRank
    ) {
      return current;
    }
  }

  return {
    ...current,
    latestStep: event,
    status: "active",
  };
}

export function classifyCheckoutDevice(
  userAgent: string | null | undefined,
): CheckoutAnalyticsDeviceCategory {
  const normalized = userAgent?.trim().toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (
    /ipad|tablet|kindle|silk|playbook/u.test(normalized) ||
    (/android/u.test(normalized) && !/mobile/u.test(normalized))
  ) {
    return "tablet";
  }

  if (/mobile|iphone|ipod|android|opera mini|iemobile/u.test(normalized)) {
    return "mobile";
  }

  return "desktop";
}

export function isSameOriginCheckoutAnalyticsRequest({
  allowedOrigins,
  origin,
  requestHost,
}: {
  allowedOrigins: ReadonlySet<string>;
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

    return Boolean(
      normalizedRequestHost &&
        originUrl.origin === origin &&
        originUrl.host.toLowerCase() === normalizedRequestHost &&
        allowedOrigins.has(originUrl.origin),
    );
  } catch {
    return false;
  }
}
