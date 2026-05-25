import type { ComponentProps, ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const dashboardControlClass =
  "border-slate-300 bg-white text-zinc-950 shadow-none dark:border-white/18 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10";

export const dashboardPanelClass =
  "rounded-lg border border-slate-300 bg-white shadow-sm dark:border-white/18 dark:bg-[#151719] dark:shadow-black/30";

export const dashboardTableHeaderRowClass =
  "border-slate-300 hover:bg-transparent dark:border-white/18";

export const dashboardTableHeadClass =
  "h-12 px-4 text-xs font-semibold text-slate-600 dark:text-zinc-400 md:px-5";

export const dashboardTableRowClass =
  "h-[42px] border-slate-200 hover:bg-slate-50/80 dark:border-white/10 dark:hover:bg-white/[0.04]";

export const dashboardTableCellClass = "px-4 md:px-5";

export const dashboardTablePrimaryTextClass =
  "text-sm font-semibold text-zinc-950 dark:text-white";

export const dashboardTableSecondaryTextClass =
  "text-xs text-slate-500 dark:text-zinc-400";

export const dashboardTableMutedTextClass =
  "text-sm text-slate-700 dark:text-zinc-300";

export const dashboardTableContainerClass =
  "[&_[data-slot=table-container]]:overflow-visible md:[&_[data-slot=table-container]]:overflow-x-auto";

export const dashboardTableClass = "table-fixed md:min-w-[920px] md:table-auto";

export const dashboardTableActionHeadClass =
  "w-[86px] pr-4 text-right md:sticky md:right-0 md:z-20 md:w-[112px] md:bg-white md:pr-5 md:shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.7)] dark:md:bg-[#151719]";

export const dashboardTableActionCellClass =
  "w-[86px] pr-4 text-right md:sticky md:right-0 md:z-10 md:w-[112px] md:bg-white md:pr-5 md:shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.7)] dark:md:bg-[#151719]";

export function DashboardPageHeader({
  breadcrumbs,
  className,
  title,
}: {
  breadcrumbs: string[];
  className?: string;
  title: string;
}) {
  return (
    <header className={cn("mb-5 flex flex-col gap-2", className)}>
      <h1 className="text-[28px] font-bold leading-tight tracking-normal text-zinc-950 dark:text-white">
        {title}
      </h1>
      <nav
        aria-label={`${title} breadcrumbs`}
        className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400"
      >
        {breadcrumbs.map((breadcrumb, index) => (
          <span key={`${breadcrumb}-${index}`} className="inline-flex items-center gap-2">
            {index > 0 ? <ChevronRightIcon className="size-4" /> : null}
            <span>{breadcrumb}</span>
          </span>
        ))}
      </nav>
    </header>
  );
}

export function DashboardButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      className={cn(
        "h-8 gap-1.5 rounded-md px-3 text-[14px] font-normal leading-none",
        dashboardControlClass,
        className,
      )}
      {...props}
    />
  );
}

export function DashboardInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn("h-10 rounded-lg text-sm", dashboardControlClass, className)}
      {...props}
    />
  );
}

export function DashboardMetricStrip({
  metrics,
  className,
}: {
  className?: string;
  metrics: Array<{
    label: string;
    value: ReactNode;
  }>;
}) {
  return (
    <section className={cn(dashboardPanelClass, className)}>
      <div className="grid grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 overflow-hidden px-4 py-3 not-last:border-r not-last:border-slate-200 dark:not-last:border-white/10"
          >
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
              {metric.label}
            </p>
            <p className="mt-1 text-xl font-bold leading-none text-zinc-950 dark:text-white md:text-2xl">
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildPaginationItems(currentPage: number, totalPages: number) {
  const pageSet = new Set(
    [1, currentPage - 1, currentPage, currentPage + 1, totalPages].filter(
      (page) => page >= 1 && page <= totalPages,
    ),
  );
  const pages = Array.from(pageSet).sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  pages.forEach((page, index) => {
    const previousPage = pages[index - 1];

    if (previousPage && page - previousPage > 1) {
      items.push("ellipsis");
    }

    items.push(page);
  });

  return items;
}

export function DashboardTablePagination({
  currentPage,
  itemLabel,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number;
  itemLabel: string;
  pageSize: number;
  pageSizeOptions?: number[];
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const showingStart = totalItems === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const showingEnd = Math.min(activePage * pageSize, totalItems);
  const paginationItems = buildPaginationItems(activePage, totalPages);

  return (
    <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-600 dark:text-zinc-400">
        Showing {showingStart} to {showingEnd} of{" "}
        {totalItems.toLocaleString()} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={String(pageSize)}
          onValueChange={(value: string | null) => {
            if (!value) {
              return;
            }

            onPageSizeChange(Number(value));
          }}
        >
          <SelectTrigger
            className={cn("h-9 w-[124px] gap-2", dashboardControlClass)}
            aria-label="Rows per page"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            align="start"
            sideOffset={6}
            className="border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white"
          >
            {pageSizeOptions.map((size) => (
              <SelectItem
                key={size}
                value={String(size)}
                className="cursor-pointer px-2 py-2 text-zinc-800 focus:bg-slate-100 focus:text-zinc-950 dark:text-zinc-200 dark:focus:bg-white/10 dark:focus:text-white"
              >
                {size} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            className={dashboardControlClass}
            disabled={activePage === 1}
            onClick={() => onPageChange(Math.max(1, activePage - 1))}
            aria-label={`Previous ${itemLabel} page`}
            type="button"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          {paginationItems.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-sm text-slate-500 dark:text-zinc-400"
              >
                ...
              </span>
            ) : (
              <Button
                key={item}
                variant="outline"
                size="icon-sm"
                className={cn(
                  dashboardControlClass,
                  item === activePage &&
                    "border-[#c4982d] text-[#a87920] dark:border-[#c4982d] dark:text-[#f3c96b]",
                )}
                onClick={() => onPageChange(item)}
                aria-label={`Go to ${itemLabel} page ${item}`}
                aria-current={item === activePage ? "page" : undefined}
                type="button"
              >
                {item}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon-sm"
            className={dashboardControlClass}
            disabled={activePage === totalPages}
            onClick={() => onPageChange(Math.min(totalPages, activePage + 1))}
            aria-label={`Next ${itemLabel} page`}
            type="button"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
