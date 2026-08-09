"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { ShoppingCartIcon } from "lucide-react";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type AnalyticsCartJourneyPoint = {
  addToCartActions: number | null;
  cartJourneys: number | null;
  comparisonAddToCartActions: number | null;
  label: string;
};

const cartJourneyChartConfig = {
  addToCartActions: {
    color: "#ff5a1f",
    label: "Add-to-cart actions",
  },
  cartJourneys: {
    color: "#ffb000",
    label: "Unique cart journeys",
  },
  comparisonAddToCartActions: {
    color: "#94a3b8",
    label: "Previous add-to-cart actions",
  },
} satisfies ChartConfig;

function ChartEmptyState() {
  return (
    <div className="grid h-64 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center dark:border-white/10 dark:bg-white/[0.025]">
      <div>
        <span className="mx-auto grid size-10 place-items-center rounded-full bg-white text-slate-400 shadow-sm dark:bg-white/[0.06] dark:text-zinc-500">
          <ShoppingCartIcon className="size-4" />
        </span>
        <p className="mt-3 text-sm font-medium text-slate-700 dark:text-zinc-300">
          No cart activity yet
        </p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-zinc-500">
          Add-to-cart activity will appear here as customers build carts during the selected period.
        </p>
      </div>
    </div>
  );
}

function TooltipValue({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-52 items-center gap-2">
      <span
        className="size-2.5 shrink-0 rounded-[3px]"
        style={{ backgroundColor: color }}
      />
      <span className="min-w-0 flex-1 text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold tabular-nums text-foreground">
        {value.toLocaleString("en-ZA")}
      </span>
    </div>
  );
}

export function CartJourneyChart({
  comparisonEnabled,
  data,
}: {
  comparisonEnabled: boolean;
  data: AnalyticsCartJourneyPoint[];
}) {
  const hasActivity = data.some(
    (point) =>
      (point.addToCartActions ?? 0) > 0 ||
      (point.cartJourneys ?? 0) > 0 ||
      (point.comparisonAddToCartActions ?? 0) > 0,
  );

  if (!hasActivity) {
    return <ChartEmptyState />;
  }

  return (
    <ChartContainer
      className="h-[300px] w-full min-w-0 aspect-auto sm:h-[340px]"
      config={cartJourneyChartConfig}
      initialDimension={{ height: 340, width: 920 }}
    >
      <ComposedChart
        accessibilityLayer
        data={data}
        margin={{ bottom: 4, left: 2, right: 4, top: 12 }}
      >
        <CartesianGrid strokeDasharray="3 5" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="label"
          minTickGap={28}
          tickLine={false}
          tickMargin={10}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          width={38}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => {
                const key = String(name) as keyof typeof cartJourneyChartConfig;
                const config = cartJourneyChartConfig[key];

                return (
                  <TooltipValue
                    color={item.color ?? config?.color ?? "#ff5a1f"}
                    label={String(config?.label ?? name)}
                    value={Number(value)}
                  />
                );
              }}
              indicator="dot"
            />
          }
          cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
        />
        <Bar
          dataKey="addToCartActions"
          fill="var(--color-addToCartActions)"
          fillOpacity={0.3}
          maxBarSize={28}
          radius={[5, 5, 0, 0]}
        />
        <Line
          connectNulls
          dataKey="cartJourneys"
          dot={false}
          stroke="var(--color-cartJourneys)"
          strokeWidth={2.5}
          type="monotone"
        />
        {comparisonEnabled ? (
          <Line
            connectNulls
            dataKey="comparisonAddToCartActions"
            dot={false}
            stroke="var(--color-comparisonAddToCartActions)"
            strokeDasharray="5 5"
            strokeWidth={1.75}
            type="monotone"
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  );
}
