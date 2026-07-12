"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertCircleIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  MapPinIcon,
  PackageCheckIcon,
  TruckIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getLocalCartSelectedVariantIds,
  readLocalCartItems,
  type LocalCartItem,
} from "@/src/modules/cart";
import type { CartValidationResponse } from "@/src/modules/cart/contracts";
import type {
  CheckoutDeliveryAddress,
  CheckoutDeliverySchedule,
  CheckoutQuoteResponse,
} from "@/src/modules/checkout/contracts";

const southAfricanProvinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
] as const;

type CustomerFields = {
  email: string;
  name: string;
  phone: string;
};

const emptyAddress: CheckoutDeliveryAddress = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  countryCode: "ZA",
  postalCode: "",
  province: "",
  suburb: "",
};

const fieldClass =
  "h-11 rounded-md border-[#d8d8d1] bg-white px-3 text-sm shadow-none focus-visible:border-[#ff5a1f] focus-visible:ring-[#ff5a1f]/15 dark:border-white/12 dark:bg-white/[0.04]";

function toValidationItems(items: LocalCartItem[]) {
  return items.map((item) => ({
    exchangeEmptyConfirmed: item.exchangeEmptyConfirmed,
    purchaseType: item.purchaseType,
    quantity: item.quantity,
    variantId: item.variantId,
  }));
}

function formatZar(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    style: "currency",
  }).format(value);
}

function isAddressComplete(address: CheckoutDeliveryAddress) {
  return Boolean(
    address.addressLine1.trim() &&
      address.city.trim() &&
      address.postalCode.trim() &&
      address.province.trim() &&
      address.suburb.trim(),
  );
}

function abortCheckoutRequest(controller: AbortController | null) {
  if (!controller || controller.signal.aborted) {
    return;
  }

  controller.abort(new DOMException("Checkout refresh cancelled.", "AbortError"));
}

