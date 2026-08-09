export const ADMIN_ANALYTICS_TIME_ZONE = "Africa/Johannesburg" as const;
export const CHECKOUT_ABANDONMENT_WINDOW_MS = 30 * 60 * 1_000;

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
// South Africa has used UTC+02:00 year-round since 1944. Keeping the business
// offset explicit makes calendar-month boundaries deterministic in Node and in
// the database, without inheriting the host machine's timezone.
const JOHANNESBURG_UTC_OFFSET_MS = 2 * HOUR_MS;

export const adminAnalyticsRangeKeys = [
  "24h",
  "7d",
  "30d",
  "90d",
  "this_month",
  "last_month",
] as const;

export type AdminAnalyticsRangeKey =
  (typeof adminAnalyticsRangeKeys)[number];

export type AdminAnalyticsGranularity = "day" | "hour" | "week";
export type AdminAnalyticsTelemetryCoverage = "full" | "none" | "partial";

export type AdminAnalyticsResolvedRange = Readonly<{
  bucketCount: number;
  bucketMilliseconds: number;
  comparisonEnd: Date;
  comparisonStart: Date;
  end: Date;
  granularity: AdminAnalyticsGranularity;
  key: AdminAnalyticsRangeKey;
  label: string;
  start: Date;
  timeZone: typeof ADMIN_ANALYTICS_TIME_ZONE;
}>;

export type AdminAnalyticsMetricComparison = Readonly<{
  change: number;
  changePercent: number | null;
  previousValue: number;
  trend: "down" | "flat" | "up";
  value: number;
}>;

export type CheckoutAnalyticsOutcome =
  | "abandoned"
  | "failed"
  | "pending"
  | "successful";

export type CheckoutOutcomeInput = Readonly<{
  hasCapturedPayment: boolean;
  lastSeenAt: Date;
  status: "active" | "completed" | "failed" | string;
}>;

export type CommercePaymentOutcomeInput = Readonly<{
  providerStatus: string | null;
  status: string;
}>;

export type CartJourneyAbandonmentInput = Readonly<{
  cartStartedAt: Date | null;
  checkoutStartedAt: Date | null;
  lastCartActivityAt: Date | null;
}>;

