import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { env } from "@/src/config/env";
import { db } from "@/src/db";
import {
  creditNoteJobs,
  creditNotes,
  invoices,
  orders,
} from "@/src/db/schema";
import { createCreditNoteAccessToken } from "@/src/modules/invoices/credit-note-access";
import {
  deliverCreditNote,
  type CreditNoteDeliveryChannelResult,
} from "@/src/modules/invoices/credit-note-delivery";
import {
  claimCreditNoteDeliveryAttempt,
  finalizeCreditNoteDeliveryAttempt,
  getCreditNoteDeliveryAttemptStates,
  releaseStaleCreditNoteDeliveryAttempts,
  type ClaimedCreditNoteDeliveryAttempt,
} from "@/src/modules/invoices/credit-note-delivery-outbox";
import { getCreditNoteDocumentData } from "@/src/modules/invoices/credit-note-service";
import {
  readStoredCreditNotePdf,
  renderAndStoreCreditNotePdf,
} from "@/src/modules/invoices/credit-note-storage";

const MAX_JOBS_PER_PASS = 10;

function moneyToCents(value: string | number) {
  return Math.round(Number(value) * 100);
}

function retryDelay(attempts: number) {
  const minutes = Math.min(6 * 60, 2 ** Math.max(0, attempts - 1));

  return new Date(Date.now() + minutes * 60_000);
}

async function claimNextCreditNoteJob() {
  const rows = await db.execute<{
    attempts: number;
    credit_note_id: string;
    id: string;
    job_type: "deliver" | "render_and_deliver";
  }>(sql`
    WITH candidate AS (
      SELECT id
      FROM credit_note_jobs
      WHERE status IN ('pending', 'failed')
        AND available_at <= now()
      ORDER BY available_at ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE credit_note_jobs AS job
    SET status = 'processing',
        attempts = job.attempts + 1,
        locked_at = now(),
        last_error = NULL,
        updated_at = now()
    FROM candidate
    WHERE job.id = candidate.id
    RETURNING job.id, job.credit_note_id, job.job_type, job.attempts
  `);
  const job = rows[0];

  return job
    ? {
        attempts: job.attempts,
        creditNoteId: job.credit_note_id,
        id: job.id,
        jobType: job.job_type,
      }
    : null;
}

async function releaseStaleCreditNoteJobs() {
  await db.execute(sql`
    UPDATE credit_note_jobs
    SET status = 'failed',
        available_at = now(),
        locked_at = NULL,
        last_error = 'Recovered after an interrupted credit-note worker.',
        updated_at = now()
    WHERE status = 'processing'
      AND locked_at < now() - interval '15 minutes'
  `);
}

