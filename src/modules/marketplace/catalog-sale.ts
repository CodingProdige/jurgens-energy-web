export type MarketplaceSalePrice = {
  compareAtPrice: string | null;
  price: string;
};

export function isMarketplaceVariantOnSale({
  compareAtPrice,
  price,
}: MarketplaceSalePrice) {
  const numericPrice = Number(price);
  const numericCompareAtPrice = Number(compareAtPrice);

  return (
    Number.isFinite(numericPrice) &&
    Number.isFinite(numericCompareAtPrice) &&
    numericPrice > 0 &&
    numericCompareAtPrice > numericPrice
  );
}
