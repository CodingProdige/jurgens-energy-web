const productCardPreviewMaxWidth = 640;
const productCardPreviewMinimumCrf = 32;
const productCardPreviewMaximumCrf = 38;

export function buildFullLengthVideoPreviewFfmpegArgs(input: {
  inputPath: string;
  maxVideoWidth: number;
  outputPath: string;
  videoCompressionCrf: number;
}) {
  const previewMaxWidth = Math.min(
    input.maxVideoWidth,
    productCardPreviewMaxWidth,
  );
  const previewCompressionCrf = Math.min(
    productCardPreviewMaximumCrf,
    Math.max(
      productCardPreviewMinimumCrf,
      input.videoCompressionCrf + 4,
    ),
  );

  return [
    "-y",
    "-i",
    input.inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    `scale='min(${previewMaxWidth},iw)':-2`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    String(previewCompressionCrf),
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "64k",
    input.outputPath,
  ];
}
