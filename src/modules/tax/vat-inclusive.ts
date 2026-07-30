export const SOUTH_AFRICAN_STANDARD_VAT_RATE_BPS = 1_500;

export function calculateVatInclusiveAmounts(
  grossCents: number,
  taxRateBps: number,
) {
  if (
    !Number.isInteger(grossCents) ||
    grossCents < 0 ||
    !Number.isInteger(taxRateBps) ||
    taxRateBps < 0
  ) {
    throw new Error("VAT-inclusive calculation received invalid input.");
  }

  const netCents = Math.round(
    (grossCents * 10_000) / (10_000 + taxRateBps),
  );

  return {
    netCents,
    taxCents: grossCents - netCents,
  };
}
