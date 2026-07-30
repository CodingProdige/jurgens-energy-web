export const PENDING_CHECKOUT_TTL_MS = 30 * 60 * 1_000;

export type StockReservationDecision = Readonly<{
  nextStockOnHand: number;
  stockQuantity: number;
}>;

export function createPendingCheckoutExpiry(now = new Date()) {
  return new Date(now.getTime() + PENDING_CHECKOUT_TTL_MS);
}

export function isPendingCheckoutOpen(
  expiresAt: Date | null | undefined,
  now = new Date(),
) {
  return Boolean(expiresAt && expiresAt.getTime() > now.getTime());
}

export function getStockReservationDecision({
  continueSellingOutOfStock,
  quantity,
  stockOnHand,
}: {
  continueSellingOutOfStock: boolean;
  quantity: number;
  stockOnHand: number;
}): StockReservationDecision | null {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity <= 0 ||
    !Number.isSafeInteger(stockOnHand) ||
    stockOnHand < 0
  ) {
    return null;
  }

  if (!continueSellingOutOfStock && stockOnHand < quantity) {
    return null;
  }

  const stockQuantity = Math.min(stockOnHand, quantity);

  return {
    nextStockOnHand: stockOnHand - stockQuantity,
    stockQuantity,
  };
}
