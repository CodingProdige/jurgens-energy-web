import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AdminWhatsappConversationExperience } from "@/app/(admin)/admin/(dashboard)/whatsapp/[conversationId]/whatsapp-conversation-experience";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { hasAdminCapability } from "@/src/modules/admin/staff";
import { getAdminWhatsappConversation } from "@/src/modules/admin/whatsapp";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminMediaLibrary } from "@/src/modules/media/admin";

export const metadata: Metadata = {
  title: "WhatsApp Conversation",
  description: "Review and respond to a Jurgens Energy WhatsApp conversation.",
  robots: {
    follow: false,
    index: false,
  },
};

const conversationIdSchema = z.string().uuid();

export default async function AdminWhatsappConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const access = await requireAdminCapability("admin.orders.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const parsedConversationId = conversationIdSchema.safeParse(
    (await params).conversationId,
  );

  if (!parsedConversationId.success) {
    notFound();
  }

  const [conversation, mediaLibrary] = await Promise.all([
    getAdminWhatsappConversation(parsedConversationId.data),
    getAdminMediaLibrary(access.session.user.id),
  ]);

  if (!conversation) {
    notFound();
  }

  const canManage = hasAdminCapability(
    access.session.user.adminCapabilities,
    "admin.orders.manage",
  );

  return (
    <AdminWhatsappConversationExperience
      canManage={canManage}
      conversation={conversation}
      mediaLibrary={mediaLibrary}
    />
  );
}
