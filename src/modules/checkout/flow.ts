export const CHECKOUT_STEPS = ["address", "shipping", "payment"] as const;

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
