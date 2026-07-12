import type { Metadata } from "next";

import { AdminWhatsappManager } from "@/app/(admin)/admin/(dashboard)/whatsapp/whatsapp-manager";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { hasAdminCapability } from "@/src/modules/admin/staff";
import { getAdminWhatsappConversations } from "@/src/modules/admin/whatsapp";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "WhatsApp Conversations",
  description:
    "Review WhatsApp ordering conversations and control automated responses.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminWhatsappPage() {
  const access = await requireAdminCapability("admin.orders.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const canManage = hasAdminCapability(
    access.session.user.adminCapabilities,
    "admin.orders.manage",
  );
  const data = await getAdminWhatsappConversations();

  return <AdminWhatsappManager canManage={canManage} data={data} />;
}
