import Image from "next/image";
import Link from "next/link";
import {
  FlameIcon,
  RefreshCcwIcon,
  TruckIcon,
} from "lucide-react";

import { ProductCardQuickAddButton } from "@/components/marketplace/product-card-quick-add-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MarketplaceProductCard as MarketplaceProductCardData } from "@/src/modules/marketplace/catalog";

export function MarketplaceProductCard({
  product,
}: {
  product: MarketplaceProductCardData;
}) {
  const productHref = `/products/${product.slug}`;
  const deliveryLabel =
    product.fulfillmentMode === "piessang_fulfilled" ? "Local" : "Courier";
  const deliveryBadgeClass =
    product.fulfillmentMode === "piessang_fulfilled"
      ? "bg-emerald-500 text-white"
      : "bg-[#1a1a1a] text-white dark:bg-[#f7f7f2] dark:text-[#080808]";
  const detailLabel = product.category?.name ?? product.brandName ?? "Jurgens Energy";

  return (
    <article className="group relative min-w-0 w-full overflow-hidden rounded-[5px] border border-[#e8e8e2] bg-white text-left shadow-[0_4px_14px_rgba(8,8,8,0.04)] transition hover:border-[#ff5a1f]/55 hover:shadow-[0_12px_28px_rgba(8,8,8,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none sm:rounded-md">
      <Link
        aria-label={`View ${product.title}`}
        className="absolute inset-0 z-10"
        href={productHref}
      />

      <div className="pointer-events-none relative z-20">
        <div className="relative aspect-square w-full overflow-hidden bg-[#f7f7f2] dark:bg-[#1a1a1a]">
          {product.coverImageUrl ? (
            <Image
              alt={product.title}
              className="object-cover transition duration-300 group-hover:scale-[1.04]"
              fill
              sizes="(min-width: 1280px) 220px, (min-width: 768px) 25vw, 50vw"
              src={product.coverImageUrl}
            />
          ) : (
            <div className="grid size-full place-items-center text-[#ff5a1f]">
              <FlameIcon className="size-10 stroke-[1.4] sm:size-12" />
            </div>
          )}

          <div className="absolute left-0 top-0 z-10 flex max-w-[78%] flex-col items-start gap-px">
            <Badge
              className={cn(
                "inline-flex h-[15px] max-w-full items-center gap-0.5 rounded-none px-1 text-[6.5px] font-black uppercase leading-none shadow-[0_4px_8px_rgba(8,8,8,0.14)] sm:h-4 sm:text-[8px]",
                deliveryBadgeClass,
              )}
            >
              <TruckIcon className="size-2.5 shrink-0 sm:size-3" />
              <span className="truncate">{deliveryLabel}</span>
            </Badge>
            {product.hasExchangeOption ? (
              <Badge className="inline-flex h-[15px] max-w-full items-center gap-0.5 rounded-none bg-[#ffb000] px-1 text-[6.5px] font-black uppercase leading-none text-[#080808] shadow-[0_4px_8px_rgba(8,8,8,0.14)] sm:h-4 sm:text-[8px]">
                <RefreshCcwIcon className="size-2.5 shrink-0 sm:size-3" />
                <span className="truncate">Exchange</span>
              </Badge>
            ) : null}

            <Badge
              className={
                product.inStock
                  ? "h-[15px] rounded-none bg-[#ff5a1f] px-1 text-[6.5px] font-black uppercase leading-none text-white shadow-[0_4px_8px_rgba(8,8,8,0.14)] sm:h-4 sm:text-[8px]"
                  : "h-[15px] rounded-none bg-[#1a1a1a] px-1 text-[6.5px] font-black uppercase leading-none text-white shadow-[0_4px_8px_rgba(8,8,8,0.14)] dark:bg-[#f7f7f2] dark:text-[#080808] sm:h-4 sm:text-[8px]"
              }
            >
              {product.inStock ? "In stock" : "Backorder"}
            </Badge>
          </div>
          {product.isOnSale ? (
            <Badge className="absolute right-0 top-0 z-10 h-[15px] rounded-none bg-[#ff5a1f] px-1 text-[6.5px] font-black uppercase leading-none text-white shadow-[0_4px_8px_rgba(8,8,8,0.14)] sm:h-4 sm:text-[8px]">
              Sale
            </Badge>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-0.5 px-1.5 pb-1.5 pt-1.5 sm:gap-1 sm:px-2.5 sm:pb-2.5 sm:pt-2">
          <h3 className="line-clamp-2 text-[11px] font-black leading-[1.12] text-[#080808] dark:text-[#f7f7f2] sm:text-[13px] sm:leading-[1.2]">
            {product.title}
          </h3>
          <p className="truncate text-[8px] font-bold uppercase leading-none text-[#7a7a73] dark:text-[#b8b8ae] sm:text-[10px]">
            {product.brandName ?? detailLabel}
          </p>
          <div className="min-w-0 pr-8">
            <ProductCardPrice
              compareAtLabel={product.compareAtPriceLabel}
              discountLabel={product.discountLabel}
              label={product.priceLabel}
            />
          </div>

          <div className="flex min-w-0 flex-wrap gap-0.5 pr-8 sm:gap-1">
            <span className="rounded-[3px] bg-orange-50 px-1 py-0.5 text-[7px] font-black uppercase leading-none text-[#ff5a1f] dark:bg-orange-500/10 sm:px-1.5 sm:text-[9px]">
              Incl. VAT
            </span>
            {product.variantCount > 1 ? (
              <span className="rounded-[3px] bg-[#f7f7f2] px-1 py-0.5 text-[7px] font-black uppercase leading-none text-[#6a6a63] dark:bg-white/10 dark:text-zinc-300 sm:px-1.5 sm:text-[9px]">
                {product.variantCount} options
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <ProductCardQuickAddButton
        className="absolute bottom-1.5 right-1.5 z-30 size-7 rounded-full shadow-[0_8px_18px_rgba(255,90,31,0.28)] sm:bottom-2 sm:right-2 sm:size-8"
        product={product}
      />
    </article>
  );
}

function ProductCardPrice({
  compareAtLabel,
  discountLabel,
  label,
}: {
  compareAtLabel: string | null;
  discountLabel: string | null;
  label: string;
}) {
  const fromPrefix = "From ";
  const currentLabel = label.startsWith(fromPrefix)
    ? label.slice(fromPrefix.length)
    : label;
  const priceRow = (
    <span className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-1">
      <span className="truncate text-[16px] font-black leading-none sm:text-[18px]">
        {currentLabel}
      </span>
      {compareAtLabel ? (
        <span className="text-[9px] font-bold leading-none text-slate-400 line-through dark:text-zinc-500 sm:text-[10px]">
          {compareAtLabel}
        </span>
      ) : null}
      {discountLabel ? (
        <span className="rounded-sm bg-orange-50 px-1 py-0.5 text-[7px] font-black uppercase leading-none text-[#ff5a1f] dark:bg-orange-500/10 sm:px-1.5 sm:text-[8px]">
          {discountLabel}
        </span>
      ) : null}
    </span>
  );

  if (label.startsWith(fromPrefix)) {
    return (
      <div className="mt-0.5 min-w-0 leading-none text-[#080808] dark:text-[#f7f7f2]">
        <span className="block text-[8px] font-black uppercase leading-none text-[#ff5a1f] sm:text-[10px]">
          From
        </span>
        {priceRow}
      </div>
    );
  }

  return (
    <div className="mt-1 min-w-0 text-[#080808] dark:text-[#f7f7f2]">
      {priceRow}
    </div>
  );
}
