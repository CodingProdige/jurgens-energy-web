import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  OrderReturnExperience,
  type CheckoutOrderSummary,
} from "@/components/marketplace/order-return-experience";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { getCheckoutOrderSummary } from "@/src/modules/checkout/orders";

export const metadata: Metadata = {
  title: "Order Confirmation",
  description: "Confirm the payment status of your Jurgens Energy order.",
  robots: { follow: false, index: false },
};

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{
    order?: string | string[];
    token?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const orderId = Array.isArray(resolvedSearchParams.order)
    ? resolvedSearchParams.order[0]
    : resolvedSearchParams.order;
  const token = Array.isArray(resolvedSearchParams.token)
    ? resolvedSearchParams.token[0]
    : resolvedSearchParams.token;

  if (!orderId || !token) {
    notFound();
  }

  const order = await getCheckoutOrderSummary(orderId, token);

  if (!order) {
    notFound();
  }

  return (
    <MarketplaceGate>
      <div className="min-h-screen bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceHeader />
        <main className="w-full py-5 sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))] sm:px-6 sm:py-10 lg:px-10">
          <OrderReturnExperience
            initialOrder={order as CheckoutOrderSummary}
            token={token}
          />
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}
