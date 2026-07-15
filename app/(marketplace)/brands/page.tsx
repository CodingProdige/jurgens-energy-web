import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, ChevronRightIcon, ShieldCheckIcon } from "lucide-react";

import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceBrandCard } from "@/components/marketplace/storefront-section-renderer";
import { getMarketplaceBrands } from "@/src/modules/marketplace/catalog";

export const metadata: Metadata = {
  title: "Brands",
  description:
    "Browse LPG cylinder, gas appliance, regulator, and accessory brands available from Jurgens Energy.",
};

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const brands = await getMarketplaceBrands();

  return (
    <MarketplaceGate>
      <div className="min-h-screen overflow-x-clip bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceHeader />
        <main className="w-full bg-white dark:bg-[#101010] sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))] sm:border-x sm:border-b sm:border-[#e8e8e2] sm:shadow-[0_18px_60px_rgba(8,8,8,0.06)] sm:dark:border-white/10">
          <header className="relative overflow-hidden border-b border-white/10 bg-[#080808] px-4 py-8 text-[#f7f7f2] sm:px-10 sm:py-12 lg:px-16 lg:py-14">
            <div
              aria-hidden="true"
              className="absolute -right-20 -top-28 size-80 rounded-full border border-[#ff5a1f]/25 sm:size-[28rem]"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-32 right-24 size-72 rounded-full bg-[#ff5a1f]/10 blur-3xl"
            />

            <div className="relative mx-auto max-w-[1240px]">
              <nav
                aria-label="Brands breadcrumbs"
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/55"
              >
                <Link className="transition hover:text-[#ff5a1f]" href="/">
                  Home
                </Link>
                <ChevronRightIcon className="size-3.5" />
                <span className="text-white/85">Brands</span>
              </nav>

              <div className="mt-9 flex flex-col gap-7 sm:mt-11 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#ff5a1f] sm:text-xs">
                    Shop by brand
                  </p>
                  <h1 className="mt-3 max-w-4xl text-[36px] font-black uppercase leading-[0.98] tracking-[-0.025em] sm:text-[52px] lg:text-[64px]">
                    Brands you know. LPG products you can trust.
                  </h1>
                  <p className="mt-5 max-w-2xl text-[15px] font-medium leading-7 text-white/68 sm:text-[17px] sm:leading-8">
                    Browse every active brand in our store, then explore its
                    available cylinders, appliances, regulators, and
                    accessories.
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
            </div>
          </header>

          <section className="mx-auto max-w-[1240px] px-1.5 py-5 sm:px-10 sm:py-10 lg:px-16 lg:py-12">
            <div className="flex flex-wrap items-end justify-between gap-3 px-2 sm:px-0">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ff5a1f]">
                  Brand directory
                </p>
                <h2 className="mt-1.5 text-[24px] font-black uppercase leading-tight sm:text-[32px]">
                  Explore our range
                </h2>
              </div>
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#74746d] dark:text-[#b9b9b1]">
                {brands.length} {brands.length === 1 ? "brand" : "brands"}
              </p>
            </div>

            {brands.length > 0 ? (
              <div className="mt-5 grid grid-cols-2 items-start gap-1.5 sm:mt-7 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {brands.map((brand) => (
                  <MarketplaceBrandCard brand={brand} key={brand.id} />
                ))}
              </div>
            ) : (
              <div className="mt-7 grid min-h-[280px] place-items-center rounded-lg border border-dashed border-[#deded8] bg-[#f7f7f2] p-6 text-center dark:border-white/10 dark:bg-white/[0.04]">
                <div className="max-w-sm">
                  <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#fff1e9] text-[#ff5a1f] dark:bg-[#ff5a1f]/10">
                    <ShieldCheckIcon className="size-6" />
                  </span>
                  <h2 className="mt-4 text-[18px] font-black uppercase">
                    Brands are being prepared
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#b9b9b1]">
                    Browse the complete product range while we finish adding
                    brand profiles.
                  </p>
                  <Link
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[#ff5a1f] px-4 text-[12px] font-black uppercase text-white transition hover:bg-[#e94d15]"
                    href="/products"
                  >
                    Browse products
                  </Link>
                </div>
              </div>
            )}
          </section>
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}
