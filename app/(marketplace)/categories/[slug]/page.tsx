import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";

import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceProductCard } from "@/components/marketplace/product-card";
import { Input } from "@/components/ui/input";
import { getCurrencyContext } from "@/src/modules/currency/server";
import { getMarketplaceCatalog } from "@/src/modules/marketplace/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const currencyContext = await getCurrencyContext();
  const catalog = await getMarketplaceCatalog({
    categorySlug: slug,
    currencyContext,
    limit: 1,
  });
  const category = catalog.categories.find((item) => item.slug === slug);

  return {
    title: category?.name ?? "Category",
    description: category
      ? `Shop ${category.name} products on Piessang.`
      : "Shop Piessang marketplace products.",
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const query = Array.isArray(resolvedSearchParams.q)
    ? resolvedSearchParams.q[0]
    : resolvedSearchParams.q;
  const currencyContext = await getCurrencyContext();
  const catalog = await getMarketplaceCatalog({
    categorySlug: slug,
    currencyContext,
    query,
  });
  const category = catalog.categories.find((item) => item.slug === slug);

  if (!category) {
    notFound();
  }

  return (
    <MarketplaceGate>
      <MarketplaceHeader />
      <main className="grid w-full gap-4 px-1.5 py-3 sm:mx-auto sm:w-[min(1180px,calc(100%-2rem))] sm:gap-7 sm:px-0 sm:py-6">
        <section className="grid gap-5">
          <div className="flex flex-col gap-4 px-2 sm:px-0 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <Link
                className="text-sm font-semibold text-[#8a641f] hover:text-[#5f4416]"
                href="/"
              >
                All products
              </Link>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
                {category.name}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                {category.path}
              </p>
            </div>
            <form className="relative w-full lg:max-w-md">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-10 rounded-lg border-slate-300 bg-white pl-10 shadow-sm dark:border-white/12 dark:bg-white/[0.04] sm:h-11"
                defaultValue={query ?? ""}
                name="q"
                placeholder={`Search ${category.name}`}
              />
            </form>
          </div>

          <nav className="flex gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] sm:px-0 [&::-webkit-scrollbar]:hidden">
            <Link
              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[#c4982d]/45 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
              href="/"
            >
              All
            </Link>
            {catalog.categories.map((item) => (
              <Link
                className={
                  item.slug === slug
                    ? "inline-flex h-9 shrink-0 items-center rounded-lg border border-[#c4982d]/35 bg-[#fbe694]/35 px-3 text-sm font-semibold text-[#6f511a]"
                    : "inline-flex h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[#c4982d]/45 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
                }
                href={`/categories/${item.slug}`}
                key={item.id}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </section>

        {catalog.products.length > 0 ? (
          <section className="grid grid-cols-2 items-start gap-1.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {catalog.products.map((product) => (
              <MarketplaceProductCard key={product.id} product={product} />
            ))}
          </section>
        ) : (
          <section className="grid min-h-[320px] place-items-center rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="max-w-md">
              <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
                No products found
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                Try another search or browse all active products.
              </p>
              <Link
                className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#c4982d] px-4 text-sm font-semibold text-white transition hover:bg-[#a87920]"
                href="/"
              >
                Browse all
              </Link>
            </div>
          </section>
        )}
      </main>
      <MarketplaceFooter />
    </MarketplaceGate>
  );
}
