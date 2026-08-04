"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  FlameIcon,
  MinusIcon,
  PackageCheckIcon,
  PlusIcon,
  StarIcon,
  TruckIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { marketplacePrimaryActionBaseClass } from "@/components/marketplace/action-styles";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { addLocalCartItem } from "@/src/modules/cart";
import {
  trackCustomGoogleEvent,
  trackGoogleEvent,
} from "@/src/modules/analytics/google";
import type { MarketplaceProductCard as MarketplaceProductCardData } from "@/src/modules/marketplace/catalog";
import { getSoldQuantityLabel } from "@/src/modules/marketplace/product-variant-presentation";

type ProductCardQuickLookProps = {
  className?: string;
  product: MarketplaceProductCardData;
};

export function ProductCardQuickLook({
  className,
  product,
}: ProductCardQuickLookProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productHref = `/products/${product.slug}`;
  const canQuickAdd = Boolean(product.quickAddVariantId);
  const soldLabel = getSoldQuantityLabel(product.soldQuantity);
  const imageUrl = product.coverImageUrl ?? null;
  const ratingLabel =
    product.averageRating && product.reviewCount > 0
      ? `${formatQuickLookRating(product.averageRating)} (${product.reviewCount})`
      : null;

  useEffect(
    () => () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    },
    [],
  );

  function openQuickLook(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsOpen(true);
    trackCustomGoogleEvent("product_quick_look_open", {
      item_brand: product.brandName ?? undefined,
      item_category: product.category?.name,
      item_id: product.id,
      item_name: product.title,
    });
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);

    if (!open) {
      setQuantity(1);
    }
  }

  function handleAddToCart() {
    if (!product.quickAddVariantId) {
      return;
    }

    addLocalCartItem({
      brandName: product.brandName,
      imageUrl: product.coverImageUrl,
      priceLabel: product.priceLabel,
      productId: product.id,
      quantity,
      slug: product.slug,
      title: product.title,
      variantId: product.quickAddVariantId,
    });

    trackGoogleEvent("add_to_cart", {
      items: [
        {
          affiliation: "Jurgens Energy",
          item_brand: product.brandName ?? undefined,
          item_category: product.category?.name,
          item_id: product.quickAddVariantId,
          item_name: product.title,
          quantity,
        },
      ],
    });

    setAdded(true);

    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    resetTimeoutRef.current = setTimeout(() => setAdded(false), 1400);
  }

  return (
    <>
      <button
        aria-label={`Quick look at ${product.title}`}
        className={cn(
          "pointer-events-auto absolute bottom-1.5 left-1.5 z-30 inline-flex h-6 max-w-[calc(100%-3.25rem)] items-center gap-1 rounded-full bg-white/92 px-1.5 text-[9px] font-black leading-none text-[#080808] shadow-[0_4px_14px_rgba(8,8,8,0.16)] ring-1 ring-[#080808]/10 backdrop-blur-sm transition-colors hover:bg-white hover:text-[#ff5a1f] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/25 dark:bg-[#f7f7f2]/92 dark:text-[#080808] sm:bottom-2 sm:left-2 sm:h-6",
          className,
        )}
        onClick={openQuickLook}
        type="button"
      >
        <EyeIcon aria-hidden="true" className="size-3 shrink-0" />
        <span className="truncate">Quick look</span>
      </button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="bottom-0 left-0 top-auto min-h-0 max-h-[min(90dvh,45rem)] w-full max-w-full translate-x-0 translate-y-0 rounded-b-none rounded-t-xl border border-[#e8e8e2] bg-white p-0 text-[#080808] ring-[#080808]/10 dark:border-white/10 dark:bg-[#101010] dark:text-[#f7f7f2] sm:max-w-full md:bottom-auto md:left-1/2 md:top-1/2 md:w-[min(56rem,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl"
          overlayClassName="bg-black/55"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">
            Quick look at {product.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Preview product details, then add the item to your cart or open the
            full product page.
          </DialogDescription>

          <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,0.95fr)_minmax(20rem,1fr)]">
            <section className="grid min-h-0 content-start gap-2 bg-[#f7f7f2] p-4 dark:bg-[#1a1a1a] md:p-5">
              <div className="relative aspect-[1/1] min-h-0 overflow-hidden rounded-lg bg-white shadow-sm dark:bg-[#101010]">
                {imageUrl ? (
                  <Image
                    alt={product.title}
                    className="object-contain"
                    fill
                    quality={90}
                    sizes="(min-width: 768px) 420px, 100vw"
                    src={imageUrl}
                  />
                ) : (
                  <span className="grid size-full place-items-center text-[#ff5a1f]">
                    <PackageCheckIcon className="size-10" />
                  </span>
                )}
              </div>
              {imageUrl ? (
                <div className="flex gap-2 overflow-hidden">
                  <span className="relative aspect-square h-14 overflow-hidden rounded-md border border-[#ff5a1f] bg-white ring-2 ring-[#ff5a1f]/15 dark:bg-[#101010]">
                    <Image
                      alt={`${product.title} thumbnail`}
                      className="object-contain"
                      fill
                      quality={90}
                      sizes="56px"
                      src={imageUrl}
                    />
                  </span>
                </div>
              ) : null}
            </section>

            <section className="relative grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
              <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_2.5rem] gap-3 border-b border-[#ecece6] px-4 py-3 dark:border-white/10 md:px-5 md:py-4">
                <div className="min-w-0">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-slate-500 dark:text-zinc-400">
                    {soldLabel ? (
                      <span className="inline-flex shrink-0 items-center gap-1 font-bold text-[#ff5a1f]">
                        <FlameIcon
                          aria-hidden="true"
                          className="size-3.5 fill-current"
                        />
                        {soldLabel}
                      </span>
                    ) : (
                      <span className="font-bold text-[#ff5a1f]">New</span>
                    )}
                    {product.brandName ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="text-slate-300 dark:text-zinc-600"
                        >
                          •
                        </span>
                        <span className="min-w-0 truncate">
                          Sold by{" "}
                          <span className="font-semibold text-[#080808] dark:text-[#f7f7f2]">
                            {product.brandName}
                          </span>
                        </span>
                      </>
                    ) : null}
                    {ratingLabel ? (
                      <span className="inline-flex shrink-0 items-center gap-1 font-bold text-[#080808] dark:text-[#f7f7f2]">
                        <StarIcon
                          aria-hidden="true"
                          className="size-3 fill-[#ff5a1f] text-[#ff5a1f]"
                        />
                        {ratingLabel}
                      </span>
                    ) : null}
                  </p>
                  <h2 className="mt-1 text-base font-normal leading-6 text-[#080808] dark:text-[#f7f7f2] md:text-lg md:leading-7">
                    {product.title}
                  </h2>
                </div>
                <DialogClose className="grid size-9 place-items-center rounded-full text-[#080808] transition hover:bg-[#f7f7f2] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/20 dark:text-[#f7f7f2] dark:hover:bg-white/10">
                  <XIcon className="size-5" />
                  <span className="sr-only">Close quick look</span>
                </DialogClose>
              </header>

              <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:none] dark:[color-scheme:dark] md:px-5 [&::-webkit-scrollbar]:hidden">
                <ProductQuickLookPrice product={product} />

                <div className="mt-4 flex min-w-0 flex-wrap gap-2 text-[11px] font-black uppercase leading-none">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600 px-2.5 py-1.5 text-emerald-700 dark:border-emerald-300 dark:text-emerald-300">
                    <TruckIcon className="size-3.5" />
                    Delivery details before payment
                  </span>
                  <span className="rounded-full border border-[#d8d8d2] px-2.5 py-1.5 text-[#080808] dark:border-white/15 dark:text-[#f7f7f2]">
                    Includes VAT
                  </span>
                </div>

                {product.shortDescription ? (
                  <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-zinc-300">
                    {cleanQuickLookText(product.shortDescription)}
                  </p>
                ) : null}

                {canQuickAdd ? (
                  <div className="mt-5 grid gap-2">
                    <span className="text-xs font-black text-[#080808] dark:text-[#f7f7f2]">
                      Qty
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="inline-grid h-10 grid-cols-3 overflow-hidden rounded-md border border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-white/[0.04]">
                        <button
                          aria-label="Decrease quantity"
                          className="grid w-10 place-items-center transition hover:bg-[#f7f7f2] dark:hover:bg-white/10"
                          onClick={() =>
                            setQuantity((current) => Math.max(1, current - 1))
                          }
                          type="button"
                        >
                          <MinusIcon className="size-4" />
                        </button>
                        <span className="grid w-10 place-items-center border-x border-[#e8e8e2] text-sm font-black dark:border-white/10">
                          {quantity}
                        </span>
                        <button
                          aria-label="Increase quantity"
                          className="grid w-10 place-items-center transition hover:bg-[#f7f7f2] dark:hover:bg-white/10"
                          onClick={() => setQuantity((current) => current + 1)}
                          type="button"
                        >
                          <PlusIcon className="size-4" />
                        </button>
                      </div>
                      {soldLabel ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#ff5a1f]">
                          <FlameIcon className="size-3.5 fill-current" />
                          {soldLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-2">
                  {canQuickAdd ? (
                    <button
                      className={cn(
                        marketplacePrimaryActionBaseClass,
                        "inline-flex h-12 w-full rounded-full text-sm normal-case disabled:cursor-not-allowed disabled:bg-emerald-600 disabled:text-white disabled:hover:bg-emerald-600",
                      )}
                      disabled={added}
                      onClick={handleAddToCart}
                      type="button"
                    >
                      {added ? (
                        <>
                          <CheckIcon className="mr-1.5 size-4" />
                          Added to cart
                        </>
                      ) : (
                        "Add to cart"
                      )}
                    </button>
                  ) : (
                    <Link
                      className={cn(
                        marketplacePrimaryActionBaseClass,
                        "inline-flex h-12 w-full rounded-full text-sm normal-case",
                      )}
                      href={productHref}
                    >
                      {product.variantCount > 1 ? "Select an option" : "View product"}
                    </Link>
                  )}

                  <Link
                    className="inline-flex w-fit items-center gap-1 text-xs font-bold text-[#080808] transition hover:text-[#ff5a1f] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/20 dark:text-[#f7f7f2]"
                    href={productHref}
                  >
                    All details
                    <ChevronRightIcon className="size-3.5" />
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProductQuickLookPrice({
  product,
}: {
  product: MarketplaceProductCardData;
}) {
  const fromPrefix = "From ";
  const currentLabel = product.priceLabel.startsWith(fromPrefix)
    ? product.priceLabel.slice(fromPrefix.length)
    : product.priceLabel;

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[26px] font-bold leading-none text-[#080808] dark:text-[#f7f7f2]">
          {currentLabel}
        </span>
        {product.compareAtPriceLabel ? (
          <span className="text-sm font-medium leading-none text-slate-400 line-through dark:text-zinc-500">
            {product.compareAtPriceLabel}
          </span>
        ) : null}
        {product.discountLabel ? (
          <span className="rounded-sm bg-[#ff5a1f] px-1.5 py-0.5 text-[10px] font-black uppercase leading-none text-white">
            {product.discountLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] font-medium leading-4 text-slate-500 dark:text-zinc-400">
        Includes VAT
      </p>
    </div>
  );
}

function formatQuickLookRating(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function cleanQuickLookText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
