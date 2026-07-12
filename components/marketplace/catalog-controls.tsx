"use client";

import {
  ChevronRightIcon,
  FilterIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  MarketplaceCatalogFacetOption,
  MarketplaceCatalogPageData,
} from "@/src/modules/marketplace/catalog";
import {
  createMarketplaceCatalogSearchParams,
  getMarketplaceCatalogActiveFilterCount,
  type MarketplaceCatalogFilters,
} from "@/src/modules/marketplace/catalog-filters";

type CatalogControlsProps = {
  children: ReactNode;
  data: Omit<MarketplaceCatalogPageData, "products">;
  filters: MarketplaceCatalogFilters;
};

type FilterFieldsProps = {
  data: Omit<MarketplaceCatalogPageData, "products">;
  filters: MarketplaceCatalogFilters;
  hideBrands: boolean;
  hideCategories: boolean;
  onChange: (filters: MarketplaceCatalogFilters, immediate?: boolean) => void;
};

const sortOptions: Array<{
  label: string;
  value: MarketplaceCatalogFilters["sort"];
}> = [
  { label: "Featured", value: "featured" },
  { label: "Best selling", value: "best-selling" },
  { label: "Newest", value: "newest" },
  { label: "Price: low to high", value: "price-asc" },
  { label: "Price: high to low", value: "price-desc" },
];

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function clearFacetFilters(filters: MarketplaceCatalogFilters) {
  return {
    ...filters,
    brandSlugs: [],
    categorySlugs: [],
    exchangeSupported: false,
    inStock: false,
    maxPrice: null,
    minPrice: null,
    onSale: false,
    page: 1,
  };
}

function FilterOption({
  checked,
  count,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  count: number;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-9 cursor-pointer items-center gap-2.5 py-1 text-[13px] text-[#1a1a1a] dark:text-[#e1e1da]",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <input
        checked={checked}
        className="size-4 shrink-0 accent-[#ff5a1f]"
        disabled={disabled}
        onChange={onChange}
        type="checkbox"
      />
      <span className="min-w-0 flex-1 leading-4">{label}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-[#777770] dark:text-[#a8a8a0]">
        {count}
      </span>
    </label>
  );
}

function FilterSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <details
      className="group border-b border-[#e8e8e2] py-4 last:border-b-0 dark:border-white/10"
      open
    >
      <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-black uppercase text-[#080808] dark:text-[#f7f7f2] [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronRightIcon className="size-4 rotate-90 text-[#777770] transition group-open:-rotate-90" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function FacetOptions({
  onToggle,
  options,
  selectedValues,
}: {
  onToggle: (value: string) => void;
  options: MarketplaceCatalogFacetOption[];
  selectedValues: string[];
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = normalizedQuery
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    : options;

  return (
    <div className="grid gap-2">
      {options.length > 7 ? (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#888880]" />
          <Input
            aria-label="Search filter options"
            className="h-8 rounded-md border-[#ddddD6] bg-white pl-8 text-xs shadow-none dark:border-white/12 dark:bg-white/[0.04]"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search"
            value={query}
          />
        </div>
      ) : null}
      <div className="grid max-h-56 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {visibleOptions.map((option) => {
          const checked = selectedValues.includes(option.value);

          return (
            <FilterOption
              checked={checked}
              count={option.count}
              disabled={option.count === 0 && !checked}
              key={option.value}
              label={option.label}
              onChange={() => onToggle(option.value)}
            />
          );
        })}
      </div>
    </div>
  );
}

