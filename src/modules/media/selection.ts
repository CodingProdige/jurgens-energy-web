export function normalizeMediaSelectionIds(
  assetIds: readonly string[],
  limit = Number.POSITIVE_INFINITY,
) {
  const uniqueAssetIds = [...new Set(assetIds)];

  return uniqueAssetIds.slice(0, Math.max(0, limit));
}

export function getInitialMediaPickerSelection({
  selectedAssetId,
  selectedAssetIds,
}: {
  selectedAssetId?: string | null;
  selectedAssetIds?: readonly string[];
}) {
  return normalizeMediaSelectionIds(
    selectedAssetIds ?? (selectedAssetId ? [selectedAssetId] : []),
  );
}

export function toggleMediaPickerSelection({
  allowMultipleSelection,
  assetId,
  selectedAssetIds,
}: {
  allowMultipleSelection: boolean;
  assetId: string;
  selectedAssetIds: readonly string[];
}) {
  if (selectedAssetIds.includes(assetId)) {
    return selectedAssetIds.filter((selectedId) => selectedId !== assetId);
  }

  return allowMultipleSelection
    ? [...selectedAssetIds, assetId]
    : [assetId];
}