function assertValidDate(value: Date, label: string) {
  if (!Number.isFinite(value.getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }
}

function getJohannesburgParts(value: Date) {
  const shifted = new Date(value.getTime() + JOHANNESBURG_UTC_OFFSET_MS);

  return {
    day: shifted.getUTCDate(),
    monthIndex: shifted.getUTCMonth(),
    year: shifted.getUTCFullYear(),
  };
}

function johannesburgCalendarDateToUtc(
  year: number,
  monthIndex: number,
  day = 1,
) {
  return new Date(
    Date.UTC(year, monthIndex, day) - JOHANNESBURG_UTC_OFFSET_MS,
  );
}

function getJohannesburgMonthStart(value: Date, monthOffset = 0) {
  const parts = getJohannesburgParts(value);

  return johannesburgCalendarDateToUtc(
    parts.year,
    parts.monthIndex + monthOffset,
  );
}

function getRangeConfiguration(key: AdminAnalyticsRangeKey) {
  switch (key) {
    case "24h":
      return {
        bucketMilliseconds: HOUR_MS,
        durationMilliseconds: 24 * HOUR_MS,
        granularity: "hour" as const,
        label: "Past 24 hours",
      };
    case "7d":
      return {
        bucketMilliseconds: DAY_MS,
        durationMilliseconds: 7 * DAY_MS,
        granularity: "day" as const,
        label: "Past 7 days",
      };
    case "30d":
      return {
        bucketMilliseconds: DAY_MS,
        durationMilliseconds: 30 * DAY_MS,
        granularity: "day" as const,
        label: "Past 30 days",
      };
    case "90d":
      return {
        bucketMilliseconds: 7 * DAY_MS,
        durationMilliseconds: 90 * DAY_MS,
        granularity: "week" as const,
        label: "Past 90 days",
      };
    case "this_month":
      return {
        bucketMilliseconds: DAY_MS,
        granularity: "day" as const,
        label: "This month",
      };
    case "last_month":
      return {
        bucketMilliseconds: DAY_MS,
        granularity: "day" as const,
        label: "Last month",
      };
  }
}

export function isAdminAnalyticsRangeKey(
  value: unknown,
): value is AdminAnalyticsRangeKey {
  return (
    typeof value === "string" &&
    adminAnalyticsRangeKeys.includes(value as AdminAnalyticsRangeKey)
  );
}

export function resolveAdminAnalyticsRange(
  key: AdminAnalyticsRangeKey,
  now = new Date(),
): AdminAnalyticsResolvedRange {
  assertValidDate(now, "now");
  const configuration = getRangeConfiguration(key);
  let start: Date;
  let end: Date;
  let comparisonStart: Date;
  let comparisonEnd: Date;

  if (key === "this_month") {
    start = getJohannesburgMonthStart(now);
    end = new Date(now);
    comparisonStart = getJohannesburgMonthStart(now, -1);
    comparisonEnd = new Date(
      Math.min(
        start.getTime(),
        comparisonStart.getTime() + (end.getTime() - start.getTime()),
      ),
    );
  } else if (key === "last_month") {
    start = getJohannesburgMonthStart(now, -1);
    end = getJohannesburgMonthStart(now);
    comparisonStart = getJohannesburgMonthStart(now, -2);
    comparisonEnd = start;
  } else {
    const durationMilliseconds = configuration.durationMilliseconds;

    if (!durationMilliseconds) {
      throw new Error(`Analytics range ${key} is missing a duration.`);
    }

    start = new Date(now.getTime() - durationMilliseconds);
    end = new Date(now);
    comparisonEnd = start;
    comparisonStart = new Date(
      start.getTime() - durationMilliseconds,
    );
  }

  const bucketCount = Math.max(
    1,
    Math.ceil(
      (end.getTime() - start.getTime()) / configuration.bucketMilliseconds,
    ),
  );

  return {
    bucketCount,
    bucketMilliseconds: configuration.bucketMilliseconds,
    comparisonEnd,
    comparisonStart,
    end,
    granularity: configuration.granularity,
    key,
    label: configuration.label,
    start,
    timeZone: ADMIN_ANALYTICS_TIME_ZONE,
  };
}

export function createAdminAnalyticsMetricComparison(
  value: number,
  previousValue: number,
): AdminAnalyticsMetricComparison {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safePreviousValue = Number.isFinite(previousValue) ? previousValue : 0;
  const change = safeValue - safePreviousValue;
  const changePercent =
    safePreviousValue === 0
      ? safeValue === 0
        ? 0
        : null
      : (change / Math.abs(safePreviousValue)) * 100;

  return {
    change,
    changePercent,
    previousValue: safePreviousValue,
    trend: change > 0 ? "up" : change < 0 ? "down" : "flat",
    value: safeValue,
  };
}

export function classifyCheckoutAnalyticsOutcome(
  input: CheckoutOutcomeInput,
  now = new Date(),
): CheckoutAnalyticsOutcome {
  assertValidDate(input.lastSeenAt, "lastSeenAt");
  assertValidDate(now, "now");

  if (input.hasCapturedPayment) {
    return "successful";
  }

  if (input.status === "failed") {
    return "failed";
  }

  if (
    input.lastSeenAt.getTime() <=
    now.getTime() - CHECKOUT_ABANDONMENT_WINDOW_MS
  ) {
    return "abandoned";
  }

  return "pending";
}

export function isCartJourneyAbandoned(
  input: CartJourneyAbandonmentInput,
  now = new Date(),
) {
  assertValidDate(now, "now");

  if (!input.cartStartedAt || input.checkoutStartedAt) {
    return false;
  }

  const lastCartActivityAt = input.lastCartActivityAt ?? input.cartStartedAt;

  assertValidDate(input.cartStartedAt, "cartStartedAt");
  assertValidDate(lastCartActivityAt, "lastCartActivityAt");

  return (
    lastCartActivityAt.getTime() <=
    now.getTime() - CHECKOUT_ABANDONMENT_WINDOW_MS
  );
}

export function isProviderConfirmedCapturedPayment(
  input: CommercePaymentOutcomeInput,
) {
  const providerConfirmed =
    input.providerStatus?.trim().toUpperCase() === "COMPLETE";

  // A fully refunded payment was captured successfully before its later
  // refund, so it remains part of historical gross sales and conversion.
  return (
    providerConfirmed &&
    (input.status === "captured" || input.status === "refunded")
  );
}

export function getAdminAnalyticsTelemetryCoverage(
  start: Date,
  end: Date,
  firstTrackedCheckoutAt: Date | null,
): AdminAnalyticsTelemetryCoverage {
  assertValidDate(start, "start");
  assertValidDate(end, "end");

  if (end <= start) {
    throw new Error("Analytics telemetry range must end after it starts.");
  }

  if (!firstTrackedCheckoutAt) {
    return "none";
  }

  assertValidDate(firstTrackedCheckoutAt, "firstTrackedCheckoutAt");

  if (end <= firstTrackedCheckoutAt) {
    return "none";
  }

  return start < firstTrackedCheckoutAt ? "partial" : "full";
}

export function getAdminAnalyticsBucketIndex(
  occurredAt: Date,
  start: Date,
  bucketMilliseconds: number,
  bucketCount: number,
) {
  assertValidDate(occurredAt, "occurredAt");
  assertValidDate(start, "start");

  if (
    !Number.isFinite(bucketMilliseconds) ||
    bucketMilliseconds <= 0 ||
    !Number.isSafeInteger(bucketCount) ||
    bucketCount <= 0
  ) {
    return -1;
  }

  const index = Math.floor(
    (occurredAt.getTime() - start.getTime()) / bucketMilliseconds,
  );

  return index >= 0 && index < bucketCount ? index : -1;
}

export function getAdminAnalyticsBucketStart(
  start: Date,
  bucketMilliseconds: number,
  index: number,
) {
  assertValidDate(start, "start");

  if (
    !Number.isFinite(bucketMilliseconds) ||
    bucketMilliseconds <= 0 ||
    !Number.isSafeInteger(index) ||
    index < 0
  ) {
    throw new Error("Invalid analytics bucket coordinates.");
  }

  return new Date(start.getTime() + bucketMilliseconds * index);
}
