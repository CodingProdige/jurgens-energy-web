type MarketplaceCatalogRevisionInput = {
  initialPage: number;
  products: readonly unknown[];
  totalCount: number;
  totalPages: number;
};

/**
 * Produces a compact, deterministic revision for the server-owned catalog
 * snapshot. The client grid uses it to distinguish an actual server refresh
 * from its own appended infinite-scroll state.
 */
export function getMarketplaceCatalogProductRevision({
  initialPage,
  products,
  totalCount,
  totalPages,
}: MarketplaceCatalogRevisionInput) {
  const serialized = JSON.stringify({
    initialPage,
    products,
    totalCount,
    totalPages,
  });
  let primaryHash = 2_166_136_261;
  let secondaryHash = 5_381;

  for (let index = 0; index < serialized.length; index += 1) {
    const character = serialized.charCodeAt(index);
    primaryHash = Math.imul(primaryHash ^ character, 16_777_619);
    secondaryHash = Math.imul(secondaryHash, 33) ^ character;
  }

  return `${serialized.length}:${(primaryHash >>> 0).toString(36)}:${(
    secondaryHash >>> 0
  ).toString(36)}`;
}
