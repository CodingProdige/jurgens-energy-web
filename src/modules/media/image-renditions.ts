import sharp from "sharp";

export const defaultImageCompressionQuality = 90;
export const defaultMaxImageWidth = 2560;
export const imageThumbnailBoundingBox = 720;

const minimumThumbnailQuality = 82;
const thumbnailQualityReduction = 4;

export function getImageRenditionSettings(input: {
  imageCompressionQuality: number;
  maxImageWidth: number;
}) {
  return {
    optimized: {
      encoding: {
        effort: 6,
        quality: input.imageCompressionQuality,
        smartSubsample: true,
      },
      resize: {
        fit: "inside" as const,
        width: input.maxImageWidth,
        withoutEnlargement: true,
      },
    },
    thumbnail: {
      encoding: {
        effort: 5,
        quality: Math.max(
          minimumThumbnailQuality,
          input.imageCompressionQuality - thumbnailQualityReduction,
        ),
        smartSubsample: true,
      },
      resize: {
        fit: "inside" as const,
        height: imageThumbnailBoundingBox,
        width: imageThumbnailBoundingBox,
        withoutEnlargement: true,
      },
    },
  };
}

export async function createImageRenditions(input: {
  imageCompressionQuality: number;
  maxImageWidth: number;
  outputXmp: string | null;
  sourceBuffer: Buffer;
}) {
  const settings = getImageRenditionSettings(input);
  const optimizedPipeline = sharp(input.sourceBuffer, { failOn: "none" })
    .rotate()
    .resize(settings.optimized.resize)
    .webp(settings.optimized.encoding);
  const thumbnailPipeline = sharp(input.sourceBuffer, { failOn: "none" })
    .rotate()
    .resize(settings.thumbnail.resize)
    .webp(settings.thumbnail.encoding);

  if (input.outputXmp) {
    optimizedPipeline.withXmp(input.outputXmp);
    thumbnailPipeline.withXmp(input.outputXmp);
  }

  const [optimized, thumbnail] = await Promise.all([
    optimizedPipeline.toBuffer({ resolveWithObject: true }),
    thumbnailPipeline.toBuffer({ resolveWithObject: true }),
  ]);

  return {
    optimized: {
      buffer: optimized.data,
      height: optimized.info.height,
      width: optimized.info.width,
    },
    thumbnail: {
      buffer: thumbnail.data,
      height: thumbnail.info.height,
      width: thumbnail.info.width,
    },
  };
}
