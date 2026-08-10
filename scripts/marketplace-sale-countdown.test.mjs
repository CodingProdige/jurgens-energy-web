import assert from "node:assert/strict";
import test from "node:test";

import { getMarketplaceSaleCountdownDisplay } from "../components/marketplace/marketplace-sale-countdown-format.ts";

test("formats a multi-day sale countdown for compact and accessible output", () => {
  assert.deepEqual(
    getMarketplaceSaleCountdownDisplay(
      ((1 * 24 + 2) * 60 * 60 + 3 * 60 + 4) * 1_000,
    ),
    {
      accessible: "1 day, 2 hours, 3 minutes, 4 seconds",
      visual: "1d 02h 03m 04s",
    },
  );
});

test("omits empty leading units and rounds a partial second up", () => {
  assert.deepEqual(getMarketplaceSaleCountdownDisplay(9_001), {
    accessible: "10 seconds",
    visual: "10s",
  });
});

test("uses singular unit labels and clamps an elapsed countdown to zero", () => {
  assert.deepEqual(getMarketplaceSaleCountdownDisplay(3_661_000), {
    accessible: "1 hour, 1 minute, 1 second",
    visual: "01h 01m 01s",
  });
  assert.deepEqual(getMarketplaceSaleCountdownDisplay(-5_000), {
    accessible: "0 seconds",
    visual: "00s",
  });
});
