import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canEditJurgensDeliveryPlan,
  canTransitionJurgensDeliveryStatus,
  getAllowedJurgensDeliveryStatusTransitions,
  getJurgensLocalShipmentUpdate,
} from "../src/modules/orders/jurgens-delivery-workflow.ts";

const adminWorkflowSource = readFileSync(
  new URL(
    "../src/modules/admin/jurgens-local-delivery-service.ts",
    import.meta.url,
  ),
  "utf8",
);
const uniquenessMigrationSource = readFileSync(
  new URL(
    "../src/db/migrations/0085_jurgens_delivery_schedule_uniqueness.sql",
    import.meta.url,
  ),
  "utf8",
);
const notificationSource = readFileSync(
  new URL(
    "../src/modules/orders/jurgens-delivery-notifications.ts",
    import.meta.url,
  ),
  "utf8",
);
const notificationClaimsSource = readFileSync(
  new URL(
    "../src/modules/notifications/dispatch-claims.ts",
    import.meta.url,
  ),
  "utf8",
);
const notificationWorkerSource = readFileSync(
  new URL("../src/modules/notifications/worker.ts", import.meta.url),
  "utf8",
);
const payFastItnSource = readFileSync(
  new URL("../src/modules/checkout/payfast-itn.ts", import.meta.url),
  "utf8",
);
const refundWorkerSource = readFileSync(
  new URL(
    "../src/modules/payments/refund-fulfillment-worker.ts",
    import.meta.url,
  ),
  "utf8",
);
const pendingNotificationMigrationSource = readFileSync(
  new URL(
    "../src/db/migrations/0087_notification_dispatch_pending_status.sql",
    import.meta.url,
  ),
  "utf8",
);

test("allows only sensible local-delivery status transitions", () => {
  assert.equal(
    canTransitionJurgensDeliveryStatus({
      from: "scheduled",
      to: "preparing",
    }),
    true,
  );
  assert.equal(
    canTransitionJurgensDeliveryStatus({
      from: "scheduled",
      to: "completed",
    }),
    false,
  );
  assert.deepEqual(getAllowedJurgensDeliveryStatusTransitions("completed"), []);
  assert.deepEqual(getAllowedJurgensDeliveryStatusTransitions("missed"), [
    "rescheduled",
    "cancelled",
  ]);
});

test("requires rescheduling through an editable delivery plan", () => {
  assert.equal(canEditJurgensDeliveryPlan("missed"), true);
  assert.equal(canEditJurgensDeliveryPlan("preparing"), true);
  assert.equal(canEditJurgensDeliveryPlan("out_for_delivery"), false);
  assert.equal(canEditJurgensDeliveryPlan("completed"), false);
});

test("sets and preserves shipment milestone timestamps while progressing", () => {
  const now = new Date("2026-07-30T08:00:00.000Z");
  const preparing = getJurgensLocalShipmentUpdate({
    current: {
      bookedAt: null,
      collectedAt: null,
      deliveredAt: null,
    },
    now,
    status: "preparing",
  });

  assert.equal(preparing.status, "booked");
  assert.equal(preparing.bookedAt, now);
  assert.equal(preparing.collectedAt, null);

  const later = new Date("2026-07-30T10:00:00.000Z");
  const outForDelivery = getJurgensLocalShipmentUpdate({
    current: preparing,
    now: later,
    status: "out_for_delivery",
  });

  assert.equal(outForDelivery.status, "out_for_delivery");
  assert.equal(outForDelivery.bookedAt, now);
  assert.equal(outForDelivery.collectedAt, later);
  assert.equal(outForDelivery.deliveredAt, null);

  const deliveredAt = new Date("2026-07-30T13:00:00.000Z");
  const delivered = getJurgensLocalShipmentUpdate({
    current: outForDelivery,
    now: deliveredAt,
    status: "completed",
  });

  assert.equal(delivered.status, "delivered");
  assert.equal(delivered.bookedAt, now);
  assert.equal(delivered.collectedAt, later);
  assert.equal(delivered.deliveredAt, deliveredAt);
});

