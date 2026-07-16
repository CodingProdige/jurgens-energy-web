"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { auditLogs, invoiceJobs, invoices } from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

const invoiceIdSchema = z.string().uuid();

export async function retryInvoiceDelivery(formData: FormData) {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to resend invoices.");
  }

  const invoiceId = invoiceIdSchema.parse(formData.get("invoiceId"));
  const now = new Date();

  await db.transaction(async (transaction) => {
    const [invoice] = await transaction
      .update(invoices)
      .set({
        emailSentAt: null,
        whatsappSentAt: null,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoiceId))
      .returning({ id: invoices.id });

    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    await transaction.insert(invoiceJobs).values({
      idempotencyKey: `invoice:${invoice.id}:manual-delivery:${randomUUID()}`,
      invoiceId: invoice.id,
      jobType: "deliver",
    });

    await transaction.insert(auditLogs).values({
      action: "invoice.delivery_retried",
      actorUserId: access.session.user.id,
      entityId: invoice.id,
      entityType: "invoice",
    });
  });

  revalidatePath("/orders/invoices");
}
