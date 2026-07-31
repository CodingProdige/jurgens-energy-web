import type { MarketplaceVariant } from "@/src/modules/marketplace/catalog";

type ExchangeVariantIdentity = Pick<
  MarketplaceVariant,
  "requiresExchangeEmpty" | "title"
>;

export function isExchangeVariant(
  variant: ExchangeVariantIdentity | null | undefined,
) {
  return Boolean(
    variant &&
      (variant.requiresExchangeEmpty || /\bexchange\b/i.test(variant.title)),
  );
}

export function getSoldQuantityLabel(quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const wholeQuantity = Math.floor(quantity);
  const milestone =
    wholeQuantity >= 1_000_000
      ? Math.floor(wholeQuantity / 1_000_000) * 1_000_000
      : wholeQuantity >= 100_000
        ? Math.floor(wholeQuantity / 100_000) * 100_000
        : wholeQuantity >= 10_000
          ? Math.floor(wholeQuantity / 10_000) * 10_000
          : wholeQuantity >= 1_000
            ? Math.floor(wholeQuantity / 1_000) * 1_000
            : wholeQuantity >= 100
              ? Math.floor(wholeQuantity / 100) * 100
              : wholeQuantity >= 10
                ? Math.floor(wholeQuantity / 10) * 10
                : wholeQuantity;

  return `${formatCompactQuantity(milestone)}+ sold`;
}

function formatCompactQuantity(quantity: number) {
  if (quantity >= 1_000_000) {
    return `${quantity / 1_000_000}M`;
  }

  if (quantity >= 1_000) {
    return `${quantity / 1_000}K`;
  }

  return String(quantity);
}
