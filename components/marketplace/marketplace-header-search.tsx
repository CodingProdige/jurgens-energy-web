"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ClockIcon,
  FlameIcon,
  PackageIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type MarketplaceSearchSuggestion = {
  brandName: string | null;
  id: string;
  imageUrl: string | null;
  priceLabel: string;
  productCode: string | null;
  slug: string;
  soldQuantity: number;
  title: string;
};

type SearchSuggestionsResponse = {
  popular: MarketplaceSearchSuggestion[];
  suggestions: MarketplaceSearchSuggestion[];
};

type MarketplaceHeaderSearchProps = {
  className?: string;
  placeholder?: string;
};

const recentSearchStorageKey = "jurgens-marketplace-recent-searches";

function getSearchHref(term: string) {
  const normalizedTerm = term.trim();

  return normalizedTerm
    ? `/products?q=${encodeURIComponent(normalizedTerm)}`
    : "/products";
}

function readRecentSearches() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(recentSearchStorageKey) ?? "[]",
    );

    return Array.isArray(parsed)
      ? parsed
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function persistRecentSearch(term: string) {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedTerm = term.trim();
  const current = readRecentSearches();
  const next = normalizedTerm
    ? [
        normalizedTerm,
        ...current.filter(
          (item) => item.toLowerCase() !== normalizedTerm.toLowerCase(),
        ),
      ].slice(0, 5)
    : current;

  try {
    window.localStorage.setItem(recentSearchStorageKey, JSON.stringify(next));
  } catch {
    // Ignore private-mode storage failures. Search still works through the form.
  }

  return next;
}

