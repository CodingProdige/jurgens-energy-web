import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  creditNoteLines,
  creditNotes,
  invoiceLines,
  invoices,
  notificationDeliveries,
  notificationDispatchClaims,
  orderItems,
  orders,
  paymentReconciliationExceptions,
  paymentRefundAllocations,
  paymentRefunds,
  payments,
  refundShipmentCancellationJobs,
  shipments,
} from "@/src/db/schema";
import type { CampaignAttributionSnapshot } from "@/src/modules/marketing/campaign-attribution";

const orderIdSchema = z.string().uuid();

function toMoney(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

export type AdminOrderDetail = {
  automation: {
    notificationClaims: Array<{
      attempts: number;
      completedAt: Date | null;
      createdAt: Date;
      eventKey: string;
      id: string;
      lastError: string | null;
      status: string;
      updatedAt: Date;
    }>;
    notificationEmails: Array<{
      createdAt: Date;
      errorMessage: string | null;
      id: string;
      recipientEmail: string;
      sentAt: Date | null;
      status: string;
      templateKey: string;
    }>;
  };
  campaignAttribution: CampaignAttributionSnapshot | null;
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
    emailSentAt: Date | null;
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
    renderError: string | null;
    renderedAt: Date | null;
    renderStatus: "failed" | "pending" | "ready";
    status: "credited" | "issued" | "partially_credited";
    totalIncludingTax: number;
    whatsappSentAt: Date | null;
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
  reconciliationExceptions: Array<{
    detail: string;
    firstSeenAt: Date;
    id: string;
    lastSeenAt: Date;
    occurrences: number;
    providerPaymentId: string | null;
    reason:
      | "inventory_reservation_invalid"
      | "inventory_unavailable_after_expiry";
    receivedAmount: number;
    resolutionNote: string | null;
    resolvedAt: Date | null;
    status: "open" | "resolved";
  }>;
  refunds: Array<{
    amount: number;
    completedAt: Date | null;
    createdAt: Date;
    creditNoteId: string | null;
    cancelOpenShipments: boolean;
    errorMessage: string | null;
    fulfillmentActions: Array<{
      attempts: number;
      id: string;
      lastError: string | null;
      provider: string;
      shipmentId: string;
      shipmentStatus: string;
      status:
        | "completed"
        | "failed"
        | "manual_review"
        | "pending"
        | "processing";
      trackingReference: string | null;
    }>;
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
    requestedRestockQuantity: number;
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
    providerCostAmount: number | null;
    providerCostCurrency: string | null;
    providerEnvironment: "live" | "sandbox" | null;
    status: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    updatedAt: Date;
    waybillNumber: string | null;
    waybillUrl: string | null;
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
      campaignAttribution: orders.campaignAttributionSnapshot,
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

  const [
    refundRows,
    refundFulfillmentRows,
    itemRows,
    paymentRows,
    reconciliationExceptionRows,
    shipmentRows,
    invoiceRows,
    notificationClaimRows,
    notificationEmailRows,
  ] =
    await Promise.all([
    db
      .select({
        amount: paymentRefunds.amount,
        cancelOpenShipments: paymentRefunds.cancelOpenShipments,
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
        requestedRestockItems: paymentRefunds.requestedRestockItems,
        status: paymentRefunds.status,
        submittedAt: paymentRefunds.submittedAt,
      })
      .from(paymentRefunds)
      .where(eq(paymentRefunds.orderId, order.id))
      .orderBy(desc(paymentRefunds.createdAt)),
    db
      .select({
        attempts: refundShipmentCancellationJobs.attempts,
        id: refundShipmentCancellationJobs.id,
        lastError: refundShipmentCancellationJobs.lastError,
        provider: shipments.provider,
        refundId: refundShipmentCancellationJobs.refundId,
        shipmentId: shipments.id,
        shipmentStatus: shipments.status,
        status: refundShipmentCancellationJobs.status,
        trackingNumber: shipments.trackingNumber,
        waybillNumber: shipments.waybillNumber,
      })
      .from(refundShipmentCancellationJobs)
      .innerJoin(
        paymentRefunds,
        eq(paymentRefunds.id, refundShipmentCancellationJobs.refundId),
      )
      .innerJoin(
        shipments,
        eq(shipments.id, refundShipmentCancellationJobs.shipmentId),
      )
      .where(eq(paymentRefunds.orderId, order.id))
      .orderBy(desc(refundShipmentCancellationJobs.createdAt)),
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
        detail: paymentReconciliationExceptions.detail,
        firstSeenAt: paymentReconciliationExceptions.firstSeenAt,
        id: paymentReconciliationExceptions.id,
        lastSeenAt: paymentReconciliationExceptions.lastSeenAt,
        occurrences: paymentReconciliationExceptions.occurrences,
        providerPaymentId:
          paymentReconciliationExceptions.providerPaymentId,
        reason: paymentReconciliationExceptions.reason,
        receivedAmount:
          paymentReconciliationExceptions.receivedAmount,
        resolutionNote:
          paymentReconciliationExceptions.resolutionNote,
        resolvedAt: paymentReconciliationExceptions.resolvedAt,
        status: paymentReconciliationExceptions.status,
      })
      .from(paymentReconciliationExceptions)
      .where(eq(paymentReconciliationExceptions.orderId, order.id))
      .orderBy(desc(paymentReconciliationExceptions.lastSeenAt)),
    db
      .select({
        id: shipments.id,
        provider: shipments.provider,
        providerCostAmount: shipments.providerCostAmount,
        providerCostCurrency: shipments.providerCostCurrency,
        providerEnvironment: shipments.providerEnvironment,
        status: shipments.status,
        trackingNumber: shipments.trackingNumber,
        trackingUrl: shipments.trackingUrl,
        updatedAt: shipments.updatedAt,
        waybillNumber: shipments.waybillNumber,
        waybillUrl: shipments.waybillUrl,
      })
      .from(shipments)
      .where(eq(shipments.orderId, order.id))
      .orderBy(desc(shipments.createdAt)),
    db
      .select({
        emailSentAt: invoices.emailSentAt,
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        issuedAt: invoices.issuedAt,
        renderError: invoices.renderError,
        renderedAt: invoices.renderedAt,
        renderStatus: invoices.renderStatus,
        status: invoices.status,
        totalIncludingTax: invoices.totalIncludingTax,
        whatsappSentAt: invoices.whatsappSentAt,
      })
      .from(invoices)
      .where(eq(invoices.orderId, order.id))
      .limit(1),
    db
      .select({
        attempts: notificationDispatchClaims.attempts,
        completedAt: notificationDispatchClaims.completedAt,
        createdAt: notificationDispatchClaims.createdAt,
        eventKey: notificationDispatchClaims.eventKey,
        id: notificationDispatchClaims.id,
        lastError: notificationDispatchClaims.lastError,
        status: notificationDispatchClaims.status,
        updatedAt: notificationDispatchClaims.updatedAt,
      })
      .from(notificationDispatchClaims)
      .where(
        sql`${notificationDispatchClaims.payload}->>'orderId' = ${order.id}`,
      )
      .orderBy(desc(notificationDispatchClaims.createdAt))
      .limit(50),
    db
      .select({
        createdAt: notificationDeliveries.createdAt,
        errorMessage: notificationDeliveries.errorMessage,
        id: notificationDeliveries.id,
        recipientEmail: notificationDeliveries.recipientEmail,
        sentAt: notificationDeliveries.sentAt,
        status: notificationDeliveries.status,
        templateKey: notificationDeliveries.templateKey,
      })
      .from(notificationDeliveries)
      .where(
        sql`${notificationDeliveries.metadata} like ${`%"order_id":"${order.id}"%`}`,
      )
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(50),
    ]);
  const refundFulfillmentByRefundId = new Map<
    string,
    typeof refundFulfillmentRows
  >();

  for (const action of refundFulfillmentRows) {
    const current = refundFulfillmentByRefundId.get(action.refundId) ?? [];

    current.push(action);
    refundFulfillmentByRefundId.set(action.refundId, current);
  }
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
    automation: {
      notificationClaims: notificationClaimRows,
      notificationEmails: notificationEmailRows,
    },
    campaignAttribution: order.campaignAttribution,
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
          emailSentAt: invoice.emailSentAt,
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
          renderError: invoice.renderError,
          renderedAt: invoice.renderedAt,
          renderStatus: invoice.renderStatus,
          status: invoice.status,
          totalIncludingTax: toMoney(invoice.totalIncludingTax),
          whatsappSentAt: invoice.whatsappSentAt,
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
    reconciliationExceptions: reconciliationExceptionRows.map(
      (exception) => ({
        ...exception,
        receivedAmount: toMoney(exception.receivedAmount),
      }),
    ),
    refunds: refundRows.map((refund) => ({
      ...refund,
      amount: toMoney(refund.amount),
      fulfillmentActions: (
        refundFulfillmentByRefundId.get(refund.id) ?? []
      ).map((action) => ({
        attempts: action.attempts,
        id: action.id,
        lastError: action.lastError,
        provider: action.provider,
        shipmentId: action.shipmentId,
        shipmentStatus: action.shipmentStatus,
        status: action.status,
        trackingReference:
          action.trackingNumber ?? action.waybillNumber ?? null,
      })),
      requestedRestockQuantity: refund.requestedRestockItems.reduce(
        (total, item) => total + item.quantity,
        0,
      ),
    })),
    shipments: shipmentRows.map((shipment) => ({
      ...shipment,
      providerCostAmount:
        shipment.providerCostAmount === null
          ? null
          : toMoney(shipment.providerCostAmount),
    })),
    shippingTotal: toMoney(order.shippingTotal),
    status: order.status,
    subtotal: toMoney(order.subtotal),
  };
}
