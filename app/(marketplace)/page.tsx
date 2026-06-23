import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, MoreHorizontalIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";

import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import {
  MarketplaceHeader,
  marketplaceTrustItems,
} from "@/components/marketplace/marketplace-header";
import { MarketplaceProductCard } from "@/components/marketplace/product-card";
import { Input } from "@/components/ui/input";
import { getCurrencyContext } from "@/src/modules/currency/server";
import { getMarketplaceCatalog } from "@/src/modules/marketplace/catalog";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";

export const metadata: Metadata = {
  title: "Shop",
  description: "Shop active Piessang marketplace products from local sellers.",
};

const fallbackCategoryImages: Record<string, string> = {
  automotive: "🚗",
  beauty: "🧴",
  books: "📚",
  electronics: "🎧",
  fashion: "🧥",
  groceries: "🥬",
  sports: "⚽",
  toys: "🤖",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = Array.isArray(resolvedSearchParams.q)
    ? resolvedSearchParams.q[0]
    : resolvedSearchParams.q;
  const currencyContext = await getCurrencyContext();
  const catalog = await getMarketplaceCatalog({ currencyContext, query });
  const heroProducts = catalog.products.slice(0, 5);
  const categoryTiles = catalog.categories.slice(0, 9);
  const supportProducts = catalog.products.slice(0, 4);

  return (
    <MarketplaceGate>
      <MarketplaceHeader />
      <main className="mx-auto grid w-[min(1180px,calc(100%-2rem))] gap-7 py-5">
        <section className="relative overflow-hidden rounded-xl bg-[#fbf4df] px-6 py-8 shadow-sm dark:bg-[#1c1a14] sm:px-10 lg:min-h-[380px] lg:px-12 lg:py-12">
          <div className="relative z-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="max-w-md">
              <p className="text-sm font-bold text-[#f0b500]">
                Your One-Stop Marketplace
              </p>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-zinc-950 dark:text-white sm:text-5xl">
                Millions of products. Thousands of sellers.
              </h1>
              <p className="mt-4 max-w-sm text-base leading-7 text-slate-600 dark:text-zinc-400">
                Shop from trusted multiple vendors and get the best deals across
                every category.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  className="inline-flex h-11 items-center gap-4 rounded-lg bg-[#ffd000] px-5 text-sm font-black text-zinc-950 shadow-sm transition hover:bg-[#f4bf00]"
                  href="#products"
                >
                  Start Shopping
                  <ArrowRightIcon className="size-4" />
                </Link>
                <Link
                  className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-zinc-950 shadow-sm transition hover:border-[#ffd000] dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                  href="/deals"
                >
                  Explore Deals
                </Link>
              </div>
              <div className="mt-7 hidden items-center gap-3 sm:flex">
                <div className="flex -space-x-2">
                  {["DJ", "IT", "MA", "PS"].map((initials) => (
                    <span
                      className="grid size-8 place-items-center rounded-full border-2 border-[#fbf4df] bg-white text-[10px] font-black text-zinc-950"
                      key={initials}
                    >
                      {initials}
                    </span>
                  ))}
                  <span className="grid size-8 place-items-center rounded-full border-2 border-[#fbf4df] bg-[#ffd000] text-sm font-black text-zinc-950">
                    +
                  </span>
                </div>
                <p className="text-sm leading-5 text-slate-600 dark:text-zinc-400">
                  <span className="font-black text-zinc-950 dark:text-white">10K+</span>{" "}
                  Happy Customers
                  <br />
                  from trusted sellers
                </p>
              </div>
            </div>

            <div className="relative min-h-[260px] lg:min-h-[320px]">
              <div className="absolute left-[12%] top-[10%] size-[76%] rounded-full bg-[#ffd000]" />
              <div className="relative grid h-full grid-cols-3 items-end gap-3">
                {heroProducts.length > 0 ? (
                  heroProducts.map((product, index) => (
                    <Link
                      className={
                        index === 1
                          ? "relative z-10 col-span-1 mb-10 aspect-[0.75] overflow-hidden rounded-xl bg-white shadow-xl"
                          : "relative z-10 aspect-square overflow-hidden rounded-xl bg-white shadow-lg"
                      }
                      href={`/products/${product.slug}`}
                      key={product.id}
                    >
                      {product.coverImageUrl ? (
                        <Image
                          alt={product.title}
                          className="object-contain p-2"
                          fill
                          sizes="180px"
                          src={product.coverImageUrl}
                        />
                      ) : (
                        <span className="grid size-full place-items-center text-sm font-black">
                          Piessang
                        </span>
                      )}
                    </Link>
                  ))
                ) : (
                  <div className="relative z-10 col-span-3 grid min-h-[220px] place-items-center rounded-xl bg-white/80 text-center text-sm font-semibold text-slate-500">
                    Active products will appear here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-2 lg:grid-cols-4">
          {marketplaceTrustItems.map((item) => {
            const Icon = item.icon;

            return (
              <article
                className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 border-slate-200 p-3 dark:border-white/10 lg:border-r lg:last:border-r-0"
                key={item.title}
              >
                <span className="grid size-11 place-items-center rounded-full bg-[#fff6d7] text-[#f0b500] dark:bg-[#ffd000]/12">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h2 className="text-sm font-black text-zinc-950 dark:text-white">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-zinc-400">
                    {item.description}
                  </p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-black text-zinc-950 dark:text-white">
              Shop by Categories
            </h2>
            <Link className="text-sm font-semibold text-zinc-950 dark:text-white" href="/">
              View all categories
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-4 overflow-hidden sm:grid-cols-5 lg:grid-cols-10">
            {categoryTiles.map((category) => {
              const emoji =
                fallbackCategoryImages[category.name.toLowerCase()] ?? "🛍️";

              return (
                <Link className="grid justify-items-center gap-2" href={`/categories/${category.slug}`} key={category.id}>
                  <span className="grid size-20 place-items-center rounded-full border border-slate-200 bg-slate-50 text-3xl shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                    {emoji}
                  </span>
                  <span className="max-w-24 truncate text-center text-sm font-medium text-zinc-950 dark:text-zinc-300">
                    {category.name}
                  </span>
                </Link>
              );
            })}
            <Link className="grid justify-items-center gap-2" href="/">
              <span className="grid size-20 place-items-center rounded-full bg-slate-100 text-zinc-950 dark:bg-white/[0.08] dark:text-white">
                <MoreHorizontalIcon className="size-7" />
              </span>
              <span className="text-center text-sm font-medium text-zinc-950 dark:text-zinc-300">
                More
              </span>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 rounded-xl bg-[#eef6e8] p-6 dark:bg-emerald-500/8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-center">
          <div>
            <h2 className="text-2xl font-black leading-tight text-zinc-950 dark:text-white">
              Support Local.
              <br />
              Shop More.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-zinc-400">
              Discover great products from local and global sellers.
            </p>
            <Link
              className="mt-5 inline-flex h-10 items-center gap-3 rounded-lg bg-zinc-950 px-4 text-sm font-bold text-white"
              href="#products"
            >
              Shop Now
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {supportProducts.map((product) => (
              <MarketplaceProductCard compact key={product.id} product={product} />
            ))}
          </div>
        </section>

        {query ? (
          <section id="products" className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-black text-zinc-950 dark:text-white">
                Search results
              </h2>
              <form className="relative w-full sm:max-w-sm">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-10 rounded-lg border-slate-300 bg-white pl-10 shadow-sm dark:border-white/12 dark:bg-white/[0.04]"
                  defaultValue={query}
                  name="q"
                  placeholder="Search products"
                />
              </form>
            </div>
            {catalog.products.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {catalog.products.map((product) => (
                  <MarketplaceProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
                <h2 className="font-bold text-zinc-950 dark:text-white">
                  No products found
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                  Try another search or browse all categories.
                </p>
              </div>
            )}
          </section>
        ) : null}
      </main>
      <MarketplaceFooter />
    </MarketplaceGate>
  );
}
