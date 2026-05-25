import type { ReactNode } from "react";

import { SellerDashboardShell } from "@/components/seller/seller-dashboard-shell";
import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { getNotificationCenter } from "@/src/modules/notifications/in-app";

export default async function SellerDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSellerDashboardAccess();
  const notificationCenter = await getNotificationCenter({
    surface: "seller",
    userId: session.user.id,
  });

  return (
    <SellerDashboardShell
      notificationCenter={notificationCenter}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    >
      {children}
    </SellerDashboardShell>
  );
}
