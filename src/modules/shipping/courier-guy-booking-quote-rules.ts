import { createHash } from "node:crypto";

import type { CourierGuyRate } from "@/src/modules/shipping/courier-guy-client";

export type CourierGuyBookingQuoteSafety = {
  allowed: boolean;
  approvedAmountCents: number;
  freshAmountCents: number;
  projectedAbsorbedAmountCents: number;
  projectedProviderSpendCents: number;
  reason:
    | "approved_quote_exceeded"
    | "booking_cost_limit_exceeded"
    | "absorbed_cost_limit_exceeded"
    | null;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)]),
    );
  }

  return value;
}

export function createCourierGuyBookingQuoteFingerprint(snapshot: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(snapshot)))
    .digest("hex");
}

export function moneyToCents(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Shipping amounts must be non-negative numbers.");
  }

  return Math.round((value + Number.EPSILON) * 100);
}

export function centsToMoney(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Shipping cents must be a non-negative whole number.");
  }

  return Number((value / 100).toFixed(2));
}

export function calculateCourierGuyOrderCostProjection({
  customerShippingAmount,
  otherProviderCosts,
  selectedProviderAmount,
}: {
  customerShippingAmount: number;
  otherProviderCosts: number;
  selectedProviderAmount: number;
}) {
  const customerShippingAmountCents = moneyToCents(customerShippingAmount);
  const otherProviderCostsCents = moneyToCents(otherProviderCosts);
  const selectedProviderAmountCents = moneyToCents(selectedProviderAmount);
  const projectedProviderSpendCents =
    otherProviderCostsCents + selectedProviderAmountCents;
  const differenceCents =
    projectedProviderSpendCents - customerShippingAmountCents;

  return {
    customerShippingAmountCents,
    deliveryMarginRemainingCents: Math.max(-differenceCents, 0),
    otherProviderCostsCents,
    projectedAbsorbedAmountCents: Math.max(differenceCents, 0),
    projectedProviderSpendCents,
    selectedProviderAmountCents,
  };
}

export function evaluateCourierGuyBookingQuoteSafety({
  approvedProviderAmount,
  customerShippingAmount,
  freshProviderAmount,
  maxAbsorbedAmount,
  maxBookingCostAmount,
  otherProviderCosts,
}: {
  approvedProviderAmount: number;
  customerShippingAmount: number;
  freshProviderAmount: number;
  maxAbsorbedAmount: number | null;
  maxBookingCostAmount: number | null;
  otherProviderCosts: number;
}): CourierGuyBookingQuoteSafety {
  const approvedAmountCents = moneyToCents(approvedProviderAmount);
  const freshAmountCents = moneyToCents(freshProviderAmount);
  const projection = calculateCourierGuyOrderCostProjection({
    customerShippingAmount,
    otherProviderCosts,
    selectedProviderAmount: freshProviderAmount,
  });

  if (freshAmountCents > approvedAmountCents) {
    return {
      allowed: false,
      approvedAmountCents,
      freshAmountCents,
      projectedAbsorbedAmountCents: projection.projectedAbsorbedAmountCents,
      projectedProviderSpendCents: projection.projectedProviderSpendCents,
      reason: "approved_quote_exceeded",
    };
  }

  if (
    maxBookingCostAmount !== null &&
    freshAmountCents > moneyToCents(maxBookingCostAmount)
  ) {
    return {
      allowed: false,
      approvedAmountCents,
      freshAmountCents,
      projectedAbsorbedAmountCents: projection.projectedAbsorbedAmountCents,
      projectedProviderSpendCents: projection.projectedProviderSpendCents,
      reason: "booking_cost_limit_exceeded",
    };
  }

  if (
    maxAbsorbedAmount !== null &&
    projection.projectedAbsorbedAmountCents > moneyToCents(maxAbsorbedAmount)
  ) {
    return {
      allowed: false,
      approvedAmountCents,
      freshAmountCents,
      projectedAbsorbedAmountCents: projection.projectedAbsorbedAmountCents,
      projectedProviderSpendCents: projection.projectedProviderSpendCents,
      reason: "absorbed_cost_limit_exceeded",
    };
  }

  return {
    allowed: true,
    approvedAmountCents,
    freshAmountCents,
    projectedAbsorbedAmountCents: projection.projectedAbsorbedAmountCents,
    projectedProviderSpendCents: projection.projectedProviderSpendCents,
    reason: null,
  };
}

export function selectCourierGuyRate(
  rates: CourierGuyRate[],
  preferredServiceCode: string | null,
) {
  if (preferredServiceCode) {
    return (
      rates.find(
        (rate) =>
          rate.serviceCode.toLowerCase() ===
          preferredServiceCode.toLowerCase(),
      ) ?? null
    );
  }

  return (
    [...rates].sort(
      (first, second) => first.providerAmount - second.providerAmount,
    )[0] ?? null
  );
}

export function findCourierGuyRateForStoredService(
  rates: CourierGuyRate[],
  storedService: { serviceCode: string; serviceLevelId: string | null },
) {
  if (storedService.serviceLevelId) {
    const byId = rates.find(
      (rate) => rate.serviceLevelId === storedService.serviceLevelId,
    );

    if (byId) {
      return byId;
    }
  }

  return (
    rates.find(
      (rate) =>
        rate.serviceCode.toLowerCase() ===
        storedService.serviceCode.toLowerCase(),
    ) ?? null
  );
}
