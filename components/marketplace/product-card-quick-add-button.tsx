"use client";

import Link from "next/link";
import { CheckIcon, PlusIcon, ShoppingCartIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { addLocalCartItem } from "@/src/modules/cart";
import { trackGoogleEvent } from "@/src/modules/analytics/google";
import type { MarketplaceProductCard as MarketplaceProductCardData } from "@/src/modules/marketplace/catalog";

type ProductCardQuickAddButtonProps = {
  className?: string;
  product: MarketplaceProductCardData;
};

const quickAddPillClass =
  "marketplace-card-quick-add inline-flex h-7 min-w-10 shrink-0 items-center justify-center rounded-full border border-[#080808]/80 bg-white px-2 text-[#080808] shadow-[0_4px_12px_rgba(8,8,8,0.10)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/25 dark:border-[#f7f7f2]/80 dark:bg-[#f7f7f2] dark:text-[#080808] sm:h-8 sm:min-w-11";

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
          quickAddPillClass,
          className,
        )}
        data-analytics-event="select_item"
        data-analytics-item-brand={product.brandName ?? undefined}
        data-analytics-item-category={product.category?.name ?? undefined}
        data-analytics-item-id={product.id}
        data-analytics-item-name={product.title}
        href={productHref}
        prefetch={false}
        title="Choose options"
      >
        <QuickAddGlyph />
      </Link>
    );
  }

  return (
    <button
      aria-label={added ? `${product.title} added to cart` : `Add ${product.title} to cart`}
      className={cn(
        quickAddPillClass,
        added &&
          "marketplace-card-quick-add-added border-emerald-600 bg-emerald-600 text-white dark:border-emerald-600 dark:bg-emerald-600 dark:text-white",
        className,
      )}
      onClick={handleQuickAdd}
      title={added ? "Added" : "Add to cart"}
      type="button"
    >
      <QuickAddGlyph added={added} />
    </button>
  );
}

function QuickAddGlyph({ added = false }: { added?: boolean }) {
  return (
    <span className="relative inline-grid h-5 w-6 place-items-center">
      {added ? (
        <CheckIcon className="size-3.5 stroke-[2.6]" />
      ) : (
        <>
          <ShoppingCartIcon className="size-3.5 stroke-[2.25]" />
          <PlusIcon className="absolute -right-0.5 -top-0.5 size-2.5 text-[#080808] stroke-[3] dark:text-[#080808]" />
        </>
      )}
    </span>
  );
}
