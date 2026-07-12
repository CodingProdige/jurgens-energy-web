import type { Metadata } from "next";
import Link from "next/link";
import { XCircleIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { getCheckoutOrderSummary } from "@/src/modules/checkout/orders";

export const metadata: Metadata = {
  title: "Payment Cancelled",
  description: "Return to your cart after cancelling PayFast payment.",
  robots: { follow: false, index: false },
};

export default async function CheckoutCancelPage({
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
          <section className="mx-auto grid min-h-[45dvh] max-w-xl place-items-center border-y border-[#e8e8e2] bg-white px-5 py-10 text-center dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border">
            <div>
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-300">
                <XCircleIcon className="size-8" />
              </span>
              <h1 className="mt-5 text-2xl font-black">Payment cancelled</h1>
              <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
                Order {order.orderNumber} was not paid. Every product remains in
                your cart.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link
                  className="inline-flex h-10 items-center rounded-md bg-[#ff5a1f] px-4 text-sm font-bold text-white"
                  href="/cart"
                >
                  Return to cart
                </Link>
                <Link
                  className="inline-flex h-10 items-center rounded-md border border-[#d8d8d1] px-4 text-sm font-semibold dark:border-white/15"
                  href="/products"
                >
                  Continue shopping
                </Link>
              </div>
            </div>
          </section>
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}
