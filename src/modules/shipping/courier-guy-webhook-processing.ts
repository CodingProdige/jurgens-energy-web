import "server-only";

import { and, eq, or } from "drizzle-orm";

import { db } from "@/src/db";
import {
  courierGuyWebhookEvents,
  shipmentEvents,
  shipments,
} from "@/src/db/schema";
import { createCourierGuyCustomerTrackingUrl } from "@/src/modules/shipping/courier-guy-operations";
import {
  createCourierGuyTrackingEventId,
  createCourierGuyWebhookEventId,
  mapCourierGuyStatus,
  resolveCourierGuyMilestones,
  resolveCourierGuyShipmentStatus,
} from "@/src/modules/shipping/courier-guy-tracking";
import {
  getCourierGuyWebhookDetails,
  parseCourierGuyDate,
  parseCourierGuyWebhookPayloads,
  type CourierGuyWebhookPayload,
} from "@/src/modules/shipping/courier-guy-webhook-payload";

export type CourierGuyWebhookEnvironment = "live" | "sandbox";
export type CourierGuyWebhookProcessingResult =
  | "duplicate"
  | "processed"
  | "unmatched";

export async function processCourierGuyWebhookPayload(
  payload: CourierGuyWebhookPayload,
  environment: CourierGuyWebhookEnvironment,
): Promise<CourierGuyWebhookProcessingResult> {
  const details = getCourierGuyWebhookDetails(payload);
  const providerEventId =
    details.providerEventId ?? createCourierGuyWebhookEventId(payload);

  await db
    .insert(courierGuyWebhookEvents)
    .values({
      payload,
      providerEnvironment: environment,
      providerEventId,
      providerShipmentId: details.providerShipmentId,
      topic: details.topic,
      trackingReference: details.trackingReference,
    })
    .onConflictDoNothing({
      target: [
        courierGuyWebhookEvents.providerEnvironment,
        courierGuyWebhookEvents.providerEventId,
      ],
    });

  return db.transaction(async (tx) => {
    const [webhookEvent] = await tx
      .select({
        id: courierGuyWebhookEvents.id,
        status: courierGuyWebhookEvents.status,
      })
      .from(courierGuyWebhookEvents)
      .where(
        and(
          eq(courierGuyWebhookEvents.providerEnvironment, environment),
          eq(courierGuyWebhookEvents.providerEventId, providerEventId),
        ),
      )
      .limit(1)
      .for("update");

    if (
      !webhookEvent ||
      !["received", "unmatched"].includes(webhookEvent.status)
    ) {
      return "duplicate";
    }

    const [shipment] =
      details.providerShipmentId || details.trackingReference
        ? await tx
            .select({
              collectedAt: shipments.collectedAt,
              deliveredAt: shipments.deliveredAt,
              id: shipments.id,
              status: shipments.status,
            })
            .from(shipments)
            .where(
              and(
                eq(shipments.provider, "courier_guy"),
                eq(shipments.providerEnvironment, environment),
                ...(details.providerShipmentId
                  ? [
                      eq(
                        shipments.providerShipmentId,
                        details.providerShipmentId,
                      ),
                    ]
                  : []),
                ...(details.trackingReference
                  ? [
                      eq(
                        shipments.trackingNumber,
                        details.trackingReference,
                      ),
                    ]
                  : []),
              ),
            )
            .limit(1)
            .for("update")
        : [];

    if (!shipment) {
      await tx
        .update(courierGuyWebhookEvents)
        .set({ processedAt: new Date(), status: "unmatched" })
        .where(eq(courierGuyWebhookEvents.id, webhookEvent.id));

      return "unmatched";
    }

    const now = new Date();
    const providerCollectedAt = parseCourierGuyDate(details.collectedAt);
    const providerDeliveredAt = parseCourierGuyDate(details.deliveredAt);
    const fallbackMilestoneAt =
      parseCourierGuyDate(details.eventTime) ??
      providerDeliveredAt ??
      providerCollectedAt ??
      now;
    let nextStatus = details.providerStatus
      ? resolveCourierGuyShipmentStatus(
          shipment.status,
          details.providerStatus,
        )
      : shipment.status;

    if (
      (!details.providerStatus ||
        !mapCourierGuyStatus(details.providerStatus)) &&
      details.trackingEvents.length > 0
    ) {
      const latestEvent = [...details.trackingEvents].sort(
        (first, second) =>
          (parseCourierGuyDate(second.occurredAt)?.getTime() ?? 0) -
          (parseCourierGuyDate(first.occurredAt)?.getTime() ?? 0),
      )[0]!;

      nextStatus = resolveCourierGuyShipmentStatus(
        nextStatus,
        latestEvent.status,
      );
    }

    if (providerDeliveredAt) {
      nextStatus = resolveCourierGuyShipmentStatus(
        nextStatus,
        "delivered",
      );
    }

    const milestones = resolveCourierGuyMilestones({
      currentCollectedAt: shipment.collectedAt,
      currentDeliveredAt: shipment.deliveredAt,
      nextStatus,
      occurredAt: fallbackMilestoneAt,
      providerCollectedAt,
      providerDeliveredAt,
    });
    const shipmentIdentity =
      details.trackingReference ??
      details.providerShipmentId ??
      shipment.id;
    const eventRows = [
      {
        location: details.location,
        message: details.message,
        occurredAt:
          parseCourierGuyDate(details.eventTime) ?? fallbackMilestoneAt,
        payload,
        provider: "courier_guy" as const,
        providerEventId,
        shipmentId: shipment.id,
        status: details.providerStatus ?? details.topic,
      },
      ...details.trackingEvents.map((event) => ({
        location: event.location,
        message: event.message,
        occurredAt: parseCourierGuyDate(event.occurredAt) ?? now,
        payload: event.payload,
        provider: "courier_guy" as const,
        providerEventId: createCourierGuyTrackingEventId({
          data: event.data,
          location: event.location,
          message: event.message,
          occurredAt: event.occurredAt,
          parcelId: event.parcelId,
          providerEventId: event.providerEventId,
          shipmentIdentity,
          source: event.source,
          status: event.status,
        }),
        shipmentId: shipment.id,
        status: event.status,
      })),
    ];
    const uniqueEventRows = [
      ...new Map(
        eventRows.map((event) => [event.providerEventId, event]),
      ).values(),
    ];

    await tx
      .insert(shipmentEvents)
      .values(uniqueEventRows)
      .onConflictDoNothing();
    await tx
      .update(shipments)
      .set({
        collectedAt: milestones.collectedAt,
        deliveredAt: milestones.deliveredAt,
        ...(details.providerShipmentId
          ? { providerShipmentId: details.providerShipmentId }
          : {}),
        status: nextStatus,
        ...(details.trackingReference
          ? {
              trackingNumber: details.trackingReference,
              trackingUrl: createCourierGuyCustomerTrackingUrl(
                details.trackingReference,
              ),
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(shipments.id, shipment.id));
    await tx
      .update(courierGuyWebhookEvents)
      .set({ processedAt: now, status: "processed" })
      .where(eq(courierGuyWebhookEvents.id, webhookEvent.id));

    return "processed";
  });
}

export async function replayUnmatchedCourierGuyWebhookEvents({
  environment,
  providerShipmentId,
  trackingReference,
}: {
  environment: CourierGuyWebhookEnvironment;
  providerShipmentId?: string | null;
  trackingReference?: string | null;
}) {
  const identityConditions = [
    ...(providerShipmentId
      ? [
          eq(
            courierGuyWebhookEvents.providerShipmentId,
            providerShipmentId,
          ),
        ]
      : []),
    ...(trackingReference
      ? [
          eq(
            courierGuyWebhookEvents.trackingReference,
            trackingReference,
          ),
        ]
      : []),
  ];

  if (identityConditions.length === 0) {
    return { processed: 0, replayed: 0 };
  }

  const pendingEvents = await db
    .select({ payload: courierGuyWebhookEvents.payload })
    .from(courierGuyWebhookEvents)
    .where(
      and(
        eq(courierGuyWebhookEvents.providerEnvironment, environment),
        eq(courierGuyWebhookEvents.status, "unmatched"),
        or(...identityConditions),
      ),
    );
  let processed = 0;
  let replayed = 0;

  for (const event of pendingEvents) {
    const payload = parseCourierGuyWebhookPayloads(event.payload)?.[0];

    if (!payload) {
      continue;
    }

    replayed += 1;

    if (
      (await processCourierGuyWebhookPayload(payload, environment)) ===
      "processed"
    ) {
      processed += 1;
    }
  }

  return { processed, replayed };
}
