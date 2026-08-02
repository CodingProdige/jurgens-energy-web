"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { MarketplaceNavItem } from "@/components/marketplace/marketplace-mobile-menu";
import { MarketplaceShopMenu } from "@/components/marketplace/marketplace-shop-menu";
import { cn } from "@/lib/utils";
import type { MarketplaceShopMenuData } from "@/src/modules/marketplace/catalog";

type MarketplaceDesktopNavProps = {
  navItems: readonly MarketplaceNavItem[];
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
  shopMenuData,
  whatsappHref,
}: MarketplaceDesktopNavProps) {
  const pathname = usePathname();

  return (
    <nav className="hidden min-w-0 flex-1 items-center justify-center gap-7 text-[12px] font-black uppercase text-[#080808] dark:text-[#f7f7f2] xl:flex 2xl:gap-8">
      {navItems.map(([label, href]) => {
        const active = isActiveNavItem(pathname, href, label);

        if (label === "Shop") {
          return (
            <MarketplaceShopMenu
              active={active}
              data={shopMenuData}
              key={label}
              whatsappHref={whatsappHref}
            />
          );
        }

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative inline-flex h-[82px] items-center gap-1 transition hover:text-[#ff5a1f]",
              active && "text-[#ff5a1f]",
            )}
            href={href}
            key={label}
          >
            <span>{label}</span>
            <span
              className={cn(
                "absolute inset-x-0 bottom-5 h-0.5 rounded-full bg-[#ff5a1f] transition group-hover:scale-x-100",
                active ? "scale-x-100" : "scale-x-0",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
