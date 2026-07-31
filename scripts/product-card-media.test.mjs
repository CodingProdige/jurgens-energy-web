import assert from "node:assert/strict";
import test from "node:test";

import { selectMarketplaceProductCardMedia } from "../src/modules/marketplace/product-card-media.ts";

function mediaRow(overrides = {}) {
  return {
    durationMs: null,
    isCover: false,
    isPublic: true,
    mimeType: "image/webp",
    previewRelativePath: null,
    productId: "product-1",
    relativePath: "products/default.webp",
    sortOrder: 0,
    thumbnailRelativePath: null,
    ...overrides,
  };
}

test("product-card media honours the public explicit cover", () => {
  const selected = selectMarketplaceProductCardMedia([
    mediaRow({
      relativePath: "products/first.webp",
      sortOrder: 0,
    }),
    mediaRow({
      isCover: true,
      relativePath: "products/explicit.webp",
      sortOrder: 2,
      thumbnailRelativePath: "products/thumbs/explicit.webp",
    }),
  ]);

  assert.equal(
    selected.get("product-1")?.coverImageUrl,
    "/media/products/explicit.webp",
  );
});

test("product cards use the full image rendition instead of a cropped thumbnail", () => {
  const selected = selectMarketplaceProductCardMedia([
    mediaRow({
      relativePath: "products/full.webp",
      thumbnailRelativePath: "products/thumbs/cropped.webp",
    }),
  ]);

  assert.equal(
    selected.get("product-1")?.coverImageUrl,
    "/media/products/full.webp",
  );
});

test("product-card media ignores private assets and selects the first public video", () => {
  const selected = selectMarketplaceProductCardMedia([
    mediaRow({
      isPublic: false,
      mimeType: "video/mp4",
      previewRelativePath: "products/previews/private.mp4",
      relativePath: "products/private.mp4",
      sortOrder: 0,
    }),
    mediaRow({
      durationMs: 45_000,
      mimeType: "video/mp4",
      previewRelativePath: "products/previews/public.mp4",
      relativePath: "products/public.mp4",
      sortOrder: 1,
      thumbnailRelativePath: "products/thumbs/public.webp",
    }),
    mediaRow({
      mimeType: "video/mp4",
      previewRelativePath: "products/previews/second.mp4",
      relativePath: "products/second.mp4",
      sortOrder: 2,
    }),
  ]);

  assert.deepEqual(selected.get("product-1")?.previewVideo, {
    durationMs: 45_000,
    posterUrl: "/media/products/thumbs/public.webp",
    url: "/media/products/previews/public.mp4",
  });
});

test("legacy video assets fall back to the full optimized video", () => {
  const selected = selectMarketplaceProductCardMedia([
    mediaRow({
      mimeType: "video/mp4",
      relativePath: "products/full.mp4",
    }),
  ]);

  assert.equal(
    selected.get("product-1")?.previewVideo?.url,
    "/media/products/full.mp4",
  );
});

test("poster-less videos never become product-card images", () => {
  const selected = selectMarketplaceProductCardMedia([
    mediaRow({
      isCover: true,
      mimeType: "video/mp4",
      relativePath: "products/full.mp4",
      sortOrder: 0,
    }),
    mediaRow({
      relativePath: "products/fallback.webp",
      sortOrder: 1,
    }),
  ]);

  assert.equal(
    selected.get("product-1")?.coverImageUrl,
    "/media/products/fallback.webp",
  );
  assert.equal(
    selected.get("product-1")?.previewVideo?.url,
    "/media/products/full.mp4",
  );
});