function ProductSuggestionRow({
  onNavigate,
  suggestion,
}: {
  onNavigate: (term: string) => void;
  suggestion: MarketplaceSearchSuggestion;
}) {
  return (
    <Link
      className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/35"
      href={`/products/${suggestion.slug}`}
      onClick={() => onNavigate(suggestion.title)}
      prefetch={false}
    >
      <span className="relative grid aspect-square size-11 place-items-center overflow-hidden rounded-md bg-[#f7f7f2] dark:bg-white/[0.07]">
        {suggestion.imageUrl ? (
          <Image
            alt=""
            className="object-contain"
            fill
            sizes="44px"
            src={suggestion.imageUrl}
            unoptimized
          />
        ) : (
          <PackageIcon className="size-5 text-[#ff5a1f]" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-black text-[#111] dark:text-[#f7f7f2]">
          {suggestion.title}
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
          {suggestion.productCode ? `Code ${suggestion.productCode}` : "Product"}
          {suggestion.brandName ? ` · ${suggestion.brandName}` : ""}
        </span>
      </span>
      <span className="shrink-0 text-[11px] font-black text-[#111] dark:text-[#f7f7f2]">
        {suggestion.priceLabel}
      </span>
    </Link>
  );
}

export function MarketplaceHeaderSearch({
  className,
  placeholder = "Search products",
}: MarketplaceHeaderSearchProps) {
  const inputId = useId();
  const rootRef = useRef<HTMLFormElement>(null);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popularProducts, setPopularProducts] = useState<
    MarketplaceSearchSuggestion[]
  >([]);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<MarketplaceSearchSuggestion[]>(
    [],
  );
  const normalizedQuery = query.trim();
  const showQuerySuggestions = normalizedQuery.length >= 2;
  const visibleSuggestions = showQuerySuggestions ? suggestions : [];
  const showDropdown =
    focused &&
    (visibleSuggestions.length > 0 ||
      popularProducts.length > 0 ||
      recentSearches.length > 0 ||
      normalizedQuery.length > 0);
  const sectionTitle = useMemo(() => {
    if (visibleSuggestions.length > 0) {
      return "Suggested products";
    }

    if (showQuerySuggestions && !loading) {
      return "No matching products yet";
    }

    return null;
  }, [loading, showQuerySuggestions, visibleSuggestions.length]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchTerm = params.get("q");

    if (searchTerm) {
      setQuery(searchTerm);
    }

    setRecentSearches(readRecentSearches());
  }, []);

  useEffect(() => {
    if (!focused) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLoading(true);

      fetch(
        `/api/catalog/search-suggestions?q=${encodeURIComponent(
          normalizedQuery,
        )}&limit=6`,
        {
          cache: "no-store",
        },
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error("Could not load product suggestions.");
          }

          return response.json() as Promise<SearchSuggestionsResponse>;
        })
        .then((data) => {
          if (cancelled) {
            return;
          }

          setPopularProducts(data.popular ?? []);
          setSuggestions(data.suggestions ?? []);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }

          setPopularProducts([]);
          setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [focused, normalizedQuery]);

  function handleSubmit() {
    const term = normalizedQuery;

    if (!term) {
      return;
    }

    setRecentSearches(persistRecentSearch(term));
  }

  function handleNavigate(term: string) {
    setFocused(false);
    setRecentSearches(persistRecentSearch(term));
  }

  return (
    <form
      action="/products"
      className={cn(
        "marketplace-header-search relative flex min-w-0 items-center rounded-full border border-[#e4e4de] bg-[#f7f7f2] shadow-[0_8px_22px_rgba(8,8,8,0.05)] focus-within:border-[#ff5a1f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#ff5a1f]/10 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-none dark:focus-within:bg-white/[0.09]",
        className,
      )}
      method="get"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
      onFocus={() => {
        setFocused(true);
        setRecentSearches(readRecentSearches());
      }}
      onSubmit={handleSubmit}
      ref={rootRef}
      role="search"
    >
      <label className="sr-only" htmlFor={inputId}>
        Search products
      </label>
      <input
        autoComplete="off"
        className="h-10 min-w-0 flex-1 rounded-full bg-transparent pl-4 pr-20 text-sm font-bold text-[#161616] outline-none placeholder:text-[#777770] dark:text-[#f7f7f2] dark:placeholder:text-[#aaa9a1]"
        enterKeyHint="search"
        id={inputId}
        maxLength={120}
        name="q"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={query}
      />
      {normalizedQuery ? (
        <button
          aria-label="Clear search"
          className="absolute right-10 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/35 dark:text-zinc-300"
          onClick={() => {
            setQuery("");
            setSuggestions([]);
          }}
          type="button"
        >
          <XIcon className="size-4" />
        </button>
      ) : null}
      <button
        aria-label="Search products"
        className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-[#ff5a1f] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/35"
        type="submit"
      >
        <SearchIcon className="size-4" />
      </button>

      {showDropdown ? (
        <div className="absolute right-0 top-[calc(100%+0.65rem)] z-[90] w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#e8e8e2] bg-white p-2 text-[#111] shadow-[0_18px_48px_rgba(8,8,8,0.16)] dark:border-white/10 dark:bg-[#101010] dark:text-[#f7f7f2]">
          {sectionTitle ? (
            <div className="px-2 pb-1 pt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
              {sectionTitle}
            </div>
          ) : null}

          {visibleSuggestions.length > 0 ? (
            <div className="grid gap-0.5">
              {visibleSuggestions.map((suggestion) => (
                <ProductSuggestionRow
                  key={suggestion.id}
                  onNavigate={handleNavigate}
                  suggestion={suggestion}
                />
              ))}
            </div>
          ) : showQuerySuggestions && !loading ? (
            <Link
              className="flex min-h-10 items-center justify-between rounded-lg px-2 text-xs font-bold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/35 dark:text-zinc-300"
              href={getSearchHref(normalizedQuery)}
              onClick={() => handleNavigate(normalizedQuery)}
              prefetch={false}
            >
              Search all products for “{normalizedQuery}”
              <SearchIcon className="size-4 text-[#ff5a1f]" />
            </Link>
          ) : null}

          {!showQuerySuggestions && recentSearches.length > 0 ? (
            <div className="mt-1 border-t border-[#ecece6] pt-2 dark:border-white/10">
              <div className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                Recent searches
              </div>
              <div className="flex flex-wrap gap-1.5 px-2 pb-1">
                {recentSearches.map((term) => (
                  <Link
                    className="inline-flex items-center gap-1 rounded-full bg-[#f7f7f2] px-2.5 py-1.5 text-[11px] font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/35 dark:bg-white/[0.07] dark:text-zinc-200"
                    href={getSearchHref(term)}
                    key={term}
                    onClick={() => handleNavigate(term)}
                    prefetch={false}
                  >
                    <ClockIcon className="size-3" />
                    {term}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {popularProducts.length > 0 ? (
            <div className="mt-1 border-t border-[#ecece6] pt-2 dark:border-white/10">
              <div className="flex items-center gap-1 px-2 pb-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                <FlameIcon className="size-3 text-[#ff5a1f]" />
                Popular products
              </div>
              <div className="grid gap-0.5">
                {popularProducts.slice(0, 3).map((suggestion) => (
                  <ProductSuggestionRow
                    key={`popular-${suggestion.id}`}
                    onNavigate={handleNavigate}
                    suggestion={suggestion}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
