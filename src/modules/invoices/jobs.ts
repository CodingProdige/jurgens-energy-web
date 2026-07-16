import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { env } from "@/src/config/env";
import { invoiceJobs, invoices, orders } from "@/src/db/schema";
import { createInvoiceAccessToken } from "@/src/modules/invoices/access";
import { deliverInvoice } from "@/src/modules/invoices/delivery";
import {
  ensureInvoiceForPaidOrder,
  ensureMissingPaidInvoices,
  getInvoiceDocumentData,
} from "@/src/modules/invoices/service";
import {
  readStoredInvoicePdf,
  renderAndStoreInvoicePdf,
} from "@/src/modules/invoices/storage";

const MAX_JOBS_PER_PASS = 10;

function moneyToCents(value: string | number) {
  return Math.round(Number(value) * 100);
}

function retryDelay(attempts: number) {
  const minutes = Math.min(6 * 60, 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + minutes * 60_000);
}

async function claimNextInvoiceJob() {
  const rows = await db.execute<{
    attempts: number;
    id: string;
    invoice_id: string;
    job_type: "deliver" | "render_and_deliver";
  }>(sql`
    WITH candidate AS (
      SELECT id
      FROM invoice_jobs
      WHERE status IN ('pending', 'failed')
        AND available_at <= now()
      ORDER BY available_at ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE invoice_jobs AS job
    SET status = 'processing',
        attempts = job.attempts + 1,
        locked_at = now(),
        last_error = NULL,
        updated_at = now()
    FROM candidate
    WHERE job.id = candidate.id
    RETURNING job.id, job.invoice_id, job.job_type, job.attempts
  `);

  const job = rows[0];

  return job
    ? {
        attempts: job.attempts,
        id: job.id,
        invoiceId: job.invoice_id,
        jobType: job.job_type,
      }
    : null;
}

async function releaseStaleInvoiceJobs() {
  await db.execute(sql`
    UPDATE invoice_jobs
    SET status = 'failed',
        available_at = now(),
        locked_at = NULL,
        last_error = 'Recovered after an interrupted invoice worker.',
        updated_at = now()
    WHERE status = 'processing'
      AND locked_at < now() - interval '15 minutes'
  `);
}

async function completeInvoiceJob(jobId: string) {
  await db
    .update(invoiceJobs)
    .set({
      completedAt: new Date(),
      lastError: null,
      lockedAt: null,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(invoiceJobs.id, jobId));
}

async function failInvoiceJob({
  attempts,
  error,
  invoiceId,
  jobId,
}: {
  attempts: number;
  error: unknown;
  invoiceId: string;
  jobId: string;
}) {
  const message =
    error instanceof Error ? error.message.slice(0, 2_000) : "Invoice job failed.";
  const now = new Date();

  await Promise.all([
    db
      .update(invoiceJobs)
      .set({
        availableAt: retryDelay(attempts),
        lastError: message,
        lockedAt: null,
        status: "failed",
        updatedAt: now,
      })
      .where(eq(invoiceJobs.id, jobId)),
    db
      .update(invoices)
      .set({
        renderError: message,
        renderStatus: "failed",
        updatedAt: now,
      })
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.renderStatus, "pending"),
        ),
      ),
  ]);
}

