"use client";

import Link from "next/link";
import {
  ChevronRightIcon,
  MenuIcon,
  ShoppingCartIcon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";

import { JurgensEnergyLogo } from "@/components/brand/jurgens-energy-logo";
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
  navItems: readonly MarketplaceNavItem[];
};

export function MarketplaceMobileMenu({
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
                href="#products"
                onClick={closeMenu}
              >
                Order Now
              </Link>
              <Link
                className={`${marketplaceSecondaryActionClass} w-full`}
                href="#accessories"
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
                href="/sign-in"
                onClick={closeMenu}
              >
                <UserIcon className="size-4" />
                Account
              </Link>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
