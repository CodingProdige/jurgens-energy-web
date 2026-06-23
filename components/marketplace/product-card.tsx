import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { MarketplaceProductCard } from "@/src/modules/marketplace/catalog";

export function MarketplaceProductCard({
  compact = false,
  product,
}: {
  compact?: boolean;
  product: MarketplaceProductCard;
}) {
  if (compact) {
    return (
      <Link
        className="group overflow-hidden rounded-lg bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-white/[0.05]"
        href={`/products/${product.slug}`}
      >
        <div className="relative aspect-[1.65] bg-slate-100 dark:bg-white/[0.06]">
          {product.coverImageUrl ? (
            <Image
              alt={product.title}
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
              fill
              sizes="220px"
              src={product.coverImageUrl}
            />
          ) : (
            <div className="grid size-full place-items-center text-sm font-semibold text-slate-500">
              Piessang
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-black text-zinc-950 dark:text-white">
            {product.sellerName}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-zinc-400">
            {product.category?.name ?? product.brandName ?? "Marketplace"}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      className="group grid overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#c4982d]/45 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03]"
      href={`/products/${product.slug}`}
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-white/[0.06]">
        {product.coverImageUrl ? (
          <Image
            alt={product.title}
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            fill
            sizes="(min-width: 1280px) 280px, (min-width: 768px) 33vw, 50vw"
            src={product.coverImageUrl}
          />
        ) : (
          <div className="grid size-full place-items-center px-6 text-center text-sm font-semibold text-slate-500">
            Piessang
          </div>
        )}
      </div>
      <div className="grid gap-3 p-4">
        <div className="min-w-0">
          <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-zinc-950 dark:text-white">
            {product.title}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-zinc-400">
            {product.brandName ?? product.sellerName}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-zinc-950 dark:text-white">
            {product.priceLabel}
          </p>
          <Badge className="rounded-md bg-emerald-100 text-xs text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300">
            {product.inStock ? "In stock" : "Backorder"}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
