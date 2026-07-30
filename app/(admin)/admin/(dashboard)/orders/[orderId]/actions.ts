"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  auditLogs,
  creditNoteDeliveryAttempts,
  creditNoteJobs,
  creditNotes,
  invoices,
} from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import {
  PayFastRefundServiceError,
  reconcilePayFastRefund,
  submitPayFastRefund,
} from "@/src/modules/payments/refunds";
import {
  RefundShipmentCancellationReviewError,
  resolveRefundShipmentCancellationReview,
  retryRefundShipmentCancellationAfterVerification,
} from "@/src/modules/payments/refund-shipment-cancellation-review";

export type RefundMutationState = {
  creditNoteNumber?: string | null;
  message?: string;
  ok?: boolean;
  refundId?: string;
  status?:
    | "pending"
    | "manual_required"
    | "submitted"
    | "verification_required"
    | "completed"
    | "failed";
};

export type CancellationReviewMutationState = {
  message?: string;
  ok?: boolean;
};

const allocationSchema = z.object({
  grossAmountCents: z.number().int().positive(),
  invoiceLineId: z.string().uuid(),
  quantity: z.number().int().positive().safe(),
});

const restockItemSchema = z.object({
  invoiceLineId: z.string().uuid(),
  quantity: z.number().int().positive().safe(),
});

const refundOperationalFields = {
  cancelOpenShipments: z.boolean(),
  restockItems: z.array(restockItemSchema).max(200),
};

const submitRefundFormSchema = z.discriminatedUnion("kind", [
  z.object({
    allocations: z.array(allocationSchema).max(200),
    ...refundOperationalFields,
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(180)
      .regex(/^[A-Za-z0-9:_-]+$/),
    kind: z.literal("full"),
    orderId: z.string().uuid(),
    reason: z.string().trim().min(3).max(255),
  }),
  z.object({
    allocations: z.array(allocationSchema).min(1).max(200),
    ...refundOperationalFields,
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(180)
      .regex(/^[A-Za-z0-9:_-]+$/),
    kind: z.literal("partial"),
    orderId: z.string().uuid(),
    reason: z.string().trim().min(3).max(255),
  }),
]);

const reconcileRefundFormSchema = z.object({
  orderId: z.string().uuid(),
  refundId: z.string().uuid(),
});

const cancellationReviewFormSchema = z.object({
  jobId: z.string().uuid(),
  orderId: z.string().uuid(),
  resolution: z.enum(["confirmed_cancelled", "shipment_not_cancelled"]),
  verificationNote: z.string().trim().min(10).max(1_000),
});

const cancellationRetryFormSchema = z.object({
  acknowledgedProviderOutcome: z.literal(true),
  jobId: z.string().uuid(),
  orderId: z.string().uuid(),
  verificationNote: z.string().trim().min(10).max(1_000),
});

const creditNoteIdSchema = z.string().uuid();

