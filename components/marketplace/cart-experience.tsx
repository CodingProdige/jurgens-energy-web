"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertCircleIcon,
  LoaderCircleIcon,
  MinusIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  Trash2Icon,
  TruckIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  getLocalCartSelectedVariantIds,
  readLocalCartItems,
  removeLocalCartItem,
  setLocalCartSelectedVariantIds,
  subscribeToLocalCart,
  updateLocalCartItemQuantity,
  type LocalCartItem,
} from "@/src/modules/cart";
import type {
  CartValidationResponse,
  ValidatedCartItem,
} from "@/src/modules/cart/contracts";
import {
  trackGoogleEvent,
  type GoogleAnalyticsItem,
} from "@/src/modules/analytics/google";

function toValidationItems(items: LocalCartItem[]) {
  return items.map((item) => ({
    purchaseType: item.purchaseType,
    quantity: item.quantity,
    variantId: item.variantId,
  }));
}

function formatMoney(amount: number, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: currencyCode,
    style: "currency",
  }).format(amount);
}

function abortCartRequest(controller: AbortController | null) {
  if (!controller || controller.signal.aborted) {
    return;
  }

  controller.abort(new DOMException("Cart refresh cancelled.", "AbortError"));
}

function toGoogleAnalyticsItem(
  item: ValidatedCartItem,
): GoogleAnalyticsItem {
  const variant = [
    item.variantTitle,
    item.purchaseType === "exchange" ? "Exchange" : "Full/new",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    affiliation: item.sellerName ?? "Jurgens Energy",
    ...(item.brandName ? { item_brand: item.brandName } : {}),
    item_id: item.variantId,
    item_name: item.productTitle,
    ...(variant ? { item_variant: variant } : {}),
    price: item.unitPriceZar,
    quantity: item.quantity,
  };
}

function createCartAnalyticsPayload(items: ValidatedCartItem[]) {
  const analyticsItems = items.map(toGoogleAnalyticsItem);
  const signature = JSON.stringify(
    [...analyticsItems].sort((left, right) =>
      left.item_id.localeCompare(right.item_id),
    ),
  );

  return {
    items: analyticsItems,
    signature,
    value: Number(
      items
        .reduce((total, item) => total + item.lineTotalZar, 0)
        .toFixed(2),
    ),
  };
}

function CartQuantityControl({
  item,
  onChange,
}: {
  item: ValidatedCartItem;
  onChange: (quantity: number) => void;
}) {
  return (
    <div className="grid h-9 grid-cols-[2.25rem_2.5rem_2.25rem] overflow-hidden rounded-md border border-[#dcdcd5] bg-white dark:border-white/15 dark:bg-white/[0.04]">
      <button
        aria-label={`Decrease quantity for ${item.productTitle}`}
        className="grid place-items-center text-[#55554f] transition hover:bg-[#f1f1ec] disabled:opacity-35 dark:text-[#c7c7c0] dark:hover:bg-white/10"
        disabled={item.quantity <= 1}
        onClick={() => onChange(item.quantity - 1)}
        type="button"
      >
        <MinusIcon className="size-3.5" />
      </button>
      <span className="grid place-items-center border-x border-[#dcdcd5] text-sm font-semibold tabular-nums dark:border-white/15">
        {item.quantity}
      </span>
      <button
        aria-label={`Increase quantity for ${item.productTitle}`}
        className="grid place-items-center text-[#55554f] transition hover:bg-[#f1f1ec] disabled:opacity-35 dark:text-[#c7c7c0] dark:hover:bg-white/10"
        disabled={item.quantity >= item.maxQuantity}
        onClick={() => onChange(item.quantity + 1)}
        type="button"
      >
        <PlusIcon className="size-3.5" />
      </button>
    </div>
  );
}

