import Image from "next/image";
import Link from "next/link";
import { FlameIcon, RefreshCcwIcon, StarIcon } from "lucide-react";

import { MarketplaceProductFulfillmentBadge } from "@/components/marketplace/product-fulfillment-badge";
import { ProductCardQuickAddButton } from "@/components/marketplace/product-card-quick-add-button";
import { ProductCardQuickLook } from "@/components/marketplace/product-card-quick-look";
import { ProductCardVideoPreview } from "@/components/marketplace/product-card-video-preview";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MarketplaceProductCard as MarketplaceProductCardData } from "@/src/modules/marketplace/catalog";
import { getSoldQuantityLabel } from "@/src/modules/marketplace/product-variant-presentation";
import {
  getMarketplaceStockStatusLabel,
  type MarketplaceStockStatus,
} from "@/src/modules/marketplace/stock-status";

export function MarketplaceProductCard({
  priceTaxDisclosure = "Final price",
  product,
}: {
  priceTaxDisclosure?: string;
  product: MarketplaceProductCardData;
}) {
  const productHref = `/products/${product.slug}`;
  const detailLabel =
    product.category?.name ?? product.brandName ?? "Jurgens Energy";
  const soldLabel = getSoldQuantityLabel(product.soldQuantity);
  const performanceBadge = getProductCardPerformanceBadge(
    product.soldQuantity,
    soldLabel,
  );
  const lowStockLabel = getProductCardLowStockLabel(product.lowStockQuantity);
  const displayImageUrl =
    product.coverImageUrl ?? product.previewVideo?.posterUrl ?? null;
  const imageBadgeStackClassName = cn(
    "absolute left-0 top-0 z-10 flex flex-col items-start gap-px",
    product.isOnSale
      ? "right-7 max-w-[calc(100%-1.75rem)] sm:right-8 sm:max-w-[calc(100%-2rem)]"
      : "max-w-[78%]",
  );
  const productImage = displayImageUrl ? (
    <Image
      alt={product.title}
      className="marketplace-product-card-media object-cover"
      fill
      loading="eager"
      quality={90}
      sizes="(min-width: 1280px) 220px, (min-width: 768px) 25vw, 50vw"
      src={displayImageUrl}
    />
  ) : (
    <div className="marketplace-product-card-media grid size-full place-items-center text-[#ff5a1f]">
      <FlameIcon className="size-10 stroke-[1.4] sm:size-12" />
    </div>
  );

  return (
    <article className="marketplace-product-card relative flex min-w-0 w-full flex-col overflow-hidden rounded-lg border border-[#e8e8e2] bg-white text-left shadow-[0_4px_14px_rgba(8,8,8,0.04)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none sm:rounded-xl">
      <Link
        aria-label={`View ${product.title}`}
        className="absolute inset-0 z-10"
        data-analytics-event="select_item"
        data-analytics-item-brand={product.brandName ?? undefined}
        data-analytics-item-category={product.category?.name ?? undefined}
        data-analytics-item-id={product.id}
        data-analytics-item-name={product.title}
        href={productHref}
        prefetch={false}
      />

      <div className="pointer-events-none relative z-20 flex flex-col">
        <div
          className="relative aspect-[1/1] h-auto min-w-0 w-full shrink-0 overflow-hidden bg-[#f7f7f2] dark:bg-[#1a1a1a]"
          data-product-card-media-container=""
        >
          {product.previewVideo ? (
            <ProductCardVideoPreview
              analytics={{
                brandName: product.brandName,
                categoryName: product.category?.name ?? null,
                productId: product.id,
                productName: product.title,
              }}
              preview={product.previewVideo}
            >
              {productImage}
            </ProductCardVideoPreview>
          ) : (
            productImage
          )}

          <div className={imageBadgeStackClassName}>
            <MarketplaceProductFulfillmentBadge
              className="rounded-r-[3px]"
              fulfillmentMode={product.fulfillmentMode}
            />
            {product.hasExchangeOption ? (
              <Badge className="inline-flex h-[15px] max-w-full items-center gap-0.5 rounded-l-none rounded-r-[3px] bg-[#ffb000] px-1 text-[6.5px] font-black uppercase leading-none text-[#080808] shadow-[0_4px_8px_rgba(8,8,8,0.14)] sm:h-4 sm:text-[8px]">
                <RefreshCcwIcon className="size-2.5 shrink-0 sm:size-3" />
                <span className="truncate">Exchange</span>
              </Badge>
            ) : null}

            <Badge
              className={cn(
                "h-[15px] rounded-l-none rounded-r-[3px] px-1 text-[6.5px] font-black uppercase leading-none shadow-[0_4px_8px_rgba(8,8,8,0.14)] sm:h-4 sm:text-[8px]",
                getProductCardStockBadgeClassName(product.stockStatus),
              )}
            >
              {getMarketplaceStockStatusLabel(product.stockStatus)}
            </Badge>
          </div>
          {product.isOnSale ? (
            <Badge className="marketplace-card-sale-badge absolute right-0 top-0 z-20 inline-flex h-[15px] max-w-[88px] items-center rounded-l-[3px] rounded-r-none bg-[#ff5a1f] px-1 text-[6.5px] font-black uppercase leading-none text-white shadow-[0_4px_8px_rgba(8,8,8,0.14)] sm:h-4 sm:max-w-[104px] sm:text-[8px]">
              <span className="truncate">{product.saleBadgeText ?? "Sale"}</span>
            </Badge>
          ) : null}
          <ProductCardQuickLook
            priceTaxDisclosure={priceTaxDisclosure}
            product={product}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-px px-1.5 pb-1.5 pt-1 sm:px-2 sm:pb-2 sm:pt-1.5">
          <h3 className="truncate text-[11px] font-bold leading-[1.12] text-[#080808] dark:text-[#f7f7f2] sm:text-[12px] sm:leading-[1.15]">
            {product.title}
          </h3>
          <p className="flex min-w-0 items-center gap-1 text-[8px] leading-none text-[#7a7a73] dark:text-[#b8b8ae] sm:text-[9px]">
            <span className="min-w-0 truncate font-bold uppercase">
              {product.brandName ?? detailLabel}
            </span>
            {product.averageRating && product.reviewCount > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 font-bold text-[#080808] dark:text-[#f7f7f2]">
                <StarIcon
                  aria-hidden="true"
                  className="size-2.5 fill-[#ff5a1f] text-[#ff5a1f] sm:size-3"
                />
                {formatCardRating(product.averageRating)}
              </span>
            ) : null}
            {soldLabel ? (
              <span className="marketplace-card-sold-proof inline-flex shrink-0 items-center gap-0.5 font-semibold text-[#ff5a1f]">
                <FlameIcon
                  aria-hidden="true"
                  className="marketplace-card-flame size-2.5 fill-current sm:size-3"
                />
                {soldLabel}
              </span>
            ) : null}
          </p>
          <div className="flex min-w-0 items-start gap-1">
            <ProductCardPrice
              compareAtLabel={product.compareAtPriceLabel}
              discountLabel={product.discountLabel}
              label={product.priceLabel}
              priceTaxDisclosure={priceTaxDisclosure}
            />
            <ProductCardQuickAddButton
              className="pointer-events-auto relative z-30 ml-auto"
              product={product}
            />
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-0.5 sm:gap-1">
            {lowStockLabel ? (
              <span className="inline-flex items-center whitespace-nowrap text-[8px] font-semibold leading-none text-[#ff5a1f] sm:text-[10px]">
                {lowStockLabel}
              </span>
            ) : null}
            {product.variantCount > 1 ? (
              <span className="rounded-[3px] bg-[#f7f7f2] px-1 py-0.5 text-[7px] font-black uppercase leading-none text-[#6a6a63] dark:bg-white/10 dark:text-zinc-300 sm:px-1.5 sm:text-[9px]">
                {product.variantCount} options
              </span>
            ) : null}
          </div>
          <ProductCardPerformanceMarquee badge={performanceBadge} />
        </div>
      </div>
    </article>
  );
}

