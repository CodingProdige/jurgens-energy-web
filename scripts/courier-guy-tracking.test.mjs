import assert from "node:assert/strict";
import test from "node:test";

import {
  createCourierGuyTrackingEventId,
  mapCourierGuyStatus,
  normalizeCourierGuyTrackingStatus,
  resolveCourierGuyMilestones,
  resolveCourierGuyShipmentStatus,
} from "../src/modules/shipping/courier-guy-tracking.ts";
import {
  getCourierGuyWebhookDetails,
  parseCourierGuyWebhookPayloads,
} from "../src/modules/shipping/courier-guy-webhook-payload.ts";

test("normalizes only documented Courier Guy tracking statuses", () => {
  assert.equal(
    normalizeCourierGuyTrackingStatus(" OUT_FOR_DELIVERY "),
    "out-for-delivery",
  );
  assert.equal(mapCourierGuyStatus("collection-exception"), null);
  assert.equal(mapCourierGuyStatus("returned-to-hub"), "in_transit");
  assert.equal(
    mapCourierGuyStatus("delivery-failed-attempt"),
    "failed_delivery",
  );
  assert.equal(mapCourierGuyStatus("in-locker"), "waybill_ready");
  assert.equal(mapCourierGuyStatus("ready-for-pickup"), "ready_for_collection");
  assert.equal(mapCourierGuyStatus("collection-assigned"), "booked");
  assert.equal(mapCourierGuyStatus("manifested"), "in_transit");
  assert.equal(mapCourierGuyStatus("delivery-assigned"), "in_transit");
  assert.equal(mapCourierGuyStatus("returned-to-sender"), "returned");
  assert.equal(mapCourierGuyStatus("undeliverable"), "undeliverable");
  assert.equal(mapCourierGuyStatus("something-new"), null);
});

test("preserves current state for unknown, stale, and terminal updates", () => {
  assert.equal(
    resolveCourierGuyShipmentStatus("in_transit", "future-provider-status"),
    "in_transit",
  );
  assert.equal(
    resolveCourierGuyShipmentStatus("out_for_delivery", "at-hub"),
    "out_for_delivery",
  );
  assert.equal(
    resolveCourierGuyShipmentStatus("delivered", "in-transit"),
    "delivered",
  );
  assert.equal(
    resolveCourierGuyShipmentStatus("cancelled", "delivered"),
    "cancelled",
  );
  assert.equal(
    resolveCourierGuyShipmentStatus("undeliverable", "delivered"),
    "undeliverable",
  );
});

test("advances documented statuses without accepting lower-progress events", () => {
  assert.equal(
    resolveCourierGuyShipmentStatus("waybill_ready", "collected"),
    "collected",
  );
  assert.equal(
    resolveCourierGuyShipmentStatus("in_transit", "out-for-delivery"),
    "out_for_delivery",
  );
  assert.equal(
    resolveCourierGuyShipmentStatus(
      "out_for_delivery",
      "delivery-failed-attempt",
    ),
    "failed_delivery",
  );
  assert.equal(
    resolveCourierGuyShipmentStatus(
      "failed_delivery",
      "out-for-delivery",
    ),
    "out_for_delivery",
  );
  assert.equal(
    resolveCourierGuyShipmentStatus("failed_delivery", "delivered"),
    "delivered",
  );
  assert.equal(
    resolveCourierGuyShipmentStatus("cancelling", "submitted"),
    "cancelling",
  );
  assert.equal(
    resolveCourierGuyShipmentStatus("cancelling", "collected"),
    "collected",
  );
  assert.equal(
    resolveCourierGuyShipmentStatus("cancelling", "cancelled"),
    "cancelled",
  );
});

test("preserves the first delivered timestamp", () => {
  const firstDeliveredAt = new Date("2026-07-29T10:00:00Z");
  const result = resolveCourierGuyMilestones({
    currentCollectedAt: new Date("2026-07-28T08:00:00Z"),
    currentDeliveredAt: firstDeliveredAt,
    nextStatus: "delivered",
    occurredAt: new Date("2026-07-29T12:00:00Z"),
    providerDeliveredAt: new Date("2026-07-29T11:00:00Z"),
  });

  assert.equal(result.deliveredAt, firstDeliveredAt);
});

test("generates a stable hash for tracking events without usable IDs", () => {
  const common = {
    location: " CPT ",
    message: "",
    occurredAt: "2026-07-29 10:00:00+00:00",
    parcelId: "42",
    providerEventId: "0",
    shipmentIdentity: "ABC123",
    source: "scanner",
    status: "at_hub",
  };
  const first = createCourierGuyTrackingEventId({
    ...common,
    data: { beta: 2, alpha: 1 },
  });
  const second = createCourierGuyTrackingEventId({
    ...common,
    data: { alpha: 1, beta: 2 },
    occurredAt: "2026-07-29T10:00:00.000Z",
  });

  assert.match(first, /^tracking:sha256:[a-f0-9]{64}$/);
  assert.equal(first, second);
  assert.notEqual(
    first,
    createCourierGuyTrackingEventId({
      ...common,
      shipmentIdentity: "OTHER123",
    }),
  );
  assert.equal(
    createCourierGuyTrackingEventId({
      ...common,
      providerEventId: "321",
    }),
    "321",
  );
});

test("accepts single and batched Courier Guy webhook payloads", () => {
  const payload = {
    event_time: "2026-07-29T10:00:00Z",
    shipment_collected_date: "2026-07-28T08:00:00Z",
    shipment_delivered_date: "2026-07-29T09:55:00Z",
    shipment_id: 123,
    short_tracking_reference: "ABC123",
    status: "delivered",
    tracking_events: [
      {
        date: "2026-07-29T09:55:00Z",
        id: 0,
        parcel_id: 42,
        status: "delivered",
      },
    ],
  };

  assert.deepEqual(parseCourierGuyWebhookPayloads(payload), [payload]);
  assert.deepEqual(parseCourierGuyWebhookPayloads([payload, payload]), [
    payload,
    payload,
  ]);
  assert.deepEqual(
    parseCourierGuyWebhookPayloads({ updates: [payload] }),
    [payload],
  );

  const details = getCourierGuyWebhookDetails(payload);

  assert.equal(details.eventTime, "2026-07-29T10:00:00Z");
  assert.equal(details.collectedAt, "2026-07-28T08:00:00Z");
  assert.equal(details.deliveredAt, "2026-07-29T09:55:00Z");
  assert.equal(details.providerShipmentId, "123");
  assert.equal(details.trackingReference, "ABC123");
  assert.equal(details.trackingEvents[0].providerEventId, null);
  assert.equal(details.trackingEvents[0].parcelId, "42");
});
