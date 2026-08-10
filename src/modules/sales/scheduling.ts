export const JOHANNESBURG_TIME_ZONE = "Africa/Johannesburg";
export const JOHANNESBURG_UTC_OFFSET_MINUTES = 120;

export type SaleScheduleMode = "now" | "scheduled";

export type SaleScheduleInput = {
  endsAtLocal: string;
  scheduleMode: SaleScheduleMode;
  startsAtLocal: string;
};

export type ResolvedSaleSchedule = {
  endsAt: Date;
  startsAt: Date;
  status: "active" | "scheduled";
};

export type SaleWindow = {
  endsAt: Date | null;
  startsAt: Date;
};

export class SaleScheduleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleScheduleValidationError";
  }
}

const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseJohannesburgLocalDateTime(
  value: string,
  label = "Sale date and time",
) {
  const match = localDateTimePattern.exec(value.trim());

  if (!match) {
    throw new SaleScheduleValidationError(
      `${label} must use the Johannesburg date and time format.`,
    );
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] =
    match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue ?? "0");
  const utcMilliseconds = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute - JOHANNESBURG_UTC_OFFSET_MINUTES,
    second,
  );
  const parsed = new Date(utcMilliseconds);
  const localVerification = new Date(
    parsed.getTime() + JOHANNESBURG_UTC_OFFSET_MINUTES * 60_000,
  );

  if (
    localVerification.getUTCFullYear() !== year ||
    localVerification.getUTCMonth() !== month - 1 ||
    localVerification.getUTCDate() !== day ||
    localVerification.getUTCHours() !== hour ||
    localVerification.getUTCMinutes() !== minute ||
    localVerification.getUTCSeconds() !== second
  ) {
    throw new SaleScheduleValidationError(`${label} is not a valid date.`);
  }

  return parsed;
}

export function formatJohannesburgLocalDateTime(value: Date) {
  if (!Number.isFinite(value.getTime())) {
    throw new SaleScheduleValidationError("Sale date and time is invalid.");
  }

  const local = new Date(
    value.getTime() + JOHANNESBURG_UTC_OFFSET_MINUTES * 60_000,
  );
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(
    local.getUTCDate(),
  )}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

export function validateSaleScheduleWindow({
  endsAt,
  now,
  requireFutureStart,
  startsAt,
}: {
  endsAt: Date;
  now: Date;
  requireFutureStart: boolean;
  startsAt: Date;
}) {
  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    !Number.isFinite(now.getTime())
  ) {
    throw new SaleScheduleValidationError("Sale schedule dates are invalid.");
  }

  if (requireFutureStart && startsAt.getTime() <= now.getTime()) {
    throw new SaleScheduleValidationError(
      "Scheduled sales must start in the future. Choose Start now for an immediate sale.",
    );
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new SaleScheduleValidationError(
      "Sale end must be after the sale start.",
    );
  }
}

export function saleScheduleWindowsOverlap(
  left: SaleWindow,
  right: SaleWindow,
) {
  const leftEndsAt = left.endsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEndsAt = right.endsAt?.getTime() ?? Number.POSITIVE_INFINITY;

  return (
    left.startsAt.getTime() < rightEndsAt &&
    right.startsAt.getTime() < leftEndsAt
  );
}

export function resolveSaleSchedule(
  input: SaleScheduleInput,
  now = new Date(),
): ResolvedSaleSchedule {
  const requestedStart = parseJohannesburgLocalDateTime(
    input.startsAtLocal,
    "Sale start",
  );
  const endsAt = parseJohannesburgLocalDateTime(input.endsAtLocal, "Sale end");
  const startsAt =
    input.scheduleMode === "now" ? new Date(now.getTime()) : requestedStart;

  validateSaleScheduleWindow({
    endsAt,
    now,
    requireFutureStart: input.scheduleMode === "scheduled",
    startsAt,
  });

  return {
    endsAt,
    startsAt,
    status: input.scheduleMode === "now" ? "active" : "scheduled",
  };
}

export function getDiscountedSalePrice(
  price: number,
  discountPercent: number,
) {
  if (!Number.isFinite(price) || price <= 0) {
    throw new SaleScheduleValidationError("Sale price must be positive.");
  }

  if (
    !Number.isFinite(discountPercent) ||
    discountPercent < 1 ||
    discountPercent > 95
  ) {
    throw new SaleScheduleValidationError(
      "Sale discount must be between 1% and 95%.",
    );
  }

  const discountedCents = Math.max(
    1,
    Math.round(price * 100 * (1 - discountPercent / 100)),
  );

  return (discountedCents / 100).toFixed(2);
}

export function getScheduledSalePreviewBase({
  currentCompareAtPrice,
  currentPrice,
  managedActiveOriginalCompareAtPrice,
  managedActiveOriginalPrice,
}: {
  currentCompareAtPrice: string | null;
  currentPrice: string;
  managedActiveOriginalCompareAtPrice?: string | null;
  managedActiveOriginalPrice?: string | null;
}) {
  return {
    compareAtPrice:
      managedActiveOriginalPrice == null
        ? currentCompareAtPrice
        : (managedActiveOriginalCompareAtPrice ?? null),
    price: managedActiveOriginalPrice ?? currentPrice,
  };
}