test("clears stale attempt milestones when a delivery is rescheduled", () => {
  const rescheduled = getJurgensLocalShipmentUpdate({
    current: {
      bookedAt: new Date("2026-07-30T08:00:00.000Z"),
      collectedAt: new Date("2026-07-30T10:00:00.000Z"),
      deliveredAt: new Date("2026-07-30T12:00:00.000Z"),
    },
    now: new Date("2026-07-31T08:00:00.000Z"),
    status: "rescheduled",
  });

  assert.deepEqual(rescheduled, {
    bookedAt: null,
    collectedAt: null,
    deliveredAt: null,
    status: "pending_booking",
  });
});

test("a missed attempt never retains a delivered timestamp", () => {
  const bookedAt = new Date("2026-07-30T08:00:00.000Z");
  const collectedAt = new Date("2026-07-30T10:00:00.000Z");
  const missed = getJurgensLocalShipmentUpdate({
    current: {
      bookedAt,
      collectedAt,
      deliveredAt: new Date("2026-07-30T12:00:00.000Z"),
    },
    now: new Date("2026-07-30T13:00:00.000Z"),
    status: "missed",
  });

  assert.equal(missed.status, "failed_delivery");
  assert.equal(missed.bookedAt, bookedAt);
  assert.equal(missed.collectedAt, collectedAt);
  assert.equal(missed.deliveredAt, null);
});

test("serializes admin changes and enforces one schedule per order and shipment", () => {
  assert.match(adminWorkflowSource, /pg_advisory_xact_lock/);
  assert.match(adminWorkflowSource, /\.for\("update"\)/);
  assert.match(
    uniquenessMigrationSource,
    /jurgens_delivery_schedules_order_id_unique/,
  );
  assert.match(
    uniquenessMigrationSource,
    /jurgens_delivery_schedules_shipment_id_unique/,
  );
  assert.match(uniquenessMigrationSource, /RAISE EXCEPTION/);
});

test("queues each local-delivery status revision and skips superseded customer updates", () => {
  assert.match(
    adminWorkflowSource,
    /enqueueJurgensDeliveryStatusNotification\(\{/,
  );
  assert.match(
    notificationSource,
    /jurgens-delivery:\$\{scheduleId\}:\$\{status\}:\$\{revision\}/,
  );
  assert.match(notificationSource, /pg_advisory_xact_lock/);
  assert.match(
    notificationSource,
    /row\.updatedAt\.toISOString\(\) !== expected\.revision/,
  );
  assert.match(
    notificationSource,
    /eq\(jurgensDeliverySchedules\.updatedAt, row\.updatedAt\)/,
  );
  assert.match(
    notificationWorkerSource,
    /customer\.jurgens_delivery\.updated/,
  );
});

test("persists local-delivery notifications before post-commit dispatch", () => {
  assert.match(
    notificationClaimsSource,
    /status: "pending"/,
  );
  assert.match(
    notificationClaimsSource,
    /eq\(notificationDispatchClaims\.status, "pending"\)/,
  );
  assert.match(
    pendingNotificationMigrationSource,
    /'pending', 'processing', 'sent', 'failed'/,
  );
  assert.match(
    payFastItnSource,
    /enqueueJurgensDeliveryStatusNotification\(\{/,
  );
  assert.match(
    refundWorkerSource,
    /enqueueJurgensDeliveryStatusNotification\(\{/,
  );
  assert.match(
    adminWorkflowSource,
    /Math\.max\(Date\.now\(\), schedule\.updatedAt\.getTime\(\) \+ 1\)/,
  );
  assert.match(
    adminWorkflowSource,
    /lastNotifiedStatus: null,\s*updatedAt: revisionDate,/s,
  );
});
