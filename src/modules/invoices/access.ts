import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  invoiceAccessTokens,
  invoices,
  orders,
} from "@/src/db/schema";
import { readStoredInvoicePdf } from "@/src/modules/invoices/storage";

const invoiceIdSchema = z.string().uuid();
const invoiceAccessTokenSchema = z
  .string()
  .min(32)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);

export type InvoiceListRow = {
  currency: string;
  customerEmail: string;
  customerName: string;
  emailSentAt: Date | null;
  id: string;
  invoiceNumber: string;
  issuedAt: Date;
  orderId: string;
  orderNumber: string;
  renderStatus: "failed" | "pending" | "ready";
  status: "credited" | "issued" | "partially_credited";
  totalIncludingTax: number;
  whatsappSentAt: Date | null;
};

function toMoney(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function toInvoiceListRow(row: {
  currency: string;
  customerEmail: string;
  customerName: string;
  emailSentAt: Date | null;
  id: string;
  invoiceNumber: string;
  issuedAt: Date;
  orderId: string;
  orderNumber: string;
  renderStatus: "failed" | "pending" | "ready";
  status: "credited" | "issued" | "partially_credited";
  totalIncludingTax: string;
  whatsappSentAt: Date | null;
}): InvoiceListRow {
  return {
    ...row,
    totalIncludingTax: toMoney(row.totalIncludingTax),
  };
}

const invoiceListSelection = {
  currency: invoices.currency,
  customerEmail: orders.customerEmail,
  customerName: orders.customerName,
  emailSentAt: invoices.emailSentAt,
  id: invoices.id,
  invoiceNumber: invoices.invoiceNumber,
  issuedAt: invoices.issuedAt,
  orderId: orders.id,
  orderNumber: orders.orderNumber,
  renderStatus: invoices.renderStatus,
  status: invoices.status,
  totalIncludingTax: invoices.totalIncludingTax,
  whatsappSentAt: invoices.whatsappSentAt,
};

export async function listCustomerInvoices(
  userId: string,
): Promise<InvoiceListRow[]> {
  const parsedUserId = z.string().uuid().safeParse(userId);

  if (!parsedUserId.success) {
    return [];
  }

  const rows = await db
    .select(invoiceListSelection)
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .where(eq(orders.userId, parsedUserId.data))
    .orderBy(desc(invoices.issuedAt));

  return rows.map(toInvoiceListRow);
}

export async function listAdminInvoices(): Promise<InvoiceListRow[]> {
  const rows = await db
    .select(invoiceListSelection)
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .orderBy(desc(invoices.issuedAt));

  return rows.map(toInvoiceListRow);
}

export function hashInvoiceAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createInvoiceAccessToken(
  invoiceId: string,
  { validForDays = 30 }: { validForDays?: number } = {},
) {
  const parsedInvoiceId = invoiceIdSchema.parse(invoiceId);
  const normalizedDays = Math.max(1, Math.min(Math.trunc(validForDays), 365));
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + normalizedDays * 24 * 60 * 60 * 1_000,
  );

  await db.insert(invoiceAccessTokens).values({
    expiresAt,
    invoiceId: parsedInvoiceId,
    tokenHash: hashInvoiceAccessToken(token),
  });

  return { expiresAt, token };
}

export async function hasValidInvoiceAccessToken({
  invoiceId,
  token,
}: {
  invoiceId: string;
  token: string;
}) {
  const parsed = z
    .object({
      invoiceId: invoiceIdSchema,
      token: invoiceAccessTokenSchema,
    })
    .safeParse({ invoiceId, token });

  if (!parsed.success) {
    return false;
  }

  const tokenRows = await db
    .select({ tokenHash: invoiceAccessTokens.tokenHash })
    .from(invoiceAccessTokens)
    .where(
      and(
        eq(invoiceAccessTokens.invoiceId, parsed.data.invoiceId),
        isNull(invoiceAccessTokens.revokedAt),
        gt(invoiceAccessTokens.expiresAt, new Date()),
      ),
    );
  const presentedHash = Buffer.from(
    hashInvoiceAccessToken(parsed.data.token),
    "hex",
  );

  return tokenRows.some(({ tokenHash }) => {
    if (!/^[a-f0-9]{64}$/i.test(tokenHash)) {
      return false;
    }

    const storedHash = Buffer.from(tokenHash, "hex");

    return (
      storedHash.length === presentedHash.length &&
      timingSafeEqual(storedHash, presentedHash)
    );
  });
}

export async function getInvoicePdfAccessRecord(invoiceId: string) {
  const parsedInvoiceId = invoiceIdSchema.safeParse(invoiceId);

  if (!parsedInvoiceId.success) {
    return null;
  }

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      orderId: orders.id,
      ownerUserId: orders.userId,
      pdfRelativePath: invoices.pdfRelativePath,
      pdfSha256: invoices.pdfSha256,
      renderStatus: invoices.renderStatus,
    })
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .where(eq(invoices.id, parsedInvoiceId.data))
    .limit(1);

  return invoice ?? null;
}

export async function readReadyInvoicePdf(invoice: {
  pdfRelativePath: string | null;
  pdfSha256: string | null;
  renderStatus: "failed" | "pending" | "ready";
}) {
  if (
    invoice.renderStatus !== "ready" ||
    !invoice.pdfRelativePath ||
    !invoice.pdfSha256
  ) {
    return null;
  }

  return readStoredInvoicePdf(invoice.pdfRelativePath, invoice.pdfSha256);
}
