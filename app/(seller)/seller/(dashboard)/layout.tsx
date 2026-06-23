import type { ReactNode } from "react";

import { SellerDashboardShell } from "@/components/seller/seller-dashboard-shell";
import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { getCurrencyPreference } from "@/src/modules/currency/server";
import { getNotificationCenter } from "@/src/modules/notifications/in-app";
import { getSellerSetupState } from "@/src/modules/sellers/dashboard";

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
  const setup = await getSellerSetupState(session.user.id);
  const currencyPreference = await getCurrencyPreference();

  return (
    <SellerDashboardShell
      attentionHrefs={setup.attentionHrefs}
      currencyPreference={currencyPreference}
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
