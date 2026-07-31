import assert from "node:assert/strict";
import test from "node:test";

import { resolveMediaByteRange } from "../src/modules/media/http-range.ts";

test("serves the complete file when no Range header is present", () => {
  assert.deepEqual(resolveMediaByteRange(null, 1_000), { kind: "full" });
});

test("resolves bounded, open-ended, and suffix byte ranges", () => {
  assert.deepEqual(resolveMediaByteRange("bytes=100-199", 1_000), {
    end: 199,
    kind: "partial",
    length: 100,
    start: 100,
  });
  assert.deepEqual(resolveMediaByteRange("bytes=900-", 1_000), {
    end: 999,
    kind: "partial",
    length: 100,
    start: 900,
  });
  assert.deepEqual(resolveMediaByteRange("bytes=-250", 1_000), {
    end: 999,
    kind: "partial",
    length: 250,
    start: 750,
  });
});

test("clamps byte ranges and suffixes to the available file", () => {
  assert.deepEqual(resolveMediaByteRange("bytes=950-1200", 1_000), {
    end: 999,
    kind: "partial",
    length: 50,
    start: 950,
  });
  assert.deepEqual(resolveMediaByteRange("bytes=-1200", 1_000), {
    end: 999,
    kind: "partial",
    length: 1_000,
    start: 0,
  });
});

test("rejects malformed, multiple, reversed, and out-of-bounds ranges", () => {
  for (const rangeHeader of [
    "items=0-10",
    "bytes=0-10,20-30",
    "bytes=10-9",
    "bytes=1000-",
    "bytes=-0",
    "bytes=-",
  ]) {
    assert.deepEqual(resolveMediaByteRange(rangeHeader, 1_000), {
      kind: "unsatisfiable",
    });
  }

  assert.deepEqual(resolveMediaByteRange("bytes=0-0", 0), {
    kind: "unsatisfiable",
  });
});