async function processClaimedInvoiceJob(job: {
  attempts: number;
  id: string;
  invoiceId: string;
}) {
  const [invoice] = await db
    .select({
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      customerUserId: orders.userId,
      emailSentAt: invoices.emailSentAt,
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      orderNumber: orders.orderNumber,
      pdfRelativePath: invoices.pdfRelativePath,
      pdfSha256: invoices.pdfSha256,
      renderStatus: invoices.renderStatus,
      totalIncludingTax: invoices.totalIncludingTax,
      whatsappSentAt: invoices.whatsappSentAt,
    })
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .where(eq(invoices.id, job.invoiceId))
    .limit(1);

  if (!invoice) {
    await completeInvoiceJob(job.id);
    return;
  }

  let pdfBuffer: Buffer;

  if (
    invoice.renderStatus === "ready" &&
    invoice.pdfRelativePath &&
    invoice.pdfSha256
  ) {
    pdfBuffer = await readStoredInvoicePdf(
      invoice.pdfRelativePath,
      invoice.pdfSha256,
    );
  } else {
    const documentData = await getInvoiceDocumentData(invoice.id);
    const stored = await renderAndStoreInvoicePdf(documentData);
    pdfBuffer = await readStoredInvoicePdf(stored.relativePath, stored.sha256);

    await db
      .update(invoices)
      .set({
        pdfRelativePath: stored.relativePath,
        pdfSha256: stored.sha256,
        renderError: null,
        renderedAt: new Date(),
        renderStatus: "ready",
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id));
  }

  const sendEmail = !invoice.emailSentAt;
  const sendWhatsapp = !invoice.whatsappSentAt;

  if (sendEmail || sendWhatsapp) {
    const access = await createInvoiceAccessToken(invoice.id);
    const secureDownloadUrl = new URL(
      `/api/invoices/${invoice.id}/pdf`,
      env.APP_URL,
    );
    secureDownloadUrl.searchParams.set("token", access.token);

    const delivery = await deliverInvoice(
      {
        customerEmail: invoice.customerEmail,
        customerName: invoice.customerName,
        customerPhone: invoice.customerPhone,
        customerUserId: invoice.customerUserId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceTotalCents: moneyToCents(invoice.totalIncludingTax),
        orderNumber: invoice.orderNumber,
        pdfBuffer,
        secureDownloadUrl: secureDownloadUrl.toString(),
      },
      { email: sendEmail, whatsapp: sendWhatsapp },
    );

    const channelUpdates: {
      emailSentAt?: Date;
      whatsappSentAt?: Date;
    } = {};
    const deliveredAt = new Date();

    if (delivery.email?.status === "sent") {
      channelUpdates.emailSentAt = deliveredAt;
    }

    if (delivery.whatsapp?.status === "sent") {
      channelUpdates.whatsappSentAt = deliveredAt;
    }

    if (Object.keys(channelUpdates).length > 0) {
      await db
        .update(invoices)
        .set({ ...channelUpdates, updatedAt: deliveredAt })
        .where(eq(invoices.id, invoice.id));
    }

    const failedChannels = [delivery.email, delivery.whatsapp].filter(
      (result) => result?.status === "failed",
    );

    if (failedChannels.length > 0) {
      throw new Error(
        `Invoice delivery failed: ${failedChannels
          .map((result) => (result?.status === "failed" ? result.reason : ""))
          .filter(Boolean)
          .join(", ")}`,
      );
    }
  }

  await completeInvoiceJob(job.id);
}

export async function processInvoiceJobs(limit = MAX_JOBS_PER_PASS) {
  await releaseStaleInvoiceJobs();
  let processed = 0;

  while (processed < Math.max(1, Math.min(limit, 50))) {
    const job = await claimNextInvoiceJob();

    if (!job) {
      break;
    }

    try {
      await processClaimedInvoiceJob(job);
    } catch (error) {
      await failInvoiceJob({
        attempts: job.attempts,
        error,
        invoiceId: job.invoiceId,
        jobId: job.id,
      });
    }

    processed += 1;
  }

  return processed;
}

export async function processInvoiceForPaidOrder(orderId: string) {
  const issuance = await ensureInvoiceForPaidOrder(orderId);

  if ("invoiceId" in issuance) {
    await processInvoiceJobs(MAX_JOBS_PER_PASS);
  }

  return issuance;
}

export async function processInvoicePipeline() {
  await ensureMissingPaidInvoices(MAX_JOBS_PER_PASS);
  return processInvoiceJobs(MAX_JOBS_PER_PASS);
}
