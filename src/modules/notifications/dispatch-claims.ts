import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq, lte, or, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { notificationDispatchClaims } from "@/src/db/schema";

const defaultStaleAfterMs = 5 * 60 * 1000;
type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function normalizeDispatchIdentity({
  dedupeKey,
  eventKey,
}: {
  dedupeKey: string;
  eventKey: string;
}) {
  const normalizedDedupeKey = dedupeKey.trim();
  const normalizedEventKey = eventKey.trim();

  if (!normalizedDedupeKey || normalizedDedupeKey.length > 320) {
    throw new Error("Notification dispatch dedupe key is invalid.");
  }

  if (!normalizedEventKey || normalizedEventKey.length > 160) {
    throw new Error("Notification dispatch event key is invalid.");
  }

  return {
    dedupeKey: normalizedDedupeKey,
    eventKey: normalizedEventKey,
  };
}

export async function enqueueNotificationDispatch({
  dedupeKey,
  eventKey,
  payload = {},
  transaction,
}: {
  dedupeKey: string;
  eventKey: string;
  payload?: Record<string, string>;
  transaction: DatabaseTransaction;
}) {
  const normalized = normalizeDispatchIdentity({ dedupeKey, eventKey });
  const now = new Date();
  const [queued] = await transaction
    .insert(notificationDispatchClaims)
    .values({
      attempts: 0,
      availableAt: now,
      claimedAt: now,
      claimToken: randomUUID(),
      dedupeKey: normalized.dedupeKey,
      eventKey: normalized.eventKey,
      payload,
      status: "pending",
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: notificationDispatchClaims.dedupeKey,
    })
    .returning({ id: notificationDispatchClaims.id });

  return {
    queued: Boolean(queued),
  } as const;
}

export async function getRetryableNotificationDispatches(limit = 20) {
  const now = new Date();

  return db
    .select({
      eventKey: notificationDispatchClaims.eventKey,
      id: notificationDispatchClaims.id,
      payload: notificationDispatchClaims.payload,
    })
    .from(notificationDispatchClaims)
    .where(
      or(
        and(
          eq(notificationDispatchClaims.status, "pending"),
          lte(notificationDispatchClaims.availableAt, now),
        ),
        and(
          eq(notificationDispatchClaims.status, "failed"),
          lte(notificationDispatchClaims.availableAt, now),
        ),
        and(
          eq(notificationDispatchClaims.status, "processing"),
          lte(
            notificationDispatchClaims.claimedAt,
            new Date(now.getTime() - defaultStaleAfterMs),
          ),
        ),
      ),
    )
    .orderBy(
      asc(notificationDispatchClaims.availableAt),
      asc(notificationDispatchClaims.createdAt),
    )
    .limit(Math.max(1, Math.min(100, Math.trunc(limit))));
}

export async function claimNotificationDispatch({
  dedupeKey,
  eventKey,
  payload = {},
  retryNow = false,
  staleAfterMs = defaultStaleAfterMs,
}: {
  dedupeKey: string;
  eventKey: string;
  payload?: Record<string, string>;
  retryNow?: boolean;
  staleAfterMs?: number;
}) {
  const normalized = normalizeDispatchIdentity({ dedupeKey, eventKey });

  return db.transaction(async (tx) => {
    const now = new Date();
    const claimToken = randomUUID();
    const [inserted] = await tx
      .insert(notificationDispatchClaims)
      .values({
        claimedAt: now,
        claimToken,
        dedupeKey: normalized.dedupeKey,
        eventKey: normalized.eventKey,
        payload,
        status: "processing",
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: notificationDispatchClaims.dedupeKey,
      })
      .returning({
        claimToken: notificationDispatchClaims.claimToken,
        id: notificationDispatchClaims.id,
      });

    if (inserted) {
      return {
        claimId: inserted.id,
        claimToken: inserted.claimToken,
        claimed: true,
      } as const;
    }

    const [existing] = await tx
      .select({
        availableAt: notificationDispatchClaims.availableAt,
        claimedAt: notificationDispatchClaims.claimedAt,
        id: notificationDispatchClaims.id,
        status: notificationDispatchClaims.status,
      })
      .from(notificationDispatchClaims)
      .where(
        eq(notificationDispatchClaims.dedupeKey, normalized.dedupeKey),
      )
      .limit(1)
      .for("update");

    if (!existing || existing.status === "sent") {
      return {
        claimId: existing?.id ?? null,
        claimed: false,
        reason: "already_sent",
      } as const;
    }

    if (
      existing.status === "processing" &&
      existing.claimedAt.getTime() > now.getTime() - staleAfterMs
    ) {
      return {
        claimId: existing.id,
        claimed: false,
        reason: "in_progress",
      } as const;
    }

    if (
      existing.status === "failed" &&
      existing.availableAt.getTime() > now.getTime() &&
      !retryNow
    ) {
      return {
        claimId: existing.id,
        claimed: false,
        reason: "retry_scheduled",
      } as const;
    }

    const [reclaimed] = await tx
      .update(notificationDispatchClaims)
      .set({
        attempts: sql`${notificationDispatchClaims.attempts} + 1`,
        availableAt: now,
        claimedAt: now,
        claimToken,
        completedAt: null,
        lastError: null,
        status: "processing",
        updatedAt: now,
      })
      .where(eq(notificationDispatchClaims.id, existing.id))
      .returning({
        claimToken: notificationDispatchClaims.claimToken,
        id: notificationDispatchClaims.id,
      });

    return reclaimed
      ? ({
          claimId: reclaimed.id,
          claimToken: reclaimed.claimToken,
          claimed: true,
        } as const)
      : ({
          claimId: existing.id,
          claimed: false,
          reason: "in_progress",
        } as const);
  });
}

export async function completeNotificationDispatch(
  claimId: string,
  claimToken: string,
) {
  const now = new Date();

  await db
    .update(notificationDispatchClaims)
    .set({
      completedAt: now,
      lastError: null,
      status: "sent",
      updatedAt: now,
    })
    .where(
      and(
        eq(notificationDispatchClaims.id, claimId),
        eq(notificationDispatchClaims.claimToken, claimToken),
        eq(notificationDispatchClaims.status, "processing"),
      ),
    );
}

export async function failNotificationDispatch(
  claimId: string,
  claimToken: string,
  error: unknown,
) {
  await db.transaction(async (tx) => {
    const [claim] = await tx
      .select({ attempts: notificationDispatchClaims.attempts })
      .from(notificationDispatchClaims)
      .where(
        and(
          eq(notificationDispatchClaims.id, claimId),
          eq(notificationDispatchClaims.claimToken, claimToken),
          eq(notificationDispatchClaims.status, "processing"),
        ),
      )
      .limit(1)
      .for("update");

    if (!claim) {
      return;
    }

    const now = new Date();
    const delayMinutes = Math.min(
      6 * 60,
      2 ** Math.max(0, claim.attempts - 1),
    );

    await tx
      .update(notificationDispatchClaims)
      .set({
        availableAt: new Date(now.getTime() + delayMinutes * 60_000),
        lastError:
          error instanceof Error
            ? error.message.slice(0, 4000)
            : String(error).slice(0, 4000),
        status: "failed",
        updatedAt: now,
      })
      .where(
        and(
          eq(notificationDispatchClaims.id, claimId),
          eq(notificationDispatchClaims.claimToken, claimToken),
          eq(notificationDispatchClaims.status, "processing"),
        ),
      );
  });
}
