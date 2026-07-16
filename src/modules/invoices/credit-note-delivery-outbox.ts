import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  creditNoteDeliveryAttempts,
  creditNotes,
  type CreditNoteDeliveryAttemptStatus,
  type CreditNoteDeliveryChannel,
} from "@/src/db/schema";
import type { CreditNoteDeliveryChannelResult } from "@/src/modules/invoices/credit-note-delivery";

const STALE_SENDING_MINUTES = 15;
const RETRYABLE_ATTEMPT_STATUSES: CreditNoteDeliveryAttemptStatus[] = [
  "pending",
  "failed",
];

export type ClaimedCreditNoteDeliveryAttempt = Readonly<{
  attempts: number;
  channel: CreditNoteDeliveryChannel;
  claimToken: string;
  creditNoteId: string;
  id: string;
  idempotencyKey: string;
}>;

function retryDelay(attempts: number) {
  const minutes = Math.min(6 * 60, 2 ** Math.max(0, attempts - 1));

  return new Date(Date.now() + minutes * 60_000);
}

function stableIdempotencyKey(
  creditNoteId: string,
  channel: CreditNoteDeliveryChannel,
) {
  return `credit-note:${creditNoteId}:${channel}:v1`;
}

function legacyStatus(
  status:
    | "pending"
    | "verification_required"
    | "sent"
    | "skipped"
    | "failed",
) {
  return status;
}

export async function ensureCreditNoteDeliveryAttempts(creditNoteId: string) {
  return db.transaction(async (transaction) => {
    const [creditNote] = await transaction
      .select({
        emailDeliveryError: creditNotes.emailDeliveryError,
        emailDeliveryStatus: creditNotes.emailDeliveryStatus,
        emailSentAt: creditNotes.emailSentAt,
        id: creditNotes.id,
        whatsappDeliveryError: creditNotes.whatsappDeliveryError,
        whatsappDeliveryStatus: creditNotes.whatsappDeliveryStatus,
        whatsappSentAt: creditNotes.whatsappSentAt,
      })
      .from(creditNotes)
      .where(eq(creditNotes.id, creditNoteId))
      .limit(1);

    if (!creditNote) {
      return false;
    }

    await transaction
      .insert(creditNoteDeliveryAttempts)
      .values([
        {
          attempts: creditNote.emailDeliveryStatus === "pending" ? 0 : 1,
          channel: "email",
          creditNoteId: creditNote.id,
          idempotencyKey: stableIdempotencyKey(creditNote.id, "email"),
          lastAttemptCompletedAt: creditNote.emailSentAt,
          lastError: creditNote.emailDeliveryError,
          sentAt: creditNote.emailSentAt,
          status: creditNote.emailDeliveryStatus,
        },
        {
          attempts: creditNote.whatsappDeliveryStatus === "pending" ? 0 : 1,
          channel: "whatsapp",
          creditNoteId: creditNote.id,
          idempotencyKey: stableIdempotencyKey(creditNote.id, "whatsapp"),
          lastAttemptCompletedAt: creditNote.whatsappSentAt,
          lastError: creditNote.whatsappDeliveryError,
          sentAt: creditNote.whatsappSentAt,
          status: creditNote.whatsappDeliveryStatus,
        },
      ])
      .onConflictDoNothing({
        target: [
          creditNoteDeliveryAttempts.creditNoteId,
          creditNoteDeliveryAttempts.channel,
        ],
      });

    return true;
  });
}

export async function claimCreditNoteDeliveryAttempt({
  channel,
  creditNoteId,
}: {
  channel: CreditNoteDeliveryChannel;
  creditNoteId: string;
}): Promise<ClaimedCreditNoteDeliveryAttempt | null> {
  if (!(await ensureCreditNoteDeliveryAttempts(creditNoteId))) {
    return null;
  }

  return db.transaction(async (transaction) => {
    const claimToken = randomUUID();
    const now = new Date();
    const [claimed] = await transaction
      .update(creditNoteDeliveryAttempts)
      .set({
        attempts: sql`${creditNoteDeliveryAttempts.attempts} + 1`,
        claimToken,
        failedAt: null,
        lastAttemptCompletedAt: null,
        lastAttemptStartedAt: now,
        lastError: null,
        lockedAt: now,
        outcomeUnknown: false,
        providerMessageId: null,
        providerStatus: null,
        status: "sending",
        updatedAt: now,
        verificationRequiredAt: null,
      })
      .where(
        and(
          eq(creditNoteDeliveryAttempts.creditNoteId, creditNoteId),
          eq(creditNoteDeliveryAttempts.channel, channel),
          inArray(
            creditNoteDeliveryAttempts.status,
            RETRYABLE_ATTEMPT_STATUSES,
          ),
          lte(creditNoteDeliveryAttempts.availableAt, now),
        ),
      )
      .returning({
        attempts: creditNoteDeliveryAttempts.attempts,
        channel: creditNoteDeliveryAttempts.channel,
        creditNoteId: creditNoteDeliveryAttempts.creditNoteId,
        id: creditNoteDeliveryAttempts.id,
        idempotencyKey: creditNoteDeliveryAttempts.idempotencyKey,
      });

    if (!claimed) {
      return null;
    }

    await transaction
      .update(creditNotes)
      .set({
        ...(channel === "email"
          ? {
              emailDeliveryError: null,
              emailDeliveryStatus: "pending" as const,
            }
          : {
              whatsappDeliveryError: null,
              whatsappDeliveryStatus: "pending" as const,
            }),
        updatedAt: now,
      })
      .where(eq(creditNotes.id, creditNoteId));

    return { ...claimed, claimToken };
  });
}

