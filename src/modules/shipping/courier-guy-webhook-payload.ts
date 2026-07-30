import { z } from "zod";

const payloadSchema = z.record(z.string(), z.unknown());
const payloadBatchSchema = z
  .array(payloadSchema)
  .min(1)
  .max(100);
const webhookBodySchema = z.union([payloadSchema, payloadBatchSchema]);

const batchKeys = ["events", "shipments", "updates"] as const;

export type CourierGuyWebhookPayload = z.infer<typeof payloadSchema>;

export type CourierGuyWebhookTrackingEvent = {
  data: unknown;
  location: string | null;
  message: string | null;
  occurredAt: string | null;
  parcelId: string | null;
  payload: Record<string, unknown>;
  providerEventId: string | null;
  source: string | null;
  status: string;
};

export function parseCourierGuyWebhookPayloads(value: unknown) {
  const parsed = webhookBodySchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  if (Array.isArray(parsed.data)) {
    return parsed.data;
  }

  for (const key of batchKeys) {
    const nested = parsed.data[key];

    if (Array.isArray(nested)) {
      const batch = payloadBatchSchema.safeParse(nested);

      return batch.success ? batch.data : null;
    }
  }

  return [parsed.data];
}

export function getCourierGuyWebhookDetails(
  payload: CourierGuyWebhookPayload,
) {
  const topic =
    readString(payload, ["topic", "event", "event_type", "type"]) ??
    "tracking_event";
  const providerStatus = readString(payload, [
    "status",
    "shipment_status",
    "shipment.status",
    "data.status",
    "data.shipment.status",
  ]);

  return {
    collectedAt: readString(payload, [
      "shipment_collected_date",
      "shipment.shipment_collected_date",
      "data.shipment_collected_date",
      "data.shipment.shipment_collected_date",
    ]),
    deliveredAt: readString(payload, [
      "shipment_delivered_date",
      "shipment.shipment_delivered_date",
      "data.shipment_delivered_date",
      "data.shipment.shipment_delivered_date",
    ]),
    eventTime: readString(payload, [
      "event_time",
      "occurred_at",
      "created_at",
      "date",
      "shipment.event_time",
      "data.event_time",
      "data.occurred_at",
      "data.date",
    ]),
    location: readString(payload, [
      "location",
      "shipment.location",
      "data.location",
    ]),
    message: readString(payload, [
      "message",
      "shipment.message",
      "data.message",
    ]),
    providerEventId: readUsableEventId(payload, [
      "event_id",
      "eventId",
    ]),
    providerShipmentId: readString(payload, [
      "shipment_id",
      "shipmentId",
      "shipment.id",
      "data.shipment_id",
      "data.shipment.id",
    ]),
    providerStatus,
    topic,
    trackingEvents: readTrackingEvents(payload),
    trackingReference: readString(payload, [
      "short_tracking_reference",
      "tracking_reference",
      "trackingReference",
      "shipment.short_tracking_reference",
      "shipment.tracking_reference",
      "data.short_tracking_reference",
      "data.tracking_reference",
      "data.shipment.short_tracking_reference",
    ]),
  };
}

export function parseCourierGuyDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function readTrackingEvents(
  payload: CourierGuyWebhookPayload,
): CourierGuyWebhookTrackingEvent[] {
  const value = readValue(payload, [
    "tracking_events",
    "shipment.tracking_events",
    "data.tracking_events",
    "data.shipment.tracking_events",
  ]);

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const parsed = payloadSchema.safeParse(item);

    if (!parsed.success) {
      return [];
    }

    const status = readString(parsed.data, ["status"]);

    if (!status) {
      return [];
    }

    return [
      {
        data: parsed.data.data,
        location: readString(parsed.data, ["location"]),
        message: readString(parsed.data, ["message"]),
        occurredAt: readString(parsed.data, [
          "date",
          "event_time",
          "occurred_at",
        ]),
        parcelId: readString(parsed.data, ["parcel_id", "parcelId"]),
        payload: parsed.data,
        providerEventId: readUsableEventId(parsed.data, [
          "id",
          "event_id",
          "eventId",
        ]),
        source: readString(parsed.data, ["source"]),
        status,
      },
    ];
  });
}

function readUsableEventId(
  payload: Record<string, unknown>,
  paths: string[],
) {
  const value = readString(payload, paths);

  return value === "0" ? null : value;
}

function readString(
  payload: Record<string, unknown>,
  paths: string[],
) {
  const value = readValue(payload, paths);

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readValue(
  payload: Record<string, unknown>,
  paths: string[],
) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, segment) => {
      if (
        !current ||
        typeof current !== "object" ||
        Array.isArray(current)
      ) {
        return undefined;
      }

      return (current as Record<string, unknown>)[segment];
    }, payload);

    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}
