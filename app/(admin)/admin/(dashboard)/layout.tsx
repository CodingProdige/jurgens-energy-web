import type { ReactNode } from "react";

import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { requireAdminAccess } from "@/src/modules/auth/permissions";
import { getCurrencyPreference } from "@/src/modules/currency/server";
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
  const currencyPreference = await getCurrencyPreference();

  return (
    <AdminDashboardShell
      capabilities={session.user.adminCapabilities}
      currencyPreference={currencyPreference}
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