async function completeCreditNoteJob(jobId: string) {
  await db
    .update(creditNoteJobs)
    .set({
      completedAt: new Date(),
      lastError: null,
      lockedAt: null,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(creditNoteJobs.id, jobId));
}

async function failCreditNoteJob({
  attempts,
  creditNoteId,
  error,
  jobId,
}: {
  attempts: number;
  creditNoteId: string;
  error: unknown;
  jobId: string;
}) {
  const message =
    error instanceof Error
      ? error.message.slice(0, 2_000)
      : "Credit-note job failed.";
  const now = new Date();

  await Promise.all([
    db
      .update(creditNoteJobs)
      .set({
        availableAt: retryDelay(attempts),
        lastError: message,
        lockedAt: null,
        status: "failed",
        updatedAt: now,
      })
      .where(eq(creditNoteJobs.id, jobId)),
    db
      .update(creditNotes)
      .set({
        renderError: message,
        renderStatus: "failed",
        updatedAt: now,
      })
      .where(
        and(
          eq(creditNotes.id, creditNoteId),
          eq(creditNotes.renderStatus, "pending"),
        ),
      ),
  ]);
}

function missingDeliveryResult(
  claim: ClaimedCreditNoteDeliveryAttempt,
): CreditNoteDeliveryChannelResult {
  return {
    idempotencyKey: claim.idempotencyKey,
    outcomeUnknown: true,
    reason:
      "The provider call returned without a channel result. Verify the provider before retrying.",
    status: "verification_required",
  };
}

async function processClaimedCreditNoteJob(job: {
  attempts: number;
  creditNoteId: string;
  id: string;
}) {
  const [creditNote] = await db
    .select({
      creditNoteNumber: creditNotes.creditNoteNumber,
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      customerUserId: orders.userId,
      id: creditNotes.id,
      invoiceNumber: invoices.invoiceNumber,
      orderNumber: orders.orderNumber,
      pdfRelativePath: creditNotes.pdfRelativePath,
      pdfSha256: creditNotes.pdfSha256,
      reason: creditNotes.reason,
      renderStatus: creditNotes.renderStatus,
      totalIncludingTax: creditNotes.totalIncludingTax,
    })
    .from(creditNotes)
    .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .where(eq(creditNotes.id, job.creditNoteId))
    .limit(1);

  if (!creditNote) {
    await completeCreditNoteJob(job.id);
    return;
  }

  let pdfBuffer: Buffer;

  if (
    creditNote.renderStatus === "ready" &&
    creditNote.pdfRelativePath &&
    creditNote.pdfSha256
  ) {
    try {
      pdfBuffer = await readStoredCreditNotePdf(
        creditNote.pdfRelativePath,
        creditNote.pdfSha256,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 2_000)
          : "Stored credit-note PDF could not be read.";

      await db
        .update(creditNotes)
        .set({
          renderError: message,
          renderStatus: "failed",
          updatedAt: new Date(),
        })
        .where(eq(creditNotes.id, creditNote.id));

      throw error;
    }
  } else {
    const documentData = await getCreditNoteDocumentData(creditNote.id);
    const stored = await renderAndStoreCreditNotePdf(documentData);
    pdfBuffer = await readStoredCreditNotePdf(
      stored.relativePath,
      stored.sha256,
    );

    await db
      .update(creditNotes)
      .set({
        pdfRelativePath: stored.relativePath,
        pdfSha256: stored.sha256,
        renderError: null,
        renderedAt: new Date(),
        renderStatus: "ready",
        updatedAt: new Date(),
      })
      .where(eq(creditNotes.id, creditNote.id));
  }

  const [emailClaim, whatsappClaim] = await Promise.all([
    claimCreditNoteDeliveryAttempt({
      channel: "email",
      creditNoteId: creditNote.id,
    }),
    claimCreditNoteDeliveryAttempt({
      channel: "whatsapp",
      creditNoteId: creditNote.id,
    }),
  ]);

  if (emailClaim || whatsappClaim) {
    const access = await createCreditNoteAccessToken(creditNote.id);
    const secureDownloadUrl = new URL(
      `/api/credit-notes/${creditNote.id}/pdf`,
      env.APP_URL,
    );
    secureDownloadUrl.searchParams.set("token", access.token);

    const delivery = await deliverCreditNote(
      {
        creditedTotalCents: moneyToCents(creditNote.totalIncludingTax),
        creditNoteNumber: creditNote.creditNoteNumber,
        customerEmail: creditNote.customerEmail,
        customerName: creditNote.customerName,
        customerPhone: creditNote.customerPhone,
        customerUserId: creditNote.customerUserId,
        orderNumber: creditNote.orderNumber,
        originalInvoiceNumber: creditNote.invoiceNumber,
        pdfBuffer,
        reason: creditNote.reason,
        secureDownloadUrl: secureDownloadUrl.toString(),
      },
      {
        channels: {
          email: Boolean(emailClaim),
          whatsapp: Boolean(whatsappClaim),
        },
      },
    );

    const results: CreditNoteDeliveryChannelResult[] = [];

    if (emailClaim) {
      const result = delivery.email ?? missingDeliveryResult(emailClaim);
      results.push(result);
      await finalizeCreditNoteDeliveryAttempt({ claim: emailClaim, result });
    }

    if (whatsappClaim) {
      const result =
        delivery.whatsapp ?? missingDeliveryResult(whatsappClaim);
      results.push(result);
      await finalizeCreditNoteDeliveryAttempt({
        claim: whatsappClaim,
        result,
      });
    }

    const failures = results.filter((result) => result.status === "failed");

    if (failures.length > 0) {
      throw new Error(
        failures
          .map((result) => (result.status === "failed" ? result.reason : null))
          .filter((reason): reason is string => Boolean(reason))
          .join("; ") || "Credit-note delivery failed.",
      );
    }
  }

  const deliveryStates = await getCreditNoteDeliveryAttemptStates(
    creditNote.id,
  );
  const retryableState = deliveryStates.find(
    ({ status }) => status === "pending" || status === "failed",
  );

  if (retryableState) {
    throw new Error(
      `Credit-note ${retryableState.channel} delivery is waiting to retry.`,
    );
  }

  await completeCreditNoteJob(job.id);
}

export async function processCreditNotePipeline() {
  await releaseStaleCreditNoteDeliveryAttempts();
  await releaseStaleCreditNoteJobs();
  let processed = 0;

  while (processed < MAX_JOBS_PER_PASS) {
    const job = await claimNextCreditNoteJob();

    if (!job) {
      break;
    }

    try {
      await processClaimedCreditNoteJob(job);
    } catch (error) {
      await failCreditNoteJob({
        attempts: job.attempts,
        creditNoteId: job.creditNoteId,
        error,
        jobId: job.id,
      });
    }

    processed += 1;
  }

  return processed;
}
