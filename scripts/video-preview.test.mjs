import assert from "node:assert/strict";
import test from "node:test";

import { buildFullLengthVideoPreviewFfmpegArgs } from "../src/modules/media/video-preview.ts";

test("product-card previews compress the full video without trimming it", () => {
  const args = buildFullLengthVideoPreviewFfmpegArgs({
    inputPath: "/tmp/full-video.mp4",
    maxVideoWidth: 1280,
    outputPath: "/tmp/full-preview.mp4",
    videoCompressionCrf: 28,
  });

  assert.deepEqual(args.slice(0, 4), [
    "-y",
    "-i",
    "/tmp/full-video.mp4",
    "-map",
  ]);
  for (const forbiddenArgument of [
    "-frames:v",
    "-shortest",
    "-ss",
    "-sseof",
    "-t",
    "-to",
    "-vframes",
  ]) {
    assert.equal(
      args.includes(forbiddenArgument),
      false,
      `${forbiddenArgument} would cap or seek the preview`,
    );
  }
  assert.equal(args.some((value) => value.includes("trim")), false);
  assert.equal(args.includes("-an"), false);
  assert.deepEqual(
    args.slice(args.indexOf("0:v:0") - 1, args.indexOf("0:v:0") + 4),
    ["-map", "0:v:0", "-map", "0:a:0?", "-vf"],
  );
  assert.equal(args[args.indexOf("-c:a") + 1], "aac");
  assert.equal(args[args.indexOf("-b:a") + 1], "64k");
  assert.equal(args[args.indexOf("-crf") + 1], "32");
  assert.equal(args[args.indexOf("-vf") + 1], "scale='min(640,iw)':-2");
  assert.equal(args.at(-1), "/tmp/full-preview.mp4");
});

test("product-card previews never exceed the configured video width", () => {
  const args = buildFullLengthVideoPreviewFfmpegArgs({
    inputPath: "/tmp/full-video.mp4",
    maxVideoWidth: 480,
    outputPath: "/tmp/full-preview.mp4",
    videoCompressionCrf: 35,
  });

  assert.equal(args[args.indexOf("-vf") + 1], "scale='min(480,iw)':-2");
  assert.equal(args[args.indexOf("-crf") + 1], "38");
});
