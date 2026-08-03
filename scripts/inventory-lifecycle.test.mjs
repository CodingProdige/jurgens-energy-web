import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createPendingCheckoutExpiry,
  getStockReservationDecision,
  isPendingCheckoutOpen,
  PENDING_CHECKOUT_TTL_MS,
} from "../src/modules/inventory/lifecycle.ts";

const checkoutOrderSource = readFileSync(
  new URL("../src/modules/checkout/orders.ts", import.meta.url),
  "utf8",
);
const payFastItnSource = readFileSync(
  new URL("../src/modules/checkout/payfast-itn.ts", import.meta.url),
  "utf8",
);
const reservationSource = readFileSync(
  new URL("../src/modules/inventory/reservations.ts", import.meta.url),
  "utf8",
);
const reconciliationSource = readFileSync(
  new URL(
    "../src/modules/payments/reconciliation-exceptions.ts",
    import.meta.url,
  ),
  "utf8",
);
const refundSource = readFileSync(
  new URL("../src/modules/payments/refunds.ts", import.meta.url),
  "utf8",
);
const refundCancellationReviewSource = readFileSync(
  new URL(
    "../src/modules/payments/refund-shipment-cancellation-review.ts",
    import.meta.url,
  ),
  "utf8",
);
const workerSource = readFileSync(
  new URL("../src/modules/invoices/worker.ts", import.meta.url),
  "utf8",
);
const instrumentationSource = readFileSync(
  new URL("../instrumentation.ts", import.meta.url),
  "utf8",
);
const migrationSource = readFileSync(
  new URL(
    "../src/db/migrations/0080_inventory_reservations_and_refund_fulfillment.sql",
    import.meta.url,
  ),
  "utf8",
);
const cancellationIdempotencyMigrationSource = readFileSync(
  new URL(
    "../src/db/migrations/0082_refund_shipment_cancellation_idempotency.sql",
    import.meta.url,
  ),
  "utf8",
);
const reconciliationMigrationSource = readFileSync(
  new URL(
    "../src/db/migrations/0084_payment_reconciliation_exceptions.sql",
    import.meta.url,
  ),
  "utf8",
);

test("reserves limited inventory without allowing a concurrent oversell", () => {
  assert.deepEqual(
    getStockReservationDecision({
      continueSellingOutOfStock: false,
      quantity: 3,
      stockOnHand: 5,
    }),
    {
      nextStockOnHand: 2,
      stockQuantity: 3,
    },
  );
  assert.equal(
    getStockReservationDecision({
      continueSellingOutOfStock: false,
      quantity: 3,
      stockOnHand: 2,
    }),
    null,
  );
});

test("records only real stock deducted for continue-selling variants", () => {
  assert.deepEqual(
    getStockReservationDecision({
      continueSellingOutOfStock: true,
      quantity: 4,
      stockOnHand: 1,
    }),
    {
      nextStockOnHand: 0,
      stockQuantity: 1,
    },
  );
  assert.deepEqual(
    getStockReservationDecision({
      continueSellingOutOfStock: true,
      quantity: 4,
      stockOnHand: 0,
    }),
    {
      nextStockOnHand: 0,
      stockQuantity: 0,
    },
  );
});

test("uses a fixed checkout payment window with an exclusive expiry boundary", () => {
  const now = new Date("2026-07-30T10:00:00.000Z");
  const expiry = createPendingCheckoutExpiry(now);

  assert.equal(expiry.getTime() - now.getTime(), PENDING_CHECKOUT_TTL_MS);
  assert.equal(
    isPendingCheckoutOpen(expiry, new Date(expiry.getTime() - 1)),
    true,
  );
  assert.equal(isPendingCheckoutOpen(expiry, expiry), false);
});

test("reserves stock in the order transaction before creating PayFast payment", () => {
  const reservePosition = checkoutOrderSource.indexOf(
    "await reserveOrderInventory({",
  );
  const paymentPosition = checkoutOrderSource.indexOf(
    ".insert(payments)",
    reservePosition,
  );

  assert.ok(reservePosition > 0);
  assert.ok(paymentPosition > reservePosition);
  assert.match(checkoutOrderSource, /paymentExpiresAt/);
});

