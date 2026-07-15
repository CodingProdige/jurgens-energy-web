"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheckIcon,
  BoxesIcon,
  CookingPotIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FlameIcon,
  FuelIcon,
  GaugeIcon,
  HeadphonesIcon,
  RefreshCcwIcon,
  Settings2Icon,
  TagsIcon,
  TruckIcon,
  WrenchIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  MarketplaceShopMenuCategory,
  MarketplaceShopMenuData,
  MarketplaceShopMenuProduct,
} from "@/src/modules/marketplace/catalog";
import { MarketplaceWhatsAppIcon } from "@/components/marketplace/marketplace-whatsapp-button";

function categoryHref(category: MarketplaceShopMenuCategory) {
  return `/categories/${category.path}`;
}

function findLpgCategory(categories: MarketplaceShopMenuCategory[]) {
  return (
    categories.find((category) =>
      ["gas-cylinders", "lpg-cylinders"].includes(category.slug),
    ) ??
    categories.find((category) => {
      const text = `${category.name} ${category.slug}`.toLowerCase();

      return text.includes("cylinder") && !text.includes("accessor");
    }) ??
    null
  );
}

function CategoryIcon({ category }: { category: MarketplaceShopMenuCategory }) {
  const text = `${category.name} ${category.slug}`.toLowerCase();
  const Icon = text.includes("geyser") || text.includes("water heater")
    ? FlameIcon
    : text.includes("appliance") || text.includes("cooker") || text.includes("burner")
      ? CookingPotIcon
      : text.includes("regulator") || text.includes("valve") || text.includes("pressure")
        ? GaugeIcon
        : text.includes("hose") || text.includes("fitting") || text.includes("clamp")
          ? WrenchIcon
          : text.includes("cylinder") || text.includes("lpg") || text.includes("gas")
            ? FuelIcon
            : text.includes("accessor") || text.includes("spare") || text.includes("maintenance")
              ? Settings2Icon
              : BoxesIcon;

  return <Icon aria-hidden="true" className="size-6 text-[#ff5a1f]" />;
}

