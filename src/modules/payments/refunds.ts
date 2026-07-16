import "server-only";

import { createHash } from "node:crypto";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  auditLogs,
  creditNoteDeliveryAttempts,
  creditNoteJobs,
  creditNoteLines,
  creditNotes,
  invoiceLines,
  invoiceNumberSequences,
  invoices,
  orders,
  paymentRefundAllocations,
  paymentRefunds,
  payments,
} from "@/src/db/schema";
import type {
  PaymentRefundMethod,
  PaymentRefundStatus,
} from "@/src/db/schema/refunds";
import {
  getConfiguredPayFastRefundsClient,
  PayFastRefundApiError,
  type PayFastRefundMethod,
  type PayFastRefundQuery,
  type PayFastRefundRetrieveResult,
} from "@/src/modules/payments/payfast-refunds-client";

const ACTIVE_REFUND_STATUSES: PaymentRefundStatus[] = [
  "pending",
  "manual_required",
  "submitted",
  "verification_required",
  "completed",
];
const UNRESOLVED_REFUND_STATUSES: PaymentRefundStatus[] = [
  "pending",
  "manual_required",
  "submitted",
  "verification_required",
];

const allocationInputSchema = z.object({
  grossAmountCents: z.number().int().safe().positive(),
  invoiceLineId: z.string().uuid(),
  quantity: z.number().int().positive().safe(),
});

const refundBaseInputSchema = z.object({
  actorUserId: z.string().uuid(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(180)
    .regex(/^[A-Za-z0-9:_-]+$/),
  notifyBuyer: z.boolean().default(true),
  notifyMerchant: z.boolean().default(false),
  orderId: z.string().uuid(),
  reason: z.string().trim().min(3).max(255),
});

const partialRefundInputSchema = refundBaseInputSchema
  .extend({
    allocations: z.array(allocationInputSchema).min(1).max(200),
    kind: z.literal("partial"),
  })
  .superRefine((input, context) => {
    const seen = new Set<string>();

    input.allocations.forEach((allocation, index) => {
      if (seen.has(allocation.invoiceLineId)) {
        context.addIssue({
          code: "custom",
          message: "Each invoice line may only appear once in a refund request.",
          path: ["allocations", index, "invoiceLineId"],
        });
      }

      seen.add(allocation.invoiceLineId);

      if (Math.round(allocation.quantity * 1_000) <= 0) {
        context.addIssue({
          code: "custom",
          message: "Refund allocation quantity must be at least 0.001.",
          path: ["allocations", index, "quantity"],
        });
      }
    });
  });

export const submitPayFastRefundInputSchema = z.discriminatedUnion("kind", [
  refundBaseInputSchema.extend({ kind: z.literal("full") }),
  partialRefundInputSchema,
]);

export const reconcilePayFastRefundInputSchema = z.object({
  actorUserId: z.string().uuid().optional(),
  refundId: z.string().uuid(),
});

export type SubmitPayFastRefundInput = z.input<
  typeof submitPayFastRefundInputSchema
>;

export type ReconcilePayFastRefundInput = z.input<
  typeof reconcilePayFastRefundInputSchema
>;

export type PayFastRefundServiceErrorCode =
  | "allocation_exceeds_invoice_line"
  | "allocation_invalid"
  | "idempotency_conflict"
  | "invoice_not_found"
  | "no_refundable_balance"
  | "order_not_found"
  | "order_not_refundable"
  | "payment_not_found"
  | "payment_not_payfast"
  | "payment_not_refundable"
  | "refund_in_progress"
  | "total_mismatch"
  | "unsupported_currency";

export class PayFastRefundServiceError extends Error {
  readonly code: PayFastRefundServiceErrorCode;

  constructor(code: PayFastRefundServiceErrorCode, message: string) {
    super(message);
    this.name = "PayFastRefundServiceError";
    this.code = code;
  }
}

export type PayFastRefundServiceResult = Readonly<{
  amountCents: number;
  creditNoteId: string | null;
  creditNoteNumber: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  idempotentReplay: boolean;
  invoiceId: string;
  manualActionReason: string | null;
  method: PaymentRefundMethod;
  orderId: string;
  paymentId: string;
  refundId: string;
  status: PaymentRefundStatus;
}>;

export type PayFastRefundReconciliationPass = Readonly<{
  processed: number;
  results: PayFastRefundServiceResult[];
}>;

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type RefundAllocationDraft = Readonly<{
  grossCents: number;
  invoiceLineId: string;
  netCents: number;
  position: number;
  quantity: number;
  taxCents: number;
}>;

function moneyToCents(value: string | number) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new PayFastRefundServiceError(
      "total_mismatch",
      "Refund source contains an invalid money amount.",
    );
  }

  return Math.round(amount * 100);
}

function centsToMoney(value: number) {
  return (value / 100).toFixed(2);
}

function normalizeQuantity(value: number | string) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity)) {
    throw new PayFastRefundServiceError(
      "allocation_invalid",
      "Refund allocation contains an invalid quantity.",
    );
  }

  return Math.round(quantity * 1_000) / 1_000;
}

