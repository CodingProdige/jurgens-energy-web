import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { bobgoWebhookEvents, shipments } from "@/src/db/schema";
import { getBobGoWebhookSecret } from "@/src/modules/marketplace/settings";

const signatureHeaderName = "bobgo-webhook-signature";

type BobGoPayload = Record<string, unknown>;

export async function verifyBobGoWebhookSignature({
  body,
  headers,
}: {
  body: string;
  headers: Headers;
}) {
  const secret = await getBobGoWebhookSecret();
  const signature = headers.get(signatureHeaderName);

  if (!secret || !signature) {
    return false;
  }

  return verifySignatureCandidates({
    body,
    secret,
    signature,
  });
}

export async function recordBobGoWebhookEvent(payload: unknown, rawBody: string) {
  if (!isRecord(payload)) {
    return { ok: false, error: "invalid_payload" };
  }

  const topic = getStringValue(payload, [
    "topic",
    "event",
    "event_name",
    "eventName",
    "type",
  ]);
  const providerShipmentId = getNestedStringValue(payload, [
    ["shipment_id"],
    ["shipmentId"],
    ["shipment", "id"],
    ["fulfillment", "shipment_id"],
    ["data", "shipment_id"],
    ["data", "shipment", "id"],
  ]);
  const providerEventId =
    getStringValue(payload, ["id", "event_id", "eventId", "uuid"]) ??
    createHash("sha256").update(`${topic ?? "unknown"}:${rawBody}`).digest("hex");

  const [inserted] = await db
    .insert(bobgoWebhookEvents)
    .values({
      payload,
      processedAt: new Date(),
      providerEventId,
      providerShipmentId,
      status: "processed",
      topic: topic ?? "unknown",
    })
    .onConflictDoNothing()
    .returning({ id: bobgoWebhookEvents.id });

  if (!inserted) {
    return { ok: true, duplicate: true };
  }

  await updateShipmentFromBobGoPayload({
    payload,
    providerShipmentId,
    topic: topic ?? "unknown",
  });

  return { ok: true, duplicate: false };
}

async function updateShipmentFromBobGoPayload({
  payload,
  providerShipmentId,
  topic,
}: {
  payload: BobGoPayload;
  providerShipmentId: string | null;
  topic: string;
}) {
  if (!providerShipmentId) {
    return;
  }

  const statusText = [
    topic,
    getStringValue(payload, ["status", "shipment_status", "shipmentStatus"]),
    getNestedStringValue(payload, [
      ["shipment", "status"],
      ["tracking", "status"],
      ["data", "status"],
      ["data", "shipment", "status"],
      ["data", "tracking", "status"],
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const status = mapBobGoStatus(statusText);

  if (!status) {
    return;
  }

  const timestamp = new Date();

  await db
    .update(shipments)
    .set({
      ...(status === "collected" ? { collectedAt: timestamp } : {}),
      ...(status === "delivered" ? { deliveredAt: timestamp } : {}),
      status,
      updatedAt: timestamp,
    })
    .where(eq(shipments.providerShipmentId, providerShipmentId));
}

function mapBobGoStatus(value: string) {
  if (value.includes("cancel")) {
    return "cancelled" as const;
  }

  if (value.includes("deliver") && !value.includes("out for")) {
    return "delivered" as const;
  }

  if (value.includes("out for delivery")) {
    return "out_for_delivery" as const;
  }

  if (value.includes("failed") && value.includes("delivery")) {
    return "failed_delivery" as const;
  }

  if (value.includes("transit")) {
    return "in_transit" as const;
  }

  if (value.includes("collect")) {
    return "collected" as const;
  }

  if (value.includes("waybill")) {
    return "waybill_ready" as const;
  }

  if (value.includes("book") || value.includes("submit")) {
    return "booked" as const;
  }

  return null;
}

function verifySignatureCandidates({
  body,
  secret,
  signature,
}: {
  body: string;
  secret: string;
  signature: string;
}) {
  const digest = createHmac("sha256", secret).update(body).digest();
  const normalizedSignature = signature.trim().replace(/^sha256=/i, "");
  const candidates = [
    digest.toString("hex"),
    digest.toString("base64"),
    digest.toString("base64url"),
  ];

  return candidates.some((candidate) =>
    timingSafeStringEqual(candidate, normalizedSignature),
  );
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isRecord(value: unknown): value is BobGoPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringValue(record: BobGoPayload, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
}

function getNestedStringValue(record: BobGoPayload, paths: string[][]) {
  for (const path of paths) {
    let current: unknown = record;

    for (const segment of path) {
      if (!isRecord(current)) {
        current = null;
        break;
      }

      current = current[segment];
    }

    if (typeof current === "string" && current.trim()) {
      return current.trim();
    }

    if (typeof current === "number") {
      return String(current);
    }
  }

  return null;
}
