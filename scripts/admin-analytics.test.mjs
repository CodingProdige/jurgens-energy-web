import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECKOUT_ABANDONMENT_WINDOW_MS,
  classifyCheckoutAnalyticsOutcome,
  createAdminAnalyticsMetricComparison,
  getAdminAnalyticsTelemetryCoverage,
  getAdminAnalyticsBucketIndex,
  isProviderConfirmedCapturedPayment,
  resolveAdminAnalyticsRange,
} from "../src/modules/admin/analytics-core.ts";

test("rolling analytics ranges use exact equal comparison periods", () => {
  const now = new Date("2026-08-09T10:15:30.000Z");
  const range = resolveAdminAnalyticsRange("24h", now);

  assert.equal(range.start.toISOString(), "2026-08-08T10:15:30.000Z");
  assert.equal(range.end.toISOString(), now.toISOString());
  assert.equal(
    range.comparisonStart.toISOString(),
    "2026-08-07T10:15:30.000Z",
  );
  assert.equal(
    range.comparisonEnd.toISOString(),
    "2026-08-08T10:15:30.000Z",
  );
  assert.equal(range.bucketCount, 24);
  assert.equal(range.granularity, "hour");
});

test("rolling day and week presets select practical chart granularities", () => {
  const now = new Date("2026-08-09T10:15:30.000Z");

  assert.deepEqual(
    ["7d", "30d", "90d"].map((key) => {
      const range = resolveAdminAnalyticsRange(key, now);

      return [range.bucketCount, range.granularity];
    }),
    [
      [7, "day"],
      [30, "day"],
      [13, "week"],
    ],
  );
});

test("this month begins at midnight in Africa/Johannesburg", () => {
  const now = new Date("2026-08-09T10:15:30.000Z");
  const range = resolveAdminAnalyticsRange("this_month", now);

  assert.equal(range.start.toISOString(), "2026-07-31T22:00:00.000Z");
  assert.equal(
    range.comparisonStart.toISOString(),
    "2026-06-30T22:00:00.000Z",
  );
  assert.equal(
    range.comparisonEnd.toISOString(),
    "2026-07-09T10:15:30.000Z",
  );
  assert.equal(range.bucketCount, 9);
});

test("this month caps its comparable period at the end of a shorter prior month", () => {
  const now = new Date("2026-03-31T20:00:00.000Z");
  const range = resolveAdminAnalyticsRange("this_month", now);

  assert.equal(range.start.toISOString(), "2026-02-28T22:00:00.000Z");
  assert.equal(
    range.comparisonStart.toISOString(),
    "2026-01-31T22:00:00.000Z",
  );
  assert.equal(
    range.comparisonEnd.toISOString(),
    "2026-02-28T22:00:00.000Z",
  );
});

test("last month compares complete Johannesburg calendar months", () => {
  const range = resolveAdminAnalyticsRange(
    "last_month",
    new Date("2026-01-20T12:00:00.000Z"),
  );

  assert.equal(range.start.toISOString(), "2025-11-30T22:00:00.000Z");
  assert.equal(range.end.toISOString(), "2025-12-31T22:00:00.000Z");
  assert.equal(
    range.comparisonStart.toISOString(),
    "2025-10-31T22:00:00.000Z",
  );
  assert.equal(
    range.comparisonEnd.toISOString(),
    "2025-11-30T22:00:00.000Z",
  );
});

test("captured payment is the only successful checkout outcome", () => {
  const now = new Date("2026-08-09T12:00:00.000Z");

  assert.equal(
    classifyCheckoutAnalyticsOutcome(
      {
        hasCapturedPayment: true,
        lastSeenAt: new Date("2026-08-09T10:00:00.000Z"),
        status: "failed",
      },
      now,
    ),
    "successful",
  );
  assert.equal(
    classifyCheckoutAnalyticsOutcome(
      {
        hasCapturedPayment: false,
        lastSeenAt: new Date("2026-08-09T11:50:00.000Z"),
        status: "completed",
      },
      now,
    ),
    "pending",
  );
});

test("provider-confirmed captures remain successful after a later refund", () => {
  assert.equal(
    isProviderConfirmedCapturedPayment({
      providerStatus: "COMPLETE",
      status: "captured",
    }),
    true,
  );
  assert.equal(
    isProviderConfirmedCapturedPayment({
      providerStatus: "complete",
      status: "refunded",
    }),
    true,
  );
  assert.equal(
    isProviderConfirmedCapturedPayment({
      providerStatus: "PENDING",
      status: "captured",
    }),
    false,
  );
  assert.equal(
    isProviderConfirmedCapturedPayment({
      providerStatus: "COMPLETE",
      status: "authorized",
    }),
    false,
  );
});

test("telemetry coverage distinguishes current and pre-instrumentation history", () => {
  const start = new Date("2026-08-01T00:00:00.000Z");
  const end = new Date("2026-08-08T00:00:00.000Z");

  assert.equal(getAdminAnalyticsTelemetryCoverage(start, end, null), "none");
  assert.equal(
    getAdminAnalyticsTelemetryCoverage(
      start,
      end,
      new Date("2026-08-09T00:00:00.000Z"),
    ),
    "none",
  );
  assert.equal(
    getAdminAnalyticsTelemetryCoverage(
      start,
      end,
      new Date("2026-08-04T00:00:00.000Z"),
    ),
    "partial",
  );
  assert.equal(
    getAdminAnalyticsTelemetryCoverage(
      start,
      end,
      new Date("2026-07-31T23:59:59.000Z"),
    ),
    "full",
  );
});

test("failed checkout wins over inactivity and abandonment starts at 30 minutes", () => {
  const now = new Date("2026-08-09T12:00:00.000Z");
  const boundary = new Date(
    now.getTime() - CHECKOUT_ABANDONMENT_WINDOW_MS,
  );

  assert.equal(
    classifyCheckoutAnalyticsOutcome(
      { hasCapturedPayment: false, lastSeenAt: boundary, status: "active" },
      now,
    ),
    "abandoned",
  );
  assert.equal(
    classifyCheckoutAnalyticsOutcome(
      {
        hasCapturedPayment: false,
        lastSeenAt: new Date(boundary.getTime() + 1),
        status: "active",
      },
      now,
    ),
    "pending",
  );
  assert.equal(
    classifyCheckoutAnalyticsOutcome(
      {
        hasCapturedPayment: false,
        lastSeenAt: new Date("2026-08-09T10:00:00.000Z"),
        status: "failed",
      },
      now,
    ),
    "failed",
  );
});

test("metric deltas do not invent a percentage from a zero baseline", () => {
  assert.deepEqual(createAdminAnalyticsMetricComparison(120, 100), {
    change: 20,
    changePercent: 20,
    previousValue: 100,
    trend: "up",
    value: 120,
  });
  assert.equal(
    createAdminAnalyticsMetricComparison(10, 0).changePercent,
    null,
  );
  assert.equal(createAdminAnalyticsMetricComparison(0, 0).changePercent, 0);
});

test("analytics buckets are start-inclusive and end-exclusive", () => {
  const start = new Date("2026-08-01T00:00:00.000Z");
  const hour = 60 * 60 * 1_000;

  assert.equal(getAdminAnalyticsBucketIndex(start, start, hour, 2), 0);
  assert.equal(
    getAdminAnalyticsBucketIndex(
      new Date(start.getTime() + 2 * hour - 1),
      start,
      hour,
      2,
    ),
    1,
  );
  assert.equal(
    getAdminAnalyticsBucketIndex(
      new Date(start.getTime() + 2 * hour),
      start,
      hour,
      2,
    ),
    -1,
  );
});
