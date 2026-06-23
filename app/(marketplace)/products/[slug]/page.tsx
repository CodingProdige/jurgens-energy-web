import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageIcon, ShieldCheckIcon, StoreIcon, TruckIcon } from "lucide-react";
import type { Metadata } from "next";

import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { Badge } from "@/components/ui/badge";
import { formatFromZar } from "@/src/modules/currency";
import { getCurrencyContext } from "@/src/modules/currency/server";
import { getMarketplaceProductBySlug } from "@/src/modules/marketplace/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const currencyContext = await getCurrencyContext();
  const product = await getMarketplaceProductBySlug(slug, currencyContext);

  if (!product) {
    return {
      title: "Product",
      description: "Shop Piessang marketplace products.",
    };
  }

  return {
    title: product.title,
    description:
      product.shortDescription ??
      product.description ??
      `Shop ${product.title} on Piessang.`,
    openGraph: {
      images: product.coverImageUrl ? [product.coverImageUrl] : undefined,
      title: product.title,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currencyContext = await getCurrencyContext();
  const product = await getMarketplaceProductBySlug(slug, currencyContext);

  if (!product) {
    notFound();
  }

  const primaryImage = product.imageUrls[0] ?? product.coverImageUrl;
  const description =
    product.fullDescription ?? product.description ?? product.shortDescription;

  return (
    <MarketplaceGate>
      <MarketplaceHeader />
      <main className="mx-auto grid w-[min(1180px,calc(100%-2rem))] gap-8 py-6">
        <nav className="text-sm text-slate-500 dark:text-zinc-400">
          <Link className="font-semibold text-[#8a641f] hover:text-[#5f4416]" href="/">
            Shop
          </Link>
          {product.category ? (
            <>
              <span className="px-2">/</span>
              <Link
                className="font-semibold text-[#8a641f] hover:text-[#5f4416]"
                href={`/categories/${product.category.slug}`}
              >
                {product.category.name}
              </Link>
            </>
          ) : null}
        </nav>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="grid min-w-0 gap-4">
            <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              {primaryImage ? (
                <Image
                  alt={product.title}
                  className="object-contain"
                  fill
                  priority
                  sizes="(min-width: 1024px) 680px, calc(100vw - 2rem)"
                  src={primaryImage}
                />
              ) : (
                <div className="grid size-full place-items-center text-sm font-semibold text-slate-500">
                  Piessang
                </div>
              )}
            </div>

            {product.imageUrls.length > 1 ? (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                {product.imageUrls.slice(0, 6).map((url) => (
                  <div
                    className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                    key={url}
                  >
                    <Image
                      alt={product.title}
                      className="object-cover"
                      fill
                      sizes="112px"
                      src={url}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="grid h-fit gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {product.brandName ? (
                  <Badge className="rounded-md bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300">
                    {product.brandName}
                  </Badge>
                ) : null}
                <Badge className="rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300">
                  {product.inStock ? "In stock" : "Backorder"}
                </Badge>
              </div>
              <h1 className="break-words text-2xl font-black leading-tight text-zinc-950 dark:text-white sm:text-3xl">
                {product.title}
              </h1>
              <p className="text-2xl font-black text-zinc-950 dark:text-white">
                {product.priceLabel}
              </p>
              {product.shortDescription ? (
                <p className="break-words text-sm leading-6 text-slate-600 dark:text-zinc-400">
                  {product.shortDescription}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <StoreIcon className="size-4 shrink-0 text-[#c4982d]" />
                <span className="min-w-0 truncate">{product.sellerName}</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <TruckIcon className="size-4 shrink-0 text-[#c4982d]" />
                <span>
                  {product.fulfillmentMode === "piessang_fulfilled"
                    ? "Fulfilled by Piessang"
                    : "Seller fulfilled"}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <ShieldCheckIcon className="size-4 shrink-0 text-[#c4982d]" />
                <span>VAT-inclusive pricing</span>
              </div>
            </div>

            <button
              className="h-11 rounded-lg bg-[#c4982d] px-4 text-sm font-bold text-white opacity-60"
              disabled
              type="button"
            >
              Add to cart
            </button>
          </aside>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
              Details
            </h2>
            <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-600 dark:text-zinc-400">
              {description ?? "No product details supplied."}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
              Variants
            </h2>
            <div className="mt-4 grid gap-3">
              {product.variants.map((variant) => (
                <article
                  className="rounded-lg border border-slate-200 p-3 dark:border-white/10"
                  key={variant.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-zinc-950 dark:text-white">
                        {variant.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        {variant.sku}
                      </p>
                    </div>
                    <PackageIcon className="size-4 shrink-0 text-[#c4982d]" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-bold text-zinc-950 dark:text-white">
                      {formatFromZar(variant.price, currencyContext)}
                    </span>
                    <Badge className="rounded-md bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300">
                      {variant.inStock ? `${variant.stockOnHand} in stock` : "Backorder"}
                    </Badge>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <MarketplaceFooter />
    </MarketplaceGate>
  );
}