function ExchangeableProductCard({
  product,
  onNavigate,
}: {
  product: MarketplaceShopMenuProduct;
  onNavigate: () => void;
}) {
  return (
    <Link
      className="group/product flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 transition hover:border-[#ff5a1f]/70 hover:bg-[#ff5a1f]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
      href={`/products/${product.slug}`}
      onClick={onNavigate}
    >
      <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.08]">
        {product.imageUrl ? (
          <Image
            alt=""
            className="size-full object-contain p-1"
            fill
            sizes="56px"
            src={product.imageUrl}
            unoptimized
          />
        ) : (
          <FuelIcon className="size-6 text-[#ff5a1f]" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-black uppercase text-white transition group-hover/product:text-[#ff5a1f]">
          {product.title}
        </span>
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#ff5a1f]">
          Exchange supported
        </span>
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-[#ff5a1f] transition group-hover/product:translate-x-0.5" />
    </Link>
  );
}

export function MarketplaceShopMenu({
  data,
  whatsappHref,
}: {
  data: MarketplaceShopMenuData;
  whatsappHref: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [panelTop, setPanelTop] = useState(112);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpgCategory = findLpgCategory(data.categories);
  const topLevelCategories = data.categories.filter(
    (category) => category.id !== lpgCategory?.id,
  );

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const updatePanelPosition = useCallback(() => {
    const header = triggerRef.current?.closest("header");

    if (header) {
      setPanelTop(Math.ceil(header.getBoundingClientRect().bottom));
    }
  }, []);

  const openMenu = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    updatePanelPosition();
    setOpen(true);
  }, [clearCloseTimer, clearOpenTimer, updatePanelPosition]);

  const closeMenu = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    setOpen(false);
  }, [clearCloseTimer, clearOpenTimer]);

  const scheduleOpen = useCallback(() => {
    clearCloseTimer();
    clearOpenTimer();
    openTimerRef.current = setTimeout(openMenu, 180);
  }, [clearCloseTimer, clearOpenTimer, openMenu]);

  const scheduleClose = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 140);
  }, [clearCloseTimer, clearOpenTimer]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
    }

    function handleOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    updatePanelPosition();
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutsidePointer);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsidePointer);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [closeMenu, open, updatePanelPosition]);

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
    [clearCloseTimer, clearOpenTimer],
  );

  return (
    <div
      className="relative flex h-[82px] items-center"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          scheduleClose();
        }
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          scheduleOpen();
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          scheduleClose();
        }
      }}
      ref={rootRef}
    >
      <button
        aria-controls="marketplace-shop-mega-menu"
        aria-expanded={open}
        aria-haspopup="true"
        className="group relative inline-flex h-[82px] items-center gap-1 text-[12px] font-black uppercase leading-none text-[#ff5a1f] transition hover:text-[#e84c15] focus-visible:outline-none focus-visible:text-[#e84c15]"
        onClick={() => {
          if (open) {
            closeMenu();
          } else {
            openMenu();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openMenu();
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span>Shop</span>
        <ChevronDownIcon
          className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
        <span
          className={`absolute inset-x-0 bottom-5 h-0.5 rounded-full bg-[#ff5a1f] transition ${
            open ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
          }`}
        />
      </button>

      {open ? (
        <div
          aria-label="Shop navigation"
          className="fixed inset-x-0 z-[75] overflow-y-auto overscroll-contain border-y border-white/10 bg-[#101010] text-left text-white shadow-[0_24px_60px_rgba(0,0,0,0.34)] [scrollbar-color:#ff5a1f_#1a1a1a]"
          id="marketplace-shop-mega-menu"
          onPointerEnter={clearCloseTimer}
          onPointerLeave={scheduleClose}
          role="navigation"
          style={{
            maxHeight: `min(calc(100dvh - ${panelTop}px - 1rem), 640px)`,
            top: panelTop,
          }}
        >
          <div className="mx-auto grid w-[min(1500px,calc(100%-2rem))] grid-cols-[220px_minmax(220px,0.9fr)_minmax(240px,1.15fr)_220px] gap-5 px-4 py-7 2xl:grid-cols-[260px_minmax(240px,0.9fr)_minmax(280px,1.15fr)_260px] 2xl:gap-7 2xl:px-8">
            <section className="min-w-0 border-r border-white/15 pr-5 2xl:pr-7">
              <span className="inline-flex bg-[#ff5a1f] px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white">
                Shop LPG
              </span>
              <h2 className="mt-4 text-2xl font-black uppercase leading-[1.05] 2xl:text-[28px]">
                Your one-stop <span className="text-[#ff5a1f]">LPG shop.</span>
              </h2>
              <p className="mt-3 text-xs font-medium leading-5 text-white/60">
                Browse {data.totalProductCount} products across cylinders,
                exchange options, and accessories.
              </p>
              <div className="mt-5 grid gap-2">
                <Link
                  className="flex h-10 items-center justify-between rounded-md bg-[#ff5a1f] px-3 text-[11px] font-black uppercase text-white transition hover:bg-[#e64b15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  href="/products"
                  onClick={closeMenu}
                >
                  Shop all products
                  <ChevronRightIcon className="size-4" />
                </Link>
                <Link
                  className="flex h-9 items-center gap-2 rounded-md border border-white/15 px-3 text-[11px] font-bold uppercase text-white/80 transition hover:border-[#ff5a1f] hover:text-white"
                  href="/products?exchange=1"
                  onClick={closeMenu}
                >
                  <RefreshCcwIcon className="size-3.5 text-[#ff5a1f]" />
                  Cylinder exchange
                </Link>
                <Link
                  className="flex h-9 items-center gap-2 rounded-md border border-white/15 px-3 text-[11px] font-bold uppercase text-white/80 transition hover:border-[#ff5a1f] hover:text-white"
                  href="/products?sale=1"
                  onClick={closeMenu}
                >
                  <TagsIcon className="size-3.5 text-[#ff5a1f]" />
                  Shop current deals
                </Link>
              </div>
            </section>

            <section className="min-w-0 border-r border-white/15 pr-5 2xl:pr-7">
              <div className="flex items-end justify-between gap-3 border-b border-white/15 pb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ff5a1f]">
                    LPG first
                  </p>
                  <h2 className="mt-1 text-base font-black uppercase">Exchangeable cylinders</h2>
                </div>
                <Link
                  className="shrink-0 text-[10px] font-black uppercase text-white/55 hover:text-[#ff5a1f]"
                  href="/products?exchange=1"
                  onClick={closeMenu}
                >
                  View all
                </Link>
              </div>
              {data.exchangeableLpgProducts.length > 0 ? (
                <div className="mt-4 max-h-[min(48vh,420px)] overflow-y-auto pr-1 [scrollbar-color:#ff5a1f_#1a1a1a]">
                  <div className="grid gap-2">
                    {data.exchangeableLpgProducts.map((product) => (
                      <ExchangeableProductCard
                        key={product.id}
                        onNavigate={closeMenu}
                        product={product}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-white/10 p-5 text-sm text-white/60">
                  No exchangeable LPG cylinders are available right now.
                </div>
              )}
            </section>

            <section className="min-w-0 border-r border-white/15 pr-5 2xl:pr-7">
              <div className="flex items-end justify-between gap-3 border-b border-white/15 pb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ff5a1f]">
                    Browse the range
                  </p>
                  <h2 className="mt-1 text-base font-black uppercase">Categories</h2>
                </div>
                <Link
                  className="shrink-0 text-[10px] font-black uppercase text-white/55 hover:text-[#ff5a1f]"
                  href="/products"
                  onClick={closeMenu}
                >
                  View all
                </Link>
              </div>
              {topLevelCategories.length > 0 ? (
                <div className="mt-4 max-h-[min(48vh,420px)] overflow-y-auto pr-2 [scrollbar-color:#ff5a1f_#1a1a1a]">
                  <div className="grid gap-2">
                    {topLevelCategories.map((category) => (
                      <article
                        className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-3 transition hover:border-[#ff5a1f]/60 hover:bg-white/[0.06]"
                        key={category.id}
                      >
                        <Link
                          className="group/category flex min-w-0 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]"
                          href={categoryHref(category)}
                          onClick={closeMenu}
                        >
                          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.07]">
                            <CategoryIcon category={category} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-black uppercase text-white transition group-hover/category:text-[#ff5a1f]">
                              {category.name}
                            </span>
                            <span className="mt-0.5 block text-[10px] font-semibold text-white/45">
                              {category.children.length > 0
                                ? `${category.children.length} subcategor${category.children.length === 1 ? "y" : "ies"}`
                                : `${category.productCount} product${category.productCount === 1 ? "" : "s"}`}
                            </span>
                          </span>
                          <ChevronRightIcon className="size-4 shrink-0 text-[#ff5a1f] transition group-hover/category:translate-x-0.5" />
                        </Link>
                        {category.brands.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1 border-t border-white/10 pt-2">
                            {category.brands.slice(0, 4).map((brand) => (
                              <Link
                                className="rounded-full bg-white/[0.07] px-2 py-1 text-[9px] font-bold text-white/65 transition hover:bg-[#ff5a1f] hover:text-white"
                                href={`/brands/${brand.slug}`}
                                key={brand.id}
                                onClick={closeMenu}
                              >
                                {brand.name}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-white/10 p-5 text-sm text-white/60">
                  Products are being organised. You can still browse the full shop.
                </div>
              )}
            </section>

            <aside className="min-w-0 border-l border-white/15 pl-5 2xl:pl-7">
              <div>
                <h2 className="text-sm font-black uppercase">Why choose us?</h2>
                <ul className="mt-3 grid gap-3 text-[11px] font-semibold text-white/70">
                  <li className="flex gap-2.5">
                    <BadgeCheckIcon className="size-4 shrink-0 text-[#ff5a1f]" />
                    Certified LPG reseller
                  </li>
                  <li className="flex gap-2.5">
                    <TruckIcon className="size-4 shrink-0 text-[#ff5a1f]" />
                    Reliable local delivery
                  </li>
                  <li className="flex gap-2.5">
                    <HeadphonesIcon className="size-4 shrink-0 text-[#ff5a1f]" />
                    Local customer support
                  </li>
                </ul>
                {whatsappHref ? (
                  <Link
                    aria-label="Start a WhatsApp chat"
                    className="mt-5 flex h-10 items-center justify-between rounded-md bg-[#080808] px-3 text-[10px] font-black uppercase text-white shadow-[0_8px_18px_rgba(8,8,8,0.2)] ring-1 ring-[#25d366]/20 transition hover:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25d366]/50"
                    href={whatsappHref}
                    onClick={closeMenu}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="flex items-center gap-2">
                      <MarketplaceWhatsAppIcon className="size-4 text-[#25d366]" />
                      Start WhatsApp chat
                    </span>
                    <ChevronRightIcon className="size-3.5" />
                  </Link>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}
