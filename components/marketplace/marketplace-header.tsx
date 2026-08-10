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
import { MarketplaceDesktopNav } from "@/components/marketplace/marketplace-desktop-nav";
import { MarketplaceHeaderSearch } from "@/components/marketplace/marketplace-header-search";
import { MarketplaceHeaderShell } from "@/components/marketplace/marketplace-header-shell";
import { MarketplaceSaleSpotlight } from "@/components/marketplace/marketplace-sale-spotlight";
import {
  MarketplaceMobileMenu,
  type MarketplaceNavItem,
} from "@/components/marketplace/marketplace-mobile-menu";
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
} from "@/src/modules/marketplace/catalog";
import {
  getActiveMarketplaceSaleCampaigns,
  getMarketplaceSaleProductCount,
} from "@/src/modules/marketplace/sales";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";

export async function MarketplaceHeader() {
  const [
    session,
    currencyPreference,
    shopMenuData,
    marketplaceSettings,
    saleCampaigns,
    saleProductCount,
  ] =
    await Promise.all([
      auth(),
      getCurrencyPreference(),
      getMarketplaceShopMenuData(),
      getMarketplaceSettings(),
      getActiveMarketplaceSaleCampaigns(),
      getMarketplaceSaleProductCount(),
    ]);
  const whatsappHref = marketplaceSettings.whatsappOrderingEnabled
    ? createMarketplaceWhatsAppHref(
        marketplaceSettings.whatsappBusinessPhoneNumber,
      )
    : null;
  const navItems: readonly MarketplaceNavItem[] = [
    ["Home", "/"],
    ["Shop", "/products"],
    ["Brands", "/brands"],
    ["About Us", "/about"],
    ["Support", "/support"],
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
  const hasFeaturedSaleCampaign = saleCampaigns.some(
    (campaign) => campaign.headerVisible,
  );

  return (
    <MarketplaceHeaderShell>
      <div className="border-b border-[#ecece6] bg-[#f7f7f2]/92 dark:border-white/10 dark:bg-[#101010]/92">
        <div className="mx-auto flex w-full flex-wrap items-center gap-x-2 gap-y-1.5 overflow-hidden px-2 py-1.5 sm:w-[min(1500px,calc(100%-1rem))] sm:flex-nowrap sm:px-6 sm:py-2 lg:px-10">
          <div
            className={cn(
              "min-w-0",
              hasFeaturedSaleCampaign
                ? "order-2 basis-full sm:order-1 sm:basis-auto sm:flex-1"
                : "hidden md:order-1 md:block md:flex-1",
            )}
          >
            <MarketplaceSaleSpotlight campaigns={saleCampaigns} />
          </div>
          <div className="order-1 ml-auto flex min-w-0 items-center justify-end gap-1.5 sm:order-2 sm:flex-none sm:gap-2">
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
          saleProductCount={saleProductCount}
          shopMenuData={shopMenuData}
          whatsappHref={whatsappHref}
        />

        <Link
          aria-label="Jurgens Energy home"
          className="flex min-w-0 shrink items-center sm:shrink-0"
          href="/"
          prefetch={false}
        >
          <JurgensEnergyLogo className="sm:hidden" compact />
          <JurgensEnergyLogo className="hidden sm:inline-flex" compact={false} />
        </Link>

        <MarketplaceDesktopNav
          navItems={navItems}
          saleProductCount={saleProductCount}
          shopMenuData={shopMenuData}
          whatsappHref={whatsappHref}
        />

        <MarketplaceHeaderSearch className="hidden w-[min(22vw,21rem)] max-w-[21rem] shrink-0 xl:flex" />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <MarketplaceCartLink />
          <Link
            className={cn(
              "hidden 2xl:inline-flex 2xl:px-5",
              marketplacePrimaryActionBaseClass,
            )}
            href="/products"
            prefetch={false}
          >
            Shop Now
          </Link>
        </div>
      </div>
    </MarketplaceHeaderShell>
  );
}

export { marketplaceTrustItems };
