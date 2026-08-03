import { SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MarketplaceHeaderSearchProps = {
  className?: string;
  placeholder?: string;
};

export function MarketplaceHeaderSearch({
  className,
  placeholder = "Search products",
}: MarketplaceHeaderSearchProps) {
  return (
    <form
      action="/products"
      className={cn(
        "relative flex min-w-0 items-center rounded-full border border-[#e4e4de] bg-[#f7f7f2] shadow-[0_8px_22px_rgba(8,8,8,0.05)] transition focus-within:border-[#ff5a1f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#ff5a1f]/10 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-none dark:focus-within:bg-white/[0.09]",
        className,
      )}
      method="get"
      role="search"
    >
      <input
        aria-label="Search products"
        autoComplete="off"
        className="h-10 min-w-0 flex-1 rounded-full bg-transparent pl-4 pr-11 text-sm font-bold text-[#161616] outline-none placeholder:text-[#777770] dark:text-[#f7f7f2] dark:placeholder:text-[#aaa9a1]"
        enterKeyHint="search"
        maxLength={120}
        name="q"
        placeholder={placeholder}
        type="search"
      />
      <button
        aria-label="Search products"
        className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-[#ff5a1f] text-white transition hover:bg-[#e64b15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/35"
        type="submit"
      >
        <SearchIcon className="size-4" />
      </button>
    </form>
  );
}
