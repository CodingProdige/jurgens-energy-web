export type CheckoutPaymentConfirmation = {
  paymentStatus: string;
  providerStatus: string | null;
  status: string;
};

export const CHECKOUT_PAYMENT_FAST_POLL_ATTEMPTS = 30;
export const CHECKOUT_INVOICE_FAST_POLL_ATTEMPTS = 8;

const CHECKOUT_FAST_POLL_INTERVAL_MS = 2_000;
const CHECKOUT_DELAYED_POLL_INTERVAL_MS = 10_000;
const CHECKOUT_LONG_POLL_INTERVAL_MS = 30_000;
const CHECKOUT_DELAYED_POLL_ATTEMPTS = 24;

export function getCheckoutStatusPollDelay({
  completedAttempts,
  paymentConfirmed,
}: {
  completedAttempts: number;
  paymentConfirmed: boolean;
}) {
  const fastAttempts = paymentConfirmed
    ? CHECKOUT_INVOICE_FAST_POLL_ATTEMPTS
    : CHECKOUT_PAYMENT_FAST_POLL_ATTEMPTS;

  if (completedAttempts < fastAttempts) {
    return CHECKOUT_FAST_POLL_INTERVAL_MS;
  }

  if (completedAttempts < fastAttempts + CHECKOUT_DELAYED_POLL_ATTEMPTS) {
    return CHECKOUT_DELAYED_POLL_INTERVAL_MS;
  }

  return CHECKOUT_LONG_POLL_INTERVAL_MS;
}

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

export function selectCheckoutPaymentConfirmation({
  orderStatus,
  payments,
}: {
  orderStatus: string;
  payments: ReadonlyArray<{
    providerStatus: string | null;
    status: string;
  }>;
}): CheckoutPaymentConfirmation {
  const payment =
    payments.find((candidate) =>
      isCheckoutPaymentConfirmed({
        paymentStatus: candidate.status,
        providerStatus: candidate.providerStatus,
        status: orderStatus,
      }),
    ) ?? payments[0];

  return {
    paymentStatus: payment?.status ?? "pending",
    providerStatus: payment?.providerStatus ?? null,
    status: orderStatus,
  };
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
