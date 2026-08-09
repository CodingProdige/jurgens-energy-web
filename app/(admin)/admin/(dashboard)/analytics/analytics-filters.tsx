import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarRangeIcon, GitCompareArrowsIcon } from "lucide-react";

import { dashboardPanelClass } from "@/components/dashboard/dashboard-controls";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const analyticsPeriods = [
  { label: "24 hours", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
] as const;

export const analyticsComparisons = [
  { label: "Previous period", value: "previous_period" },
  { label: "No comparison", value: "none" },
] as const;

export type AnalyticsPeriod = (typeof analyticsPeriods)[number]["value"];
export type AnalyticsComparison =
  (typeof analyticsComparisons)[number]["value"];

function analyticsHref({
  comparison,
  period,
}: {
  comparison: AnalyticsComparison;
  period: AnalyticsPeriod;
}) {
  const params = new URLSearchParams({ compare: comparison, period });

  return `/analytics?${params.toString()}`;
}

function FilterGroup({
  children,
  icon: Icon,
  label,
}: {
  children: ReactNode;
  icon: typeof CalendarRangeIcon;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <div className="flex min-w-0 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function AnalyticsFilters({
  activeComparison,
  activePeriod,
  periodLabel,
}: {
  activeComparison: AnalyticsComparison;
  activePeriod: AnalyticsPeriod;
  periodLabel: string;
}) {
  return (
    <section
      aria-label="Analytics filters"
      className={cn("px-4 py-3.5 sm:px-5", dashboardPanelClass)}
    >
      <div className="flex min-w-0 flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <FilterGroup icon={CalendarRangeIcon} label="Reporting period">
            {analyticsPeriods.map((option) => {
              const isActive = option.value === activePeriod;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={buttonVariants({
                    className: cn(
                      "h-8 rounded-md border-slate-300 px-3 text-xs font-medium shadow-none dark:border-white/15",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 dark:border-primary"
                        : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/10",
                    ),
                    variant: isActive ? "default" : "outline",
                  })}
                  href={analyticsHref({
                    comparison: activeComparison,
                    period: option.value,
                  })}
                  key={option.value}
                  prefetch={false}
                >
                  {option.label}
                </Link>
              );
            })}
          </FilterGroup>

          <FilterGroup icon={GitCompareArrowsIcon} label="Comparison">
            {analyticsComparisons.map((option) => {
              const isActive = option.value === activeComparison;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={buttonVariants({
                    className: cn(
                      "h-8 rounded-md border-slate-300 px-3 text-xs font-medium shadow-none dark:border-white/15",
                      isActive
                        ? "border-amber-500 bg-amber-500/12 text-amber-800 hover:bg-amber-500/18 dark:border-amber-400/50 dark:text-amber-200"
                        : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/10",
                    ),
                    variant: "outline",
                  })}
                  href={analyticsHref({
                    comparison: option.value,
                    period: activePeriod,
                  })}
                  key={option.value}
                  prefetch={false}
                >
                  {option.label}
                </Link>
              );
            })}
          </FilterGroup>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
          <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
          <span className="font-medium text-zinc-900 dark:text-white">Live data</span>
          <span aria-hidden="true" className="text-slate-300 dark:text-white/20">
            ·
          </span>
          <span className="max-w-[22rem] truncate">{periodLabel} · SAST</span>
        </div>
      </div>
    </section>
  );
}
