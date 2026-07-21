type ExchangeRequirementTextInput = {
  emptySize?: string | null;
  fallbackText?: string | null;
  quantity: number;
};

function normalizeQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) {
    return 1;
  }

  return Math.max(1, Math.floor(quantity));
}

function normalizeLegacyConfirmationText(value: string | null | undefined) {
  const normalizedValue = value?.trim().replace(/\s+/g, " ");

  if (!normalizedValue) {
    return null;
  }

  const legacyConfirmation = normalizedValue.match(
    /^I confirm I have\s+(.+?)(?:\.)?$/i,
  );

  if (
    legacyConfirmation?.[1] ||
    /^(?:bring|hand over)\b.*\bempty cylinders?\b/i.test(normalizedValue)
  ) {
    return null;
  }

  return normalizedValue;
}

export function getExchangeRequirementText({
  emptySize,
  fallbackText,
  quantity,
}: ExchangeRequirementTextInput) {
  const normalizedQuantity = normalizeQuantity(quantity);
  const normalizedFallbackText = normalizeLegacyConfirmationText(fallbackText);

  if (normalizedQuantity === 1 && normalizedFallbackText) {
    return normalizedFallbackText;
  }

  const normalizedEmptySize = emptySize?.trim() || null;
  const quantityText =
    normalizedQuantity === 1
      ? normalizedEmptySize
        ? `your ${normalizedEmptySize}`
        : "your compatible"
      : normalizedEmptySize
        ? `your ${normalizedQuantity} × ${normalizedEmptySize}`
        : `your ${normalizedQuantity} compatible`;
  const cylinderText =
    normalizedQuantity === 1 ? "empty cylinder" : "empty cylinders";

  return `Supply us with ${quantityText} ${cylinderText} in acceptable condition when your order is delivered.`;
}

export function resolveCartLineExchangePolicy({
  available,
  requiresExchangeEmpty,
}: {
  available: boolean;
  requiresExchangeEmpty: boolean;
}) {
  return {
    checkoutEligible: available,
    exchangeConfirmationMissing: false,
    purchaseType: requiresExchangeEmpty
      ? ("exchange" as const)
      : ("standard" as const),
  };
}
