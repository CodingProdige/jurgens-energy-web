"use client";

import type { ReactNode } from "react";

type MarketplaceHeaderShellProps = {
  children: ReactNode;
};

export function MarketplaceHeaderShell({
  children,
}: MarketplaceHeaderShellProps) {
  return (
    <header className="marketplace-header-shell sticky top-0 z-50 border-b border-[#e8e8e2] bg-white shadow-[0_2px_18px_rgba(8,8,8,0.04)] dark:border-white/10 dark:bg-[#080808]">
      {children}
    </header>
  );
}
