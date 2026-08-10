"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlameIcon } from "lucide-react";

import type { MarketplaceNavItem } from "@/components/marketplace/marketplace-mobile-menu";
import { MarketplaceShopMenu } from "@/components/marketplace/marketplace-shop-menu";
import { cn } from "@/lib/utils";
import type { MarketplaceShopMenuData } from "@/src/modules/marketplace/catalog";
import type { MarketplaceSaleCampaign } from "@/src/modules/marketplace/sales";

type MarketplaceDesktopNavProps = {
  navItems: readonly MarketplaceNavItem[];
  saleCampaigns: readonly MarketplaceSaleCampaign[];
  saleProductCount: number;
  shopMenuData: MarketplaceShopMenuData;
  whatsappHref: string | null;
};

function normalizePath(path: string) {
  if (path === "/") {
    return path;
  }

  return path.replace(/\/+$/, "");
}

function isActiveNavItem(pathname: string, href: string, label: string) {
  const currentPath = normalizePath(pathname);
  const navPath = normalizePath(href);

  if (navPath === "/") {
    return currentPath === "/";
  }

  if (label === "Shop") {
    return (
      currentPath === "/products" ||
      currentPath.startsWith("/products/") ||
      currentPath.startsWith("/categories/")
    );
  }

  return currentPath === navPath || currentPath.startsWith(`${navPath}/`);
}

export function MarketplaceDesktopNav({
  navItems,
  saleCampaigns,
  saleProductCount,
  shopMenuData,
  whatsappHref,
}: MarketplaceDesktopNavProps) {
  const pathname = usePathname();
  const saleActive = isActiveNavItem(pathname, "/sale", "Sale");

  return (
    <nav className="hidden min-w-0 flex-1 items-center justify-center gap-5 text-[12px] font-black uppercase text-[#080808] dark:text-[#f7f7f2] xl:flex 2xl:gap-7">
      <Link
        aria-current={saleActive ? "page" : undefined}
        aria-label={
          saleProductCount > 0
            ? `Shop sales. ${saleProductCount} product${saleProductCount === 1 ? "" : "s"} currently on sale.`
            : "Shop current sales."
        }
        className={cn(
          "group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#ff5a1f] px-3 text-white shadow-[0_8px_20px_rgba(255,90,31,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e84c15] hover:shadow-[0_10px_24px_rgba(255,90,31,0.32)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/30 motion-reduce:transform-none",
          saleActive && "ring-2 ring-[#ffb000] ring-offset-2 dark:ring-offset-[#080808]",
        )}
        href="/sale"
        prefetch={false}
      >
        <FlameIcon aria-hidden="true" className="size-3.5 fill-current" />
        <span>Sale</span>
        {saleProductCount > 0 ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] leading-none text-[#c73708]">
            {saleProductCount > 99 ? "99+" : saleProductCount}
          </span>
        ) : null}
      </Link>
      {navItems.map(([label, href]) => {
        const active = isActiveNavItem(pathname, href, label);

        if (label === "Shop") {
          return (
            <MarketplaceShopMenu
              active={active}
              data={shopMenuData}
              key={label}
              saleCampaigns={saleCampaigns}
              whatsappHref={whatsappHref}
            />
          );
        }

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "marketplace-nav-link group relative inline-flex h-[82px] items-center gap-1 focus-visible:outline-none focus-visible:text-[#ff5a1f]",
              active && "text-[#ff5a1f]",
            )}
            href={href}
            key={label}
            prefetch={false}
          >
            <span>{label}</span>
            <span
              className={cn(
                "marketplace-nav-underline absolute inset-x-0 bottom-5 h-0.5 rounded-full bg-[#ff5a1f]",
                active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
