"use client";

import { useEffect, useState } from "react";
import {
  CircleHelpIcon,
  PaletteIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import {
  dashboardControlClass,
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type DashboardMetricColor = string;

export type DashboardMetricDefinition = {
  color: DashboardMetricColor;
  description: string;
  id: string;
  label: string;
  value: number;
};

type DashboardMetricPreference = {
  color?: DashboardMetricColor;
  id: string;
  visible: boolean;
};

const metricDefaultColors: Record<string, string> = {
  amber: "#f59e0b",
  blue: "#3b82f6",
  emerald: "#10b981",
  red: "#ef4444",
  slate: "#64748b",
  violet: "#8b5cf6",
};

const defaultMetricLimit = 6;
const fallbackMetricColor = "#3b82f6";

function normalizeMetricColor(color: string | undefined) {
  if (!color) {
    return fallbackMetricColor;
  }

  if (color in metricDefaultColors) {
    return metricDefaultColors[color];
  }

  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallbackMetricColor;
}

function getInitialMetricPreferences(
  availableMetrics: DashboardMetricDefinition[],
  storageKey: string,
) {
  const defaultPreferences = availableMetrics.map((metric, index) => ({
    color: normalizeMetricColor(metric.color),
    id: metric.id,
    visible: index < defaultMetricLimit,
  }));

  if (typeof window === "undefined") {
    return defaultPreferences;
  }

  try {
    const stored = window.localStorage.getItem(storageKey);

    if (!stored) {
      return defaultPreferences;
    }

    const parsed = JSON.parse(stored) as DashboardMetricPreference[];
    const availableMetricIds = new Set(
      availableMetrics.map((metric) => metric.id),
    );
    const storedPreferences = parsed.filter((preference) =>
      availableMetricIds.has(preference.id),
    );
    const storedPreferenceIds = new Set(
      storedPreferences.map((preference) => preference.id),
    );
    const missingPreferences = defaultPreferences.filter(
      (preference) => !storedPreferenceIds.has(preference.id),
    );

    return [...storedPreferences, ...missingPreferences];
  } catch {
    return defaultPreferences;
  }
}

function MetricInfo({ description, label }: { description: string; label: string }) {
  return (
    <span className="group/info relative inline-flex shrink-0">
      <button
        aria-label={`${label} info`}
        className="grid size-[18px] place-items-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4982d]/30 dark:border-white/10 dark:bg-white/10 dark:text-zinc-400 dark:hover:bg-white/15 dark:hover:text-zinc-200"
        type="button"
      >
        <CircleHelpIcon className="size-3.5" />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-[80] mt-2 hidden w-56 max-w-[min(14rem,calc(100vw-2rem))] -translate-x-1/2 whitespace-normal rounded-lg border border-slate-200 bg-white p-2 text-left font-sans text-xs font-normal leading-snug tracking-normal text-slate-600 shadow-xl group-hover/info:block group-focus-within/info:block dark:border-white/10 dark:bg-[#151719] dark:text-zinc-300">
        {description}
      </span>
    </span>
  );
}

export function DashboardCompactMetrics({
  metrics,
  storageKey,
}: {
  metrics: DashboardMetricDefinition[];
  storageKey: string;
}) {
  const [preferences, setPreferences] = useState<DashboardMetricPreference[]>(
    () => getInitialMetricPreferences(metrics, storageKey),
  );

  useEffect(() => {
    setPreferences((currentPreferences) => {
      const currentById = new Map(
        currentPreferences.map((preference) => [preference.id, preference]),
      );

      return metrics.map((metric, index) => {
        const currentPreference = currentById.get(metric.id);

        return {
          color: normalizeMetricColor(currentPreference?.color ?? metric.color),
          id: metric.id,
          visible: currentPreference?.visible ?? index < defaultMetricLimit,
        };
      });
    });
  }, [metrics]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  }, [preferences, storageKey]);

  const preferenceById = new Map(
    preferences.map((preference) => [preference.id, preference]),
  );
  const selectedMetrics = metrics.filter(
    (metric) => preferenceById.get(metric.id)?.visible,
  );

  function toggleMetric(metricId: string) {
    setPreferences((currentPreferences) =>
      currentPreferences.map((preference) =>
        preference.id === metricId
          ? { ...preference, visible: !preference.visible }
          : preference,
      ),
    );
  }

  function updateMetricColor(metricId: string, color: string) {
    setPreferences((currentPreferences) =>
      currentPreferences.map((preference) =>
        preference.id === metricId ? { ...preference, color } : preference,
      ),
    );
  }

  function resetMetrics() {
    setPreferences(
      metrics.map((metric, index) => ({
        color: normalizeMetricColor(metric.color),
        id: metric.id,
        visible: index < defaultMetricLimit,
      })),
    );
  }

  return (
    <section className={cn("px-3 py-2", dashboardPanelClass)}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2 dark:border-white/10">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-xs font-semibold text-zinc-950 dark:text-white">
              Counts
            </p>
            <MetricInfo
              description="Configurable count chips for this dashboard page."
              label="Counts"
            />
          </div>
          <p className="truncate text-[11px] text-slate-500 dark:text-zinc-400">
            {selectedMetrics.length} of {metrics.length} shown
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="Configure counts"
                className={cn("size-8 p-0", dashboardControlClass)}
                type="button"
                variant="outline"
              >
                <SlidersHorizontalIcon className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent
            align="end"
            collisionAvoidance={{
              align: "shift",
              fallbackAxisSide: "none",
              side: "flip",
            }}
            collisionPadding={12}
            className="w-[min(20rem,calc(100vw-2rem))] border border-slate-200 bg-white p-2 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white"
            sideOffset={8}
          >
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                Pick counts
              </p>
              <button
                className="text-xs font-medium text-[#9a6a16] hover:text-[#6f4a0d] dark:text-[#fbe694]"
                onClick={resetMetrics}
                type="button"
              >
                Reset
              </button>
            </div>
            <div className="grid max-h-80 gap-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {metrics.map((metric) => {
                const preference = preferenceById.get(metric.id);
                const activeColor = normalizeMetricColor(
                  preference?.color ?? metric.color,
                );

                return (
                  <div
                    key={metric.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                      <input
                        checked={preference?.visible ?? false}
                        className="size-4 accent-[#c4982d]"
                        onChange={() => toggleMetric(metric.id)}
                        type="checkbox"
                      />
                      <span className="min-w-0 flex-1 truncate font-normal">
                        {metric.label}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-zinc-400">
                        {metric.value.toLocaleString()}
                      </span>
                    </label>
                    <label
                      className="relative grid size-7 cursor-pointer place-items-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.08]"
                      aria-label={`Choose ${metric.label} color`}
                    >
                      <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: activeColor }}
                      />
                      <PaletteIcon className="absolute bottom-0.5 right-0.5 size-2.5 text-slate-500 dark:text-zinc-400" />
                      <input
                        aria-label={`Choose ${metric.label} color`}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        onChange={(event) =>
                          updateMetricColor(metric.id, event.target.value)
                        }
                        type="color"
                        value={activeColor}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {selectedMetrics.length > 0 ? (
        <div className="grid grid-cols-2 divide-y divide-slate-200 dark:divide-white/10 sm:grid-cols-3 lg:grid-cols-6">
          {selectedMetrics.map((metric) => {
            const color = normalizeMetricColor(
              preferenceById.get(metric.id)?.color ?? metric.color,
            );

            return (
              <div
                key={metric.id}
                className="flex min-w-0 items-center gap-2 py-2 sm:px-2"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="min-w-0 truncate text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                      {metric.label}
                    </p>
                    <MetricInfo
                      description={metric.description}
                      label={metric.label}
                    />
                  </div>
                  <p className="text-sm font-semibold leading-tight text-zinc-950 dark:text-white">
                    {metric.value.toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-3 text-xs text-slate-500 dark:text-zinc-400">
          No counts selected.
        </p>
      )}
    </section>
  );
}
