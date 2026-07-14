import type { ReactNode } from "react";

import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";

export default function MarketplacePoliciesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <MarketplaceGate>
      <div className="min-h-screen overflow-x-clip bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceHeader />
        <main className="w-full bg-[#f7f7f2] dark:bg-[#080808] sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))] sm:border-x sm:border-b sm:border-[#e8e8e2] sm:shadow-[0_18px_60px_rgba(8,8,8,0.06)] sm:dark:border-white/10">
          {children}
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}
