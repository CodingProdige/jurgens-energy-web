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