export async function getCreditNoteDeliveryAttemptStates(
  creditNoteId: string,
) {
  await ensureCreditNoteDeliveryAttempts(creditNoteId);

  return db
    .select({
      availableAt: creditNoteDeliveryAttempts.availableAt,
      channel: creditNoteDeliveryAttempts.channel,
      status: creditNoteDeliveryAttempts.status,
    })
    .from(creditNoteDeliveryAttempts)
    .where(eq(creditNoteDeliveryAttempts.creditNoteId, creditNoteId));
}

export async function finalizeCreditNoteDeliveryAttempt({
  claim,
  result,
}: {
  claim: ClaimedCreditNoteDeliveryAttempt;
  result: CreditNoteDeliveryChannelResult;
}) {
  const now = new Date();
  const status = legacyStatus(result.status);
  const lastError = result.status === "sent" ? null : result.reason;
  const providerMessageId =
    "providerMessageId" in result ? (result.providerMessageId ?? null) : null;
  const providerStatus =
    "providerStatus" in result ? (result.providerStatus ?? null) : null;
  const outcomeUnknown = result.status === "verification_required";

  return db.transaction(async (transaction) => {
    const [finalized] = await transaction
      .update(creditNoteDeliveryAttempts)
      .set({
        availableAt:
          result.status === "failed" ? retryDelay(claim.attempts) : now,
        claimToken: null,
        failedAt: result.status === "failed" ? now : null,
        lastAttemptCompletedAt: now,
        lastError,
        lockedAt: null,
        outcomeUnknown,
        providerMessageId,
        providerStatus,
        sentAt: result.status === "sent" ? now : null,
        skippedAt: result.status === "skipped" ? now : null,
        status,
        updatedAt: now,
        verificationRequiredAt:
          result.status === "verification_required" ? now : null,
      })
      .where(
        and(
          eq(creditNoteDeliveryAttempts.id, claim.id),
          eq(creditNoteDeliveryAttempts.status, "sending"),
          eq(creditNoteDeliveryAttempts.claimToken, claim.claimToken),
        ),
      )
      .returning({ id: creditNoteDeliveryAttempts.id });

    if (!finalized) {
      return false;
    }

    await transaction
      .update(creditNotes)
      .set({
        ...(claim.channel === "email"
          ? {
              emailDeliveryError: lastError,
              emailDeliveryStatus: status,
              emailSentAt: result.status === "sent" ? now : null,
            }
          : {
              whatsappDeliveryError: lastError,
              whatsappDeliveryStatus: status,
              whatsappSentAt: result.status === "sent" ? now : null,
            }),
        updatedAt: now,
      })
      .where(eq(creditNotes.id, claim.creditNoteId));

    return true;
  });
}

export async function releaseStaleCreditNoteDeliveryAttempts() {
  return db.transaction(async (transaction) => {
    const now = new Date();
    const message =
      "Delivery may have reached the provider before the worker stopped. Verify the provider outcome before retrying.";
    const staleBefore = new Date(
      now.getTime() - STALE_SENDING_MINUTES * 60_000,
    );
    const staleAttempts = await transaction
      .update(creditNoteDeliveryAttempts)
      .set({
        claimToken: null,
        lastAttemptCompletedAt: now,
        lastError: message,
        lockedAt: null,
        outcomeUnknown: true,
        status: "verification_required",
        updatedAt: now,
        verificationRequiredAt: now,
      })
      .where(
        and(
          eq(creditNoteDeliveryAttempts.status, "sending"),
          lte(creditNoteDeliveryAttempts.lockedAt, staleBefore),
        ),
      )
      .returning({
        channel: creditNoteDeliveryAttempts.channel,
        creditNoteId: creditNoteDeliveryAttempts.creditNoteId,
      });

    for (const attempt of staleAttempts) {
      await transaction
        .update(creditNotes)
        .set({
          ...(attempt.channel === "email"
            ? {
                emailDeliveryError: message,
                emailDeliveryStatus: "verification_required" as const,
              }
            : {
                whatsappDeliveryError: message,
                whatsappDeliveryStatus: "verification_required" as const,
              }),
          updatedAt: now,
        })
        .where(eq(creditNotes.id, attempt.creditNoteId));
    }

    return staleAttempts.length;
  });
}
