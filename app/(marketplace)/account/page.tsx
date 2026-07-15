import type { Metadata } from "next";

import { AccountPageShell } from "@/src/modules/marketplace/account/components";
import { getCustomerAccountOverview } from "@/src/modules/marketplace/account/data";
import { AccountOverviewView } from "@/src/modules/marketplace/account/overview";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your Jurgens Energy orders and account details.",
  robots: { follow: false, index: false },
};

export default async function AccountPage() {
  const data = await getCustomerAccountOverview();
  const firstName = data.account.name?.trim().split(/\s+/)[0];

  return (
    <AccountPageShell
      active="overview"
      description="Review your orders, delivery progress, and WhatsApp account connection."
      title={firstName ? `Welcome, ${firstName}` : "Account overview"}
    >
      <AccountOverviewView
        activeDeliveries={data.activeDeliveries}
        orderCount={data.orderCount}
        recentOrders={data.recentOrders}
      />
    </AccountPageShell>
  );
}
