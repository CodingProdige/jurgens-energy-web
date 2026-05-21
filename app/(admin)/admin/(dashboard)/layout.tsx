import type { ReactNode } from "react";

import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { requireAdminAccess } from "@/src/modules/auth/permissions";

export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireAdminAccess();

  return (
    <AdminDashboardShell
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