function readAllocations(formData: FormData) {
  try {
    const parsed = JSON.parse(String(formData.get("allocations") ?? "[]"));

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readRestockItems(formData: FormData) {
  try {
    const parsed = JSON.parse(String(formData.get("restockItems") ?? "[]"));

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resultMessage(
  result: Awaited<ReturnType<typeof submitPayFastRefund>>,
) {
  if (result.status === "completed") {
    return result.creditNoteNumber
      ? `Refund completed and ${result.creditNoteNumber} was issued.`
      : "Refund completed. The credit note is being prepared.";
  }

  if (result.status === "manual_required") {
    return (
      result.manualActionReason ??
      "PayFast requires a secured manual refund step before a credit note can be issued."
    );
  }

  if (result.status === "submitted") {
    return "PayFast accepted the refund. Use Check PayFast status until it is confirmed.";
  }

  if (result.status === "verification_required") {
    return "The provider outcome needs verification. No credit note will be issued until PayFast confirms the refund.";
  }

  if (result.status === "failed") {
    return "PayFast did not confirm the refund. No credit note was issued.";
  }

  return "The refund request was saved and is waiting to be submitted.";
}

function revalidateRefundSurfaces(orderId: string) {
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders/invoices");
  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath("/account/invoices");
}

export async function submitRefundAction(
  _state: RefundMutationState,
  formData: FormData,
): Promise<RefundMutationState> {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    return {
      message: "You do not have permission to issue refunds.",
      ok: false,
    };
  }

  const parsed = submitRefundFormSchema.safeParse({
    allocations: readAllocations(formData),
    cancelOpenShipments:
      String(formData.get("cancelOpenShipments") ?? "") === "true",
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    kind: String(formData.get("kind") ?? ""),
    orderId: String(formData.get("orderId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    restockItems: readRestockItems(formData),
  });

  if (!parsed.success) {
    return {
      message:
        parsed.error.issues[0]?.message ??
        "Review the refund amount and reason, then try again.",
      ok: false,
    };
  }

  try {
    const result = await submitPayFastRefund({
      ...parsed.data,
      actorUserId: access.session.user.id,
      notifyBuyer: true,
      notifyMerchant: false,
    });

    revalidateRefundSurfaces(parsed.data.orderId);

    return {
      creditNoteNumber: result.creditNoteNumber,
      message: resultMessage(result),
      ok: result.status !== "failed",
      refundId: result.refundId,
      status: result.status,
    };
  } catch (error) {
    if (error instanceof PayFastRefundServiceError) {
      return { message: error.message, ok: false };
    }

    console.error("[admin-refund] Refund submission failed", error);

    return {
      message:
        "The refund could not be submitted safely. No credit note was issued. Check the server logs before trying again.",
      ok: false,
    };
  }
}

export async function reconcileRefundAction(
  _state: RefundMutationState,
  formData: FormData,
): Promise<RefundMutationState> {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    return {
      message: "You do not have permission to reconcile refunds.",
      ok: false,
    };
  }

  const parsed = reconcileRefundFormSchema.safeParse({
    orderId: String(formData.get("orderId") ?? ""),
    refundId: String(formData.get("refundId") ?? ""),
  });

  if (!parsed.success) {
    return { message: "Choose a valid refund to reconcile.", ok: false };
  }

  try {
    const result = await reconcilePayFastRefund({
      actorUserId: access.session.user.id,
      refundId: parsed.data.refundId,
    });

    revalidateRefundSurfaces(parsed.data.orderId);

    return {
      creditNoteNumber: result.creditNoteNumber,
      message: resultMessage(result),
      ok: result.status !== "failed",
      refundId: result.refundId,
      status: result.status,
    };
  } catch (error) {
    if (error instanceof PayFastRefundServiceError) {
      return { message: error.message, ok: false };
    }

    console.error("[admin-refund] Refund reconciliation failed", error);

    return {
      message:
        "PayFast status could not be checked safely. The refund and invoice records were left unchanged.",
      ok: false,
    };
  }
}

export async function resolveRefundShipmentCancellationReviewAction(
  _state: CancellationReviewMutationState,
  formData: FormData,
): Promise<CancellationReviewMutationState> {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    return {
      message:
        "You do not have permission to resolve shipment cancellation reviews.",
      ok: false,
    };
  }

  const parsed = cancellationReviewFormSchema.safeParse({
    jobId: String(formData.get("jobId") ?? ""),
    orderId: String(formData.get("orderId") ?? ""),
    resolution: String(formData.get("resolution") ?? ""),
    verificationNote: String(formData.get("verificationNote") ?? ""),
  });

  if (!parsed.success) {
    return {
      message:
        parsed.error.issues[0]?.path[0] === "verificationNote"
          ? "Add a verification note of at least 10 characters describing what you checked."
          : "Choose a valid cancellation review outcome.",
      ok: false,
    };
  }

  try {
    const result = await resolveRefundShipmentCancellationReview({
      actorUserId: access.session.user.id,
      ...parsed.data,
    });

    revalidateRefundSurfaces(parsed.data.orderId);

    return {
      message: result.alreadyResolved
        ? "This cancellation review was already resolved."
        : parsed.data.resolution === "confirmed_cancelled"
          ? "Cancellation confirmed and the shipment was marked cancelled."
          : "The review was resolved and the shipment's verified state was left in place.",
      ok: true,
    };
  } catch (error) {
    if (error instanceof RefundShipmentCancellationReviewError) {
      return { message: error.message, ok: false };
    }

    console.error(
      "[admin-refund] Shipment cancellation review resolution failed",
      error,
    );

    return {
      message:
        "The review could not be resolved safely. Its existing state was left unchanged.",
      ok: false,
    };
  }
}

export async function retryRefundShipmentCancellationAction(
  _state: CancellationReviewMutationState,
  formData: FormData,
): Promise<CancellationReviewMutationState> {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    return {
      message:
        "You do not have permission to retry shipment cancellations.",
      ok: false,
    };
  }

  const parsed = cancellationRetryFormSchema.safeParse({
    acknowledgedProviderOutcome:
      String(formData.get("acknowledgeProviderOutcome") ?? "") ===
      "confirmed",
    jobId: String(formData.get("jobId") ?? ""),
    orderId: String(formData.get("orderId") ?? ""),
    verificationNote: String(formData.get("verificationNote") ?? ""),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];

    return {
      message:
        issue?.path[0] === "acknowledgedProviderOutcome"
          ? "Confirm that the provider rejected or did not receive the earlier request before retrying."
          : issue?.path[0] === "verificationNote"
            ? "Add a verification note of at least 10 characters describing what you checked."
            : "Choose a valid cancellation review to retry.",
      ok: false,
    };
  }

  try {
    await retryRefundShipmentCancellationAfterVerification({
      actorUserId: access.session.user.id,
      jobId: parsed.data.jobId,
      orderId: parsed.data.orderId,
      verificationNote: parsed.data.verificationNote,
    });

    revalidateRefundSurfaces(parsed.data.orderId);

    return {
      message:
        "One guarded cancellation retry was queued. If its outcome is uncertain, it will return to manual review instead of retrying blindly.",
      ok: true,
    };
  } catch (error) {
    if (error instanceof RefundShipmentCancellationReviewError) {
      return { message: error.message, ok: false };
    }

    console.error(
      "[admin-refund] Shipment cancellation retry failed",
      error,
    );

    return {
      message:
        "The retry could not be queued safely. The review remains unchanged.",
      ok: false,
    };
  }
}

export async function retryCreditNoteDeliveryAction(formData: FormData) {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to resend credit notes.");
  }

  const parsed = creditNoteIdSchema.safeParse(formData.get("creditNoteId"));

  if (!parsed.success) {
    throw new Error("Choose a valid credit note to resend.");
  }

  const acknowledgedUnknownOutcome =
    formData.get("acknowledgeUnknownOutcome") === "confirmed";

  const result = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select ${creditNotes.id} from ${creditNotes} where ${creditNotes.id} = ${parsed.data} for update`,
    );

    const [creditNote] = await transaction
      .select({
        emailDeliveryStatus: creditNotes.emailDeliveryStatus,
        id: creditNotes.id,
        invoiceId: creditNotes.invoiceId,
        renderStatus: creditNotes.renderStatus,
        whatsappDeliveryStatus: creditNotes.whatsappDeliveryStatus,
      })
      .from(creditNotes)
      .where(eq(creditNotes.id, parsed.data))
      .limit(1);

    if (!creditNote) {
      throw new Error("Credit note not found.");
    }

    const [invoice] = await transaction
      .select({ orderId: invoices.orderId })
      .from(invoices)
      .where(eq(invoices.id, creditNote.invoiceId))
      .limit(1);

    if (!invoice) {
      throw new Error("The credit note invoice could not be found.");
    }

    const [existingJob] = await transaction
      .select({ id: creditNoteJobs.id, status: creditNoteJobs.status })
      .from(creditNoteJobs)
      .where(
        and(
          eq(creditNoteJobs.creditNoteId, creditNote.id),
          inArray(creditNoteJobs.status, ["pending", "processing", "failed"]),
        ),
      )
      .orderBy(desc(creditNoteJobs.createdAt))
      .limit(1);

    if (existingJob?.status === "pending" || existingJob?.status === "processing") {
      return { orderId: invoice.orderId };
    }

    const needsRender = creditNote.renderStatus === "failed";
    const requiresUnknownOutcomeAcknowledgement =
      creditNote.emailDeliveryStatus === "verification_required" ||
      creditNote.whatsappDeliveryStatus === "verification_required";

    if (
      requiresUnknownOutcomeAcknowledgement &&
      !acknowledgedUnknownOutcome
    ) {
      throw new Error(
        "Confirm that you checked the provider and accept the duplicate-delivery risk before retrying.",
      );
    }

    const resetEmail =
      creditNote.emailDeliveryStatus === "failed" ||
      creditNote.emailDeliveryStatus === "skipped" ||
      creditNote.emailDeliveryStatus === "verification_required";
    const resetWhatsapp =
      creditNote.whatsappDeliveryStatus === "failed" ||
      creditNote.whatsappDeliveryStatus === "skipped" ||
      creditNote.whatsappDeliveryStatus === "verification_required";
    const resetChannels = [
      ...(resetEmail ? (["email"] as const) : []),
      ...(resetWhatsapp ? (["whatsapp"] as const) : []),
    ];
    const now = new Date();

    if (resetChannels.length > 0) {
      await transaction
        .update(creditNoteDeliveryAttempts)
        .set({
          availableAt: now,
          claimToken: null,
          failedAt: null,
          lastError: null,
          lockedAt: null,
          manualResetAt: now,
          manualResetByUserId: access.session.user.id,
          outcomeUnknown: false,
          skippedAt: null,
          status: "pending",
          updatedAt: now,
          verificationRequiredAt: null,
        })
        .where(
          and(
            eq(creditNoteDeliveryAttempts.creditNoteId, creditNote.id),
            inArray(creditNoteDeliveryAttempts.channel, resetChannels),
            inArray(creditNoteDeliveryAttempts.status, [
              "failed",
              "skipped",
              "verification_required",
            ]),
          ),
        );
    }

    await transaction
      .update(creditNotes)
      .set({
        ...(resetEmail
          ? {
              emailDeliveryError: null,
              emailDeliveryStatus: "pending" as const,
              emailSentAt: null,
            }
          : {}),
        ...(needsRender
          ? {
              renderError: null,
              renderStatus: "pending" as const,
              renderedAt: null,
            }
          : {}),
        ...(resetWhatsapp
          ? {
              whatsappDeliveryError: null,
              whatsappDeliveryStatus: "pending" as const,
              whatsappSentAt: null,
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(creditNotes.id, creditNote.id));

    const jobType = needsRender ? "render_and_deliver" : "deliver";

    if (existingJob?.status === "failed") {
      await transaction
        .update(creditNoteJobs)
        .set({
          availableAt: now,
          completedAt: null,
          jobType,
          lastError: null,
          lockedAt: null,
          status: "pending",
          updatedAt: now,
        })
        .where(eq(creditNoteJobs.id, existingJob.id));
    } else {
      await transaction.insert(creditNoteJobs).values({
        creditNoteId: creditNote.id,
        idempotencyKey: `credit-note:${creditNote.id}:manual-delivery:${randomUUID()}`,
        jobType,
      });
    }

    await transaction.insert(auditLogs).values({
      action: "credit_note.delivery_retried",
      actorUserId: access.session.user.id,
      entityId: creditNote.id,
      entityType: "credit_note",
      metadata: JSON.stringify({
        jobType,
        reusedFailedJob: existingJob?.status === "failed",
        acknowledgedUnknownOutcome,
        resetEmail,
        resetWhatsapp,
      }),
    });

    return { orderId: invoice.orderId };
  });

  revalidateRefundSurfaces(result.orderId);
}
