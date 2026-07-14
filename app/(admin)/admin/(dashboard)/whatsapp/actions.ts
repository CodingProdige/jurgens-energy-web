"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminCapability } from "@/src/modules/auth/permissions";
import {
  clearWhatsappConversationModeration,
  pauseWhatsappConversationAutomation,
  resumeWhatsappConversationAutomation,
  sendAdminWhatsappConversationMessage,
  sendAdminWhatsappFollowUp,
} from "@/src/modules/admin/whatsapp";

const conversationActionSchema = z.object({
  conversationId: z.string().uuid(),
});
const sendMessageSchema = conversationActionSchema.extend({
  attachmentAssetId: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  attachmentFileName: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  attachmentMimeType: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  attachmentType: z
    .enum(["document", "image", "video"])
    .optional(),
  attachmentUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  body: z.string().trim().max(4000).default(""),
}).refine((value) => value.body || value.attachmentUrl, {
  message: "Message or attachment is required.",
});

export type AdminWhatsappActionResult = {
  message: string;
  ok: boolean;
};

export async function pauseWhatsappAutomation(
  input: unknown,
): Promise<AdminWhatsappActionResult> {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    return {
      message: "WhatsApp management access could not be confirmed.",
      ok: false,
    };
  }

  const parsed = conversationActionSchema.safeParse(input);

  if (!parsed.success) {
    return { message: "The conversation could not be confirmed.", ok: false };
  }

  const result = await pauseWhatsappConversationAutomation({
    adminUserId: access.session.user.id,
    conversationId: parsed.data.conversationId,
  });

  if (result.ok) {
    revalidatePath("/whatsapp");
    revalidatePath(`/whatsapp/${parsed.data.conversationId}`);
  }

  return result;
}

export async function resumeWhatsappAutomation(
  input: unknown,
): Promise<AdminWhatsappActionResult> {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    return {
      message: "WhatsApp management access could not be confirmed.",
      ok: false,
    };
  }

  const parsed = conversationActionSchema.safeParse(input);

  if (!parsed.success) {
    return { message: "The conversation could not be confirmed.", ok: false };
  }

  const result = await resumeWhatsappConversationAutomation({
    adminUserId: access.session.user.id,
    conversationId: parsed.data.conversationId,
  });

  if (result.ok) {
    revalidatePath("/whatsapp");
    revalidatePath(`/whatsapp/${parsed.data.conversationId}`);
  }

  return result;
}

export async function clearWhatsappModeration(formData: FormData) {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    return;
  }

  const parsed = conversationActionSchema.safeParse({
    conversationId: formData.get("conversationId"),
  });

  if (!parsed.success) {
    return;
  }

  await clearWhatsappConversationModeration(parsed.data.conversationId);
  revalidatePath("/whatsapp");
}

export async function sendAdminWhatsappMessage(formData: FormData) {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    return;
  }

  const parsed = sendMessageSchema.safeParse({
    attachmentAssetId: formData.get("attachmentAssetId") ?? undefined,
    attachmentFileName: formData.get("attachmentFileName") ?? undefined,
    attachmentMimeType: formData.get("attachmentMimeType") ?? undefined,
    attachmentType: formData.get("attachmentType") || undefined,
    attachmentUrl: formData.get("attachmentUrl") ?? undefined,
    body: formData.get("body") ?? "",
    conversationId: formData.get("conversationId"),
  });

  if (!parsed.success) {
    return;
  }

  await sendAdminWhatsappConversationMessage({
    adminUserId: access.session.user.id,
    attachment:
      parsed.data.attachmentUrl &&
      parsed.data.attachmentMimeType &&
      parsed.data.attachmentType
        ? {
            ...(parsed.data.attachmentAssetId
              ? { assetId: parsed.data.attachmentAssetId }
              : {}),
            fileName: parsed.data.attachmentFileName ?? null,
            mimeType: parsed.data.attachmentMimeType,
            type: parsed.data.attachmentType,
            url: parsed.data.attachmentUrl,
          }
        : undefined,
    body: parsed.data.body,
    conversationId: parsed.data.conversationId,
  });
  revalidatePath("/whatsapp");
  revalidatePath(`/whatsapp/${parsed.data.conversationId}`);
}

export async function sendWhatsappFollowUp(
  input: unknown,
): Promise<AdminWhatsappActionResult> {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    return {
      message: "WhatsApp management access could not be confirmed.",
      ok: false,
    };
  }

  const parsed = conversationActionSchema.safeParse(input);

  if (!parsed.success) {
    return { message: "The conversation could not be confirmed.", ok: false };
  }

  const result = await sendAdminWhatsappFollowUp({
    adminUserId: access.session.user.id,
    conversationId: parsed.data.conversationId,
  });

  if (result.ok) {
    revalidatePath("/whatsapp");
    revalidatePath(`/whatsapp/${parsed.data.conversationId}`);
  }

  return result;
}
