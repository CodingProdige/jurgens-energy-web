export function getJurgensImplicitFreeDeliveryThreshold(
  rates: Array<{
    fromAmount: number;
    price: number;
    upToAmount: number | null;
  }>,
) {
  const paidFiniteCaps = rates.flatMap((rate) =>
    rate.price > 0 && rate.upToAmount !== null ? [rate.upToAmount] : [],
  );

  if (paidFiniteCaps.length === 0) {
    return null;
  }

  const terminalPaidCap = Math.max(...paidFiniteCaps);
  const hasTierAtOrBeyondCap = rates.some(
    (rate) =>
      rate.upToAmount === null ||
      rate.fromAmount >= terminalPaidCap ||
      rate.upToAmount > terminalPaidCap,
  );

  return hasTierAtOrBeyondCap ? null : terminalPaidCap;
}
