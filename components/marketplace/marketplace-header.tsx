import Link from "next/link";

import { auth } from "@/auth";
import { JurgensEnergyLogo } from "@/components/brand/jurgens-energy-logo";
import { CurrencySelector } from "@/components/currency/currency-selector";
import {
  MarketplaceAccountMenu,
  type MarketplaceAccountSummary,
} from "@/components/marketplace/marketplace-account-menu";
import { marketplacePrimaryActionBaseClass } from "@/components/marketplace/action-styles";
import { MarketplaceCartLink } from "@/components/marketplace/marketplace-cart-link";
import { MarketplaceHeaderShell } from "@/components/marketplace/marketplace-header-shell";
import {
  MarketplaceMobileMenu,
  type MarketplaceNavItem,
} from "@/components/marketplace/marketplace-mobile-menu";
import { MarketplaceShopMenu } from "@/components/marketplace/marketplace-shop-menu";
import { createMarketplaceWhatsAppHref } from "@/components/marketplace/marketplace-whatsapp-button";
import { marketplaceTrustItems } from "@/components/marketplace/marketplace-trust-items";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import {
  emptyNotificationCenter,
  getNotificationCenter,
} from "@/src/modules/notifications/in-app";
import { getCurrencyPreference } from "@/src/modules/currency/server";
import {
  getMarketplaceShopMenuData,
  type MarketplaceShopMenuCategory,
} from "@/src/modules/marketplace/catalog";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";

function findAccessoriesCategory(
  categories: MarketplaceShopMenuCategory[],
): MarketplaceShopMenuCategory | null {
  for (const category of categories) {
    if (
      category.name.toLowerCase().includes("accessor") ||
      category.slug.toLowerCase().includes("accessor")
    ) {
      return category;
    }

    const childMatch = findAccessoriesCategory(category.children);

    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

export async function MarketplaceHeader() {
  const [session, currencyPreference, shopMenuData, marketplaceSettings] =
    await Promise.all([
      auth(),
      getCurrencyPreference(),
      getMarketplaceShopMenuData(),
      getMarketplaceSettings(),
    ]);
  const whatsappHref = marketplaceSettings.whatsappOrderingEnabled
    ? createMarketplaceWhatsAppHref(
        marketplaceSettings.whatsappBusinessPhoneNumber,
      )
    : null;
  const accessoriesCategory = findAccessoriesCategory(shopMenuData.categories);
  const accessoriesHref = accessoriesCategory
    ? `/categories/${accessoriesCategory.path}`
    : "/products";
  const navItems: readonly MarketplaceNavItem[] = [
    ["Home", "/"],
    ["Shop", "/products"],
    ["Cylinder Exchange", "/products?exchange=1"],
    ["Accessories", accessoriesHref],
    ["Delivery", "/#delivery"],
    ["Blog", "/blog"],
    ["About Us", "/#about"],
    ["Contact", "/#contact"],
  ];
  const accountUser: MarketplaceAccountSummary | null = session?.user
    ? {
        email: session.user.email,
        image: session.user.image,
        name: session.user.name,
        roles: session.user.roles ?? [],
      }
    : null;
  const notificationCenter = session?.user?.id
    ? await getNotificationCenter({
        surface: "marketplace",
        userId: session.user.id,
      })
    : emptyNotificationCenter;

  return (
    <MarketplaceHeaderShell>
      <div className="border-b border-[#ecece6] bg-[#f7f7f2]/92 dark:border-white/10 dark:bg-[#101010]/92">
        <div className="mx-auto flex w-full items-center justify-end gap-2 overflow-hidden px-2 py-1.5 sm:w-[min(1500px,calc(100%-1rem))] sm:justify-between sm:px-6 sm:py-2 lg:px-10">
          <p className="hidden text-[11px] font-bold uppercase tracking-[0.16em] text-[#5c5c57] dark:text-[#c8c8c0] md:block">
            Safe LPG from a certified reseller.
          </p>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:ml-auto sm:flex-none sm:gap-2">
            <CurrencySelector
              className="min-w-0 rounded-full border border-[#e8e8e2] bg-white/80 px-1 py-1 dark:border-white/10 dark:bg-white/[0.04]"
              compact
              initialPreference={currencyPreference}
              variant="marketplace"
            />
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <ThemeToggle
                compact
                className="size-8 border border-[#e8e8e2] bg-white/80 text-[#1a1a1a] hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f7f7f2] sm:size-9"
              />
              {session?.user ? (
                <NotificationBell
                  accent="marketplace"
                  initialState={notificationCenter}
                  surface="marketplace"
                />
              ) : null}
              <MarketplaceAccountMenu user={accountUser} />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto flex h-16 w-full items-center justify-between gap-2 px-3 sm:h-[82px] sm:w-[min(1500px,calc(100%-1rem))] sm:gap-3 sm:px-6 lg:px-10">
        <MarketplaceMobileMenu
          accountUser={accountUser}
          navItems={navItems}
          shopMenuData={shopMenuData}
          whatsappHref={whatsappHref}
        />

        <Link
          aria-label="Jurgens Energy home"
          className="flex min-w-0 shrink items-center sm:shrink-0"
          href="/"
        >
          <JurgensEnergyLogo className="sm:hidden" compact />
          <JurgensEnergyLogo className="hidden sm:inline-flex" compact={false} />
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-7 text-[12px] font-black uppercase text-[#080808] dark:text-[#f7f7f2] xl:flex 2xl:gap-8">
          {navItems.map(([label, href]) =>
            label === "Shop" ? (
              <MarketplaceShopMenu
                data={shopMenuData}
                key={label}
                whatsappHref={whatsappHref}
              />
            ) : (
              <Link
                className="group relative inline-flex h-[82px] items-center gap-1 transition hover:text-[#ff5a1f]"
                href={href}
                key={label}
              >
                <span>{label}</span>
                <span className="absolute inset-x-0 bottom-5 h-0.5 scale-x-0 rounded-full bg-[#ff5a1f] transition group-hover:scale-x-100" />
              </Link>
            ),
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <MarketplaceCartLink />
          <Link
            className={cn(
              "hidden min-[390px]:inline-flex sm:px-5",
              marketplacePrimaryActionBaseClass,
            )}
            href="/products"
          >
            Order Now
          </Link>
        </div>
      </div>
    </MarketplaceHeaderShell>
  );
}

export { marketplaceTrustItems };
