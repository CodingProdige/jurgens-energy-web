import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PRODUCT_CARD_VIDEO_ANALYTICS_DELAY_MS,
  PRODUCT_CARD_VIDEO_HOVER_DELAY_MS,
  canAutoplayProductCardVideo,
  isPointerInsideProductCardVideo,
} from "../src/modules/marketplace/product-card-video-preview.ts";

test("product-card video hover waits for deliberate intent", () => {
  assert.equal(PRODUCT_CARD_VIDEO_HOVER_DELAY_MS, 200);
});

test("preview analytics require sustained playback", () => {
  assert.equal(PRODUCT_CARD_VIDEO_ANALYTICS_DELAY_MS, 1_000);
});

test("hover autoplay requires a suitable pointer, motion setting and connection", () => {
  const eligibleConditions = {
    effectiveConnectionType: "4g",
    prefersReducedMotion: false,
    saveData: false,
    supportsFineHover: true,
  };

  assert.equal(canAutoplayProductCardVideo(eligibleConditions), true);
  assert.equal(
    canAutoplayProductCardVideo({
      ...eligibleConditions,
      supportsFineHover: false,
    }),
    false,
  );
  assert.equal(
    canAutoplayProductCardVideo({
      ...eligibleConditions,
      prefersReducedMotion: true,
    }),
    false,
  );
  assert.equal(
    canAutoplayProductCardVideo({
      ...eligibleConditions,
      saveData: true,
    }),
    false,
  );
  assert.equal(
    canAutoplayProductCardVideo({
      ...eligibleConditions,
      effectiveConnectionType: "2g",
    }),
    false,
  );
  assert.equal(
    canAutoplayProductCardVideo({
      ...eligibleConditions,
      effectiveConnectionType: "slow-2g",
    }),
    false,
  );
  assert.equal(
    canAutoplayProductCardVideo({
      ...eligibleConditions,
      effectiveConnectionType: "3g",
    }),
    true,
  );
});

test("only hovering the square media region starts a card preview", () => {
  const bounds = {
    bottom: 300,
    left: 100,
    right: 300,
    top: 100,
  };

  assert.equal(
    isPointerInsideProductCardVideo({ clientX: 200, clientY: 200 }, bounds),
    true,
  );
  assert.equal(
    isPointerInsideProductCardVideo({ clientX: 200, clientY: 340 }, bounds),
    false,
  );
});

test("the client island preserves full-length native looping and lazy loading", async () => {
  const source = await readFile(
    new URL(
      "../components/marketplace/product-card-video-preview.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /preload="none"/);
  assert.match(source, /\n\s+loop\n/);
  assert.match(source, /\n\s+muted\n/);
  assert.match(source, /\n\s+playsInline\n/);
  assert.match(source, /video\.src = preview\.url/);
  assert.match(source, /video\.removeAttribute\("src"\)/);
  assert.match(source, /new IntersectionObserver/);
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
