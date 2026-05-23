import type { ReactNode } from "react";

import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { requireAdminAccess } from "@/src/modules/auth/permissions";
import { getNotificationCenter } from "@/src/modules/notifications/in-app";

export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireAdminAccess();
  const notificationCenter = await getNotificationCenter({
    surface: "admin",
    userId: session.user.id,
  });

  return (
    <AdminDashboardShell
      capabilities={session.user.adminCapabilities}
      notificationCenter={notificationCenter}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    >
      {children}
    </AdminDashboardShell>
  );
}
