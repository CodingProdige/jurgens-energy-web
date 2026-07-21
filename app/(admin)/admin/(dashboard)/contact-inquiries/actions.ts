"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  auditLogs,
  contactInquiries,
  contactInquiryStatuses,
} from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

const updateContactInquiryStatusSchema = z.object({
  inquiryId: z.string().uuid(),
  status: z.enum(contactInquiryStatuses),
});

export async function updateContactInquiryStatusAction(formData: FormData) {
  const access = await requireAdminCapability("admin.contact_inquiries.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to update contact inquiries.");
  }

  const parsed = updateContactInquiryStatusSchema.safeParse({
    inquiryId: String(formData.get("inquiryId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });

  if (!parsed.success) {
    throw new Error("Choose a valid contact inquiry status.");
  }

  const now = new Date();

  await db.transaction(async (transaction) => {
    const [updatedInquiry] = await transaction
      .update(contactInquiries)
      .set({
        status: parsed.data.status,
        updatedAt: now,
      })
      .where(eq(contactInquiries.id, parsed.data.inquiryId))
      .returning({ id: contactInquiries.id });

    if (!updatedInquiry) {
      throw new Error("Contact inquiry not found.");
    }

    await transaction.insert(auditLogs).values({
      action: "contact_inquiry.status_updated",
      actorUserId: access.session.user.id,
      entityId: updatedInquiry.id,
      entityType: "contact_inquiry",
      metadata: JSON.stringify({ status: parsed.data.status }),
    });
  });

  revalidatePath("/contact-inquiries");
  revalidatePath(`/contact-inquiries/${parsed.data.inquiryId}`);
}
