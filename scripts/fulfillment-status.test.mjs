import assert from "node:assert/strict";
import test from "node:test";

import { resolveAggregatedOrderStatus } from "../src/modules/orders/fulfillment-status.ts";
import {
  getCourierGuyCustomerMilestoneLabel,
  resolveCourierGuyCustomerMilestone,
} from "../src/modules/shipping/courier-guy-customer-status.ts";

test("fulfils an order only when every shipment is delivered", () => {
  assert.equal(
    resolveAggregatedOrderStatus({
      orderStatus: "paid",
      shipmentStatuses: ["delivered"],
    }),
    "fulfilled",
  );
  assert.equal(
    resolveAggregatedOrderStatus({
      orderStatus: "paid",
      shipmentStatuses: ["delivered", "delivered"],
    }),
    "fulfilled",
  );
  assert.equal(
    resolveAggregatedOrderStatus({
      orderStatus: "paid",
      shipmentStatuses: ["delivered", "in_transit"],
    }),
    "paid",
  );
});

test("does not fulfil a paid order without shipment records", () => {
  assert.equal(
    resolveAggregatedOrderStatus({
      orderStatus: "paid",
      shipmentStatuses: [],
    }),
    "paid",
  );
});

test("corrects a prematurely fulfilled mixed order back to paid", () => {
  assert.equal(
    resolveAggregatedOrderStatus({
      orderStatus: "fulfilled",
      shipmentStatuses: ["delivered", "out_for_delivery"],
    }),
    "paid",
  );
});

test("does not rewrite payment lifecycle statuses", () => {
  for (const orderStatus of ["pending", "cancelled", "refunded"]) {
    assert.equal(
      resolveAggregatedOrderStatus({
        orderStatus,
        shipmentStatuses: ["delivered"],
      }),
      orderStatus,
    );
  }
});

test("maps Courier Guy states to customer milestones without noisy duplicates", () => {
  assert.equal(resolveCourierGuyCustomerMilestone("booking"), null);
  assert.equal(resolveCourierGuyCustomerMilestone("booked"), "booked");
  assert.equal(resolveCourierGuyCustomerMilestone("waybill_ready"), "booked");
  assert.equal(
    resolveCourierGuyCustomerMilestone("out_for_delivery"),
    "out_for_delivery",
  );
  assert.equal(
    resolveCourierGuyCustomerMilestone("failed_delivery"),
    "delivery_exception",
  );
  assert.equal(resolveCourierGuyCustomerMilestone("delivered"), "delivered");
  assert.equal(
    getCourierGuyCustomerMilestoneLabel("out_for_delivery"),
    "Out for delivery",
  );
});
