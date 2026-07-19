"use client";

import Link from "next/link";
import { CheckIcon, ShoppingCartIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { addLocalCartItem } from "@/src/modules/cart";
import { trackGoogleEvent } from "@/src/modules/analytics/google";
import type { MarketplaceProductCard as MarketplaceProductCardData } from "@/src/modules/marketplace/catalog";

type ProductCardQuickAddButtonProps = {
  className?: string;
  product: MarketplaceProductCardData;
};

export function ProductCardQuickAddButton({
  className,
  product,
}: ProductCardQuickAddButtonProps) {
  const [added, setAdded] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productHref = `/products/${product.slug}`;
  const canQuickAdd = Boolean(product.quickAddVariantId);

  useEffect(
    () => () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    },
    [],
  );

  function handleQuickAdd() {
    if (!product.quickAddVariantId) {
      return;
    }

    addLocalCartItem({
      brandName: product.brandName,
      imageUrl: product.coverImageUrl,
      priceLabel: product.priceLabel,
      productId: product.id,
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
          quantity: 1,
        },
      ],
    });

    setAdded(true);

    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    resetTimeoutRef.current = setTimeout(() => setAdded(false), 1400);
  }

  if (!canQuickAdd) {
    return (
      <Link
        aria-label={`Choose options for ${product.title}`}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-md bg-[#ff5a1f] text-white transition hover:bg-[#e84c15] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/25",
          className,
        )}
        data-analytics-event="select_item"
        data-analytics-item-brand={product.brandName ?? undefined}
        data-analytics-item-category={product.category?.name ?? undefined}
        data-analytics-item-id={product.id}
        data-analytics-item-name={product.title}
        href={productHref}
        title="Choose options"
      >
        <ShoppingCartIcon className="size-4" />
      </Link>
    );
  }

  return (
    <button
      aria-label={added ? `${product.title} added to cart` : `Add ${product.title} to cart`}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md bg-[#ff5a1f] text-white transition hover:bg-[#e84c15] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/25",
        added && "bg-emerald-600 hover:bg-emerald-600",
        className,
      )}
      onClick={handleQuickAdd}
      title={added ? "Added" : "Add to cart"}
      type="button"
    >
      {added ? (
        <CheckIcon className="size-4" />
      ) : (
        <ShoppingCartIcon className="size-4" />
      )}
    </button>
  );
}