function FilterFields({
  data,
  filters,
  hideBrands,
  hideCategories,
  onChange,
}: FilterFieldsProps) {
  function update(next: Partial<MarketplaceCatalogFilters>, immediate = true) {
    onChange({ ...filters, ...next, page: 1 }, immediate);
  }

  return (
    <div className="grid content-start">
      {!hideCategories && data.facets.categories.length > 0 ? (
        <FilterSection title="Category">
          <FacetOptions
            onToggle={(value) =>
              update({ categorySlugs: toggleValue(filters.categorySlugs, value) })
            }
            options={data.facets.categories}
            selectedValues={filters.categorySlugs}
          />
        </FilterSection>
      ) : null}

      {!hideBrands && data.facets.brands.length > 0 ? (
        <FilterSection title="Brand">
          <FacetOptions
            onToggle={(value) =>
              update({ brandSlugs: toggleValue(filters.brandSlugs, value) })
            }
            options={data.facets.brands}
            selectedValues={filters.brandSlugs}
          />
        </FilterSection>
      ) : null}

      <FilterSection title="Availability">
        <FilterOption
          checked={filters.inStock}
          count={data.facets.inStockCount}
          disabled={data.facets.inStockCount === 0 && !filters.inStock}
          label="In stock"
          onChange={() => update({ inStock: !filters.inStock })}
        />
      </FilterSection>

      <FilterSection title="Product options">
        <FilterOption
          checked={filters.exchangeSupported}
          count={data.facets.exchangeSupportedCount}
          disabled={
            data.facets.exchangeSupportedCount === 0 && !filters.exchangeSupported
          }
          label="Exchange supported"
          onChange={() =>
            update({ exchangeSupported: !filters.exchangeSupported })
          }
        />
        <FilterOption
          checked={filters.onSale}
          count={data.facets.onSaleCount}
          disabled={data.facets.onSaleCount === 0 && !filters.onSale}
          label="On sale"
          onChange={() => update({ onSale: !filters.onSale })}
        />
      </FilterSection>

      <FilterSection title={`Price (${data.currencyCode})`}>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-[10px] font-bold uppercase text-[#777770] dark:text-[#aaa9a1]">
            Min
            <Input
              className="h-9 rounded-md border-[#ddddD6] bg-white px-2 text-sm shadow-none dark:border-white/12 dark:bg-white/[0.04]"
              inputMode="decimal"
              min={0}
              onChange={(event) =>
                update(
                  {
                    minPrice: event.currentTarget.value
                      ? Number(event.currentTarget.value)
                      : null,
                  },
                  false,
                )
              }
              placeholder={String(data.facets.priceMinimum ?? 0)}
              type="number"
              value={filters.minPrice ?? ""}
            />
          </label>
          <label className="grid gap-1 text-[10px] font-bold uppercase text-[#777770] dark:text-[#aaa9a1]">
            Max
            <Input
              className="h-9 rounded-md border-[#ddddD6] bg-white px-2 text-sm shadow-none dark:border-white/12 dark:bg-white/[0.04]"
              inputMode="decimal"
              min={0}
              onChange={(event) =>
                update(
                  {
                    maxPrice: event.currentTarget.value
                      ? Number(event.currentTarget.value)
                      : null,
                  },
                  false,
                )
              }
              placeholder={String(data.facets.priceMaximum ?? 0)}
              type="number"
              value={filters.maxPrice ?? ""}
            />
          </label>
        </div>
      </FilterSection>
    </div>
  );
}

export function MarketplaceCatalogControls({
  children,
  data,
  filters,
}: CatalogControlsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [query, setQuery] = useState(filters.query);
  const [desktopFilters, setDesktopFilters] = useState(filters);
  const [mobileFilters, setMobileFilters] = useState(filters);
  const priceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeFilterCount = getMarketplaceCatalogActiveFilterCount(filters);
  const mobileActiveFilterCount =
    getMarketplaceCatalogActiveFilterCount(mobileFilters);
  const hideCategories = data.context?.kind === "category";
  const hideBrands = data.context?.kind === "brand";

  useEffect(() => {
    setDesktopFilters(filters);
    setMobileFilters(filters);
    setQuery(filters.query);
  }, [filters]);

  useEffect(
    () => () => {
      if (priceTimerRef.current) {
        clearTimeout(priceTimerRef.current);
      }
    },
    [],
  );

  function navigate(nextFilters: MarketplaceCatalogFilters) {
    const searchParams = createMarketplaceCatalogSearchParams(nextFilters);
    const href = searchParams.size > 0 ? `${pathname}?${searchParams}` : pathname;

    startTransition(() => router.push(href, { scroll: false }));
  }

  function updateDesktopFilters(
    nextFilters: MarketplaceCatalogFilters,
    immediate = true,
  ) {
    setDesktopFilters(nextFilters);

    if (priceTimerRef.current) {
      clearTimeout(priceTimerRef.current);
    }

    if (immediate) {
      navigate(nextFilters);
      return;
    }

    priceTimerRef.current = setTimeout(() => navigate(nextFilters), 450);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ ...filters, page: 1, query: query.trim() });
  }

  const activeChips = useMemo(() => {
    const chips: Array<{
      key: string;
      label: string;
      remove: () => MarketplaceCatalogFilters;
    }> = [];

    for (const value of filters.categorySlugs) {
      const option = data.facets.categories.find((item) => item.value === value);
      chips.push({
        key: `category-${value}`,
        label: option?.label ?? value,
        remove: () => ({
          ...filters,
          categorySlugs: filters.categorySlugs.filter((item) => item !== value),
          page: 1,
        }),
      });
    }

    for (const value of filters.brandSlugs) {
      const option = data.facets.brands.find((item) => item.value === value);
      chips.push({
        key: `brand-${value}`,
        label: option?.label ?? value,
        remove: () => ({
          ...filters,
          brandSlugs: filters.brandSlugs.filter((item) => item !== value),
          page: 1,
        }),
      });
    }

    if (filters.inStock) {
      chips.push({
        key: "stock",
        label: "In stock",
        remove: () => ({ ...filters, inStock: false, page: 1 }),
      });
    }

    if (filters.exchangeSupported) {
      chips.push({
        key: "exchange",
        label: "Exchange supported",
        remove: () => ({ ...filters, exchangeSupported: false, page: 1 }),
      });
    }

    if (filters.onSale) {
      chips.push({
        key: "sale",
        label: "On sale",
        remove: () => ({ ...filters, onSale: false, page: 1 }),
      });
    }

    if (filters.minPrice !== null || filters.maxPrice !== null) {
      chips.push({
        key: "price",
        label: `${data.currencyCode} ${filters.minPrice ?? 0}–${filters.maxPrice ?? "Any"}`,
        remove: () => ({
          ...filters,
          maxPrice: null,
          minPrice: null,
          page: 1,
        }),
      });
    }

    return chips;
  }, [data.currencyCode, data.facets.brands, data.facets.categories, filters]);

  return (
    <>
      <div className="grid gap-3 px-3 sm:px-0 lg:grid-cols-[minmax(16rem,1fr)_auto] lg:items-center">
        <form className="relative" onSubmit={handleSearchSubmit}>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#85857e]" />
          <Input
            className="h-10 rounded-md border-[#ddddD6] bg-white pl-9 pr-10 text-sm shadow-none focus-visible:border-[#ff5a1f] focus-visible:ring-[#ff5a1f]/15 dark:border-white/12 dark:bg-white/[0.04] sm:h-11"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={`Search ${data.context?.name ?? "products"}`}
            value={query}
          />
          {query ? (
            <Button
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 size-7 -translate-y-1/2 rounded-full text-[#777770]"
              onClick={() => {
                setQuery("");
                navigate({ ...filters, page: 1, query: "" });
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <XIcon className="size-3.5" />
            </Button>
          ) : null}
        </form>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 lg:grid-cols-[auto_auto]">
          <Button
            className="h-10 rounded-md border-[#d8d8d1] bg-white px-3 text-[#080808] shadow-none hover:border-[#ff5a1f] hover:bg-orange-50 dark:border-white/12 dark:bg-white/[0.04] dark:text-[#f7f7f2] lg:hidden"
            onClick={() => {
              setMobileFilters(filters);
              setIsDrawerOpen(true);
            }}
            type="button"
            variant="outline"
          >
            <FilterIcon className="size-4" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="grid size-5 place-items-center rounded-full bg-[#ff5a1f] text-[10px] font-black text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>

          <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-xs font-bold text-[#666660] dark:text-[#aaa9a1]">
            <span className="hidden sm:inline">Sort</span>
            <select
              aria-label="Sort products"
              className="h-10 min-w-0 rounded-md border border-[#d8d8d1] bg-white px-2.5 text-sm font-semibold text-[#080808] outline-none focus:border-[#ff5a1f] dark:border-white/12 dark:bg-[#171717] dark:text-[#f7f7f2] sm:min-w-44"
              onChange={(event) =>
                navigate({
                  ...filters,
                  page: 1,
                  sort: event.currentTarget.value as MarketplaceCatalogFilters["sort"],
                })
              }
              value={filters.sort}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 px-3 sm:px-0">
        <span className="mr-1 text-xs tabular-nums text-[#666660] dark:text-[#aaa9a1]">
          {data.totalCount} {data.totalCount === 1 ? "product" : "products"}
        </span>
        {activeChips.map((chip) => (
          <button
            className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-[#ff5a1f]/25 bg-orange-50 px-2.5 text-[11px] font-semibold text-[#b8380b] transition hover:border-[#ff5a1f] dark:bg-[#ff5a1f]/10 dark:text-[#ff9a75]"
            key={chip.key}
            onClick={() => navigate(chip.remove())}
            type="button"
          >
            <span className="truncate">{chip.label}</span>
            <XIcon className="size-3 shrink-0" />
          </button>
        ))}
        {activeFilterCount > 1 ? (
          <button
            className="h-7 px-1 text-[11px] font-semibold text-[#666660] underline underline-offset-4 hover:text-[#ff5a1f] dark:text-[#aaa9a1]"
            onClick={() => navigate(clearFacetFilters(filters))}
            type="button"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-4 grid min-w-0 items-start lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-6",
          isPending && "opacity-70",
        )}
      >
        <aside className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] overflow-y-auto border-r border-[#e8e8e2] pr-5 [scrollbar-width:thin] dark:border-white/10 lg:block">
          <div className="flex items-center justify-between border-b border-[#e8e8e2] pb-3 dark:border-white/10">
            <h2 className="text-sm font-black uppercase">Filters</h2>
            {activeFilterCount > 0 ? (
              <button
                className="text-[11px] font-semibold text-[#666660] hover:text-[#ff5a1f] dark:text-[#aaa9a1]"
                onClick={() => navigate(clearFacetFilters(filters))}
                type="button"
              >
                Clear
              </button>
            ) : null}
          </div>
          <FilterFields
            data={data}
            filters={desktopFilters}
            hideBrands={hideBrands}
            hideCategories={hideCategories}
            onChange={updateDesktopFilters}
          />
        </aside>

        <div className="min-w-0">
          {children}
        </div>
      </div>

      <Dialog onOpenChange={setIsDrawerOpen} open={isDrawerOpen}>
        <DialogContent
          className="!left-0 !top-0 !h-[100dvh] !max-h-[100dvh] !w-[min(22rem,calc(100vw-0.5rem))] !max-w-[min(22rem,calc(100vw-0.5rem))] !translate-x-0 !translate-y-0 rounded-none rounded-r-lg border-r border-[#e8e8e2] bg-white text-[#080808] shadow-2xl dark:border-white/10 dark:bg-[#101010] dark:text-[#f7f7f2] lg:hidden"
          overlayClassName="bg-black/40 lg:hidden"
        >
          <DialogHeader className="border-b border-[#e8e8e2] bg-white px-4 py-4 dark:border-white/10 dark:bg-[#101010]">
            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase">
              Filters
              {mobileActiveFilterCount > 0 ? (
                <span className="grid size-5 place-items-center rounded-full bg-[#ff5a1f] text-[10px] text-white">
                  {mobileActiveFilterCount}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              Refine the products shown in this collection.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="px-4 py-0">
            <FilterFields
              data={data}
              filters={mobileFilters}
              hideBrands={hideBrands}
              hideCategories={hideCategories}
              onChange={(nextFilters) => setMobileFilters(nextFilters)}
            />
          </DialogBody>
          <DialogFooter className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 bg-white p-3 dark:bg-[#101010] sm:grid-cols-[auto_minmax(0,1fr)]">
            <Button
              className="h-11 rounded-md px-3"
              onClick={() => setMobileFilters(clearFacetFilters(mobileFilters))}
              type="button"
              variant="outline"
            >
              Clear
            </Button>
            <Button
              className="h-11 rounded-md bg-[#ff5a1f] text-white hover:bg-[#e84c15]"
              onClick={() => {
                setIsDrawerOpen(false);
                navigate({ ...mobileFilters, page: 1 });
              }}
              type="button"
            >
              Apply filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
