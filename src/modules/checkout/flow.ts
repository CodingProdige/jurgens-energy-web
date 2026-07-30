export const CHECKOUT_STEPS = ["address", "shipping", "payment"] as const;
export const CHECKOUT_DELIVERY_GROUP_KEY = "delivery";

export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

export function getCheapestCheckoutShippingOption<
  Option extends { amountZar: number },
>(options: readonly Option[]) {
  let cheapestOption: Option | null = null;

  for (const option of options) {
    if (!cheapestOption || option.amountZar < cheapestOption.amountZar) {
      cheapestOption = option;
    }
  }

  return cheapestOption;
}

export function getSingleOrderShippingTotal(
  groups: ReadonlyArray<{
    groupKey: string;
    options: ReadonlyArray<{ amountZar: number; quoteId: string }>;
  }>,
  selectedQuoteByGroup: Readonly<Record<string, string>>,
) {
  if (groups.length > 1) {
    throw new Error(
      "Checkout must expose exactly one order-level delivery group.",
    );
  }

  const group = groups[0];

  if (!group) {
    return 0;
  }

  const quoteId = selectedQuoteByGroup[group.groupKey];

  return (
    group.options.find((option) => option.quoteId === quoteId)?.amountZar ?? 0
  );
}

export function isCheckoutAddressStepReady({
  addressBookChoiceComplete,
  addressComplete,
  customerComplete,
}: {
  addressBookChoiceComplete: boolean;
  addressComplete: boolean;
  customerComplete: boolean;
}) {
  return customerComplete && addressComplete && addressBookChoiceComplete;
}

export function isCheckoutShippingStepReady({
  allGroupsAvailable,
  hasQuoteError,
  isLoadingQuotes,
  scheduleValid,
}: {
  allGroupsAvailable: boolean;
  hasQuoteError: boolean;
  isLoadingQuotes: boolean;
  scheduleValid: boolean;
}) {
  return (
    allGroupsAvailable &&
    scheduleValid &&
    !isLoadingQuotes &&
    !hasQuoteError
  );
}
