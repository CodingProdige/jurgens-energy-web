export type CheckoutPaymentConfirmation = {
  paymentStatus: string;
  providerStatus: string | null;
  status: string;
};

export function isCheckoutPaymentConfirmed(
  confirmation: CheckoutPaymentConfirmation,
) {
  const orderIsPaid =
    confirmation.status === "paid" || confirmation.status === "fulfilled";
  const paymentIsCaptured = confirmation.paymentStatus === "captured";
  const providerConfirmed =
    confirmation.providerStatus?.trim().toUpperCase() === "COMPLETE";

  return orderIsPaid && paymentIsCaptured && providerConfirmed;
}

export function getConfirmedPurchasedVariantIds(
  confirmation: CheckoutPaymentConfirmation & {
    purchasedVariantIds: readonly string[];
  },
) {
  if (!isCheckoutPaymentConfirmed(confirmation)) {
    return [];
  }

  return Array.from(
    new Set(
      confirmation.purchasedVariantIds
        .map((variantId) => variantId.trim())
        .filter(Boolean),
    ),
  );
}