function requestFingerprint(
  input: z.output<typeof submitPayFastRefundInputSchema>,
) {
  const allocations =
    input.kind === "partial"
      ? [...input.allocations]
          .map((allocation) => ({
            grossAmountCents: allocation.grossAmountCents,
            invoiceLineId: allocation.invoiceLineId,
            quantity: normalizeQuantity(allocation.quantity),
          }))
          .sort((first, second) =>
            first.invoiceLineId.localeCompare(second.invoiceLineId),
          )
      : null;

  return createHash("sha256")
    .update(
      JSON.stringify({
        allocations,
        kind: input.kind,
        notifyBuyer: input.notifyBuyer,
        notifyMerchant: input.notifyMerchant,
        orderId: input.orderId,
        reason: input.reason,
      }),
    )
    .digest("hex");
}

function calculateInclusiveCredit({
  grossCents,
  remainingNetCents,
  remainingTaxCents,
  taxRateBps,
}: {
  grossCents: number;
  remainingNetCents: number;
  remainingTaxCents: number;
  taxRateBps: number;
}) {
  if (grossCents === remainingNetCents + remainingTaxCents) {
    return { netCents: remainingNetCents, taxCents: remainingTaxCents };
  }

  let netCents = Math.round(
    (grossCents * 10_000) / (10_000 + taxRateBps),
  );
  let taxCents = grossCents - netCents;

  if (netCents > remainingNetCents) {
    netCents = remainingNetCents;
    taxCents = grossCents - netCents;
  }

  if (taxCents > remainingTaxCents) {
    taxCents = remainingTaxCents;
    netCents = grossCents - taxCents;
  }

  if (
    netCents < 0 ||
    taxCents < 0 ||
    netCents > remainingNetCents ||
    taxCents > remainingTaxCents
  ) {
    throw new PayFastRefundServiceError(
      "allocation_exceeds_invoice_line",
      "Refund allocation exceeds the remaining net or VAT value of an invoice line.",
    );
  }

  return { netCents, taxCents };
}

async function loadRefundResult(
  refundId: string,
  idempotentReplay: boolean,
): Promise<PayFastRefundServiceResult> {
  const [refund] = await db
    .select({
      amount: paymentRefunds.amount,
      creditNoteId: paymentRefunds.creditNoteId,
      creditNoteNumber: creditNotes.creditNoteNumber,
      errorCode: paymentRefunds.errorCode,
      errorMessage: paymentRefunds.errorMessage,
      invoiceId: paymentRefunds.invoiceId,
      manualActionReason: paymentRefunds.manualActionReason,
      method: paymentRefunds.refundMethod,
      orderId: paymentRefunds.orderId,
      paymentId: paymentRefunds.paymentId,
      refundId: paymentRefunds.id,
      status: paymentRefunds.status,
    })
    .from(paymentRefunds)
    .leftJoin(creditNotes, eq(creditNotes.id, paymentRefunds.creditNoteId))
    .where(eq(paymentRefunds.id, refundId))
    .limit(1);

  if (!refund) {
    throw new Error("Refund record was not found after persistence.");
  }

  return {
    ...refund,
    amountCents: moneyToCents(refund.amount),
    idempotentReplay,
  };
}