test("consumes or releases reservations instead of decrementing stock on ITN", () => {
  assert.match(payFastItnSource, /consumeOrderInventory\(\{/);
  assert.match(payFastItnSource, /releaseOrderInventory\(\{/);
  assert.doesNotMatch(
    payFastItnSource,
    /greatest\(0,\s*\$\{productVariants\.stockOnHand\}/,
  );
  assert.match(
    payFastItnSource,
    /inventory_unavailable_after_expiry/,
  );
});

test("safely acquires current stock for pre-reservation payment attempts", () => {
  assert.match(
    reservationSource,
    /if \(reservations\.length === 0\) \{\s*return consumeLegacyOrderInventory\(/s,
  );
  assert.match(
    reservationSource,
    /const plan = createReservationPlan\(\{\s*lines: legacyOrderLines,\s*variants,/s,
  );
  assert.match(
    reservationSource,
    /status: "consumed" as const/,
  );
});

test("persists and alerts on a valid COMPLETE payment that cannot acquire stock", () => {
  assert.match(
    payFastItnSource,
    /recordPaymentReconciliationException\(\{/,
  );
  assert.match(
    payFastItnSource,
    /reconciliationRequired: true/,
  );
  assert.match(
    reconciliationSource,
    /notifyAdminsOfOpenPaymentReconciliationExceptions/,
  );
  assert.match(
    reconciliationMigrationSource,
    /payment_reconciliation_exceptions_payment_id_unique/,
  );
  assert.match(
    reconciliationMigrationSource,
    /admin\.payment\.reconciliation_required/,
  );
});

test("runs durable expiry and refund cancellation passes in the existing worker", () => {
  assert.match(workerSource, /expirePendingCheckoutOrders\(\)/);
  assert.match(workerSource, /processRefundShipmentCancellationJobs\(\)/);
  assert.match(workerSource, /processNotificationDispatchRetries\(\)/);
  assert.match(instrumentationSource, /startInvoiceWorker/);
  assert.match(instrumentationSource, /process\.env\.NEXT_RUNTIME === "nodejs"/);
});

test("requires explicit refund fulfilment intent and idempotent adjustment records", () => {
  assert.match(
    refundSource,
    /cancelOpenShipments:\s*z\.boolean\(\)\.default\(false\)/,
  );
  assert.match(
    refundSource,
    /restockItems:\s*z\.array\(restockItemInputSchema\).*\.default\(\[\]\)/s,
  );
  assert.match(refundSource, /refundInventoryAdjustments/);
  assert.match(refundSource, /refundShipmentCancellationJobs/);
});

test("requires a verified admin decision before resolving or retrying ambiguous cancellations", () => {
  assert.match(
    refundCancellationReviewSource,
    /record\.jobStatus !== "manual_review"/,
  );
  assert.match(
    refundCancellationReviewSource,
    /resolution === "confirmed_cancelled"/,
  );
  assert.match(
    refundCancellationReviewSource,
    /record\.provider !== "courier_guy"/,
  );
  assert.match(
    refundCancellationReviewSource,
    /attempts: Math\.max\(record\.attempts, 4\)/,
  );
  assert.match(
    refundCancellationReviewSource,
    /refund\.shipment_cancellation_review_resolved/,
  );
  assert.match(
    refundCancellationReviewSource,
    /refund\.shipment_cancellation_retry_queued/,
  );
});

test("migration enforces reservation and refund fulfilment idempotency", () => {
  assert.match(
    migrationSource,
    /inventory_reservations_order_variant_unique/,
  );
  assert.match(
    migrationSource,
    /refund_inventory_adjustments_refund_order_item_unique/,
  );
  assert.match(
    cancellationIdempotencyMigrationSource,
    /refund_shipment_cancellation_jobs_shipment_unique/,
  );
  assert.match(migrationSource, /requested_restock_items/);
  assert.match(migrationSource, /cancel_open_shipments/);
});
