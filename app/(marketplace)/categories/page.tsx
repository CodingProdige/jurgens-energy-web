import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  ChevronRightIcon,
  FlameIcon,
  SearchXIcon,
} from "lucide-react";

import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { cn } from "@/lib/utils";
import {
  getMarketplaceCategories,
  type MarketplaceCategorySummary,
} from "@/src/modules/marketplace/catalog";

export const metadata: Metadata = {
  title: "Categories",
  description:
    "Browse Jurgens Energy product categories and shop available products online.",
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await getMarketplaceCategories();
  const populatedCategories = categories.filter(
    (category) => category.productCount > 0,
  );
  const rootCategories = populatedCategories.filter(
    (category) => !category.path.includes("/"),
  );
  const subcategories = populatedCategories.filter((category) =>
    category.path.includes("/"),
  );

  return (
    <MarketplaceGate>
      <div className="min-h-screen overflow-x-clip bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceHeader />
        <main className="w-full bg-white pb-8 dark:bg-[#101010] sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))] sm:border-x sm:border-b sm:border-[#e8e8e2] sm:shadow-[0_18px_60px_rgba(8,8,8,0.06)] sm:dark:border-white/10">
          <header className="border-b border-[#ecece6] px-4 py-8 dark:border-white/10 sm:px-10 sm:py-12 lg:px-16">
            <nav
              aria-label="Categories breadcrumbs"
              className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[#777770] dark:text-[#aaa9a1] sm:text-xs"
            >
              <Link className="hover:text-[#ff5a1f]" href="/">
                Home
              </Link>
              <ChevronRightIcon className="size-3.5 shrink-0" />
              <span className="truncate text-[#1a1a1a] dark:text-[#e1e1da]">
                Categories
              </span>
            </nav>

            <p className="mt-8 text-[11px] font-black uppercase tracking-[0.24em] text-[#ff5a1f] sm:text-xs">
              Shop by category
            </p>
            <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="max-w-4xl text-[36px] font-black uppercase leading-[0.98] tracking-[-0.025em] sm:text-[52px] lg:text-[64px]">
                  Browse product categories.
                </h1>
                <p className="mt-5 max-w-2xl text-[15px] font-medium leading-7 text-[#5f5f58] dark:text-[#b9b9b1] sm:text-[17px] sm:leading-8">
                  Explore the categories currently available from Jurgens
                  Energy, then open a category to view products and checkout
                  details.
                </p>
              </div>

              <Link
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#ff5a1f] px-5 text-[12px] font-black uppercase tracking-[0.05em] text-white transition hover:bg-[#e94d15]"
                href="/products"
              >
                Shop all products
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </header>

          <section className="px-1.5 py-5 sm:px-10 sm:py-10 lg:px-16 lg:py-12">
            {rootCategories.length > 0 ? (
              <div className="grid grid-cols-2 items-start gap-1.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
                {rootCategories.map((category) => (
                  <CategoryDirectoryCard category={category} key={category.id} />
                ))}
              </div>
            ) : (
              <EmptyCategoriesState />
            )}
          </section>

          {subcategories.length > 0 ? (
            <section className="border-t border-[#ecece6] px-4 py-6 dark:border-white/10 sm:px-10 sm:py-9 lg:px-16">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ff5a1f]">
                    More specific categories
                  </p>
                  <h2 className="mt-1.5 text-[24px] font-black uppercase leading-tight sm:text-[32px]">
                    Product subcategories
                  </h2>
                </div>
                <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#74746d] dark:text-[#b9b9b1]">
                  {subcategories.length}{" "}
                  {subcategories.length === 1 ? "subcategory" : "subcategories"}
                </p>
              </div>

              <div className="mt-5 grid gap-2 sm:mt-7 sm:grid-cols-2 lg:grid-cols-3">
                {subcategories.map((category) => (
                  <Link
                    className="group flex min-w-0 items-center justify-between gap-3 rounded-md border border-[#e8e8e2] bg-white px-4 py-3 transition hover:border-[#ff5a1f]/60 hover:text-[#ff5a1f] dark:border-white/10 dark:bg-white/[0.04]"
                    href={`/categories/${category.path}`}
                    key={category.id}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-black">
                        {category.name}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-bold uppercase text-[#74746d] dark:text-[#b9b9b1]">
                        {category.productCount} products
                      </span>
                    </span>
                    <ArrowRightIcon className="size-4 shrink-0 transition group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}

function CategoryDirectoryCard({
  category,
}: {
  category: MarketplaceCategorySummary;
}) {
  const isRemoteImage =
    category.firstProductImageUrl?.startsWith("http://") ||
    category.firstProductImageUrl?.startsWith("https://");

  return (
    <Link
      className="group block min-w-0 overflow-hidden rounded-md border border-[#e8e8e2] bg-white text-left shadow-[0_4px_14px_rgba(8,8,8,0.04)] transition hover:border-[#ff5a1f]/55 hover:shadow-[0_12px_28px_rgba(8,8,8,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"
      href={`/categories/${category.path}`}
    >
      <div className="relative aspect-square bg-[#f7f7f2] dark:bg-[#1a1a1a]">
        {category.firstProductImageUrl ? (
          isRemoteImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${category.name} category`}
              className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
              src={category.firstProductImageUrl}
            />
          ) : (
            <Image
              alt={`${category.name} category`}
              className="object-cover transition duration-300 group-hover:scale-[1.04]"
              fill
              sizes="(min-width: 1280px) 20vw, (min-width: 768px) 33vw, 50vw"
              src={category.firstProductImageUrl}
            />
          )
        ) : (
          <div className="grid size-full place-items-center text-[#ff5a1f]">
            <FlameIcon className="size-10 stroke-[1.4]" />
          </div>
        )}
      </div>
      <div className="grid gap-1 px-2 pb-2 pt-2 sm:px-3 sm:pb-3">
        <h2 className="line-clamp-2 text-[13px] font-black leading-tight text-[#080808] dark:text-[#f7f7f2] sm:text-[15px]">
          {category.name}
        </h2>
        <p className="line-clamp-1 text-[10px] font-bold uppercase text-[#7a7a73] dark:text-[#b8b8ae] sm:text-[11px]">
          {category.productCount} products
        </p>
      </div>
    </Link>
  );
}

function EmptyCategoriesState() {
  return (
    <section
      className={cn(
        "grid min-h-[320px] place-items-center rounded-lg border border-dashed border-[#deded8] bg-[#f7f7f2] p-6 text-center",
        "dark:border-white/10 dark:bg-white/[0.04]",
      )}
    >
      <div className="max-w-sm">
        <SearchXIcon className="mx-auto size-8 text-[#ff5a1f]" />
        <h2 className="mt-4 text-lg font-black">No categories found</h2>
        <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
          Product categories will appear here as soon as active products are
          assigned to them.
        </p>
        <Link
          className="mt-5 inline-flex h-9 items-center justify-center rounded-md border border-[#d8d8d1] px-3 text-sm font-semibold transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15"
          href="/products"
        >
          Browse products
        </Link>
      </div>
    </section>
  );
}