async function allocateCreditNoteNumber(transaction: DatabaseTransaction) {
  await transaction
    .insert(invoiceNumberSequences)
    .values({ key: "credit_note", nextValue: BigInt(1) })
    .onConflictDoNothing({ target: invoiceNumberSequences.key });

  const [sequence] = await transaction
    .update(invoiceNumberSequences)
    .set({
      nextValue: sql`${invoiceNumberSequences.nextValue} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(invoiceNumberSequences.key, "credit_note"))
    .returning({ nextValue: invoiceNumberSequences.nextValue });

  if (!sequence || sequence.nextValue <= BigInt(1)) {
    throw new Error("Could not allocate a credit-note number.");
  }

  return `CN${(sequence.nextValue - BigInt(1)).toString()}`;
}

async function buildRefundAllocations({
  input,
  invoiceId,
  transaction,
}: {
  input: z.output<typeof submitPayFastRefundInputSchema>;
  invoiceId: string;
  transaction: DatabaseTransaction;
}): Promise<RefundAllocationDraft[]> {
  const lines = await transaction
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId))
    .orderBy(asc(invoiceLines.position));

  if (lines.length === 0) {
    throw new PayFastRefundServiceError(
      "invoice_not_found",
      "The paid invoice does not contain refundable lines.",
    );
  }

  const reservedRows = await transaction
    .select({
      grossAmount: sql<string>`coalesce(sum(${paymentRefundAllocations.grossAmount}), 0)`,
      invoiceLineId: paymentRefundAllocations.invoiceLineId,
      netAmount: sql<string>`coalesce(sum(${paymentRefundAllocations.netAmount}), 0)`,
      quantity: sql<string>`coalesce(sum(${paymentRefundAllocations.quantity}), 0)`,
      taxAmount: sql<string>`coalesce(sum(${paymentRefundAllocations.taxAmount}), 0)`,
    })
    .from(paymentRefundAllocations)
    .innerJoin(
      paymentRefunds,
      eq(paymentRefunds.id, paymentRefundAllocations.refundId),
    )
    .where(inArray(paymentRefunds.status, ACTIVE_REFUND_STATUSES))
    .groupBy(paymentRefundAllocations.invoiceLineId);
  const reservedByLine = new Map(
    reservedRows.map((row) => [
      row.invoiceLineId,
      {
        grossCents: moneyToCents(row.grossAmount),
        netCents: moneyToCents(row.netAmount),
        quantity: normalizeQuantity(row.quantity),
        taxCents: moneyToCents(row.taxAmount),
      },
    ]),
  );
  const requestedByLine = new Map(
    input.kind === "partial"
      ? input.allocations.map((allocation) => [
          allocation.invoiceLineId,
          allocation,
        ])
      : [],
  );
  const lineIds = new Set(lines.map((line) => line.id));

  if (
    input.kind === "partial" &&
    input.allocations.some((allocation) => !lineIds.has(allocation.invoiceLineId))
  ) {
    throw new PayFastRefundServiceError(
      "allocation_invalid",
      "Every refund allocation must belong to the order's immutable invoice.",
    );
  }

  const drafts: RefundAllocationDraft[] = [];

  for (const line of lines) {
    const originalGrossCents = moneyToCents(line.lineTotalIncludingTax);
    const originalNetCents = moneyToCents(line.lineTotalExcludingTax);
    const originalTaxCents = moneyToCents(line.taxAmount);
    const reserved = reservedByLine.get(line.id) ?? {
      grossCents: 0,
      netCents: 0,
      quantity: 0,
      taxCents: 0,
    };
    const remainingGrossCents = originalGrossCents - reserved.grossCents;
    const remainingNetCents = originalNetCents - reserved.netCents;
    const remainingTaxCents = originalTaxCents - reserved.taxCents;
    const originalQuantity = normalizeQuantity(line.quantity);
    const remainingQuantity = normalizeQuantity(
      originalQuantity - reserved.quantity,
    );
    const request = requestedByLine.get(line.id);
    const grossCents =
      input.kind === "full"
        ? remainingGrossCents
        : request?.grossAmountCents ?? 0;

    if (grossCents === 0) {
      continue;
    }

    if (
      grossCents < 0 ||
      grossCents > remainingGrossCents ||
      remainingNetCents < 0 ||
      remainingTaxCents < 0
    ) {
      throw new PayFastRefundServiceError(
        "allocation_exceeds_invoice_line",
        `Refund allocation exceeds the remaining value of invoice line ${line.position}.`,
      );
    }

    const quantity = request
      ? normalizeQuantity(request.quantity)
      : remainingQuantity;

    if (quantity <= 0 || quantity > remainingQuantity) {
      throw new PayFastRefundServiceError(
        "allocation_invalid",
        `Refund quantity exceeds the remaining quantity on invoice line ${line.position}.`,
      );
    }

    const expectedGrossCents =
      quantity === remainingQuantity
        ? remainingGrossCents
        : Math.round(
            moneyToCents(line.unitPriceIncludingTax) * quantity,
          );

    if (grossCents !== expectedGrossCents) {
      throw new PayFastRefundServiceError(
        "allocation_invalid",
        `Refund value for invoice line ${line.position} must equal its immutable invoiced unit price multiplied by the credited quantity.`,
      );
    }

    const tax = calculateInclusiveCredit({
      grossCents,
      remainingNetCents,
      remainingTaxCents,
      taxRateBps: line.taxRateBps,
    });

    drafts.push({
      grossCents,
      invoiceLineId: line.id,
      netCents: tax.netCents,
      position: line.position,
      quantity: normalizeQuantity(quantity),
      taxCents: tax.taxCents,
    });
  }

  if (drafts.length === 0) {
    throw new PayFastRefundServiceError(
      "no_refundable_balance",
      "The invoice has no remaining refundable balance.",
    );
  }

  return drafts;
}

async function reserveRefund(
  input: z.output<typeof submitPayFastRefundInputSchema>,
  fingerprint: string,
) {
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`,
    );

    const [existing] = await transaction
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.idempotencyKey, input.idempotencyKey))
      .limit(1);

    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw new PayFastRefundServiceError(
          "idempotency_conflict",
          "That idempotency key was already used for a different refund request.",
        );
      }

      return { existing: true as const, refund: existing };
    }

    const [order] = await transaction
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (!order) {
      throw new PayFastRefundServiceError(
        "order_not_found",
        "The order does not exist.",
      );
    }

    await transaction.execute(
      sql`select ${orders.id} from ${orders} where ${orders.id} = ${order.id} for update`,
    );

    if (order.status !== "paid" && order.status !== "fulfilled") {
      throw new PayFastRefundServiceError(
        "order_not_refundable",
        "Only paid or fulfilled orders can be refunded.",
      );
    }

    const candidatePayments = await transaction
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.orderId, order.id),
          inArray(payments.status, ["captured", "refunded"]),
        ),
      )
      .orderBy(desc(payments.completedAt));

    if (candidatePayments.length === 0) {
      throw new PayFastRefundServiceError(
        "payment_not_found",
        "The order does not have a captured payment to refund.",
      );
    }

    if (candidatePayments.length !== 1) {
      throw new PayFastRefundServiceError(
        "payment_not_refundable",
        "The order has multiple captured payment records and requires manual review.",
      );
    }

    const payment = candidatePayments[0];

    await transaction.execute(
      sql`select ${payments.id} from ${payments} where ${payments.id} = ${payment.id} for update`,
    );

    if (payment.provider.trim().toLowerCase() !== "payfast") {
      throw new PayFastRefundServiceError(
        "payment_not_payfast",
        "This service only refunds payments collected through PayFast.",
      );
    }

    if (
      payment.status !== "captured" ||
      !payment.completedAt ||
      !payment.providerPaymentId
    ) {
      throw new PayFastRefundServiceError(
        "payment_not_refundable",
        "The PayFast payment is not in a refundable captured state.",
      );
    }

    const [invoice] = await transaction
      .select()
      .from(invoices)
      .where(eq(invoices.orderId, order.id))
      .limit(1);

    if (!invoice) {
      throw new PayFastRefundServiceError(
        "invoice_not_found",
        "A tax invoice must exist before a paid order can be refunded.",
      );
    }


    await transaction.execute(
      sql`select ${invoices.id} from ${invoices} where ${invoices.id} = ${invoice.id} for update`,
    );

    if (order.currency !== "ZAR" || invoice.currency !== "ZAR") {
      throw new PayFastRefundServiceError(
        "unsupported_currency",
        "PayFast refunds currently require a ZAR order and invoice.",
      );
    }

    const paymentTotalCents = moneyToCents(payment.amount);

    if (
      paymentTotalCents !== moneyToCents(order.grandTotal) ||
      paymentTotalCents !== moneyToCents(invoice.totalIncludingTax) ||
      paymentTotalCents !== moneyToCents(invoice.amountPaid)
    ) {
      throw new PayFastRefundServiceError(
        "total_mismatch",
        "Payment, order, and invoice totals do not agree; refund requires manual review.",
      );
    }

    const [unresolved] = await transaction
      .select({ id: paymentRefunds.id })
      .from(paymentRefunds)
      .where(
        and(
          eq(paymentRefunds.paymentId, payment.id),
          inArray(paymentRefunds.status, UNRESOLVED_REFUND_STATUSES),
        ),
      )
      .limit(1);

    if (unresolved) {
      throw new PayFastRefundServiceError(
        "refund_in_progress",
        "Another refund for this payment must be resolved before a new one is submitted.",
      );
    }

    const allocations = await buildRefundAllocations({
      input,
      invoiceId: invoice.id,
      transaction,
    });
    const amountCents = allocations.reduce(
      (total, allocation) => total + allocation.grossCents,
      0,
    );
    const [reserved] = await transaction
      .select({
        amount: sql<string>`coalesce(sum(${paymentRefunds.amount}), 0)`,
      })
      .from(paymentRefunds)
      .where(
        and(
          eq(paymentRefunds.paymentId, payment.id),
          inArray(paymentRefunds.status, ACTIVE_REFUND_STATUSES),
        ),
      );

    if (moneyToCents(reserved?.amount ?? 0) + amountCents > paymentTotalCents) {
      throw new PayFastRefundServiceError(
        "no_refundable_balance",
        "The requested refund exceeds the captured payment's remaining balance.",
      );
    }

    const [refund] = await transaction
      .insert(paymentRefunds)
      .values({
        actorUserId: input.actorUserId,
        amount: centsToMoney(amountCents),
        idempotencyKey: input.idempotencyKey,
        invoiceId: invoice.id,
        notifyBuyer: input.notifyBuyer,
        notifyMerchant: input.notifyMerchant,
        orderId: order.id,
        paymentId: payment.id,
        providerPaymentId: payment.providerPaymentId,
        reason: input.reason,
        refundKind: input.kind,
        requestFingerprint: fingerprint,
        requestedAllocations: allocations.map((allocation) => ({
          grossAmountCents: allocation.grossCents,
          invoiceLineId: allocation.invoiceLineId,
          quantity: allocation.quantity,
        })),
      })
      .returning();

    await transaction.insert(paymentRefundAllocations).values(
      allocations.map((allocation) => ({
        grossAmount: centsToMoney(allocation.grossCents),
        invoiceLineId: allocation.invoiceLineId,
        netAmount: centsToMoney(allocation.netCents),
        position: allocation.position,
        quantity: allocation.quantity.toFixed(3),
        refundId: refund.id,
        taxAmount: centsToMoney(allocation.taxCents),
      })),
    );

    await transaction.insert(auditLogs).values({
      action: "refund.requested",
      actorUserId: input.actorUserId,
      entityId: refund.id,
      entityType: "payment_refund",
      metadata: JSON.stringify({
        amount: centsToMoney(amountCents),
        idempotencyKey: input.idempotencyKey,
        invoiceId: invoice.id,
        kind: input.kind,
        orderId: order.id,
        paymentId: payment.id,
      }),
    });

    return { existing: false as const, refund };
  });
}

