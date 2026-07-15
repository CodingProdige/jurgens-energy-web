import type { Metadata } from "next";

import { AccountPageShell } from "@/src/modules/marketplace/account/components";
import { getCustomerOrders } from "@/src/modules/marketplace/account/data";
import { OrdersHistoryView } from "@/src/modules/marketplace/account/overview";

export const metadata: Metadata = {
  title: "My Orders",
  description: "Review your Jurgens Energy orders and delivery progress.",
  robots: { follow: false, index: false },
};

export default async function AccountOrdersPage() {
  const orders = await getCustomerOrders();

  return (
    <AccountPageShell
      active="orders"
      description="Open an order to review its items, payment, delivery schedule, and live tracking information."
      title="My orders"
    >
      <OrdersHistoryView orders={orders} />
    </AccountPageShell>
  );
}
