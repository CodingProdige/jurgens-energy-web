import Link from "next/link";
import {
  ArrowRightIcon,
  PackageCheckIcon,
  PackageSearchIcon,
  ReceiptTextIcon,
  ShoppingBagIcon,
  TruckIcon,
} from "lucide-react";

import { OrderSummaryCard } from "@/src/modules/marketplace/account/components";
import type { CustomerOrderSummary } from "@/src/modules/marketplace/account/data";

export function AccountOverviewView({
  activeDeliveries,
  orderCount,
  recentOrders,
}: {
  activeDeliveries: number;
  orderCount: number;
  recentOrders: CustomerOrderSummary[];
}) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          className="group grid min-w-0 gap-4 rounded-md bg-[#080808] p-5 text-white transition hover:bg-[#1a1a1a] dark:bg-[#f7f7f2] dark:text-[#080808] dark:hover:bg-white sm:p-6"
          href="/account/orders"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-11 place-items-center rounded-md bg-[#ff5a1f] text-white">
              <ReceiptTextIcon className="size-5" />
            </span>
            <ArrowRightIcon className="size-5 text-[#ff5a1f] transition group-hover:translate-x-1" />
          </div>
          <div>
            <p className="text-3xl font-black tabular-nums">{orderCount}</p>
            <h2 className="mt-1 font-black">Order history</h2>
            <p className="mt-1 text-xs leading-5 text-white/65 dark:text-[#666660]">
              View receipts, products, payment status, and delivery tracking.
            </p>
          </div>
        </Link>

        <Link
          className="group grid min-w-0 gap-4 rounded-md border border-[#deded7] bg-white p-5 transition hover:border-[#18a957]/60 dark:border-white/10 dark:bg-[#101010] sm:p-6"
          href="/account/orders"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-11 place-items-center rounded-md bg-[#18a957]/12 text-[#18a957]">
              <TruckIcon className="size-5" />
            </span>
            <ArrowRightIcon className="size-5 text-[#18a957] transition group-hover:translate-x-1" />
          </div>
          <div>
            <p className="text-3xl font-black tabular-nums">
              {activeDeliveries}
            </p>
            <h2 className="mt-1 font-black">Active deliveries</h2>
            <p className="mt-1 text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
              Open your active orders to see schedules and parcel tracking.
            </p>
          </div>
        </Link>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Recent orders</h2>
            <p className="mt-1 text-sm text-[#666660] dark:text-[#aaa9a1]">
              Your latest purchases and their current progress.
            </p>
          </div>
          {recentOrders.length > 0 ? (
            <Link
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#d9460f] transition hover:text-[#ff5a1f] dark:text-[#ff8a60]"
              href="/account/orders"
            >
              View all
              <ArrowRightIcon className="size-3.5" />
            </Link>
          ) : null}
        </div>

        {recentOrders.length > 0 ? (
          <div className="grid gap-3">
            {recentOrders.map((order) => (
              <OrderSummaryCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <div className="grid place-items-center rounded-md border border-dashed border-[#d3d3cc] bg-white px-5 py-12 text-center dark:border-white/15 dark:bg-[#101010]">
            <span className="grid size-12 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f]">
              <PackageCheckIcon className="size-6" />
            </span>
            <h3 className="mt-4 text-lg font-black">No orders yet</h3>
            <p className="mt-1 max-w-md text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
              Once you place an order while signed in, its payment and delivery
              progress will appear here.
            </p>
            <Link
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5a1f] px-4 text-sm font-black text-white transition hover:bg-[#e84c15]"
              href="/products"
            >
              <ShoppingBagIcon className="size-4" />
              Browse products
            </Link>
          </div>
        )}
      </section>
    </>
  );
}

export function OrdersHistoryView({
  orders,
}: {
  orders: CustomerOrderSummary[];
}) {
  if (orders.length > 0) {
    return (
      <div className="grid gap-3">
        {orders.map((order) => (
          <OrderSummaryCard key={order.id} order={order} />
        ))}
      </div>
    );
  }

  return (
    <section className="grid place-items-center rounded-md border border-dashed border-[#d3d3cc] bg-white px-5 py-14 text-center dark:border-white/15 dark:bg-[#101010]">
      <span className="grid size-14 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f]">
        <PackageSearchIcon className="size-7" />
      </span>
      <h2 className="mt-4 text-xl font-black">You have no orders yet</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
        Orders placed while signed in will be stored here with their payment and
        delivery progress.
      </p>
      <Link
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5a1f] px-4 text-sm font-black text-white transition hover:bg-[#e84c15]"
        href="/products"
      >
        <ShoppingBagIcon className="size-4" />
        Start shopping
      </Link>
    </section>
  );
}