function CartLine({
  checked,
  item,
  onCheckedChange,
  onQuantityChange,
  onRemove,
}: {
  checked: boolean;
  item: ValidatedCartItem;
  onCheckedChange: (checked: boolean) => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  return (
    <article
      className={cn(
        "grid min-w-0 grid-cols-[1.25rem_5.25rem_minmax(0,1fr)] gap-2.5 border-b border-[#e8e8e2] px-3 py-3 transition last:border-b-0 dark:border-white/10 sm:grid-cols-[1.25rem_7rem_minmax(0,1fr)_auto] sm:gap-4 sm:px-4 sm:py-4",
        !checked && "bg-[#fafaf7] opacity-70 dark:bg-white/[0.02]",
      )}
    >
      <Checkbox
        aria-label={`${checked ? "Exclude" : "Include"} ${item.productTitle} ${checked ? "from" : "in"} checkout`}
        checked={checked}
        className="mt-1 size-[18px] rounded-[3px] border-[#aaa9a1] data-checked:border-[#ff5a1f] data-checked:bg-[#ff5a1f]"
        disabled={!item.checkoutEligible}
        onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
      />

      <Link
        className="relative aspect-square overflow-hidden rounded-[5px] border border-[#e4e4de] bg-[#f4f4f0] dark:border-white/10 dark:bg-white/[0.04]"
        href={`/products/${item.productSlug}`}
      >
        {item.imageUrl ? (
          <Image
            alt={item.productTitle}
            className="object-contain"
            fill
            sizes="(max-width: 640px) 84px, 112px"
            src={item.imageUrl}
          />
        ) : (
          <span className="grid size-full place-items-center text-[#aaa9a1]">
            <ShoppingBagIcon className="size-5" />
          </span>
        )}
      </Link>

      <div className="grid min-w-0 content-start gap-1 sm:pr-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              className="line-clamp-2 text-[13px] font-bold leading-4 hover:text-[#ff5a1f] sm:text-[15px] sm:leading-5"
              href={`/products/${item.productSlug}`}
            >
              {item.productTitle}
            </Link>
            <p className="mt-1 truncate text-[10px] uppercase text-[#777770] dark:text-[#aaa9a1] sm:text-[11px]">
              {[item.brandName, item.variantTitle].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            aria-label={`Remove ${item.productTitle} from cart`}
            className="grid size-7 shrink-0 place-items-center rounded-md text-[#777770] transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300 sm:hidden"
            onClick={onRemove}
            type="button"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        </div>

        {item.purchaseType === "exchange" ? (
          <div className="mt-1 grid gap-1">
            <span className="w-fit bg-[#ffb000] px-1.5 py-0.5 text-[9px] font-bold uppercase text-black">
              Cylinder exchange
            </span>
            <p className="text-[10px] font-semibold leading-4 text-[#9a3b13] dark:text-orange-300 sm:text-[11px]">
              Empty cylinder required
              {item.exchangeRequiredEmptyCylinderSize
                ? `: ${item.exchangeRequiredEmptyCylinderSize}`
                : ""}
              .
              {item.exchangeAcceptedReturnBrands.length > 0
                ? ` Accepted return brands: ${item.exchangeAcceptedReturnBrands.join(", ")}.`
                : ""}
            </p>
          </div>
        ) : null}

        {!item.available ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-300">
            <AlertCircleIcon className="size-3.5" />
            Currently unavailable
          </p>
        ) : null}

        <p className="mt-1 text-[15px] font-black leading-none tabular-nums sm:text-lg">
          {item.lineTotalLabel}
        </p>
        {item.quantity > 1 ? (
          <p className="text-[10px] text-[#777770] dark:text-[#aaa9a1]">
            {item.unitPriceLabel} each
          </p>
        ) : null}

        <div className="mt-2 flex items-center gap-2 sm:hidden">
          <CartQuantityControl item={item} onChange={onQuantityChange} />
        </div>
      </div>

      <div className="hidden min-w-[8.5rem] content-between justify-items-end sm:grid">
        <button
          className="inline-flex h-8 items-center gap-1.5 px-1.5 text-xs text-[#666660] transition hover:text-red-600 dark:text-[#aaa9a1] dark:hover:text-red-300"
          onClick={onRemove}
          type="button"
        >
          <Trash2Icon className="size-3.5" />
          Remove
        </button>
        <CartQuantityControl item={item} onChange={onQuantityChange} />
      </div>
    </article>
  );
}

function MissingCartLine({
  item,
  onRemove,
}: {
  item: LocalCartItem;
  onRemove: () => void;
}) {
  return (
    <article className="grid grid-cols-[1.25rem_5.25rem_minmax(0,1fr)] gap-2.5 border-b border-[#e8e8e2] bg-[#fafaf7] px-3 py-3 opacity-70 last:border-b-0 dark:border-white/10 dark:bg-white/[0.02] sm:grid-cols-[1.25rem_7rem_minmax(0,1fr)_auto] sm:gap-4 sm:px-4 sm:py-4">
      <Checkbox aria-label={`${item.title} is unavailable`} disabled />
      <div className="relative aspect-square overflow-hidden rounded-[5px] border border-[#e4e4de] bg-[#f4f4f0] dark:border-white/10 dark:bg-white/[0.04]">
        {item.imageUrl ? (
          <Image alt={item.title} className="object-contain" fill sizes="112px" src={item.imageUrl} />
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="line-clamp-2 text-[13px] font-bold sm:text-[15px]">{item.title}</p>
          <button
            aria-label={`Remove ${item.title} from cart`}
            className="grid size-7 shrink-0 place-items-center rounded-md text-[#777770] transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300 sm:hidden"
            onClick={onRemove}
            type="button"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        </div>
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-300">
          <AlertCircleIcon className="size-3.5" />
          This product is no longer available.
        </p>
      </div>
      <button
        aria-label={`Remove ${item.title} from cart`}
        className="hidden h-8 items-center gap-1.5 px-1.5 text-xs text-[#666660] hover:text-red-600 dark:text-[#aaa9a1] sm:inline-flex"
        onClick={onRemove}
        type="button"
      >
        <Trash2Icon className="size-3.5" />
        Remove
      </button>
    </article>
  );
}

export function CartExperience() {
  const [localItems, setLocalItems] = useState<LocalCartItem[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [validation, setValidation] = useState<CartValidationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const trackedViewCartSignaturesRef = useRef(new Set<string>());

  const validate = useCallback(async (items: LocalCartItem[]) => {
    abortCartRequest(abortControllerRef.current);

    if (items.length === 0) {
      setValidation(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/cart/validate", {
        body: JSON.stringify({ items: toValidationItems(items) }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("Cart validation failed.");
      }

      const result = (await response.json()) as CartValidationResponse;
      const requestedQuantityByVariantId = new Map(
        items.map((item) => [item.variantId, item.quantity]),
      );
      const eligibleVariantIds = new Set(
        result.items
          .filter((item) => item.checkoutEligible)
          .map((item) => item.variantId),
      );

      setValidation(result);

      for (const item of result.items) {
        if (requestedQuantityByVariantId.get(item.variantId) !== item.quantity) {
          updateLocalCartItemQuantity(item.variantId, item.quantity);
        }
      }

      setSelectedVariantIds((current) => {
        const next = current.filter((variantId) => eligibleVariantIds.has(variantId));

        if (next.length !== current.length) {
          setLocalCartSelectedVariantIds(next);
        }

        return next;
      });
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        return;
      }

      setError("We could not refresh the cart. Please try again.");
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const items = readLocalCartItems();
    setLocalItems(items);
    setSelectedVariantIds(getLocalCartSelectedVariantIds(items));
    void validate(items);

    return subscribeToLocalCart((state) => {
      setLocalItems(state.items);
      setSelectedVariantIds(getLocalCartSelectedVariantIds(state.items));
      void validate(state.items);
    });
  }, [validate]);

  useEffect(
    () => () => {
      abortCartRequest(abortControllerRef.current);
    },
    [],
  );

  const validatedByVariantId = useMemo(
    () => new Map(validation?.items.map((item) => [item.variantId, item]) ?? []),
    [validation],
  );
  const selectedVariantIdSet = useMemo(
    () => new Set(selectedVariantIds),
    [selectedVariantIds],
  );
  const selectedItems =
    validation?.items.filter(
      (item) => selectedVariantIdSet.has(item.variantId) && item.checkoutEligible,
    ) ?? [];
  const selectedQuantity = selectedItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const selectedSubtotal = selectedItems.reduce(
    (total, item) => total + item.displayLineTotal,
    0,
  );
  const eligibleVariantIds =
    validation?.items
      .filter((item) => item.checkoutEligible)
      .map((item) => item.variantId) ?? [];
  const allEligibleSelected =
    eligibleVariantIds.length > 0 &&
    eligibleVariantIds.every((variantId) => selectedVariantIdSet.has(variantId));
  const canCheckout = selectedItems.length > 0 && !isLoading && !error;
  const subtotalLabel = validation
    ? formatMoney(
        selectedSubtotal,
        validation.currencyCode,
        validation.currencyLocale,
      )
    : "—";
  const viewCartAnalytics = useMemo(() => {
    if (!validation || validation.items.length === 0) {
      return null;
    }

    return createCartAnalyticsPayload(validation.items);
  }, [validation]);

  useEffect(() => {
    if (!viewCartAnalytics || isLoading || error) {
      return;
    }

    if (
      trackedViewCartSignaturesRef.current.has(viewCartAnalytics.signature)
    ) {
      return;
    }

    trackedViewCartSignaturesRef.current.add(viewCartAnalytics.signature);
    trackGoogleEvent("view_cart", {
      currency: "ZAR",
      items: viewCartAnalytics.items,
      value: viewCartAnalytics.value,
    });
  }, [error, isLoading, viewCartAnalytics]);

  function persistSelection(next: string[]) {
    setSelectedVariantIds(next);
    setLocalCartSelectedVariantIds(next);
  }

  function toggleVariant(variantId: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...selectedVariantIds, variantId]))
      : selectedVariantIds.filter((item) => item !== variantId);

    persistSelection(next);
  }

  function removeValidatedItem(item: ValidatedCartItem) {
    trackGoogleEvent("remove_from_cart", {
      currency: "ZAR",
      items: [toGoogleAnalyticsItem(item)],
      value: Number(item.lineTotalZar.toFixed(2)),
    });
    removeLocalCartItem(item.variantId);
  }

  if (!isLoading && localItems.length === 0) {
    return (
      <section className="grid min-h-[52dvh] place-items-center border-y border-[#e8e8e2] bg-white px-5 py-14 text-center dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border">
        <div className="max-w-sm">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f]">
            <ShoppingBagIcon className="size-6" />
          </span>
          <h2 className="mt-5 text-xl font-black">Your cart is empty</h2>
          <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
            Products you add will stay here until you are ready to check out.
          </p>
          <Link
            className={cn(
              buttonVariants(),
              "mt-6 h-11 rounded-md bg-[#ff5a1f] px-5 text-white hover:bg-[#e84c15]",
            )}
            href="/products"
          >
            Continue shopping
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <section className="min-w-0 border-y border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border">
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[#e8e8e2] px-3 dark:border-white/10 sm:px-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox
              checked={allEligibleSelected}
              className="size-[18px] rounded-[3px] border-[#aaa9a1] data-checked:border-[#ff5a1f] data-checked:bg-[#ff5a1f]"
              disabled={eligibleVariantIds.length === 0}
              onCheckedChange={(checked) =>
                persistSelection(checked === true ? eligibleVariantIds : [])
              }
            />
            <span className="font-semibold">Select all</span>
            <span className="text-xs tabular-nums text-[#777770] dark:text-[#aaa9a1]">
              ({localItems.length})
            </span>
          </label>
          {isLoading ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#777770] dark:text-[#aaa9a1]">
              <LoaderCircleIcon className="size-3.5 animate-spin text-[#ff5a1f]" />
              Refreshing
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div>
          {localItems.map((localItem) => {
            const item = validatedByVariantId.get(localItem.variantId);

            return item ? (
              <CartLine
                checked={selectedVariantIdSet.has(item.variantId)}
                item={item}
                key={item.variantId}
                onCheckedChange={(checked) => toggleVariant(item.variantId, checked)}
                onQuantityChange={(quantity) =>
                  updateLocalCartItemQuantity(item.variantId, quantity)
                }
                onRemove={() => removeValidatedItem(item)}
              />
            ) : (
              <MissingCartLine
                item={localItem}
                key={localItem.variantId}
                onRemove={() => removeLocalCartItem(localItem.variantId)}
              />
            );
          })}
        </div>
      </section>

      <aside className="sticky top-4 hidden overflow-hidden rounded-md border border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-[#101010] lg:block">
        <div className="border-b border-[#e8e8e2] px-5 py-4 dark:border-white/10">
          <h2 className="text-sm font-black uppercase">Order summary</h2>
        </div>
        <div className="grid gap-4 px-5 py-5">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-[#666660] dark:text-[#aaa9a1]">
              Selected items ({selectedQuantity})
            </span>
            <strong className="text-base tabular-nums">{subtotalLabel}</strong>
          </div>
          <div className="border-t border-[#e8e8e2] pt-4 dark:border-white/10">
            <div className="flex items-center justify-between gap-4">
              <span className="font-bold">Subtotal</span>
              <span className="text-xl font-black tabular-nums">{subtotalLabel}</span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-[#777770] dark:text-[#aaa9a1]">
              Delivery is calculated from your address at checkout.
            </p>
          </div>
          <Link
            aria-disabled={!canCheckout}
            className={cn(
              buttonVariants(),
              "h-12 w-full rounded-md bg-[#ff5a1f] text-sm font-bold text-white hover:bg-[#e84c15]",
              !canCheckout && "pointer-events-none opacity-45",
            )}
            href="/checkout"
          >
            Checkout ({selectedQuantity})
          </Link>
          <div className="grid gap-2 text-[11px] text-[#55554f] dark:text-[#c7c7c0]">
            <p className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4 text-emerald-600" />
              Secure hosted payment with PayFast
            </p>
            <p className="flex items-center gap-2">
              <TruckIcon className="size-4 text-[#ff5a1f]" />
              Jurgens and courier delivery calculated separately
            </p>
          </div>
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#deded7] bg-white/96 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur dark:border-white/10 dark:bg-[#101010]/96 lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-[10px] text-[#777770] dark:text-[#aaa9a1]">
              {selectedQuantity} selected
            </p>
            <p className="truncate text-lg font-black tabular-nums">{subtotalLabel}</p>
          </div>
          <Link
            aria-disabled={!canCheckout}
            className={cn(
              buttonVariants(),
              "h-11 rounded-md bg-[#ff5a1f] px-5 text-sm font-bold text-white hover:bg-[#e84c15]",
              !canCheckout && "pointer-events-none opacity-45",
            )}
            href="/checkout"
          >
            Checkout ({selectedQuantity})
          </Link>
        </div>
      </div>
    </div>
  );
}
