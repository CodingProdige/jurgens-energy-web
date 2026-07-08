import Image from "next/image";
import Link from "next/link";
import {
  BadgePercentIcon,
  MenuIcon,
  PackageCheckIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  StoreIcon,
  TruckIcon,
  UserIcon,
} from "lucide-react";

import { auth } from "@/auth";
import { CurrencySelector } from "@/components/currency/currency-selector";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  emptyNotificationCenter,
  getNotificationCenter,
} from "@/src/modules/notifications/in-app";
import { getCurrencyPreference } from "@/src/modules/currency/server";
import { getMarketplaceCategories } from "@/src/modules/marketplace/catalog";

function getSurfaceUrl(hostname: string) {
  const appUrl = new URL(process.env.APP_URL ?? "http://localhost:3000");
  appUrl.hostname = hostname;
  appUrl.pathname = "";
  appUrl.search = "";
  appUrl.hash = "";

  return appUrl.toString().replace(/\/$/, "");
}

export async function MarketplaceHeader() {
  const [session, currencyPreference, categories] = await Promise.all([
    auth(),
    getCurrencyPreference(),
    getMarketplaceCategories(),
  ]);
  const notificationCenter = session?.user?.id
    ? await getNotificationCenter({
        surface: "marketplace",
        userId: session.user.id,
      })
    : emptyNotificationCenter;
  const sellerUrl = getSurfaceUrl(
    process.env.SELLER_HOSTNAME ?? "seller.localhost",
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#101112]/95">
      <div className="border-b border-slate-100 dark:border-white/10">
        <div className="flex h-9 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <p className="hidden text-xs font-semibold text-slate-500 dark:text-zinc-400 sm:block">
            Shop trusted local sellers across South Africa.
          </p>
          <div className="ml-auto flex items-center gap-2">
            <CurrencySelector
              initialPreference={currencyPreference}
              variant="marketplace"
            />
            <ThemeToggle compact />
          </div>
        </div>
      </div>

      <div className="hidden h-20 w-full items-center gap-6 px-8 lg:flex">
        <Link className="flex shrink-0 items-center gap-3" href="/" aria-label="Piessang home">
          <span className="relative block h-9 w-9 overflow-hidden">
            <Image
              alt=""
              className="h-9 w-[164px] max-w-none object-left"
              height={36}
              priority
              src="/brand/logo/jurgens-icon.png"
              width={164}
            />
          </span>
          <span className="text-xl font-black tracking-wide text-zinc-950 dark:text-white">
            PIESSANG
          </span>
        </Link>

        <form className="flex h-11 min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <select
            aria-label="Search category"
            className="w-36 border-r border-slate-200 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-white/10 dark:bg-[#151719] dark:text-white"
            name="category"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            className="min-w-0 flex-1 bg-transparent px-4 text-sm text-zinc-950 outline-none placeholder:text-slate-400 dark:text-white"
            name="q"
            placeholder="Search for products, brands and more..."
          />
          <button
            aria-label="Search"
            className="grid w-14 place-items-center bg-[#ffd000] text-zinc-950 transition hover:bg-[#f4bf00]"
            type="submit"
          >
            <SearchIcon className="size-5" />
          </button>
        </form>

        <nav className="flex items-center gap-6 text-[11px] font-semibold text-zinc-950 dark:text-white">
          <Link className="grid justify-items-center gap-1" href="/deals">
            <ShieldCheckIcon className="size-5" />
            Deals
          </Link>
          <Link className="grid justify-items-center gap-1" href="/track-order">
            <TruckIcon className="size-5" />
            Track Order
          </Link>
          <Link className="grid justify-items-center gap-1" href={sellerUrl}>
            <StoreIcon className="size-5" />
            Sell on Piessang
          </Link>
          <Link className="relative grid justify-items-center gap-1" href="/cart">
            <ShoppingBagIcon className="size-5" />
            <span className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-[#ffd000] text-[10px] font-black">
              0
            </span>
            Cart
          </Link>
          {session?.user ? (
            <NotificationBell
              accent="marketplace"
              initialState={notificationCenter}
              surface="marketplace"
            />
          ) : (
            <Link className="grid justify-items-center gap-1" href="/sign-in">
              <UserIcon className="size-5" />
              Sign in
            </Link>
          )}
        </nav>
      </div>

      <div className="hidden h-14 w-full items-center gap-7 border-t border-slate-100 px-8 text-sm dark:border-white/10 lg:flex">
        <button className="flex items-center gap-3 font-semibold text-zinc-950 dark:text-white" type="button">
          <MenuIcon className="size-5" />
          <span className="grid text-left leading-tight">
            <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
              Shop by
            </span>
            Categories
          </span>
        </button>
        <nav className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <Link
            className="border-b-2 border-[#ffd000] py-4 font-semibold text-[#e5ad00]"
            href="/"
          >
            Home
          </Link>
          {categories.slice(0, 7).map((category) => (
            <Link
              className="py-4 font-medium text-zinc-950 transition hover:text-[#c4982d] dark:text-zinc-200"
              href={`/categories/${category.slug}`}
              key={category.id}
            >
              {category.name}
            </Link>
          ))}
          <Link
            className="py-4 font-medium text-zinc-950 transition hover:text-[#c4982d] dark:text-zinc-200"
            href="/"
          >
            More
          </Link>
        </nav>
      </div>

      <div className="grid w-full gap-3 px-3 py-3 lg:hidden">
        <div className="flex h-10 items-center justify-between">
          <button aria-label="Open menu" className="grid size-9 place-items-center" type="button">
            <MenuIcon className="size-5" />
          </button>
          <Link href="/" aria-label="Piessang home">
            <Image
              alt="Jurgens Energy"
              height={30}
              priority
              src="/brand/logo/jurgens-icon.png"
              width={132}
            />
          </Link>
          <div className="flex items-center gap-2">
            <Link className="relative grid size-9 place-items-center" href="/cart">
              <ShoppingBagIcon className="size-5" />
              <span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-[#ffd000] text-[10px] font-black">
                0
              </span>
            </Link>
            <Link className="grid size-9 place-items-center" href="/sign-in">
              <UserIcon className="size-5" />
            </Link>
          </div>
        </div>
        <form className="flex h-11 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <input
            className="min-w-0 flex-1 bg-transparent px-4 text-xs outline-none placeholder:text-slate-400 dark:text-white"
            name="q"
            placeholder="Search for products, brands and more..."
          />
          <button
            aria-label="Search"
            className="grid w-14 place-items-center bg-[#ffd000] text-zinc-950"
            type="submit"
          >
            <SearchIcon className="size-5" />
          </button>
        </form>
      </div>
    </header>
  );
}

export const marketplaceTrustItems = [
  {
    description: "Shop from verified sellers across the country",
    icon: PackageCheckIcon,
    title: "Multiple Trusted Sellers",
  },
  {
    description: "Compare and get the best prices",
    icon: BadgePercentIcon,
    title: "Best Prices & Deals",
  },
  {
    description: "100% safe payments across all banks",
    icon: ShieldCheckIcon,
    title: "Secure Payments",
  },
  {
    description: "Quick delivery to your doorstep",
    icon: TruckIcon,
    title: "Fast & Reliable Delivery",
  },
] as const;
