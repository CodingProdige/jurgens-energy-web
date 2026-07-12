import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { CartExperience } from "@/components/marketplace/cart-experience";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review products saved in your Jurgens Energy shopping cart.",
  robots: { follow: false, index: false },
};

export default function CartPage() {
  return (
    <MarketplaceGate>
      <div className="min-h-screen bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceHeader />
        <main className="w-full overflow-x-clip bg-[#f7f7f2] pb-24 dark:bg-[#080808] sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))] lg:pb-10">
          <div className="mx-auto w-full py-4 sm:px-6 sm:py-7 lg:px-10">
            <header className="px-3 pb-4 sm:px-0 sm:pb-6">
              <nav
                aria-label="Cart breadcrumbs"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#777770] dark:text-[#aaa9a1] sm:text-xs"
              >
                <Link className="hover:text-[#ff5a1f]" href="/">
                  Home
                </Link>
                <ChevronRightIcon className="size-3.5" />
                <span className="text-[#1a1a1a] dark:text-[#e1e1da]">Cart</span>
              </nav>
              <h1 className="mt-3 text-[28px] font-black leading-tight sm:text-[38px]">
                Shopping Cart
              </h1>
              <p className="mt-1 text-[13px] text-[#666660] dark:text-[#aaa9a1] sm:text-sm">
                Uncheck anything you want to keep for later.
              </p>
            </header>
            <CartExperience />
          </div>
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}
