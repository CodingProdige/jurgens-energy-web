export type CustomerShippingPrice = {
  amount: number;
  flatRate: number;
  freeOverAmount: number | null;
  rule: "flat_rate" | "free_shipping_over";
};

export type CustomerShippingPolicyInput = {
  flatRate: number;
  freeOverAmount?: number | null;
  orderSubtotal: number;
};

function requireNonNegativeMoney(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative amount.`);
  }

  return roundMoney(value);
}

export function normalizeFreeShippingThreshold(
  value: number | null | undefined,
) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Free-shipping threshold must be greater than zero.");
  }

  const roundedValue = roundMoney(value);

  if (roundedValue <= 0) {
    throw new Error(
      "Free-shipping threshold must be at least one cent after rounding.",
    );
  }

  return roundedValue;
}

/**
 * Customer-facing shipping never depends on a carrier quote. Provider costs
 * are reconciled internally after booking and any difference is absorbed by
 * Jurgens Energy.
 */
export function calculateCustomerShippingPrice({
  flatRate,
  freeOverAmount,
  orderSubtotal,
}: CustomerShippingPolicyInput): CustomerShippingPrice {
  const normalizedFlatRate = requireNonNegativeMoney(flatRate, "Flat shipping");
  const normalizedSubtotal = requireNonNegativeMoney(
    orderSubtotal,
    "Order subtotal",
  );
  const normalizedThreshold =
    normalizeFreeShippingThreshold(freeOverAmount);
  const qualifiesForFreeShipping =
    normalizedThreshold !== null &&
    normalizedSubtotal >= normalizedThreshold;

  return {
    amount: qualifiesForFreeShipping ? 0 : normalizedFlatRate,
    flatRate: normalizedFlatRate,
    freeOverAmount: normalizedThreshold,
    rule: qualifiesForFreeShipping
      ? "free_shipping_over"
      : "flat_rate",
  };
}

export function calculateAbsorbedShippingCost({
  customerAmount,
  providerAmount,
}: {
  customerAmount: number;
  providerAmount: number;
}) {
  return Math.max(
    0,
    roundMoney(
      requireNonNegativeMoney(providerAmount, "Provider shipping") -
        requireNonNegativeMoney(customerAmount, "Customer shipping"),
    ),
  );
}

export function roundMoney(value: number) {
  return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
}
