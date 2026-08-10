import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatJohannesburgLocalDateTime,
  getScheduledSalePreviewBase,
  parseJohannesburgLocalDateTime,
  resolveSaleSchedule,
  saleScheduleWindowsOverlap,
  validateSaleScheduleWindow,
} from "../src/modules/sales/scheduling.ts";

test("Johannesburg local values parse to the correct UTC instant and round-trip", () => {
  const instant = parseJohannesburgLocalDateTime("2026-08-11T10:30");

  assert.equal(instant.toISOString(), "2026-08-11T08:30:00.000Z");
  assert.equal(formatJohannesburgLocalDateTime(instant), "2026-08-11T10:30");
});

test("Johannesburg parser rejects malformed and impossible calendar values", () => {
  assert.throws(
    () => parseJohannesburgLocalDateTime("2026-02-30T10:00"),
    /not a valid date/,
  );
  assert.throws(
    () => parseJohannesburgLocalDateTime("2026-08-11 10:00"),
    /Johannesburg date and time format/,
  );
  assert.throws(
    () => formatJohannesburgLocalDateTime(new Date(Number.NaN)),
    /invalid/,
  );
});

test("scheduled windows require a future start and an end after start", () => {
  const now = new Date("2026-08-11T08:00:00.000Z");

  assert.deepEqual(resolveSaleSchedule({
    endsAtLocal: "2026-08-11T13:00",
    scheduleMode: "scheduled",
    startsAtLocal: "2026-08-11T12:00",
  }, now), {
    endsAt: new Date("2026-08-11T11:00:00.000Z"),
    startsAt: new Date("2026-08-11T10:00:00.000Z"),
    status: "scheduled",
  });

  assert.throws(
    () => resolveSaleSchedule({
      endsAtLocal: "2026-08-11T13:00",
      scheduleMode: "scheduled",
      startsAtLocal: "2026-08-11T10:00",
    }, now),
    /must start in the future/,
  );
  assert.throws(
    () => validateSaleScheduleWindow({
      endsAt: new Date("2026-08-11T09:00:00.000Z"),
      now,
      requireFutureStart: false,
      startsAt: new Date("2026-08-11T09:00:00.000Z"),
    }),
    /end must be after/,
  );
});

test("start-now uses the authoritative server time", () => {
  const now = new Date("2026-08-11T08:00:00.123Z");
  const result = resolveSaleSchedule({
    endsAtLocal: "2026-08-11T13:00",
    scheduleMode: "now",
    startsAtLocal: "2026-08-11T01:00",
  }, now);

  assert.equal(result.status, "active");
  assert.equal(result.startsAt.toISOString(), now.toISOString());
});

test("sale overlap uses half-open windows and allows exact-boundary succession", () => {
  const morning = {
    endsAt: new Date("2026-08-11T10:00:00.000Z"),
    startsAt: new Date("2026-08-11T08:00:00.000Z"),
  };

  assert.equal(saleScheduleWindowsOverlap(morning, {
    endsAt: new Date("2026-08-11T12:00:00.000Z"),
    startsAt: morning.endsAt,
  }), false);
  assert.equal(saleScheduleWindowsOverlap(morning, {
    endsAt: new Date("2026-08-11T12:00:00.000Z"),
    startsAt: new Date("2026-08-11T09:59:59.999Z"),
  }), true);
  assert.equal(saleScheduleWindowsOverlap(morning, {
    endsAt: null,
    startsAt: new Date("2026-08-11T10:00:00.000Z"),
  }), false);
  assert.equal(saleScheduleWindowsOverlap({
    endsAt: null,
    startsAt: new Date("2026-08-01T08:00:00.000Z"),
  }, morning), true);
});

test("sequential scheduled previews use the active campaign original price", () => {
  assert.deepEqual(getScheduledSalePreviewBase({
    currentCompareAtPrice: "100.00",
    currentPrice: "90.00",
    managedActiveOriginalCompareAtPrice: null,
    managedActiveOriginalPrice: "100.00",
  }), {
    compareAtPrice: null,
    price: "100.00",
  });
});

test("lifecycle contract expires before starts and uses a dedicated fast worker", async () => {
  const [lifecycle, worker, adminSales, migration] = await Promise.all([
    readFile(new URL("../src/modules/sales/lifecycle.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/invoices/worker.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/admin/sales.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/db/migrations/0107_sale_campaign_scheduling.sql", import.meta.url), "utf8"),
  ]);

  assert.ok(lifecycle.indexOf("const expiringCampaigns") < lifecycle.indexOf("const startingCampaigns"));
  assert.match(lifecycle, /remainingDueExpirations/);
  assert.doesNotMatch(lifecycle, /revalidatePath/);
  assert.match(worker, /__jurgensSaleLifecycleWorker/);
  assert.match(worker, /7_500/);
  assert.match(adminSales, /export async function startSaleCampaignNow/);
  assert.match(adminSales, /export async function updateSaleCampaignSchedule/);
  assert.match(adminSales, /export async function cancelScheduledSaleCampaign/);
  assert.match(migration, /created_at" AT TIME ZONE 'UTC'/);
});
