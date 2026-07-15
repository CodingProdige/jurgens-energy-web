import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  AccountPageShell,
  OrderDetailView,
} from "@/src/modules/marketplace/account/components";
import { getCustomerOrderDetail } from "@/src/modules/marketplace/account/data";

export const metadata: Metadata = {
  title: "Order Details",
  description: "Review your Jurgens Energy order and delivery progress.",
  robots: { follow: false, index: false },
};

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getCustomerOrderDetail(orderId);

  if (!order) {
    notFound();
  }

  return (
    <AccountPageShell
      active="orders"
      description="Review your purchase, payment, delivery address, and the latest fulfillment updates."
      title="Order details"
    >
      <OrderDetailView order={order} />
    </AccountPageShell>
  );
}
