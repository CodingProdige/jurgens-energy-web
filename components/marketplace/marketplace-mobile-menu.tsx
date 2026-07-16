"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MapPinIcon,
  MenuIcon,
  MessageCircleIcon,
  PackageIcon,
  ReceiptTextIcon,
  ShoppingCartIcon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";

import { JurgensEnergyLogo } from "@/components/brand/jurgens-energy-logo";
import {
  getInitials,
  type MarketplaceAccountSummary,
} from "@/components/marketplace/marketplace-account-menu";
import { marketplacePrimaryActionClass } from "@/components/marketplace/action-styles";
import { MarketplaceWhatsAppIcon } from "@/components/marketplace/marketplace-whatsapp-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  MarketplaceShopMenuCategory,
  MarketplaceShopMenuData,
} from "@/src/modules/marketplace/catalog";

export type MarketplaceNavItem = readonly [label: string, href: string];

type MarketplaceMobileMenuProps = {
  accountUser: MarketplaceAccountSummary | null;
  navItems: readonly MarketplaceNavItem[];
  shopMenuData: MarketplaceShopMenuData;
  whatsappHref: string | null;
};

function findCategoryByPath(
  categories: MarketplaceShopMenuCategory[],
  path: string,
): MarketplaceShopMenuCategory | null {
  for (const category of categories) {
    if (category.path === path) {
      return category;
    }

    const nested = findCategoryByPath(category.children, path);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function MobileShopPage({
  activePath,
  data,
  onBack,
  onNavigate,
  onSelectCategory,
}: {
  activePath: string | null;
  data: MarketplaceShopMenuData;
  onBack: () => void;
  onNavigate: () => void;
  onSelectCategory: (path: string) => void;
}) {
  const activeCategory = activePath
    ? findCategoryByPath(data.categories, activePath)
    : null;
  const parentPath = activePath?.includes("/")
    ? activePath.slice(0, activePath.lastIndexOf("/"))
    : null;
  const parentCategory = parentPath
    ? findCategoryByPath(data.categories, parentPath)
    : null;

  function renderCategoryList(categories: MarketplaceShopMenuCategory[]) {
    return categories.map((category) => (
      <button
        className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#ecece6] bg-white px-3 py-3 text-left transition hover:border-[#ff5a1f]/50 hover:bg-[#fff8f5] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
        key={category.id}
        onClick={() => onSelectCategory(category.path)}
        type="button"
      >
        <span className="min-w-0">
          <span className="block truncate text-xs font-black uppercase text-[#1a1a1a] dark:text-[#f7f7f2]">
            {category.name}
          </span>
          <span className="mt-0.5 block text-[10px] text-[#8a8a83]">
            {category.children.length > 0
              ? `${category.children.length} subcategor${category.children.length === 1 ? "y" : "ies"}`
              : `${category.productCount} product${category.productCount === 1 ? "" : "s"}`}
          </span>
        </span>
        {category.children.length > 0 ? (
          <ChevronRightIcon className="size-4 shrink-0 text-[#ff5a1f]" />
        ) : null}
      </button>
    ));
  }

  return (
    <div className="grid min-h-0 gap-4">
      <div className="flex items-center gap-2 border-b border-[#ecece6] pb-3 dark:border-white/10">
        <button
          aria-label={parentCategory ? `Back to ${parentCategory.name}` : "Back to menu"}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-[#e4e4de] text-[#ff5a1f] transition hover:bg-[#fff3ed] dark:border-white/10 dark:hover:bg-white/[0.08]"
          onClick={onBack}
          type="button"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#777770] dark:text-[#aaa9a1]">
            Shop
          </p>
          <h2 className="truncate text-sm font-black uppercase text-[#1a1a1a] dark:text-[#f7f7f2]">
            {activeCategory?.name ?? "Categories"}
          </h2>
        </div>
      </div>
      {activeCategory ? (
        <>
          <Link
            className="flex min-h-11 items-center justify-between rounded-md bg-[#ff5a1f] px-3 text-[11px] font-black uppercase text-white transition hover:bg-[#e64b15]"
            href={`/categories/${activeCategory.path}`}
            onClick={onNavigate}
          >
            View all <span aria-hidden="true">→</span>
          </Link>
          {activeCategory.children.length > 0 ? (
            <div className="grid gap-2">
              <p className="px-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#777770] dark:text-[#aaa9a1]">
                Subcategories
              </p>
              {renderCategoryList(activeCategory.children)}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-[#dcdcd5] px-3 py-4 text-xs text-[#777770] dark:border-white/15 dark:text-[#aaa9a1]">
              Browse this category to see all available products.
            </p>
          )}
          {activeCategory.brands.length > 0 ? (
            <div className="border-t border-[#ecece6] pt-3 dark:border-white/10">
              <p className="px-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#777770] dark:text-[#aaa9a1]">
                Brands in this category
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeCategory.brands.map((brand) => (
                  <Link
                    className="rounded-full border border-[#dcdcd5] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#5d5d57] hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/10 dark:bg-white/[0.05] dark:text-[#c8c8c0]"
                    href={`/brands/${brand.slug}`}
                    key={brand.id}
                    onClick={onNavigate}
                  >
                    {brand.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="grid gap-2">
            <Link
              className="flex min-h-10 items-center justify-center rounded-md bg-[#ff5a1f] px-3 text-center text-[10px] font-black uppercase text-white"
              href="/products"
              onClick={onNavigate}
            >
              Shop all
            </Link>
          </div>
          {data.categories.length > 0 ? (
            <div className="grid gap-2">
              <p className="px-1 pb-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#777770] dark:text-[#aaa9a1]">
                Categories
              </p>
              {renderCategoryList(data.categories)}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function MarketplaceMobileMenu({
  accountUser,
  navItems,
  shopMenuData,
  whatsappHref,
}: MarketplaceMobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [shopPageOpen, setShopPageOpen] = useState(false);
  const [shopPath, setShopPath] = useState<string | null>(null);
  function closeMenu() {
    setOpen(false);
    setShopPageOpen(false);
    setShopPath(null);
  }

  function openShopPage() {
    setShopPageOpen(true);
    setShopPath(null);
  }

  function backFromShopPage() {
    if (!shopPath) {
      setShopPageOpen(false);
      return;
    }

    setShopPath(
      shopPath.includes("/")
        ? shopPath.slice(0, shopPath.lastIndexOf("/"))
        : null,
    );
  }

  return (
    <>
      <Button
        aria-label="Open menu"
        className="size-10 shrink-0 rounded-full text-[#1a1a1a] hover:bg-[#f7f7f2] dark:text-[#f7f7f2] dark:hover:bg-white/10 xl:hidden"
        onClick={() => setOpen(true)}
        size="icon-lg"
        type="button"
        variant="ghost"
      >
        <MenuIcon className="size-6" />
      </Button>

      <Dialog
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setShopPageOpen(false);
            setShopPath(null);
          }
        }}
        open={open}
      >
        <DialogContent
          className="!left-0 !top-0 !z-[90] !h-[100dvh] !max-h-[100dvh] !w-[min(21rem,calc(100vw-1rem))] !max-w-[min(21rem,calc(100vw-1rem))] !translate-x-0 !translate-y-0 rounded-none rounded-r-xl border-r border-[#e8e8e2] bg-white text-[#080808] shadow-2xl shadow-black/20 data-closed:slide-out-to-left-2 data-open:slide-in-from-left-2 dark:border-white/10 dark:bg-[#101010] dark:text-[#f7f7f2]"
          overlayClassName="z-[80] bg-black/35"
        >
          <DialogHeader className="border-b border-[#ecece6] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#101010]">
            <DialogTitle className="sr-only">Jurgens Energy menu</DialogTitle>
            <Link
              aria-label="Jurgens Energy home"
              className="inline-flex w-fit"
              href="/"
              onClick={closeMenu}
            >
              <JurgensEnergyLogo compact />
            </Link>
          </DialogHeader>

          <DialogBody className="grid min-h-0 content-start gap-6 overflow-y-auto px-5 py-5">
            {shopPageOpen ? (
              <MobileShopPage
                activePath={shopPath}
                data={shopMenuData}
                onBack={backFromShopPage}
                onNavigate={closeMenu}
                onSelectCategory={setShopPath}
              />
            ) : (
              <>
            {accountUser ? (
              <div className="rounded-lg border border-[#e8e8e2] bg-[#f7f7f2] p-3 dark:border-white/10 dark:bg-white/[0.06]">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#ff5a1f] text-sm font-black uppercase text-white">
                    {accountUser.image ? (
                      <Image
                        alt=""
                        className="size-full object-cover"
                        height={44}
                        src={accountUser.image}
                        unoptimized
                        width={44}
                      />
                    ) : (
                      getInitials(accountUser)
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">
                      {accountUser.name || accountUser.email || "Account"}
                    </p>
                    {accountUser.email ? (
                      <p className="truncate text-xs text-[#696963] dark:text-[#c8c8c0]">
                        {accountUser.email}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <nav className="grid gap-1">
              {navItems.map(([label, href]) =>
                label === "Shop" ? (
                  <button
                    className="flex h-11 w-full items-center justify-between rounded-md px-2 text-left text-[13px] font-black uppercase text-[#080808] transition hover:bg-[#f7f7f2] hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:bg-white/10"
                    key={label}
                    onClick={openShopPage}
                    type="button"
                  >
                    <span>{label}</span>
                    <ChevronRightIcon className="size-4 text-[#ff5a1f]" />
                  </button>
                ) : (
                  <Link
                    className="flex h-11 items-center justify-between rounded-md px-2 text-[13px] font-black uppercase text-[#080808] transition hover:bg-[#f7f7f2] hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:bg-white/10"
                    href={href}
                    key={label}
                    onClick={closeMenu}
                  >
                    <span>{label}</span>
                  </Link>
                ),
              )}
              <Link
                className="flex h-11 items-center gap-3 rounded-md px-2 text-[13px] font-black uppercase text-[#080808] transition hover:bg-[#f7f7f2] hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:bg-white/10"
                href="/cart"
                onClick={closeMenu}
              >
                <ShoppingCartIcon className="size-4" />
                Cart
              </Link>
            </nav>

            <div className="grid gap-2 border-t border-[#ecece6] pt-5 dark:border-white/10">
              {accountUser ? (
                <>
                  <Link
                    className="flex h-10 items-center gap-3 rounded-md px-2 text-[13px] font-bold text-[#1a1a1a] transition hover:bg-[#f7f7f2] hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:bg-white/10"
                    href="/account"
                    onClick={closeMenu}
                  >
                    <UserIcon className="size-4" />
                    My account
                  </Link>
                  <Link
                    className="flex h-10 items-center gap-3 rounded-md px-2 text-[13px] font-bold text-[#1a1a1a] transition hover:bg-[#f7f7f2] hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:bg-white/10"
                    href="/account/orders"
                    onClick={closeMenu}
                  >
                    <PackageIcon className="size-4" />
                    My orders
                  </Link>
                  <Link
                    className="flex h-10 items-center gap-3 rounded-md px-2 text-[13px] font-bold text-[#1a1a1a] transition hover:bg-[#f7f7f2] hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:bg-white/10"
                    href="/account/addresses"
                    onClick={closeMenu}
                  >
                    <MapPinIcon className="size-4" />
                    My addresses
                  </Link>
                  <Link
                    className="flex h-10 items-center gap-3 rounded-md px-2 text-[13px] font-bold text-[#1a1a1a] transition hover:bg-[#f7f7f2] hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:bg-white/10"
                    href="/account/invoices"
                    onClick={closeMenu}
                  >
                    <ReceiptTextIcon className="size-4" />
                    My invoices
                  </Link>
                </>
              ) : null}
              <Link
                className="flex h-10 items-center gap-3 rounded-md px-2 text-[13px] font-bold text-[#1a1a1a] transition hover:bg-[#f7f7f2] hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:bg-white/10"
                href={accountUser ? "/account/whatsapp" : "/sign-in"}
                onClick={closeMenu}
              >
                {accountUser ? (
                  <MessageCircleIcon className="size-4" />
                ) : (
                  <UserIcon className="size-4" />
                )}
                {accountUser ? "WhatsApp number" : "Sign in"}
              </Link>
              {accountUser?.roles.includes("admin") ? (
                <Link
                  className="flex h-10 items-center gap-3 rounded-md px-2 text-[13px] font-bold text-[#1a1a1a] transition hover:bg-[#f7f7f2] hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:bg-white/10"
                  href="/admin"
                  onClick={closeMenu}
                >
                  <LayoutDashboardIcon className="size-4" />
                  Admin dashboard
                </Link>
              ) : null}
              {accountUser?.roles.includes("seller") ? (
                <Link
                  className="flex h-10 items-center gap-3 rounded-md px-2 text-[13px] font-bold text-[#1a1a1a] transition hover:bg-[#f7f7f2] hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:bg-white/10"
                  href="/seller"
                  onClick={closeMenu}
                >
                  <LayoutDashboardIcon className="size-4" />
                  Seller dashboard
                </Link>
              ) : null}
              {accountUser ? (
                <button
                  className="flex h-10 items-center gap-3 rounded-md px-2 text-left text-[13px] font-bold text-[#b42318] transition hover:bg-[#fff2ef] dark:text-[#ffb19a] dark:hover:bg-[#ff5a1f]/10"
                  onClick={() => {
                    closeMenu();
                    void signOut({ callbackUrl: "/" });
                  }}
                  type="button"
                >
                  <LogOutIcon className="size-4" />
                  Sign out
                </button>
              ) : null}
            </div>
              </>
            )}
          </DialogBody>
          {whatsappHref ? (
            <div className="shrink-0 border-t border-[#ecece6] bg-white px-5 py-4 dark:border-white/10 dark:bg-[#101010]">
              <Link
                aria-label="Order now on WhatsApp"
                className={`${marketplacePrimaryActionClass} w-full gap-2.5`}
                href={whatsappHref}
                onClick={closeMenu}
                rel="noreferrer"
                target="_blank"
              >
                <MarketplaceWhatsAppIcon className="size-5" />
                Order now on WhatsApp
              </Link>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
