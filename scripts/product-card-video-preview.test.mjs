import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PRODUCT_CARD_VIDEO_ANALYTICS_DELAY_MS } from "../src/modules/marketplace/product-card-video-preview.ts";

test("preview analytics require sustained playback", () => {
  assert.equal(PRODUCT_CARD_VIDEO_ANALYTICS_DELAY_MS, 1_000);
});

test("the client island keeps video playback manual and stable", async () => {
  const source = await readFile(
    new URL(
      "../components/marketplace/product-card-video-preview.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /preload="metadata"/);
  assert.match(source, /\n\s+loop\n/);
  assert.match(source, /\n\s+muted\n/);
  assert.match(source, /\n\s+playsInline\n/);
  assert.match(source, /type PlaybackIntent = "manual"/);
  assert.match(source, /video\.src = preview\.url/);
  assert.doesNotMatch(source, /video\.removeAttribute\("src"\)/);
  assert.doesNotMatch(source, /new IntersectionObserver/);
  assert.doesNotMatch(source, /pointerenter|pointermove|pointerleave/);
  assert.doesNotMatch(source, /PRODUCT_CARD_VIDEO_HOVER_DELAY_MS/);
  assert.doesNotMatch(source, /canAutoplayProductCardVideo/);
  assert.doesNotMatch(source, /isPointerInsideProductCardVideo/);
  assert.match(source, /document\.hidden/);
  assert.match(source, /onWaiting=\{handlePlaybackInterruption\}/);
  assert.match(source, /video\.readyState < HTMLMediaElement\.HAVE_FUTURE_DATA/);
  assert.match(source, /window\.jurgensGoogleConsent\?\.analytics !== "granted"/);
  assert.match(source, /trackedProductVideoPreviewIds/);
  assert.doesNotMatch(source, /currentTime\s*[><]=?\s*\d/);
});

test("the server product card delegates only its media layer to the client island", async () => {
  const source = await readFile(
    new URL("../components/marketplace/product-card.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /<ProductCardVideoPreview/);
  assert.match(source, /preview=\{product\.previewVideo\}/);
  assert.match(source, /getSoldQuantityLabel\(product\.soldQuantity\)/);
  assert.match(source, /<ProductCardPerformanceMarquee badge=\{performanceBadge\}/);
  assert.match(source, /<h3 className="truncate /);
  assert.match(source, /<div className="flex min-w-0 items-start gap-1">/);
  assert.doesNotMatch(source, /line-clamp-2/);
  assert.doesNotMatch(source, />\s*From\s*</);
  assert.doesNotMatch(source, /absolute bottom-1\.5 right-1\.5/);
  assert.doesNotMatch(source, /^"use client";/);
});
