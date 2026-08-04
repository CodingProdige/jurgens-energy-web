"use client";

import Link from "next/link";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  Clock3Icon,
  DownloadIcon,
  LoaderCircleIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  ShoppingBagIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  trackGoogleAdsConversion,
  trackGoogleEvent,
} from "@/src/modules/analytics/google";
import { removeLocalCartItems } from "@/src/modules/cart";
import {
  getConfirmedPurchasedVariantIds,
  isCheckoutPaymentConfirmed,
} from "@/src/modules/checkout/payment-confirmation";

const PURCHASE_ANALYTICS_STORAGE_PREFIX =
  "jurgens:analytics:google-purchase:v1";
const PAID_ORDER_CART_CLEANUP_STORAGE_PREFIX =
  "jurgens:checkout:paid-cart-cleanup:v1";

export type CheckoutOrderSummary = {
  createdAt: string;
  customerEmail: string;
  grandTotal: number;
  items: Array<{ quantity: number; title: string; variantId: string }>;
  invoice: {
    id: string;
    invoiceNumber: string;
    renderStatus: "failed" | "pending" | "ready";
  } | null;
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
  const [confirmationDelayed, setConfirmationDelayed] = useState(false);
  const [invoiceDelayed, setInvoiceDelayed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const cleanedOrderIdRef = useRef<string | null>(null);
  const trackedPurchaseOrderIdRef = useRef<string | null>(null);
  const confirmedPurchasedVariantIds = useMemo(
    () => getConfirmedPurchasedVariantIds(order),
    [order],
  );
  const isPaid = isCheckoutPaymentConfirmed(order);
  const isFailed = order.status === "cancelled" || order.paymentStatus === "failed";
  const invoiceReady = order.invoice?.renderStatus === "ready";

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

  const refreshOrderManually = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await refreshOrder();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshOrder]);

  useEffect(() => {
    if (invoiceReady) {
      setInvoiceDelayed(false);
    }
  }, [invoiceReady]);

  useEffect(() => {
    if (isFailed || (isPaid && (invoiceReady || invoiceDelayed))) {
      return;
    }

    let attempt = 0;
    const maxAttempts = isPaid ? 8 : 30;
    const intervalId = window.setInterval(() => {
      attempt += 1;
      void refreshOrder();

      if (attempt >= maxAttempts) {
        window.clearInterval(intervalId);

        if (isPaid && !invoiceReady) {
          setInvoiceDelayed(true);
        } else if (!isPaid && !isFailed) {
          setConfirmationDelayed(true);
        }
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [invoiceDelayed, invoiceReady, isFailed, isPaid, refreshOrder]);

  useEffect(() => {
    if (
      !isPaid ||
      confirmedPurchasedVariantIds.length === 0 ||
      cleanedOrderIdRef.current === order.orderId
    ) {
      return;
    }

    const storageKey = `${PAID_ORDER_CART_CLEANUP_STORAGE_PREFIX}:${order.orderId}`;

    try {
      if (window.localStorage.getItem(storageKey) !== null) {
        cleanedOrderIdRef.current = order.orderId;
        return;
      }
    } catch {
      // Continue with in-memory idempotency when browser storage is unavailable.
    }

    removeLocalCartItems(confirmedPurchasedVariantIds);
    cleanedOrderIdRef.current = order.orderId;

    try {
      window.localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // The ref still prevents duplicate cleanup during this mounted visit.
    }
  }, [confirmedPurchasedVariantIds, isPaid, order.orderId]);

  useEffect(() => {
    if (!isPaid || trackedPurchaseOrderIdRef.current === order.orderId) {
      return;
    }

    const trackPaidOrderPurchase = () => {
      if (
        trackedPurchaseOrderIdRef.current === order.orderId ||
        !window.jurgensGoogleTagMode ||
        !window.jurgensGoogleTagsReady
      ) {
        return;
      }

      const storageKey = `${PURCHASE_ANALYTICS_STORAGE_PREFIX}:${order.orderId}`;

      try {
        if (window.localStorage.getItem(storageKey) !== null) {
          trackedPurchaseOrderIdRef.current = order.orderId;
          return;
        }
      } catch {
        // Continue with in-memory deduplication when browser storage is unavailable.
      }

      const transactionId = order.orderNumber || order.orderId;
      const purchase = {
        currency: "ZAR",
        items: order.items.map((item) => ({
          item_id: item.variantId,
          item_name: item.title,
          quantity: item.quantity,
        })),
        shipping: order.shippingTotal,
        transaction_id: transactionId,
        value: order.grandTotal,
      };

      trackGoogleEvent("purchase", purchase);
      trackGoogleAdsConversion({
        currency: purchase.currency,
        transaction_id: purchase.transaction_id,
        value: purchase.value,
      });

      try {
        window.localStorage.setItem(storageKey, transactionId);
      } catch {
        // The ref still prevents duplicate events during this mounted visit.
      }

      trackedPurchaseOrderIdRef.current = order.orderId;
    };

    trackPaidOrderPurchase();
    window.addEventListener(
      "jurgens:google-tags-ready",
      trackPaidOrderPurchase,
    );

    return () =>
      window.removeEventListener(
        "jurgens:google-tags-ready",
        trackPaidOrderPurchase,
      );
  }, [
    isPaid,
    order.grandTotal,
    order.items,
    order.orderId,
    order.orderNumber,
    order.shippingTotal,
  ]);

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
      ) : confirmationDelayed ? (
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300">
          <Clock3Icon className="size-8" />
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
            : confirmationDelayed
              ? "Payment confirmation is delayed"
              : "Confirming your payment"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
        {isPaid
          ? `Order ${order.orderNumber} is paid. We’ve started your order updates, and only the purchased products were removed from your cart.`
          : isFailed
            ? "Your products are still in the cart and can be checked out again."
            : confirmationDelayed
              ? `Order ${order.orderNumber} is still awaiting confirmation from PayFast. Do not pay again while this payment is being checked.`
              : "PayFast is sending the secure payment confirmation. This usually takes a few seconds."}
      </p>

      {confirmationDelayed && !isPaid && !isFailed ? (
        <div className="mx-auto mt-5 max-w-lg rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-left">
          <p className="text-xs font-black text-amber-900 dark:text-amber-200">
            Your order remains safely pending
          </p>
          <p className="mt-1 text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
            Refresh the status below. If it remains pending for more than a few
            minutes, you can check it in{" "}
            <Link
              className="font-bold text-amber-800 underline underline-offset-2 dark:text-amber-300"
              href={`/account/orders/${order.orderId}`}
            >
              My orders
            </Link>{" "}
            or{" "}
            <Link
              className="font-bold text-amber-800 underline underline-offset-2 dark:text-amber-300"
              href="/contact"
            >
              contact support
            </Link>
            .
          </p>
        </div>
      ) : null}

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

      {isPaid ? (
        <div className="mx-auto mt-5 flex max-w-lg items-center gap-3 rounded-md border border-[#e2e2dc] bg-[#f7f7f2] px-3 py-3 text-left dark:border-white/10 dark:bg-white/[0.035]">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#ff5a1f]/10 text-[#ff5a1f]">
            {invoiceReady ? (
              <ReceiptTextIcon className="size-5" />
            ) : invoiceDelayed ? (
              <ReceiptTextIcon className="size-5" />
            ) : (
              <LoaderCircleIcon className="size-5 animate-spin" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black">
              {invoiceReady && order.invoice
                ? `Invoice ${order.invoice.invoiceNumber}`
                : invoiceDelayed
                  ? "Invoice is on its way"
                  : "Preparing your invoice"}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-[#666660] dark:text-[#aaa9a1]">
              {invoiceReady
                ? "A copy is also sent to your checkout email and WhatsApp number when those channels are configured."
                : invoiceDelayed
                  ? "You don’t need to wait here. We’ll email it, send it on WhatsApp when configured, and keep it in My orders shortly."
                  : "This can take a moment. You can continue shopping — we’ll send it and keep it in your account as soon as it’s ready."}
            </p>
          </div>
          {invoiceReady && order.invoice ? (
            <a
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-[#ff5a1f] px-3 text-xs font-black text-white transition hover:bg-[#e84c15]"
              href={`/api/invoices/${order.invoice.id}/pdf?checkoutToken=${encodeURIComponent(token)}`}
            >
              <DownloadIcon className="size-3.5" />
              PDF
            </a>
          ) : null}
        </div>
      ) : null}

      {pollError && !isFailed && !invoiceReady ? (
        <p className="mt-4 text-xs text-red-600 dark:text-red-300">
          {isPaid
            ? "The invoice status could not be refreshed. Your paid order remains safely recorded and the worker will continue preparing it."
            : "The latest status could not be loaded. Your order remains safely recorded."}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {!isPaid && !isFailed ? (
          <Button
            className="h-10 rounded-md"
            disabled={isRefreshing}
            onClick={() => void refreshOrderManually()}
            type="button"
            variant="outline"
          >
            <RefreshCwIcon
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {isRefreshing ? "Refreshing status" : "Refresh status"}
          </Button>
        ) : null}
        {isPaid ? (
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d7d7cf] bg-white px-4 text-sm font-bold text-[#171714] transition hover:bg-[#f7f7f2] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
            href={`/account/orders/${order.orderId}`}
          >
            <ReceiptTextIcon className="size-4" />
            View order
          </Link>
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
