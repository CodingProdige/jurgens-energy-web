import Image from "next/image";
import Link from "next/link";

import { CurrencySelector } from "@/components/currency/currency-selector";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getCurrencyPreference } from "@/src/modules/currency/server";

function getSurfaceUrl(hostname: string) {
  const appUrl = new URL(process.env.APP_URL ?? "http://localhost:3000");
  appUrl.hostname = hostname;
  appUrl.pathname = "";
  appUrl.search = "";
  appUrl.hash = "";

  return appUrl.toString().replace(/\/$/, "");
}

export async function MarketplaceFooter() {
  const currencyPreference = await getCurrencyPreference();
  const sellerUrl = getSurfaceUrl(
    process.env.SELLER_HOSTNAME ?? "seller.localhost",
  );

  return (
    <footer className="mt-10 border-t border-slate-200 bg-white dark:border-white/10 dark:bg-[#101112]">
      <div className="grid w-full gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div className="min-w-0">
          <Link className="inline-flex items-center gap-3" href="/">
            <span className="relative block h-9 w-9 overflow-hidden">
              <Image
                alt=""
                className="h-9 w-[164px] max-w-none object-left"
                height={36}
                src="/brand/logo/jurgens-icon.png"
                width={164}
              />
            </span>
            <span className="text-lg font-black tracking-wide text-zinc-950 dark:text-white">
              PIESSANG
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600 dark:text-zinc-400">
            A local-first marketplace for discovering trusted products and sellers.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <CurrencySelector
              initialPreference={currencyPreference}
              variant="marketplace"
            />
            <ThemeToggle compact />
          </div>
        </div>

        <FooterColumn
          links={[
            ["Shop", "/"],
            ["Deals", "/deals"],
            ["Categories", "/"],
            ["Track order", "/track-order"],
          ]}
          title="Buy"
        />
        <FooterColumn
          links={[
            ["Sell on Piessang", sellerUrl],
            ["Seller sign in", `${sellerUrl}/sign-in`],
            ["Seller register", `${sellerUrl}/register`],
          ]}
          title="Sell"
        />
        <FooterColumn
          links={[
            ["Support", "/support"],
            ["Payments", "/payments"],
            ["Delivery", "/delivery"],
            ["Returns", "/returns"],
          ]}
          title="Help"
        />
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 dark:border-white/10 dark:text-zinc-500">
        © {new Date().getFullYear()} Piessang. All rights reserved.
      </div>
    </footer>
  );
}

function FooterColumn({
  links,
  title,
}: {
  links: Array<[string, string]>;
  title: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-bold text-zinc-950 dark:text-white">{title}</h2>
      <nav className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-zinc-400">
        {links.map(([label, href]) => (
          <Link className="transition hover:text-[#c4982d]" href={href} key={label}>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
