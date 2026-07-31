import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  createImageRenditions,
  defaultImageCompressionQuality,
  defaultMaxImageWidth,
  getImageRenditionSettings,
  imageThumbnailBoundingBox,
} from "../src/modules/media/image-renditions.ts";

test("uses a high-fidelity default for optimized product images", () => {
  const settings = getImageRenditionSettings({
    imageCompressionQuality: defaultImageCompressionQuality,
    maxImageWidth: defaultMaxImageWidth,
  });

  assert.equal(defaultImageCompressionQuality, 90);
  assert.equal(defaultMaxImageWidth, 2560);
  assert.equal(settings.optimized.encoding.quality, 90);
  assert.equal(settings.optimized.encoding.smartSubsample, true);
  assert.equal(settings.thumbnail.encoding.quality, 86);
  assert.equal(settings.thumbnail.encoding.smartSubsample, true);
  assert.deepEqual(settings.thumbnail.resize, {
    fit: "inside",
    height: imageThumbnailBoundingBox,
    width: imageThumbnailBoundingBox,
    withoutEnlargement: true,
  });
});

test("keeps the full image and thumbnail aspect ratio without cropping", async () => {
  const source = await sharp({
    create: {
      background: "#ff5a1f",
      channels: 4,
      height: 1800,
      width: 3000,
    },
  })
    .png()
    .toBuffer();

  const renditions = await createImageRenditions({
    imageCompressionQuality: defaultImageCompressionQuality,
    maxImageWidth: defaultMaxImageWidth,
    outputXmp: null,
    sourceBuffer: source,
  });
  const [optimizedMetadata, thumbnailMetadata] = await Promise.all([
    sharp(renditions.optimized.buffer).metadata(),
    sharp(renditions.thumbnail.buffer).metadata(),
  ]);

  assert.deepEqual(
    [renditions.optimized.width, renditions.optimized.height],
    [2560, 1536],
  );
  assert.deepEqual(
    [renditions.thumbnail.width, renditions.thumbnail.height],
    [720, 432],
  );
  assert.equal(optimizedMetadata.format, "webp");
  assert.equal(thumbnailMetadata.format, "webp");
});

test("does not enlarge smaller source images", async () => {
  const source = await sharp({
    create: {
      background: "#ffffff",
      channels: 3,
      height: 200,
      width: 320,
    },
  })
    .png()
    .toBuffer();

  const renditions = await createImageRenditions({
    imageCompressionQuality: defaultImageCompressionQuality,
    maxImageWidth: defaultMaxImageWidth,
    outputXmp: null,
    sourceBuffer: source,
  });

  assert.deepEqual(
    [renditions.optimized.width, renditions.optimized.height],
    [320, 200],
  );
  assert.deepEqual(
    [renditions.thumbnail.width, renditions.thumbnail.height],
    [320, 200],
  );
});