function toStoredMethod(method: PayFastRefundMethod): PaymentRefundMethod {
  switch (method) {
    case "PAYMENT_SOURCE":
      return "payment_source";
    case "BANK_PAYOUT":
      return "bank_payout";
    case "NOT_AVAILABLE":
      return "not_available";
    default:
      return "unknown";
  }
}

async function markProviderFailure({
  error,
  phase = "create",
  refundId,
  status,
}: {
  error: unknown;
  phase?: "create" | "query";
  refundId: string;
  status: "failed" | "verification_required";
}) {
  const providerError =
    error instanceof PayFastRefundApiError ? error : undefined;
  const message =
    error instanceof Error ? error.message.slice(0, 2_000) : "Refund failed.";
  const now = new Date();
  const responseUpdate =
    phase === "query"
      ? { providerQueryResponse: providerError?.providerResponse }
      : { providerCreateResponse: providerError?.providerResponse };

  await db.transaction(async (transaction) => {
    const [refund] = await transaction
      .update(paymentRefunds)
      .set({
        ...responseUpdate,
        errorCode: providerError?.code ?? "provider_error",
        errorMessage: message,
        failedAt: status === "failed" ? now : null,
        providerHttpStatus: providerError?.httpStatus ?? null,
        status,
        updatedAt: now,
      })
      .where(eq(paymentRefunds.id, refundId))
      .returning({ actorUserId: paymentRefunds.actorUserId });

    await transaction.insert(auditLogs).values({
      action:
        status === "verification_required"
          ? "refund.verification_required"
          : "refund.failed",
      actorUserId: refund?.actorUserId,
      entityId: refundId,
      entityType: "payment_refund",
      metadata: JSON.stringify({
        errorCode: providerError?.code ?? "provider_error",
        message,
        outcomeUnknown: providerError?.outcomeUnknown ?? false,
        providerHttpStatus: providerError?.httpStatus ?? null,
      }),
    });
  });
}

