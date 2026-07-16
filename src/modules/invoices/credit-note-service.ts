import "server-only";

import { asc, eq } from "drizzle-orm";

import { env } from "@/src/config/env";
import { db } from "@/src/db";
import {
  creditNoteLines,
  creditNotes,
  invoices,
  orders,
  paymentRefunds,
} from "@/src/db/schema";
import type {
  InvoiceAddressSnapshot,
  InvoiceCustomerSnapshot,
  InvoiceIssuerSnapshot,
} from "@/src/db/schema/invoices";
import {
  parseCreditNoteDocumentData,
  type CreditNoteDocumentData,
} from "@/src/modules/invoices/credit-note-document-data";

function moneyToCents(value: string | number) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new Error("Credit-note source contains an invalid money amount.");
  }

  return Math.round(amount * 100);
}

function countryName(countryCode: string) {
  return countryCode.toUpperCase() === "ZA" ? "South Africa" : countryCode;
}

function toDocumentAddress(address: InvoiceAddressSnapshot) {
  return {
    city: address.city,
    countryCode: address.countryCode,
    countryName: countryName(address.countryCode),
    line1: address.addressLine1,
    line2: address.addressLine2 ?? undefined,
    postalCode: address.postalCode,
    province: address.province,
    suburb: address.suburb ?? undefined,
  };
}

function toDocumentIssuer(issuer: InvoiceIssuerSnapshot) {
  return {
    address: toDocumentAddress(issuer),
    email: issuer.email,
    legalName: issuer.legalName,
    phone: issuer.phone,
    registrationNumber: issuer.companyRegistrationNumber ?? undefined,
    tradingName: issuer.tradingName,
    vatNumber: issuer.vatRegistrationNumber,
    website: env.APP_URL,
  };
}

function toDocumentCustomer(customer: InvoiceCustomerSnapshot) {
  return {
    billingAddress: toDocumentAddress(customer),
    companyName: customer.businessName ?? undefined,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    vatNumber: customer.vatRegistrationNumber ?? undefined,
  };
}

export async function getCreditNoteDocumentData(
  creditNoteId: string,
): Promise<CreditNoteDocumentData> {
  const [record] = await db
    .select({
      creditNoteNumber: creditNotes.creditNoteNumber,
      customerSnapshot: invoices.customerSnapshot,
      invoiceIssuedAt: invoices.issuedAt,
      invoiceNumber: invoices.invoiceNumber,
      invoiceTotal: invoices.totalIncludingTax,
      issuedAt: creditNotes.issuedAt,
      issuerSnapshot: invoices.issuerSnapshot,
      orderNumber: orders.orderNumber,
      reason: creditNotes.reason,
      refundAmount: paymentRefunds.amount,
      refundCompletedAt: paymentRefunds.completedAt,
      refundId: paymentRefunds.id,
      refundProvider: paymentRefunds.provider,
      subtotalExcludingTax: creditNotes.subtotalExcludingTax,
      taxTotal: creditNotes.taxTotal,
      totalIncludingTax: creditNotes.totalIncludingTax,
    })
    .from(creditNotes)
    .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .leftJoin(paymentRefunds, eq(paymentRefunds.creditNoteId, creditNotes.id))
    .where(eq(creditNotes.id, creditNoteId))
    .limit(1);

  if (!record) {
    throw new Error("Credit note not found.");
  }

  const lines = await db
    .select({
      description: creditNoteLines.description,
      lineTotalExcludingTax: creditNoteLines.lineTotalExcludingTax,
      lineTotalIncludingTax: creditNoteLines.lineTotalIncludingTax,
      quantity: creditNoteLines.quantity,
      sku: creditNoteLines.sku,
      taxAmount: creditNoteLines.taxAmount,
      taxRateBps: creditNoteLines.taxRateBps,
      unitPriceIncludingTax: creditNoteLines.unitPriceIncludingTax,
    })
    .from(creditNoteLines)
    .where(eq(creditNoteLines.creditNoteId, creditNoteId))
    .orderBy(asc(creditNoteLines.position));

  if (lines.length === 0) {
    throw new Error("A credit note cannot be rendered without credited lines.");
  }

  const refund =
    record.refundId && record.refundCompletedAt && record.refundAmount
      ? {
          amountCents: moneyToCents(record.refundAmount),
          processedAt: record.refundCompletedAt.toISOString(),
          provider:
            record.refundProvider?.toLowerCase() === "payfast"
              ? "PayFast"
              : (record.refundProvider ?? "Payment provider"),
          transactionReference: record.refundId,
        }
      : undefined;

  return parseCreditNoteDocumentData({
    creditNoteNumber: record.creditNoteNumber,
    currency: "ZAR",
    customer: toDocumentCustomer(record.customerSnapshot),
    issuedAt: record.issuedAt.toISOString(),
    issuer: toDocumentIssuer(record.issuerSnapshot),
    lines: lines.map((line) => ({
      description: line.description,
      grossAmountCents: moneyToCents(line.lineTotalIncludingTax),
      netAmountCents: moneyToCents(line.lineTotalExcludingTax),
      quantity: Number(line.quantity),
      sku: line.sku ?? undefined,
      unitPriceGrossCents: moneyToCents(line.unitPriceIncludingTax),
      vatAmountCents: moneyToCents(line.taxAmount),
      vatRateBasisPoints: line.taxRateBps,
    })),
    notes: [
      "All credited amounts are VAT inclusive.",
      "This document adjusts the original tax invoice; it does not replace it.",
    ],
    orderNumber: record.orderNumber,
    originalInvoice: {
      grossAmountCents: moneyToCents(record.invoiceTotal),
      invoiceNumber: record.invoiceNumber,
      issuedAt: record.invoiceIssuedAt.toISOString(),
    },
    reason: record.reason,
    refund,
    totals: {
      grossAmountCents: moneyToCents(record.totalIncludingTax),
      netAmountCents: moneyToCents(record.subtotalExcludingTax),
      vatAmountCents: moneyToCents(record.taxTotal),
    },
  });
}
