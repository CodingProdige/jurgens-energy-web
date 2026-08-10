import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getPullGestureIntent,
  getResistedPullDistance,
  isPullToRefreshArmed,
  PULL_TO_REFRESH_MAX_VISUAL_PX,
  PULL_TO_REFRESH_TRIGGER_PX,
} from "../src/modules/navigation/pull-to-refresh.ts";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("locks only deliberate downward pull gestures", () => {
  assert.equal(getPullGestureIntent({ deltaX: 2, deltaY: 4 }), "pending");
  assert.equal(getPullGestureIntent({ deltaX: 4, deltaY: 24 }), "pull");
  assert.equal(getPullGestureIntent({ deltaX: 24, deltaY: 12 }), "cancel");
  assert.equal(getPullGestureIntent({ deltaX: 0, deltaY: -12 }), "cancel");
});

test("damps and caps visual pull distance", () => {
  assert.equal(getResistedPullDistance(-20), 0);
  assert.equal(getResistedPullDistance(40), 22);
  assert.equal(
    getResistedPullDistance(Number.POSITIVE_INFINITY),
    PULL_TO_REFRESH_MAX_VISUAL_PX,
  );
});

test("arms only at the canonical release threshold", () => {
  assert.equal(isPullToRefreshArmed(PULL_TO_REFRESH_TRIGGER_PX - 1), false);
  assert.equal(isPullToRefreshArmed(PULL_TO_REFRESH_TRIGGER_PX), true);
});

test("mounts one canonical pull-to-refresh control for the entire app", () => {
  const rootLayoutSource = read("app/layout.tsx");
  const componentSource = read("components/ui/pull-to-refresh.tsx");

  assert.equal(rootLayoutSource.match(/<PullToRefresh \/>/g)?.length, 1);
  assert.match(componentSource, /window\.location\.reload\(\)/);
  assert.match(componentSource, /data-pull-to-refresh=\"ignore\"/);
  assert.match(componentSource, /document\.scrollingElement/);
});
