import { z } from "zod";

const maximumMoneyCents = 999_999_999_999;
const moneyPattern = /^\d+(?:\.\d{1,2})?$/;

export const optionalCostPriceInputSchema = z
  .string()
  .trim()
  .max(40)
  .refine(
    (value) => value === "" || parseMoneyToCents(value) !== null,
    "Enter a non-negative cost price with no more than two decimal places.",
  )
  .optional();

export type VariantProfitability = {
  costPriceCents: number;
  grossMarginBps: number | null;
  grossProfitCents: number;
  sellingPriceCents: number;
};

export function parseMoneyToCents(value: string | number): number | null {
  const normalized = String(value).trim();

  if (!moneyPattern.test(normalized)) {
    return null;
  }

  const [wholePart, fractionalPart = ""] = normalized.split(".");
  const whole = Number(wholePart);
  const fraction = Number(fractionalPart.padEnd(2, "0"));
  const cents = whole * 100 + fraction;

  return Number.isSafeInteger(cents) && cents <= maximumMoneyCents
    ? cents
    : null;
}

export function formatMoneyCents(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError("Money cents must be a non-negative safe integer.");
  }

  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");

  return `${whole}.${fraction}`;
}

export function normalizeOptionalCostPrice(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const cents = parseMoneyToCents(normalized);

  if (cents === null) {
    throw new RangeError(
      "Cost price must be non-negative and have no more than two decimal places.",
    );
  }

  return formatMoneyCents(cents);
}

export function resolveOptionalCostPriceForSave({
  existingCostPrice,
  input,
}: {
  existingCostPrice: string | null;
  input: string | undefined;
}): string | null {
  return input === undefined
    ? existingCostPrice
    : normalizeOptionalCostPrice(input);
}

export function calculateGrossProfitCents(
  sellingPriceCents: number,
  costPriceCents: number,
): number {
  if (
    !Number.isSafeInteger(sellingPriceCents) ||
    sellingPriceCents < 0 ||
    !Number.isSafeInteger(costPriceCents) ||
    costPriceCents < 0
  ) {
    throw new RangeError(
      "Selling price and cost price cents must be non-negative safe integers.",
    );
  }

  return sellingPriceCents - costPriceCents;
}

export function calculateGrossMarginBps(
  sellingPriceCents: number,
  costPriceCents: number,
): number | null {
  const grossProfitCents = calculateGrossProfitCents(
    sellingPriceCents,
    costPriceCents,
  );

  if (sellingPriceCents === 0) {
    return null;
  }

  return Math.round((grossProfitCents / sellingPriceCents) * 10_000);
}

export function getVariantProfitability({
  costPrice,
  price,
}: {
  costPrice: string | null;
  price: string;
}): VariantProfitability | null {
  if (costPrice === null) {
    return null;
  }

  const sellingPriceCents = parseMoneyToCents(price);
  const costPriceCents = parseMoneyToCents(costPrice);

  if (sellingPriceCents === null || costPriceCents === null) {
    return null;
  }

  return {
    costPriceCents,
    grossMarginBps: calculateGrossMarginBps(
      sellingPriceCents,
      costPriceCents,
    ),
    grossProfitCents: calculateGrossProfitCents(
      sellingPriceCents,
      costPriceCents,
    ),
    sellingPriceCents,
  };
}
