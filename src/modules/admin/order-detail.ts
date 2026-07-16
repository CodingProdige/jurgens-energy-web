import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  creditNoteLines,
  creditNotes,
  invoiceLines,
  invoices,
  orderItems,
  orders,
  paymentRefundAllocations,
  paymentRefunds,
  payments,
  shipments,
} from "@/src/db/schema";

const orderIdSchema = z.string().uuid();

function toMoney(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

export type AdminOrderDetail = {
  createdAt: Date;
  currency: string;
  customer: {
    email: string;
    name: string;
    phone: string;
  };
  deliveryAddress: {
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    countryCode: string;
    postalCode: string;
    province: string;
    suburb: string;
  };
  grandTotal: number;
  id: string;
  invoice: {
    creditNotes: Array<{
      creditNoteNumber: string;
      emailDeliveryStatus:
        | "failed"
        | "pending"
        | "sent"
        | "skipped"
        | "verification_required";
      id: string;
      issuedAt: Date;
      reason: string;
      renderStatus: "failed" | "pending" | "ready";
      totalIncludingTax: number;
      whatsappDeliveryStatus:
        | "failed"
        | "pending"
        | "sent"
        | "skipped"
        | "verification_required";
    }>;
    id: string;
    invoiceNumber: string;
    issuedAt: Date;
    lines: Array<{
      description: string;
      creditedQuantity: number;
      creditedTotalIncludingTax: number;
      id: string;
      kind: string;
      lineTotalIncludingTax: number;
      quantity: number;
      remainingQuantity: number;
      remainingTotalIncludingTax: number;
      sku: string | null;
      taxAmount: number;
      taxRateBps: number;
      unitPriceIncludingTax: number;
    }>;
    status: "credited" | "issued" | "partially_credited";
    totalIncludingTax: number;
  } | null;
  items: Array<{
    id: string;
    lineTotal: number;
    quantity: number;
    title: string;
    unitPrice: number;
  }>;
  orderNumber: string;
  paidAt: Date | null;
  payments: Array<{
    amount: number;
    completedAt: Date | null;
    createdAt: Date;
    id: string;
    provider: string;
    providerPaymentId: string | null;
    providerStatus: string | null;
    status: string;
  }>;
  refunds: Array<{
    amount: number;
    completedAt: Date | null;
    createdAt: Date;
    creditNoteId: string | null;
    errorMessage: string | null;
    id: string;
    manualActionReason: string | null;
    providerStatus: string | null;
    reason: string;
    refundKind: "full" | "partial";
    refundMethod:
      | "bank_payout"
      | "not_available"
      | "payment_source"
      | "unknown";
    status:
      | "completed"
      | "failed"
      | "manual_required"
      | "pending"
      | "submitted"
      | "verification_required";
    submittedAt: Date | null;
  }>;
  shipments: Array<{
    id: string;
    provider: string;
    status: string;
    trackingNumber: string | null;
    waybillNumber: string | null;
  }>;
  shippingTotal: number;
  status: "cancelled" | "fulfilled" | "paid" | "pending" | "refunded";
  subtotal: number;
};

export async function getAdminOrderDetail(
  orderId: string,
): Promise<AdminOrderDetail | null> {
  const parsedOrderId = orderIdSchema.safeParse(orderId);

  if (!parsedOrderId.success) {
    return null;
  }

  const [order] = await db
    .select({
      createdAt: orders.createdAt,
      currency: orders.currency,
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      deliveryAddress: orders.deliveryAddressSnapshot,
      grandTotal: orders.grandTotal,
      id: orders.id,
      orderNumber: orders.orderNumber,
      paidAt: orders.paidAt,
      shippingTotal: orders.shippingTotal,
      status: orders.status,
      subtotal: orders.subtotal,
    })
    .from(orders)
    .where(eq(orders.id, parsedOrderId.data))
    .limit(1);

  if (!order) {
    return null;
  }

  const [refundRows, itemRows, paymentRows, shipmentRows, invoiceRows] =
    await Promise.all([
    db
      .select({
        amount: paymentRefunds.amount,
        completedAt: paymentRefunds.completedAt,
        createdAt: paymentRefunds.createdAt,
        creditNoteId: paymentRefunds.creditNoteId,
        errorMessage: paymentRefunds.errorMessage,
        id: paymentRefunds.id,
        manualActionReason: paymentRefunds.manualActionReason,
        providerStatus: paymentRefunds.providerStatus,
        reason: paymentRefunds.reason,
        refundKind: paymentRefunds.refundKind,
        refundMethod: paymentRefunds.refundMethod,
        status: paymentRefunds.status,
        submittedAt: paymentRefunds.submittedAt,
      })
      .from(paymentRefunds)
      .where(eq(paymentRefunds.orderId, order.id))
      .orderBy(desc(paymentRefunds.createdAt)),
    db
      .select({
        id: orderItems.id,
        quantity: orderItems.quantity,
        title: orderItems.title,
        unitPrice: orderItems.unitPrice,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id)),
    db
      .select({
        amount: payments.amount,
        completedAt: payments.completedAt,
        createdAt: payments.createdAt,
        id: payments.id,
        provider: payments.provider,
        providerPaymentId: payments.providerPaymentId,
        providerStatus: payments.providerStatus,
        status: payments.status,
      })
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(desc(payments.createdAt)),
    db
      .select({
        id: shipments.id,
        provider: shipments.provider,
        status: shipments.status,
        trackingNumber: shipments.trackingNumber,
        waybillNumber: shipments.waybillNumber,
      })
      .from(shipments)
      .where(eq(shipments.orderId, order.id))
      .orderBy(desc(shipments.createdAt)),
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        issuedAt: invoices.issuedAt,
        status: invoices.status,
        totalIncludingTax: invoices.totalIncludingTax,
      })
      .from(invoices)
      .where(eq(invoices.orderId, order.id))
      .limit(1),
    ]);
  const invoice = invoiceRows[0] ?? null;
  const [
    invoiceLineRows,
    creditedLineRows,
    reservedLineRows,
    creditNoteRows,
  ] = invoice
    ? await Promise.all([
        db
          .select({
            description: invoiceLines.description,
            id: invoiceLines.id,
            kind: invoiceLines.kind,
            lineTotalIncludingTax: invoiceLines.lineTotalIncludingTax,
            quantity: invoiceLines.quantity,
            sku: invoiceLines.sku,
            taxAmount: invoiceLines.taxAmount,
            taxRateBps: invoiceLines.taxRateBps,
            unitPriceIncludingTax: invoiceLines.unitPriceIncludingTax,
          })
          .from(invoiceLines)
          .where(eq(invoiceLines.invoiceId, invoice.id))
          .orderBy(asc(invoiceLines.position)),
        db
          .select({
            grossAmount: sql<string>`coalesce(sum(${creditNoteLines.lineTotalIncludingTax}), 0)`,
            invoiceLineId: creditNoteLines.invoiceLineId,
            quantity: sql<string>`coalesce(sum(${creditNoteLines.quantity}), 0)`,
          })
          .from(creditNoteLines)
          .innerJoin(
            creditNotes,
            eq(creditNotes.id, creditNoteLines.creditNoteId),
          )
          .where(eq(creditNotes.invoiceId, invoice.id))
          .groupBy(creditNoteLines.invoiceLineId),
        db
          .select({
            grossAmount: sql<string>`coalesce(sum(${paymentRefundAllocations.grossAmount}), 0)`,
            invoiceLineId: paymentRefundAllocations.invoiceLineId,
            quantity: sql<string>`coalesce(sum(${paymentRefundAllocations.quantity}), 0)`,
          })
          .from(paymentRefundAllocations)
          .innerJoin(
            paymentRefunds,
            eq(paymentRefunds.id, paymentRefundAllocations.refundId),
          )
          .where(
            and(
              eq(paymentRefunds.invoiceId, invoice.id),
              inArray(paymentRefunds.status, [
                "pending",
                "manual_required",
                "submitted",
                "verification_required",
                "completed",
              ]),
            ),
          )
          .groupBy(paymentRefundAllocations.invoiceLineId),
        db
          .select({
            creditNoteNumber: creditNotes.creditNoteNumber,
            emailDeliveryStatus: creditNotes.emailDeliveryStatus,
            id: creditNotes.id,
            issuedAt: creditNotes.issuedAt,
            reason: creditNotes.reason,
            renderStatus: creditNotes.renderStatus,
            totalIncludingTax: creditNotes.totalIncludingTax,
            whatsappDeliveryStatus: creditNotes.whatsappDeliveryStatus,
          })
          .from(creditNotes)
          .where(eq(creditNotes.invoiceId, invoice.id))
          .orderBy(desc(creditNotes.issuedAt)),
      ])
    : [[], [], [], []];
  const creditedByInvoiceLine = new Map(
    creditedLineRows.map((line) => [
      line.invoiceLineId,
      {
        quantity: Number(line.quantity),
        totalIncludingTax: toMoney(line.grossAmount),
      },
    ]),
  );
  const reservedByInvoiceLine = new Map(
    reservedLineRows.map((line) => [
      line.invoiceLineId,
      {
        quantity: Number(line.quantity),
        totalIncludingTax: toMoney(line.grossAmount),
      },
    ]),
  );

  return {
    createdAt: order.createdAt,
    currency: order.currency,
    customer: {
      email: order.customerEmail,
      name: order.customerName,
      phone: order.customerPhone,
    },
    deliveryAddress: order.deliveryAddress,
    grandTotal: toMoney(order.grandTotal),
    id: order.id,
    invoice: invoice
      ? {
          creditNotes: creditNoteRows.map((creditNote) => ({
            ...creditNote,
            totalIncludingTax: toMoney(creditNote.totalIncludingTax),
          })),
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          issuedAt: invoice.issuedAt,
          lines: invoiceLineRows.map((line) => ({
            ...line,
            creditedQuantity:
              creditedByInvoiceLine.get(line.id)?.quantity ?? 0,
            creditedTotalIncludingTax:
              creditedByInvoiceLine.get(line.id)?.totalIncludingTax ?? 0,
            lineTotalIncludingTax: toMoney(line.lineTotalIncludingTax),
            quantity: Number(line.quantity),
            remainingQuantity: Math.max(
              0,
              Number(line.quantity) -
                (reservedByInvoiceLine.get(line.id)?.quantity ?? 0),
            ),
            remainingTotalIncludingTax: Math.max(
              0,
              toMoney(line.lineTotalIncludingTax) -
                (reservedByInvoiceLine.get(line.id)?.totalIncludingTax ?? 0),
            ),
            taxAmount: toMoney(line.taxAmount),
            unitPriceIncludingTax: toMoney(line.unitPriceIncludingTax),
          })),
          status: invoice.status,
          totalIncludingTax: toMoney(invoice.totalIncludingTax),
        }
      : null,
    items: itemRows.map((item) => ({
      ...item,
      lineTotal: toMoney(item.unitPrice) * item.quantity,
      unitPrice: toMoney(item.unitPrice),
    })),
    orderNumber: order.orderNumber,
    paidAt: order.paidAt,
    payments: paymentRows.map((payment) => ({
      ...payment,
      amount: toMoney(payment.amount),
    })),
    refunds: refundRows.map((refund) => ({
      ...refund,
      amount: toMoney(refund.amount),
    })),
    shipments: shipmentRows,
    shippingTotal: toMoney(order.shippingTotal),
    status: order.status,
    subtotal: toMoney(order.subtotal),
  };
}
