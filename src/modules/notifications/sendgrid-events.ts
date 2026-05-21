import { eq, like, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  notificationDeliveries,
  notificationWebhookEvents,
  type NotificationDeliveryStatus,
} from "@/src/db/schema";

export type SendGridWebhookEvent = {
  email?: string;
  event?: string;
  reason?: string;
  response?: string;
  sg_event_id?: string;
  sg_message_id?: string;
  timestamp?: number;
  url?: string;
  piessang_delivery_id?: string;
  piessang_template_key?: string;
  [key: string]: unknown;
};

type WebhookProcessResult = {
  processed: number;
  skipped: number;
};

export async function recordSendGridWebhookEvents(
  events: SendGridWebhookEvent[],
): Promise<WebhookProcessResult> {
  let processed = 0;
  let skipped = 0;

  for (const event of events) {
    const eventType = normalizeEventType(event.event);
    const providerEventId = getProviderEventId(event);

    if (!eventType || !providerEventId) {
      skipped += 1;
      continue;
    }

    const deliveryId = await findDeliveryId(event);
    const [recordedEvent] = await db
      .insert(notificationWebhookEvents)
      .values({
        deliveryId,
        eventType,
        payload: JSON.stringify(event),
        providerEventId,
      })
      .onConflictDoNothing()
      .returning({ id: notificationWebhookEvents.id });

    if (!recordedEvent) {
      skipped += 1;
      continue;
    }

    if (deliveryId) {
      await applyDeliveryEvent({
        deliveryId,
        event,
        eventDate: getEventDate(event.timestamp),
        eventType,
      });
    }

    processed += 1;
  }

  return { processed, skipped };
}

async function findDeliveryId(event: SendGridWebhookEvent) {
  const customDeliveryId =
    typeof event.piessang_delivery_id === "string"
      ? event.piessang_delivery_id
      : undefined;

  if (customDeliveryId) {
    return customDeliveryId;
  }

  const providerMessageId =
    typeof event.sg_message_id === "string" ? event.sg_message_id : undefined;

  if (!providerMessageId) {
    return null;
  }

  const [delivery] = await db
    .select({ id: notificationDeliveries.id })
    .from(notificationDeliveries)
    .where(like(notificationDeliveries.providerMessageId, `${providerMessageId}%`))
    .limit(1);

  return delivery?.id ?? null;
}

async function applyDeliveryEvent({
  deliveryId,
  event,
  eventDate,
  eventType,
}: {
  deliveryId: string;
  event: SendGridWebhookEvent;
  eventDate: Date | null;
  eventType: string;
}) {
  if (eventType === "open") {
    await db
      .update(notificationDeliveries)
      .set({
        openCount: sql`${notificationDeliveries.openCount} + 1`,
        openedAt: eventDate ?? new Date(),
      })
      .where(eq(notificationDeliveries.id, deliveryId));
    return;
  }

  const status = getDeliveryStatus(eventType);
  const errorMessage = getDeliveryErrorMessage(event);

  if (!status && !errorMessage) {
    return;
  }

  await db
    .update(notificationDeliveries)
    .set({
      ...(errorMessage ? { errorMessage } : {}),
      ...(eventDate && status === "sent" ? { sentAt: eventDate } : {}),
      ...(status ? { status } : {}),
    })
    .where(eq(notificationDeliveries.id, deliveryId));
}

function getDeliveryStatus(
  eventType: string,
): NotificationDeliveryStatus | undefined {
  if (eventType === "processed" || eventType === "delivered") {
    return "sent";
  }

  if (["bounce", "dropped", "spamreport"].includes(eventType)) {
    return "failed";
  }

  return undefined;
}

function getDeliveryErrorMessage(event: SendGridWebhookEvent) {
  const eventType = normalizeEventType(event.event);

  if (!eventType || !["bounce", "deferred", "dropped", "spamreport"].includes(eventType)) {
    return undefined;
  }

  const detail =
    [event.reason, event.response]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" ")
      .trim() || "SendGrid reported a delivery issue.";

  return `${eventType}: ${detail}`.slice(0, 1000);
}

function getEventDate(timestamp: unknown) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp * 1000);
}

function getProviderEventId(event: SendGridWebhookEvent) {
  if (typeof event.sg_event_id === "string" && event.sg_event_id.length > 0) {
    return event.sg_event_id;
  }

  const eventType = normalizeEventType(event.event);
  const messageId =
    typeof event.sg_message_id === "string" ? event.sg_message_id : "";
  const timestamp = typeof event.timestamp === "number" ? event.timestamp : "";
  const url = typeof event.url === "string" ? event.url : "";

  if (!eventType || !messageId || !timestamp) {
    return null;
  }

  return [messageId, eventType, timestamp, url].join(":");
}

function normalizeEventType(eventType: unknown) {
  return typeof eventType === "string" && eventType.length > 0
    ? eventType.toLowerCase()
    : null;
}
