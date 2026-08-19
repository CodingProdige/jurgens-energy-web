import { getMediaPublicUrl } from "../media/paths.ts";

export type MarketplaceProductPreviewVideo = {
  durationMs: number | null;
  posterUrl: string | null;
  url: string;
};

export type MarketplaceProductCardMedia = {
  coverImageUrl: string | null;
  imageUrls: string[];
  previewVideo: MarketplaceProductPreviewVideo | null;
};

export type MarketplaceProductCardMediaRow = {
  durationMs: number | null;
  isCover: boolean;
  isPublic: boolean;
  mimeType: string;
  previewRelativePath: string | null;
  productId: string;
  relativePath: string;
  sortOrder: number;
  thumbnailRelativePath: string | null;
};

export function getMarketplaceProductImageUrl(row: {
  mimeType: string;
  relativePath: string;
  thumbnailRelativePath: string | null;
}) {
  if (row.mimeType.startsWith("video/")) {
    return row.thumbnailRelativePath
      ? getMediaPublicUrl(row.thumbnailRelativePath)
      : null;
  }

  return row.mimeType.startsWith("image/")
    ? getMediaPublicUrl(row.relativePath)
    : null;
}

export function selectMarketplaceProductCardMedia(
  rows: readonly MarketplaceProductCardMediaRow[],
) {
  const mediaByProductId = new Map<string, MarketplaceProductCardMedia>();
  const hasExplicitCoverByProductId = new Set<string>();
  const orderedRows = rows
    .map((row, sourceIndex) => ({ row, sourceIndex }))
    .sort(
      (first, second) =>
        first.row.sortOrder - second.row.sortOrder ||
        first.sourceIndex - second.sourceIndex,
    );

  for (const { row } of orderedRows) {
    if (!row.isPublic) {
      continue;
    }

    const current = mediaByProductId.get(row.productId) ?? {
      coverImageUrl: null,
      imageUrls: [],
      previewVideo: null,
    };
    const coverUrl = getMarketplaceProductImageUrl(row);

    if (row.mimeType.startsWith("image/") && coverUrl) {
      current.imageUrls.push(coverUrl);
    }

    if (
      row.isCover &&
      coverUrl &&
      !hasExplicitCoverByProductId.has(row.productId)
    ) {
      current.coverImageUrl = coverUrl;
      hasExplicitCoverByProductId.add(row.productId);
    } else if (
      coverUrl &&
      current.coverImageUrl === null &&
      !hasExplicitCoverByProductId.has(row.productId)
    ) {
      current.coverImageUrl = coverUrl;
    }

    if (
      current.previewVideo === null &&
      row.mimeType.startsWith("video/")
    ) {
      current.previewVideo = {
        durationMs: row.durationMs,
        posterUrl: row.thumbnailRelativePath
          ? getMediaPublicUrl(row.thumbnailRelativePath)
          : null,
        url: getMediaPublicUrl(
          row.previewRelativePath ?? row.relativePath,
        ),
      };
    }

    mediaByProductId.set(row.productId, current);
  }

  for (const selection of mediaByProductId.values()) {
    const uniqueImageUrls = Array.from(new Set(selection.imageUrls));

    selection.imageUrls = selection.coverImageUrl
      ? [
          selection.coverImageUrl,
          ...uniqueImageUrls.filter((url) => url !== selection.coverImageUrl),
        ]
      : uniqueImageUrls;
  }

  return mediaByProductId;
}
