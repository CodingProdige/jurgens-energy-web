import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { payfastItnEvents } from "@/src/db/schema";

export const payFastItnStages = [
  "received",
  "configuration",
  "source_ip",
  "signature",
  "merchant",
  "payment_reference",
  "amount",
  "provider_validation",
  "payment_update",
  "capture",
  "completed",
] as const;

export type PayFastItnStage = (typeof payFastItnStages)[number];

export type PayFastItnAuditStatus = "processed" | "received" | "rejected";

const diagnosticPayloadFields = [
  "m_payment_id",
  "pf_payment_id",
  "payment_status",
  "item_name",
  "item_description",
  "amount_gross",
  "amount_fee",
  "amount_net",
  "custom_str1",
  "merchant_id",
] as const;

function nullableTrimmed(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim();

  return normalized ? normalized.slice(0, maxLength) : null;
}

export function redactPayFastItnPayload(payload: Record<string, string>) {
  return Object.fromEntries(
    diagnosticPayloadFields.flatMap((field) =>
      payload[field] === undefined ? [] : [[field, payload[field]]],
    ),
  );
}

export async function createPayFastItnAuditEvent({
  cfConnectingIp,
  payload,
  sourceIp,
  xForwardedFor,
}: {
  cfConnectingIp?: string | null;
  payload: Record<string, string>;
  sourceIp: string;
  xForwardedFor?: string | null;
}) {
  const [event] = await db
    .insert(payfastItnEvents)
    .values({
      cfConnectingIp: nullableTrimmed(cfConnectingIp, 64),
      paymentReference: nullableTrimmed(payload.m_payment_id, 160),
      payload: redactPayFastItnPayload(payload),
      providerPaymentId: nullableTrimmed(payload.pf_payment_id, 160),
      providerStatus: nullableTrimmed(payload.payment_status?.toUpperCase(), 80),
      sourceIp: nullableTrimmed(sourceIp, 64),
      status: "received",
      validationStage: "received",
      xForwardedFor: nullableTrimmed(xForwardedFor, 1_000),
    })
    .returning({ id: payfastItnEvents.id });

  if (!event) {
    throw new Error("Could not persist the PayFast notification audit event.");
  }

  return event.id;
}

export async function completePayFastItnAuditEvent({
  errorCode,
  errorMessage,
  eventId,
  stage,
  status,
}: {
  errorCode?: string | null;
  errorMessage?: string | null;
  eventId: string;
  stage: PayFastItnStage;
  status: Exclude<PayFastItnAuditStatus, "received">;
}) {
  const now = new Date();

  await db
    .update(payfastItnEvents)
    .set({
      errorCode: nullableTrimmed(errorCode, 80),
      errorMessage: nullableTrimmed(errorMessage, 2_000),
      processedAt: now,
      status,
      updatedAt: now,
      validationStage: stage,
    })
    .where(eq(payfastItnEvents.id, eventId));
}
