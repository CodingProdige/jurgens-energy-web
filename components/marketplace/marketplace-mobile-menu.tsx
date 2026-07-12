"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ChevronRightIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  MessageCircleIcon,
  ShoppingCartIcon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";

import { JurgensEnergyLogo } from "@/components/brand/jurgens-energy-logo";
import {
  getInitials,
  type MarketplaceAccountSummary,
} from "@/components/marketplace/marketplace-account-menu";
import {
  marketplacePrimaryActionClass,
  marketplaceSecondaryActionClass,
} from "@/components/marketplace/action-styles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type MarketplaceNavItem = readonly [label: string, href: string];

type MarketplaceMobileMenuProps = {
  accountUser: MarketplaceAccountSummary | null;
  navItems: readonly MarketplaceNavItem[];
};

export function MarketplaceMobileMenu({
  accountUser,
  navItems,
}: MarketplaceMobileMenuProps) {
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
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

      <Dialog open={open} onOpenChange={setOpen}>
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

          <DialogBody className="grid content-start gap-6 px-5 py-5">
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
              {navItems.map(([label, href]) => (
                <Link
                  className="flex h-11 items-center justify-between rounded-md px-2 text-[13px] font-black uppercase text-[#080808] transition hover:bg-[#f7f7f2] hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:bg-white/10"
                  href={href}
                  key={label}
                  onClick={closeMenu}
                >
                  <span>{label}</span>
                  <ChevronRightIcon className="size-4 text-[#ff5a1f]" />
                </Link>
              ))}
            </nav>

            <div className="grid gap-3">
              <Link
                className={`${marketplacePrimaryActionClass} w-full`}
                href="/products"
                onClick={closeMenu}
              >
                Order Now
              </Link>
              <Link
                className={`${marketplaceSecondaryActionClass} w-full`}
                href="/products?category=accessories"
                onClick={closeMenu}
              >
                Shop Accessories
              </Link>
            </div>

            <div className="grid gap-2 border-t border-[#ecece6] pt-5 dark:border-white/10">
              <Link
                className="flex h-10 items-center gap-3 rounded-md px-2 text-[13px] font-bold text-[#1a1a1a] transition hover:bg-[#f7f7f2] hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:bg-white/10"
                href="/cart"
                onClick={closeMenu}
              >
                <ShoppingCartIcon className="size-4" />
                Cart
              </Link>
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
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