export function CheckoutExperience({
  initialCustomer,
}: {
  initialCustomer: { email: string; name: string };
}) {
  const [cartItems, setCartItems] = useState<LocalCartItem[]>([]);
  const [cart, setCart] = useState<CartValidationResponse | null>(null);
  const [customer, setCustomer] = useState<CustomerFields>({
    email: initialCustomer.email,
    name: initialCustomer.name,
    phone: "",
  });
  const [address, setAddress] = useState<CheckoutDeliveryAddress>(emptyAddress);
  const [quotes, setQuotes] = useState<CheckoutQuoteResponse | null>(null);
  const [selectedQuoteByGroup, setSelectedQuoteByGroup] = useState<
    Record<string, string>
  >({});
  const [jurgensDeliverySchedule, setJurgensDeliverySchedule] =
    useState<CheckoutDeliverySchedule | null>(null);
  const [isLoadingCart, setIsLoadingCart] = useState(true);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const allItems = readLocalCartItems();
    const selectedVariantIds = new Set(
      getLocalCartSelectedVariantIds(allItems),
    );
    const selectedItems = allItems.filter((item) =>
      selectedVariantIds.has(item.variantId),
    );
    setCartItems(selectedItems);

    if (selectedItems.length === 0) {
      setIsLoadingCart(false);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    void fetch("/api/cart/validate", {
      body: JSON.stringify({ items: toValidationItems(selectedItems) }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Cart validation failed.");
        }

        return (await response.json()) as CartValidationResponse;
      })
      .then((result) => setCart(result))
      .catch((caughtError) => {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          return;
        }

        setError("Your cart could not be refreshed. Return to the cart and try again.");
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoadingCart(false);
        }
      });

    return () => abortCheckoutRequest(abortController);
  }, []);

  useEffect(
    () => () => {
      abortCheckoutRequest(abortControllerRef.current);
    },
    [],
  );

  const checkoutItems = useMemo(() => toValidationItems(cartItems), [cartItems]);
  const requestedQuantityByVariantId = useMemo(
    () => new Map(cartItems.map((item) => [item.variantId, item.quantity])),
    [cartItems],
  );
  const cartReviewRequired = Boolean(
    cart &&
      (cart.invalidVariantIds.length > 0 ||
        cart.items.length !== cartItems.length ||
        cart.items.some((item) => !item.checkoutEligible) ||
        cart.items.some(
          (item) => requestedQuantityByVariantId.get(item.variantId) !== item.quantity,
        )),
  );
  const shippingTotal =
    quotes?.groups.reduce((total, group) => {
      const selectedQuoteId = selectedQuoteByGroup[group.groupKey];
      const option = group.options.find((item) => item.quoteId === selectedQuoteId);

      return total + (option?.amountZar ?? 0);
    }, 0) ?? 0;
  const subtotal = cart?.subtotalZar ?? 0;
  const grandTotal = subtotal + shippingTotal;
  const allGroupsAvailable = Boolean(
    quotes &&
      quotes.groups.length > 0 &&
      quotes.groups.every(
        (group) =>
          group.options.length > 0 && selectedQuoteByGroup[group.groupKey],
      ),
  );
  const jurgensSchedulingGroup =
    quotes?.groups.find(
      (group) =>
        group.scheduling?.required && Boolean(selectedQuoteByGroup[group.groupKey]),
    ) ?? null;
  const requiresJurgensSchedule = Boolean(jurgensSchedulingGroup);
  const customerComplete = Boolean(
    customer.name.trim().length >= 2 &&
      customer.email.includes("@") &&
      customer.phone.trim(),
  );
  const canCreateOrder =
    allGroupsAvailable &&
    customerComplete &&
    isAddressComplete(address) &&
    (!requiresJurgensSchedule || Boolean(jurgensDeliverySchedule)) &&
    !cartReviewRequired &&
    !isCreatingOrder;

  function updateAddress(
    field: keyof CheckoutDeliveryAddress,
    value: string,
  ) {
    setAddress((current) => ({ ...current, [field]: value }));
    setQuotes(null);
    setSelectedQuoteByGroup({});
    setJurgensDeliverySchedule(null);
  }

  async function requestDeliveryQuotes() {
    if (!isAddressComplete(address) || checkoutItems.length === 0) {
      setError("Complete the delivery address before requesting rates.");
      return;
    }

    if (cartReviewRequired) {
      setError("Return to your cart and review the selected products before checkout.");
      return;
    }

    setIsLoadingQuotes(true);
    setError(null);
      setQuotes(null);
      setSelectedQuoteByGroup({});
      setJurgensDeliverySchedule(null);

    try {
      const response = await fetch("/api/checkout/quotes", {
        body: JSON.stringify({ deliveryAddress: address, items: checkoutItems }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as CheckoutQuoteResponse & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Delivery rates could not be calculated.");
      }

      const firstJurgensSchedule = payload.groups.find(
        (group) => group.scheduling?.required,
      )?.scheduling?.options[0];

      setQuotes(payload);
      setJurgensDeliverySchedule(
        firstJurgensSchedule
          ? {
              date: firstJurgensSchedule.date,
              deliveryInstructions: "",
              windowEnd: firstJurgensSchedule.windowEnd,
              windowLabel: firstJurgensSchedule.windowLabel,
              windowStart: firstJurgensSchedule.windowStart,
            }
          : null,
      );
      setSelectedQuoteByGroup(
        Object.fromEntries(
          payload.groups.flatMap((group) =>
            group.options[0] ? [[group.groupKey, group.options[0].quoteId]] : [],
          ),
        ),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Delivery rates could not be calculated.",
      );
    } finally {
      setIsLoadingQuotes(false);
    }
  }

  async function startHostedCheckout() {
    if (!canCreateOrder || !quotes) {
      return;
    }

    setIsCreatingOrder(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout/orders", {
        body: JSON.stringify({
          customer,
          deliveryAddress: address,
          deliverySelections: quotes.groups.map((group) => ({
            groupKey: group.groupKey,
            quoteId: selectedQuoteByGroup[group.groupKey],
          })),
          items: checkoutItems,
          ...(requiresJurgensSchedule && jurgensDeliverySchedule
            ? { jurgensDeliverySchedule }
            : {}),
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        message?: string;
        redirectUrl?: string;
      };

      if (!response.ok || !payload.redirectUrl) {
        throw new Error(payload.message ?? "Checkout could not be started.");
      }

      window.location.assign(payload.redirectUrl);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Checkout could not be started.",
      );
      setIsCreatingOrder(false);
    }
  }

  if (isLoadingCart) {
    return (
      <div className="grid min-h-[45dvh] place-items-center">
        <span className="inline-flex items-center gap-2 text-sm text-[#666660] dark:text-[#aaa9a1]">
          <LoaderCircleIcon className="size-5 animate-spin text-[#ff5a1f]" />
          Preparing checkout
        </span>
      </div>
    );
  }

  if (!cart || cartItems.length === 0) {
    return (
      <section className="grid min-h-[45dvh] place-items-center border-y border-[#e8e8e2] bg-white px-5 py-12 text-center dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border">
        <div>
          <AlertCircleIcon className="mx-auto size-8 text-[#ff5a1f]" />
          <h2 className="mt-4 text-lg font-black">Nothing selected</h2>
          <p className="mt-2 text-sm text-[#666660] dark:text-[#aaa9a1]">
            Select at least one product before checking out.
          </p>
          <Link
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5a1f] px-4 text-sm font-bold text-white"
            href="/cart"
          >
            <ChevronLeftIcon className="size-4" />
            Return to cart
          </Link>
        </div>
      </section>
    );
  }

  if (cartReviewRequired) {
    return (
      <section className="grid min-h-[45dvh] place-items-center border-y border-[#e8e8e2] bg-white px-5 py-12 text-center dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border">
        <div className="max-w-md">
          <AlertCircleIcon className="mx-auto size-8 text-[#ff5a1f]" />
          <h2 className="mt-4 text-lg font-black">Review your cart</h2>
          <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
            One or more selected products changed since you opened checkout.
            Return to the cart to confirm the latest availability and quantities.
          </p>
          <Link
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5a1f] px-4 text-sm font-bold text-white"
            href="/cart"
          >
            <ChevronLeftIcon className="size-4" />
            Return to cart
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="grid min-w-0 gap-4">
        <section className="border-y border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border">
          <div className="flex items-center gap-2 border-b border-[#e8e8e2] px-4 py-3 dark:border-white/10">
            <PackageCheckIcon className="size-4 text-[#ff5a1f]" />
            <h2 className="text-sm font-black uppercase">Selected products</h2>
          </div>
          <div className="divide-y divide-[#e8e8e2] dark:divide-white/10">
            {cart.items.map((item) => (
              <div
                className="grid grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-4"
                key={item.variantId}
              >
                <div className="relative aspect-square overflow-hidden rounded-[5px] border border-[#e4e4de] bg-[#f4f4f0] dark:border-white/10 dark:bg-white/[0.04]">
                  {item.imageUrl ? (
                    <Image
                      alt={item.productTitle}
                      className="object-contain"
                      fill
                      sizes="60px"
                      src={item.imageUrl}
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[12px] font-bold sm:text-sm">
                    {item.productTitle}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-[#777770] dark:text-[#aaa9a1]">
                    {item.variantTitle} · Qty {item.quantity}
                  </p>
                </div>
                <p className="text-[12px] font-black tabular-nums sm:text-sm">
                  {formatZar(item.lineTotalZar)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-[#e8e8e2] bg-white px-3 py-4 dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border sm:px-5 sm:py-5">
          <div className="flex items-center gap-2">
            <MapPinIcon className="size-4 text-[#ff5a1f]" />
            <h2 className="text-sm font-black uppercase">Contact and delivery</h2>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="checkout-name">Full name *</Label>
              <Input
                autoComplete="name"
                className={fieldClass}
                id="checkout-name"
                onChange={(event) =>
                  setCustomer((current) => ({ ...current, name: event.target.value }))
                }
                required
                value={customer.name}
              />
            </label>
            <label className="grid gap-1.5">
              <Label htmlFor="checkout-email">Email *</Label>
              <Input
                autoComplete="email"
                className={fieldClass}
                id="checkout-email"
                onChange={(event) =>
                  setCustomer((current) => ({ ...current, email: event.target.value }))
                }
                required
                type="email"
                value={customer.email}
              />
            </label>
            <label className="grid gap-1.5">
              <Label htmlFor="checkout-phone">Phone *</Label>
              <Input
                autoComplete="tel"
                className={fieldClass}
                id="checkout-phone"
                onChange={(event) =>
                  setCustomer((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="082 123 4567"
                required
                type="tel"
                value={customer.phone}
              />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="checkout-address-1">Street address *</Label>
              <Input
                autoComplete="address-line1"
                className={fieldClass}
                id="checkout-address-1"
                onChange={(event) => updateAddress("addressLine1", event.target.value)}
                required
                value={address.addressLine1}
              />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="checkout-address-2">Complex, unit or building</Label>
              <Input
                autoComplete="address-line2"
                className={fieldClass}
                id="checkout-address-2"
                onChange={(event) => updateAddress("addressLine2", event.target.value)}
                value={address.addressLine2}
              />
            </label>
            <label className="grid gap-1.5">
              <Label htmlFor="checkout-suburb">Suburb *</Label>
              <Input
                autoComplete="address-level3"
                className={fieldClass}
                id="checkout-suburb"
                onChange={(event) => updateAddress("suburb", event.target.value)}
                required
                value={address.suburb}
              />
            </label>
            <label className="grid gap-1.5">
              <Label htmlFor="checkout-city">City *</Label>
              <Input
                autoComplete="address-level2"
                className={fieldClass}
                id="checkout-city"
                onChange={(event) => updateAddress("city", event.target.value)}
                required
                value={address.city}
              />
            </label>
            <label className="grid gap-1.5">
              <Label htmlFor="checkout-province">Province *</Label>
              <select
                autoComplete="address-level1"
                className={fieldClass}
                id="checkout-province"
                onChange={(event) => updateAddress("province", event.target.value)}
                required
                value={address.province}
              >
                <option value="">Select province</option>
                {southAfricanProvinces.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <Label htmlFor="checkout-postal-code">Postal code *</Label>
              <Input
                autoComplete="postal-code"
                className={fieldClass}
                id="checkout-postal-code"
                inputMode="numeric"
                onChange={(event) => updateAddress("postalCode", event.target.value)}
                required
                value={address.postalCode}
              />
            </label>
          </div>

          <Button
            className="mt-5 h-11 w-full rounded-md border-[#d8d8d1] bg-white font-bold text-[#080808] shadow-none hover:border-[#ff5a1f] hover:bg-orange-50 dark:border-white/15 dark:bg-white/[0.04] dark:text-white"
            disabled={!isAddressComplete(address) || isLoadingQuotes}
            onClick={() => void requestDeliveryQuotes()}
            type="button"
            variant="outline"
          >
            {isLoadingQuotes ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <TruckIcon className="size-4" />
            )}
            {quotes ? "Refresh delivery rates" : "Calculate delivery"}
          </Button>
        </section>

        {quotes ? (
          <section className="border-y border-[#e8e8e2] bg-white px-3 py-4 dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border sm:px-5 sm:py-5">
            <div className="flex items-center gap-2">
              <TruckIcon className="size-4 text-[#ff5a1f]" />
              <h2 className="text-sm font-black uppercase">Delivery options</h2>
            </div>
            <div className="mt-4 grid gap-5">
              {quotes.groups.map((group) => (
                <fieldset className="min-w-0" key={group.groupKey}>
                  <legend className="text-xs font-bold">{group.label}</legend>
                  {group.options.length > 0 ? (
                    <div className="mt-2 grid gap-2">
                      {group.options.map((option) => {
                        const checked =
                          selectedQuoteByGroup[group.groupKey] === option.quoteId;

                        return (
                          <label
                            className={cn(
                              "grid cursor-pointer grid-cols-[1.1rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md border px-3 py-3 transition",
                              checked
                                ? "border-[#ff5a1f] bg-[#fff8f4] dark:bg-[#ff5a1f]/8"
                                : "border-[#deded7] hover:border-[#ff5a1f]/60 dark:border-white/12",
                            )}
                            key={option.quoteId}
                          >
                            <input
                              checked={checked}
                              className="size-4 accent-[#ff5a1f]"
                              name={`delivery-${group.groupKey}`}
                              onChange={() =>
                                setSelectedQuoteByGroup((current) => ({
                                  ...current,
                                  [group.groupKey]: option.quoteId,
                                }))
                              }
                              type="radio"
                              value={option.quoteId}
                            />
                            <span className="min-w-0">
                              <span className="block text-[12px] font-bold sm:text-sm">
                                {option.label}
                              </span>
                              {option.deliveryInformation ? (
                                <span className="mt-0.5 block text-[10px] leading-4 text-[#777770] dark:text-[#aaa9a1]">
                                  {option.deliveryInformation}
                                </span>
                              ) : null}
                            </span>
                            <strong className="text-[12px] tabular-nums sm:text-sm">
                              {formatZar(option.amountZar)}
                            </strong>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] leading-4 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                      {group.unavailableReason ?? "Delivery is unavailable."}
                    </p>
                  )}
                </fieldset>
              ))}
            </div>
          </section>
        ) : null}

        {jurgensSchedulingGroup?.scheduling ? (
          <section className="border-y border-[#e8e8e2] bg-white px-3 py-4 dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border sm:px-5 sm:py-5">
            <div className="flex items-center gap-2">
              <CalendarClockIcon className="size-4 text-[#ff5a1f]" />
              <h2 className="text-sm font-black uppercase">
                Schedule Jurgens delivery
              </h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
              Choose when Jurgens Energy should deliver the local items in this
              order.
            </p>

            <div className="mt-4 grid max-h-[22rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {jurgensSchedulingGroup.scheduling.options.map((option) => {
                const checked =
                  jurgensDeliverySchedule?.date === option.date &&
                  jurgensDeliverySchedule.windowStart === option.windowStart &&
                  jurgensDeliverySchedule.windowEnd === option.windowEnd;

                return (
                  <label
                    className={cn(
                      "grid cursor-pointer grid-cols-[1.1rem_minmax(0,1fr)] gap-2 rounded-md border px-3 py-2.5 transition",
                      checked
                        ? "border-[#ff5a1f] bg-[#fff8f4] dark:bg-[#ff5a1f]/8"
                        : "border-[#deded7] hover:border-[#ff5a1f]/60 dark:border-white/12",
                    )}
                    key={option.value}
                  >
                    <input
                      checked={checked}
                      className="mt-1 size-4 accent-[#ff5a1f]"
                      name="jurgens-delivery-schedule"
                      onChange={() =>
                        setJurgensDeliverySchedule((current) => ({
                          date: option.date,
                          deliveryInstructions:
                            current?.deliveryInstructions ?? "",
                          windowEnd: option.windowEnd,
                          windowLabel: option.windowLabel,
                          windowStart: option.windowStart,
                        }))
                      }
                      type="radio"
                      value={option.value}
                    />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold">
                        {option.dateLabel}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-[#666660] dark:text-[#aaa9a1]">
                        {option.windowLabel} · {option.windowStart}-
                        {option.windowEnd}
                      </span>
                      {option.isSameDay ? (
                        <span className="mt-1 inline-flex rounded-[3px] bg-[#ff5a1f] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                          Same day
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>

            <label className="mt-4 grid gap-1.5">
              <Label htmlFor="jurgens-delivery-instructions">
                Delivery instructions
              </Label>
              <textarea
                className={cn(fieldClass, "h-24 py-3")}
                id="jurgens-delivery-instructions"
                maxLength={500}
                onChange={(event) =>
                  setJurgensDeliverySchedule((current) =>
                    current
                      ? {
                          ...current,
                          deliveryInstructions: event.target.value,
                        }
                      : current,
                  )
                }
                placeholder="Gate code, preferred entrance, delivery notes..."
                value={jurgensDeliverySchedule?.deliveryInstructions ?? ""}
              />
            </label>
          </section>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 border-y border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 sm:rounded-md sm:border">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        ) : null}
      </div>

      <aside className="sticky top-4 overflow-hidden border-y border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border">
        <div className="border-b border-[#e8e8e2] px-4 py-3 dark:border-white/10 sm:px-5">
          <h2 className="text-sm font-black uppercase">Payment summary</h2>
        </div>
        <div className="grid gap-3 px-4 py-4 text-sm sm:px-5 sm:py-5">
          <div className="flex justify-between gap-4 text-[#666660] dark:text-[#aaa9a1]">
            <span>Products</span>
            <span className="tabular-nums">{formatZar(subtotal)}</span>
          </div>
          <div className="flex justify-between gap-4 text-[#666660] dark:text-[#aaa9a1]">
            <span>Delivery</span>
            <span className="tabular-nums">
              {quotes ? formatZar(shippingTotal) : "Not calculated"}
            </span>
          </div>
          <div className="mt-1 flex items-end justify-between gap-4 border-t border-[#e8e8e2] pt-4 dark:border-white/10">
            <span className="font-bold">Total</span>
            <span className="text-xl font-black tabular-nums">
              {formatZar(grandTotal)}
            </span>
          </div>
          <Button
            className="mt-2 h-12 rounded-md bg-[#ff5a1f] text-sm font-bold text-white hover:bg-[#e84c15]"
            disabled={!canCreateOrder}
            onClick={() => void startHostedCheckout()}
            type="button"
          >
            {isCreatingOrder ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <LockKeyholeIcon className="size-4" />
            )}
            Continue to PayFast
          </Button>
          <div className="mt-1 grid gap-2 text-[10px] leading-4 text-[#666660] dark:text-[#aaa9a1]">
            <p className="flex items-center gap-2">
              <CheckCircle2Icon className="size-3.5 text-emerald-600" />
              VAT included in product prices.
            </p>
            <p className="flex items-center gap-2">
              <LockKeyholeIcon className="size-3.5 text-[#ff5a1f]" />
              Pay securely on PayFast hosted checkout.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