async function finalizeCompletedRefund({
  actorUserId,
  providerAvailableAfterCents,
  providerHttpStatus,
  providerQueryResponse,
  providerRetrieveResponse,
  providerStatus,
  refundId,
}: {
  actorUserId?: string;
  providerAvailableAfterCents: number;
  providerHttpStatus: number;
  providerQueryResponse: unknown;
  providerRetrieveResponse: unknown;
  providerStatus: string;
  refundId: string;
}) {
  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select ${paymentRefunds.id} from ${paymentRefunds} where ${paymentRefunds.id} = ${refundId} for update`,
    );

    const [refund] = await transaction
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.id, refundId))
      .limit(1);

    if (!refund || (refund.status === "completed" && refund.creditNoteId)) {
      return;
    }

    if (
      refund.status !== "manual_required" &&
      refund.status !== "submitted" &&
      refund.status !== "verification_required"
    ) {
      throw new Error("Only a provider-confirmed refund can be finalized.");
    }

    await transaction.execute(
      sql`select ${payments.id} from ${payments} where ${payments.id} = ${refund.paymentId} for update`,
    );
    await transaction.execute(
      sql`select ${invoices.id} from ${invoices} where ${invoices.id} = ${refund.invoiceId} for update`,
    );

    const [invoice] = await transaction
      .select()
      .from(invoices)
      .where(eq(invoices.id, refund.invoiceId))
      .limit(1);
    const allocations = await transaction
      .select({
        description: invoiceLines.description,
        grossAmount: paymentRefundAllocations.grossAmount,
        invoiceLineId: paymentRefundAllocations.invoiceLineId,
        kind: invoiceLines.kind,
        netAmount: paymentRefundAllocations.netAmount,
        position: paymentRefundAllocations.position,
        quantity: paymentRefundAllocations.quantity,
        sku: invoiceLines.sku,
        taxAmount: paymentRefundAllocations.taxAmount,
        taxRateBps: invoiceLines.taxRateBps,
        unitPriceIncludingTax: invoiceLines.unitPriceIncludingTax,
      })
      .from(paymentRefundAllocations)
      .innerJoin(
        invoiceLines,
        eq(invoiceLines.id, paymentRefundAllocations.invoiceLineId),
      )
      .where(eq(paymentRefundAllocations.refundId, refund.id))
      .orderBy(asc(paymentRefundAllocations.position));

    if (!invoice || allocations.length === 0) {
      throw new Error("Refund accounting allocation is incomplete.");
    }

    const netCents = allocations.reduce(
      (total, allocation) => total + moneyToCents(allocation.netAmount),
      0,
    );
    const taxCents = allocations.reduce(
      (total, allocation) => total + moneyToCents(allocation.taxAmount),
      0,
    );
    const grossCents = allocations.reduce(
      (total, allocation) => total + moneyToCents(allocation.grossAmount),
      0,
    );

    if (grossCents !== moneyToCents(refund.amount) || netCents + taxCents !== grossCents) {
      throw new Error("Refund allocation totals do not match the refund amount.");
    }

    const creditNoteNumber = await allocateCreditNoteNumber(transaction);
    const [creditNote] = await transaction
      .insert(creditNotes)
      .values({
        creditNoteNumber,
        invoiceId: invoice.id,
        issuedAt: new Date(),
        reason: refund.reason,
        subtotalExcludingTax: centsToMoney(netCents),
        taxTotal: centsToMoney(taxCents),
        totalIncludingTax: centsToMoney(grossCents),
      })
      .returning({ id: creditNotes.id });

    await transaction.insert(creditNoteLines).values(
      allocations.map((allocation, index) => ({
        creditNoteId: creditNote.id,
        description: allocation.description,
        invoiceLineId: allocation.invoiceLineId,
        kind: allocation.kind,
        lineTotalExcludingTax: allocation.netAmount,
        lineTotalIncludingTax: allocation.grossAmount,
        position: index + 1,
        quantity: allocation.quantity,
        sku: allocation.sku,
        taxAmount: allocation.taxAmount,
        taxRateBps: allocation.taxRateBps,
        unitPriceIncludingTax: allocation.unitPriceIncludingTax,
      })),
    );
    await transaction.insert(creditNoteDeliveryAttempts).values([
      {
        channel: "email",
        creditNoteId: creditNote.id,
        idempotencyKey: `credit-note:${creditNote.id}:email:v1`,
      },
      {
        channel: "whatsapp",
        creditNoteId: creditNote.id,
        idempotencyKey: `credit-note:${creditNote.id}:whatsapp:v1`,
      },
    ]);
    await transaction.insert(creditNoteJobs).values({
      creditNoteId: creditNote.id,
      idempotencyKey: `credit-note:${creditNote.id}:render-and-deliver:v1`,
      jobType: "render_and_deliver",
    });

    const now = new Date();

    await transaction
      .update(paymentRefunds)
      .set({
        completedAt: now,
        creditNoteId: creditNote.id,
        errorCode: null,
        errorMessage: null,
        providerAvailableAfterCents,
        providerHttpStatus,
        providerQueryResponse,
        providerRetrieveResponse,
        providerStatus,
        status: "completed",
        updatedAt: now,
      })
      .where(eq(paymentRefunds.id, refund.id));

    const [credited] = await transaction
      .select({
        total: sql<string>`coalesce(sum(${creditNotes.totalIncludingTax}), 0)`,
      })
      .from(creditNotes)
      .where(eq(creditNotes.invoiceId, invoice.id));
    const invoiceTotalCents = moneyToCents(invoice.totalIncludingTax);
    const creditedTotalCents = moneyToCents(credited?.total ?? 0);

    if (creditedTotalCents > invoiceTotalCents) {
      throw new Error("Credit notes exceed the immutable invoice total.");
    }

    await transaction
      .update(invoices)
      .set({
        status:
          creditedTotalCents === invoiceTotalCents
            ? "credited"
            : "partially_credited",
        updatedAt: now,
      })
      .where(eq(invoices.id, invoice.id));

    const [completedRefunds] = await transaction
      .select({
        total: sql<string>`coalesce(sum(${paymentRefunds.amount}), 0)`,
      })
      .from(paymentRefunds)
      .where(
        and(
          eq(paymentRefunds.paymentId, refund.paymentId),
          eq(paymentRefunds.status, "completed"),
        ),
      );
    const [payment] = await transaction
      .select({ amount: payments.amount })
      .from(payments)
      .where(eq(payments.id, refund.paymentId))
      .limit(1);

    if (
      payment &&
      moneyToCents(completedRefunds?.total ?? 0) === moneyToCents(payment.amount)
    ) {
      await transaction
        .update(payments)
        .set({ status: "refunded", updatedAt: now })
        .where(eq(payments.id, refund.paymentId));
      await transaction
        .update(orders)
        .set({ status: "refunded", updatedAt: now })
        .where(eq(orders.id, refund.orderId));
    }

    await transaction.insert(auditLogs).values([
      {
        action: "refund.completed",
        actorUserId: actorUserId ?? refund.actorUserId,
        entityId: refund.id,
        entityType: "payment_refund",
        metadata: JSON.stringify({
          amount: refund.amount,
          creditNoteId: creditNote.id,
          creditNoteNumber,
          providerAvailableAfterCents,
          providerStatus,
        }),
      },
      {
        action: "credit_note.issued",
        actorUserId: actorUserId ?? refund.actorUserId,
        entityId: creditNote.id,
        entityType: "credit_note",
        metadata: JSON.stringify({
          amount: refund.amount,
          creditNoteNumber,
          invoiceId: invoice.id,
          orderId: refund.orderId,
          refundId: refund.id,
        }),
      },
    ]);
  });
}

function hasMatchingRefundTransaction(
  retrieve: PayFastRefundRetrieveResult,
  amountCents: number,
  providerRequestStartedAt: Date,
) {
  // PayFast ledger timestamps have second precision, while our request marker
  // can include milliseconds.
  const earliest = Math.floor(providerRequestStartedAt.getTime() / 1_000) * 1_000;

  return retrieve.transactions.some((transaction) => {
    const transactionDate = Date.parse(transaction.date);
    const isRefund = transaction.type.toLowerCase().includes("refund");
    const isNewTransaction =
      Number.isFinite(transactionDate) && transactionDate >= earliest;

    return (
      isRefund &&
      Math.abs(transaction.amountCents) === amountCents &&
      isNewTransaction
    );
  });
}

type RefundTransactionBaseline = PayFastRefundRetrieveResult["transactions"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStoredTransactionBaseline(
  providerQueryResponse: unknown,
): RefundTransactionBaseline | null {
  if (!isRecord(providerQueryResponse)) {
    return null;
  }

  const baseline = providerQueryResponse.refundTransactionBaseline;

  if (!Array.isArray(baseline)) {
    return null;
  }

  const normalized = baseline.flatMap((transaction) => {
    if (!isRecord(transaction)) {
      return [];
    }

    const amountCents = Number(transaction.amountCents);

    if (!Number.isSafeInteger(amountCents)) {
      return [];
    }

    return [
      {
        amountCents,
        date: String(transaction.date ?? ""),
        type: String(transaction.type ?? ""),
      },
    ];
  });

  return normalized.length === baseline.length ? normalized : null;
}

function providerQueryEvidence(
  queryResponse: unknown,
  baseline: RefundTransactionBaseline | null,
) {
  return {
    query: queryResponse,
    refundTransactionBaseline: baseline,
  };
}

function transactionFingerprint(
  transaction: RefundTransactionBaseline[number],
) {
  return JSON.stringify([
    transaction.amountCents,
    transaction.date,
    transaction.type,
  ]);
}

function hasNewMatchingRefundTransaction(
  retrieve: PayFastRefundRetrieveResult,
  baseline: RefundTransactionBaseline,
  amountCents: number,
) {
  const baselineCounts = new Map<string, number>();

  for (const transaction of baseline) {
    const fingerprint = transactionFingerprint(transaction);

    baselineCounts.set(
      fingerprint,
      (baselineCounts.get(fingerprint) ?? 0) + 1,
    );
  }

  for (const transaction of retrieve.transactions) {
    const fingerprint = transactionFingerprint(transaction);
    const previousCount = baselineCounts.get(fingerprint) ?? 0;

    if (previousCount > 0) {
      baselineCounts.set(fingerprint, previousCount - 1);
      continue;
    }

    if (
      transaction.type.toLowerCase().includes("refund") &&
      Math.abs(transaction.amountCents) === amountCents
    ) {
      return true;
    }
  }

  return false;
}

export async function reconcilePayFastRefund(
  rawInput: ReconcilePayFastRefundInput,
): Promise<PayFastRefundServiceResult> {
  const input = reconcilePayFastRefundInputSchema.parse(rawInput);
  const [refund] = await db
    .select()
    .from(paymentRefunds)
    .where(eq(paymentRefunds.id, input.refundId))
    .limit(1);

  if (!refund) {
    throw new PayFastRefundServiceError(
      "payment_not_found",
      "The refund record does not exist.",
    );
  }

  if (
    refund.status !== "manual_required" &&
    refund.status !== "submitted" &&
    refund.status !== "verification_required"
  ) {
    return loadRefundResult(refund.id, true);
  }

  const providerActivityStartedAt =
    refund.providerRequestStartedAt ?? refund.createdAt;
  const transactionBaseline = getStoredTransactionBaseline(
    refund.providerQueryResponse,
  );

  try {
    const client = await getConfiguredPayFastRefundsClient();
    const [query, retrieve] = await Promise.all([
      client.queryRefund(refund.providerPaymentId),
      client.retrieveRefund(refund.providerPaymentId),
    ]);
    const amountCents = moneyToCents(refund.amount);
    const expectedMaximumAvailable = Math.max(
      0,
      (refund.providerAvailableBeforeCents ?? query.amountOriginalCents) -
        amountCents,
    );
    const balanceConfirmsRefund =
      query.amountAvailableCents <= expectedMaximumAvailable;
    const ledgerConfirmsRefund = transactionBaseline
      ? hasNewMatchingRefundTransaction(
          retrieve,
          transactionBaseline,
          amountCents,
        )
      : hasMatchingRefundTransaction(
          retrieve,
          amountCents,
          providerActivityStartedAt,
        );
    const completed = balanceConfirmsRefund && ledgerConfirmsRefund;
    const providerStatus = `${query.providerStatus}/${retrieve.providerStatus}`;
    const queryEvidence = providerQueryEvidence(
      query.raw,
      transactionBaseline,
    );

    if (completed) {
      await finalizeCompletedRefund({
        actorUserId: input.actorUserId,
        providerAvailableAfterCents: query.amountAvailableCents,
        providerHttpStatus: retrieve.httpStatus,
        providerQueryResponse: queryEvidence,
        providerRetrieveResponse: retrieve.raw,
        providerStatus,
        refundId: refund.id,
      });
    } else {
      await db
        .update(paymentRefunds)
        .set({
          errorCode: null,
          errorMessage: null,
          providerAvailableAfterCents: query.amountAvailableCents,
          providerHttpStatus: retrieve.httpStatus,
          providerQueryResponse: queryEvidence,
          providerRetrieveResponse: retrieve.raw,
          providerStatus,
          updatedAt: new Date(),
        })
        .where(eq(paymentRefunds.id, refund.id));
    }
  } catch (error) {
    const providerError =
      error instanceof PayFastRefundApiError ? error : undefined;

    await db
      .update(paymentRefunds)
      .set({
        errorCode: providerError?.code ?? "reconciliation_failed",
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 2_000)
            : "Refund reconciliation failed.",
        providerHttpStatus: providerError?.httpStatus ?? null,
        updatedAt: new Date(),
      })
      .where(eq(paymentRefunds.id, refund.id));
  }

  return loadRefundResult(refund.id, false);
}

/**
 * Read-only provider reconciliation pass for eventual PayFast processing and
 * externally completed BANK_PAYOUT refunds. This never invokes the mutation
 * endpoint and therefore cannot duplicate a refund.
 */
export async function reconcilePendingPayFastRefunds(
  limit = 10,
): Promise<PayFastRefundReconciliationPass> {
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 50));
  const throttleBefore = new Date(Date.now() - 30_000);
  const candidates = await db
    .select({ id: paymentRefunds.id })
    .from(paymentRefunds)
    .where(
      and(
        inArray(paymentRefunds.status, [
          "manual_required",
          "submitted",
          "verification_required",
        ]),
        lte(paymentRefunds.updatedAt, throttleBefore),
      ),
    )
    .orderBy(asc(paymentRefunds.updatedAt), asc(paymentRefunds.createdAt))
    .limit(boundedLimit);
  const results: PayFastRefundServiceResult[] = [];

  for (const candidate of candidates) {
    results.push(
      await reconcilePayFastRefund({
        refundId: candidate.id,
      }),
    );
  }

  return { processed: results.length, results };
}

export async function submitPayFastRefund(
  rawInput: SubmitPayFastRefundInput,
): Promise<PayFastRefundServiceResult> {
  const input = submitPayFastRefundInputSchema.parse(rawInput);
  const fingerprint = requestFingerprint(input);
  const reservation = await reserveRefund(input, fingerprint);
  const refund = reservation.refund;

  if (
    reservation.existing &&
    (refund.status !== "pending" || refund.providerRequestStartedAt)
  ) {
    return loadRefundResult(refund.id, true);
  }

  let query: PayFastRefundQuery;

  try {
    const client = await getConfiguredPayFastRefundsClient();
    const [refundQuery, baselineRetrieve] = await Promise.all([
      client.queryRefund(refund.providerPaymentId),
      client.retrieveRefund(refund.providerPaymentId),
    ]);
    query = refundQuery;

    const amountCents = moneyToCents(refund.amount);
    const [payment] = await db
      .select({ amount: payments.amount })
      .from(payments)
      .where(eq(payments.id, refund.paymentId))
      .limit(1);

    if (
      !payment ||
      query.errors.length > 0 ||
      query.amountOriginalCents !== moneyToCents(payment.amount) ||
      query.amountAvailableCents < amountCents
    ) {
      await markProviderFailure({
        error: new PayFastRefundApiError({
          code: "request_failed",
          httpStatus: query.httpStatus,
          message:
            query.errors.join(" ") ||
            "PayFast reports insufficient refundable payment balance.",
          providerResponse: query.raw,
        }),
        refundId: refund.id,
        phase: "query",
        status: "failed",
      });

      return loadRefundResult(refund.id, false);
    }

    const usesOriginalFullMethod =
      refund.refundKind === "full" &&
      amountCents === query.amountOriginalCents &&
      query.amountAvailableCents === query.amountOriginalCents;
    const providerMethod = usesOriginalFullMethod
      ? query.fullMethod
      : query.partialMethod;
    const method = toStoredMethod(providerMethod);

    await db
      .update(paymentRefunds)
      .set({
        providerAvailableBeforeCents: query.amountAvailableCents,
        providerHttpStatus: query.httpStatus,
        providerQueryResponse: providerQueryEvidence(
          query.raw,
          baselineRetrieve.transactions,
        ),
        providerRetrieveResponse: baselineRetrieve.raw,
        providerStatus: query.providerStatus,
        refundMethod: method,
        updatedAt: new Date(),
      })
      .where(eq(paymentRefunds.id, refund.id));

    if (method !== "payment_source") {
      const manualActionReason =
        method === "bank_payout"
          ? "PayFast requires a bank payout for this refund. Handle it in the secured PayFast workflow; this application does not collect or store customer banking details."
          : "PayFast reports that an automatic payment-source refund is unavailable. Manual review is required.";

      await db.transaction(async (transaction) => {
        await transaction
          .update(paymentRefunds)
          .set({
            manualActionReason,
            status: "manual_required",
            updatedAt: new Date(),
          })
          .where(eq(paymentRefunds.id, refund.id));
        await transaction.insert(auditLogs).values({
          action: "refund.manual_required",
          actorUserId: refund.actorUserId,
          entityId: refund.id,
          entityType: "payment_refund",
          metadata: JSON.stringify({
            method,
            providerStatus: query.providerStatus,
            reason: manualActionReason,
          }),
        });
      });

      return loadRefundResult(refund.id, false);
    }

    const [claimed] = await db
      .update(paymentRefunds)
      .set({
        providerRequestStartedAt: new Date(),
        status: "verification_required",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentRefunds.id, refund.id),
          eq(paymentRefunds.status, "pending"),
          isNull(paymentRefunds.providerRequestStartedAt),
        ),
      )
      .returning();

    if (!claimed) {
      return loadRefundResult(refund.id, true);
    }

    let providerAccepted = false;

    try {
      const createResult = await client.createRefund(refund.providerPaymentId, {
        amountCents,
        notifyBuyer: refund.notifyBuyer,
        notifyMerchant: refund.notifyMerchant,
        reason: refund.reason,
      });

      if (!createResult.accepted) {
        await markProviderFailure({
          error: new PayFastRefundApiError({
            code: "request_failed",
            httpStatus: createResult.httpStatus,
            message: createResult.message ?? "PayFast rejected the refund request.",
            providerResponse: createResult.raw,
          }),
          refundId: refund.id,
          status: "failed",
        });

        return loadRefundResult(refund.id, false);
      }

      providerAccepted = true;

      await db.transaction(async (transaction) => {
        await transaction
          .update(paymentRefunds)
          .set({
            errorCode: null,
            errorMessage: null,
            providerCreateResponse: createResult.raw,
            providerHttpStatus: createResult.httpStatus,
            providerStatus: createResult.providerStatus,
            status: "submitted",
            submittedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(paymentRefunds.id, refund.id));
        await transaction.insert(auditLogs).values({
          action: "refund.submitted",
          actorUserId: refund.actorUserId,
          entityId: refund.id,
          entityType: "payment_refund",
          metadata: JSON.stringify({
            amount: refund.amount,
            providerStatus: createResult.providerStatus,
          }),
        });
      });

      return reconcilePayFastRefund({
        actorUserId: refund.actorUserId ?? undefined,
        refundId: refund.id,
      });
    } catch (error) {
      await markProviderFailure({
        error,
        refundId: refund.id,
        status:
          providerAccepted ||
          (error instanceof PayFastRefundApiError && error.outcomeUnknown)
            ? "verification_required"
            : "failed",
      });

      return loadRefundResult(refund.id, false);
    }
  } catch (error) {
    await markProviderFailure({
      error,
      phase: "query",
      refundId: refund.id,
      status: "failed",
    });
    return loadRefundResult(refund.id, false);
  }
}