function getProductCardStockBadgeClassName(status: MarketplaceStockStatus) {
  if (status === "low_stock") {
    return "bg-[#ffb000] text-[#080808]";
  }

  if (status === "in_stock") {
    return "bg-[#ff5a1f] text-white";
  }

  return "bg-[#1a1a1a] text-white dark:bg-[#f7f7f2] dark:text-[#080808]";
}

function formatCardRating(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function getProductCardLowStockLabel(quantity: number | null) {
  if (!quantity) {
    return null;
  }

  return quantity === 1 ? "Only 1 left" : `Only ${quantity} left`;
}

type ProductCardPerformanceBadge = {
  detail: string;
  label: string;
  tone: "best-seller" | "popular";
};

function ProductCardPerformanceMarquee({
  badge,
}: {
  badge: ProductCardPerformanceBadge | null;
}) {
  if (!badge) {
    return null;
  }

  return (
    <div className="min-w-0 pt-px">
      <span
        className={
          badge.tone === "best-seller"
            ? "marketplace-card-performance inline-flex max-w-full items-center gap-0.5 rounded-[3px] bg-[#ff5a1f] px-1 py-0.5 text-[7px] font-black uppercase leading-none text-white sm:gap-1 sm:px-1.5 sm:text-[8px]"
            : "marketplace-card-performance inline-flex max-w-full items-center gap-0.5 rounded-[3px] bg-orange-50 px-1 py-0.5 text-[7px] font-black uppercase leading-none text-[#ff5a1f] ring-1 ring-[#ff5a1f]/15 dark:bg-orange-500/10 sm:gap-1 sm:px-1.5 sm:text-[8px]"
        }
      >
        <FlameIcon
          aria-hidden="true"
          className="marketplace-card-flame size-2.5 shrink-0 fill-current sm:size-3"
        />
        <span className="min-w-0 truncate">{badge.label}</span>
        <span aria-hidden="true" className="opacity-70">
          |
        </span>
        <span className="shrink-0 normal-case">{badge.detail}</span>
      </span>
    </div>
  );
}

function getProductCardPerformanceBadge(
  soldQuantity: number,
  soldLabel: string | null,
): ProductCardPerformanceBadge | null {
  if (!soldLabel || soldQuantity < 10) {
    return null;
  }

  if (soldQuantity >= 100) {
    return {
      detail: soldLabel,
      label: "Best seller",
      tone: "best-seller",
    };
  }

  return {
    detail: soldLabel,
    label: "Popular pick",
    tone: "popular",
  };
}

function ProductCardPrice({
  compareAtLabel,
  discountLabel,
  label,
  priceTaxDisclosure,
}: {
  compareAtLabel: string | null;
  discountLabel: string | null;
  label: string;
  priceTaxDisclosure: string;
}) {
  const fromPrefix = "From ";
  const currentLabel = label.startsWith(fromPrefix)
    ? label.slice(fromPrefix.length)
    : label;
  const priceRow = (
    <span className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-1">
      <span className="truncate text-[15px] font-bold leading-none text-[#080808] dark:text-[#f7f7f2] sm:text-[17px]">
        {currentLabel}
      </span>
      {compareAtLabel ? (
        <span className="text-[9px] font-medium leading-none text-slate-400 line-through dark:text-zinc-500 sm:text-[10px]">
          {compareAtLabel}
        </span>
      ) : null}
      {discountLabel ? (
        <span className="rounded-sm bg-[#ff5a1f] px-1 py-0.5 text-[7px] font-bold uppercase leading-none text-white sm:px-1.5 sm:text-[8px]">
          {discountLabel}
        </span>
      ) : null}
    </span>
  );

  return (
    <div className="min-w-0 flex-1 leading-none">
      {priceRow}
      <span className="mt-0.5 block text-[7px] font-medium leading-none text-[#6a6a63] dark:text-zinc-400 sm:text-[8px]">
        {priceTaxDisclosure}
      </span>
    </div>
  );
}
