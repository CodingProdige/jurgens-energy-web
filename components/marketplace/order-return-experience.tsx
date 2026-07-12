"use client";

import Link from "next/link";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  RefreshCwIcon,
  ShoppingBagIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { removeLocalCartItems } from "@/src/modules/cart";

export type CheckoutOrderSummary = {
  createdAt: string;
  customerEmail: string;
  grandTotal: number;
  items: Array<{ quantity: number; title: string; variantId: string }>;
  orderId: string;
  orderNumber: string;
  paymentStatus: string;
  providerStatus: string | null;
  purchasedVariantIds: string[];
  shippingTotal: number;
  status: string;
  subtotal: number;
};

function formatZar(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    style: "currency",
  }).format(value);
}

export function OrderReturnExperience({
  initialOrder,
  token,
}: {
  initialOrder: CheckoutOrderSummary;
  token: string;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [pollError, setPollError] = useState(false);
  const cleanedOrderIdRef = useRef<string | null>(null);
  const isPaid = order.status === "paid" || order.status === "fulfilled";
  const isFailed = order.status === "cancelled" || order.paymentStatus === "failed";

  const refreshOrder = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/checkout/orders/${order.orderId}?token=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Order refresh failed.");
      }

      const nextOrder = (await response.json()) as CheckoutOrderSummary;
      setOrder(nextOrder);
      setPollError(false);
      return nextOrder;
    } catch {
      setPollError(true);
      return null;
    }
  }, [order.orderId, token]);

  useEffect(() => {
    if (isPaid || isFailed) {
      return;
    }

    let attempt = 0;
    const intervalId = window.setInterval(() => {
      attempt += 1;
      void refreshOrder();

      if (attempt >= 30) {
        window.clearInterval(intervalId);
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [isFailed, isPaid, refreshOrder]);

  useEffect(() => {
    if (
      isPaid &&
      order.purchasedVariantIds.length > 0 &&
      cleanedOrderIdRef.current !== order.orderId
    ) {
      removeLocalCartItems(order.purchasedVariantIds);
      cleanedOrderIdRef.current = order.orderId;
    }
  }, [isPaid, order.orderId, order.purchasedVariantIds]);

  return (
    <section className="mx-auto w-full max-w-2xl border-y border-[#e8e8e2] bg-white px-4 py-8 text-center dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border sm:px-8 sm:py-10">
      {isPaid ? (
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
          <CheckCircle2Icon className="size-8" />
        </span>
      ) : isFailed ? (
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-300">
          <AlertCircleIcon className="size-8" />
        </span>
      ) : (
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f]">
          <LoaderCircleIcon className="size-8 animate-spin" />
        </span>
      )}

      <h1 className="mt-5 text-2xl font-black sm:text-3xl">
        {isPaid
          ? "Payment confirmed"
          : isFailed
            ? "Payment was not completed"
            : "Confirming your payment"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
        {isPaid
          ? `Order ${order.orderNumber} is paid. Only the purchased products were removed from your cart.`
          : isFailed
            ? "Your products are still in the cart and can be checked out again."
            : "PayFast is sending the secure payment confirmation. This usually takes a few seconds."}
      </p>

      <div className="mx-auto mt-7 max-w-lg border-y border-[#e8e8e2] py-4 text-left dark:border-white/10">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-[#666660] dark:text-[#aaa9a1]">Order</span>
          <strong>{order.orderNumber}</strong>
        </div>
        <div className="mt-2 flex items-center justify-between gap-4 text-sm">
          <span className="text-[#666660] dark:text-[#aaa9a1]">Total</span>
          <strong className="text-lg tabular-nums">{formatZar(order.grandTotal)}</strong>
        </div>
        <div className="mt-4 grid gap-2 border-t border-[#e8e8e2] pt-4 dark:border-white/10">
          {order.items.map((item) => (
            <div
              className="flex items-start justify-between gap-4 text-xs"
              key={item.variantId}
            >
              <span className="text-left">{item.title}</span>
              <span className="shrink-0 text-[#777770] dark:text-[#aaa9a1]">
                Qty {item.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {pollError && !isPaid && !isFailed ? (
        <p className="mt-4 text-xs text-red-600 dark:text-red-300">
          The latest status could not be loaded. Your order remains safely recorded.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {!isPaid && !isFailed ? (
          <Button
            className="h-10 rounded-md"
            onClick={() => void refreshOrder()}
            type="button"
            variant="outline"
          >
            <RefreshCwIcon className="size-4" />
            Refresh status
          </Button>
        ) : null}
        <Link
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5a1f] px-4 text-sm font-bold text-white transition hover:bg-[#e84c15]"
          href={isFailed ? "/cart" : "/products"}
        >
          <ShoppingBagIcon className="size-4" />
          {isFailed ? "Return to cart" : "Continue shopping"}
        </Link>
      </div>
    </section>
  );
}
