import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  creditNoteAccessTokens,
  creditNotes,
  invoices,
  orders,
} from "@/src/db/schema";
import { readStoredCreditNotePdf } from "@/src/modules/invoices/credit-note-storage";

const creditNoteIdSchema = z.string().uuid();
const creditNoteAccessTokenSchema = z
  .string()
  .min(32)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);

export type CreditNoteListRow = {
  creditNoteNumber: string;
  currency: string;
  customerEmail: string;
  customerName: string;
  emailDeliveryStatus:
    | "failed"
    | "pending"
    | "sent"
    | "skipped"
    | "verification_required";
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  issuedAt: Date;
  orderId: string;
  orderNumber: string;
  reason: string;
  renderStatus: "failed" | "pending" | "ready";
  totalIncludingTax: number;
  whatsappDeliveryStatus:
    | "failed"
    | "pending"
    | "sent"
    | "skipped"
    | "verification_required";
};

function toMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

const creditNoteListSelection = {
  creditNoteNumber: creditNotes.creditNoteNumber,
  currency: invoices.currency,
  customerEmail: orders.customerEmail,
  customerName: orders.customerName,
  emailDeliveryStatus: creditNotes.emailDeliveryStatus,
  id: creditNotes.id,
  invoiceId: invoices.id,
  invoiceNumber: invoices.invoiceNumber,
  issuedAt: creditNotes.issuedAt,
  orderId: orders.id,
  orderNumber: orders.orderNumber,
  reason: creditNotes.reason,
  renderStatus: creditNotes.renderStatus,
  totalIncludingTax: creditNotes.totalIncludingTax,
  whatsappDeliveryStatus: creditNotes.whatsappDeliveryStatus,
};

function toCreditNoteListRow(
  row: Omit<CreditNoteListRow, "totalIncludingTax"> & {
    totalIncludingTax: string;
  },
): CreditNoteListRow {
  return {
    ...row,
    totalIncludingTax: toMoney(row.totalIncludingTax),
  };
}

export async function listCustomerCreditNotes(
  userId: string,
): Promise<CreditNoteListRow[]> {
  const parsedUserId = z.string().uuid().safeParse(userId);

  if (!parsedUserId.success) {
    return [];
  }

  const rows = await db
    .select(creditNoteListSelection)
    .from(creditNotes)
    .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .where(eq(orders.userId, parsedUserId.data))
    .orderBy(desc(creditNotes.issuedAt));

  return rows.map(toCreditNoteListRow);
}

export async function listCreditNotesForInvoices(invoiceIds: string[]) {
  const parsedInvoiceIds = z.array(z.string().uuid()).safeParse(invoiceIds);

  if (!parsedInvoiceIds.success || parsedInvoiceIds.data.length === 0) {
    return [];
  }

  const rows = await db
    .select(creditNoteListSelection)
    .from(creditNotes)
    .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .where(inArray(invoices.id, parsedInvoiceIds.data))
    .orderBy(desc(creditNotes.issuedAt));

  return rows.map(toCreditNoteListRow);
}

export function hashCreditNoteAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createCreditNoteAccessToken(
  creditNoteId: string,
  { validForDays = 30 }: { validForDays?: number } = {},
) {
  const parsedCreditNoteId = creditNoteIdSchema.parse(creditNoteId);
  const normalizedDays = Math.max(1, Math.min(Math.trunc(validForDays), 365));
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + normalizedDays * 24 * 60 * 60 * 1_000,
  );

  await db.insert(creditNoteAccessTokens).values({
    creditNoteId: parsedCreditNoteId,
    expiresAt,
    tokenHash: hashCreditNoteAccessToken(token),
  });

  return { expiresAt, token };
}

export async function hasValidCreditNoteAccessToken({
  creditNoteId,
  token,
}: {
  creditNoteId: string;
  token: string;
}) {
  const parsed = z
    .object({
      creditNoteId: creditNoteIdSchema,
      token: creditNoteAccessTokenSchema,
    })
    .safeParse({ creditNoteId, token });

  if (!parsed.success) {
    return false;
  }

  const tokenRows = await db
    .select({ tokenHash: creditNoteAccessTokens.tokenHash })
    .from(creditNoteAccessTokens)
    .where(
      and(
        eq(creditNoteAccessTokens.creditNoteId, parsed.data.creditNoteId),
        isNull(creditNoteAccessTokens.revokedAt),
        gt(creditNoteAccessTokens.expiresAt, new Date()),
      ),
    );
  const presentedHash = Buffer.from(
    hashCreditNoteAccessToken(parsed.data.token),
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

export async function getCreditNotePdfAccessRecord(creditNoteId: string) {
  const parsedCreditNoteId = creditNoteIdSchema.safeParse(creditNoteId);

  if (!parsedCreditNoteId.success) {
    return null;
  }

  const [creditNote] = await db
    .select({
      creditNoteNumber: creditNotes.creditNoteNumber,
      id: creditNotes.id,
      orderId: orders.id,
      ownerUserId: orders.userId,
      pdfRelativePath: creditNotes.pdfRelativePath,
      pdfSha256: creditNotes.pdfSha256,
      renderStatus: creditNotes.renderStatus,
    })
    .from(creditNotes)
    .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .where(eq(creditNotes.id, parsedCreditNoteId.data))
    .limit(1);

  return creditNote ?? null;
}

export async function readReadyCreditNotePdf(creditNote: {
  pdfRelativePath: string | null;
  pdfSha256: string | null;
  renderStatus: "failed" | "pending" | "ready";
}) {
  if (
    creditNote.renderStatus !== "ready" ||
    !creditNote.pdfRelativePath ||
    !creditNote.pdfSha256
  ) {
    return null;
  }

  return readStoredCreditNotePdf(
    creditNote.pdfRelativePath,
    creditNote.pdfSha256,
  );
}
