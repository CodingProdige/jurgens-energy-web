"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3Icon } from "lucide-react";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartColors = {
  abandoned: "#64748b",
  captured: "#10b981",
  expired: "#0ea5e9",
  failed: "#ef4444",
  flame: "#ff5a1f",
  pending: "#ffb000",
  refunded: "#8b5cf6",
} as const;

export type AnalyticsSalesPoint = {
  comparisonOrders: number | null;
  comparisonSales: number | null;
  label: string;
  orders: number | null;
  sales: number | null;
};

export type AnalyticsCheckoutOutcome = {
  id: "successful" | "pending" | "failed" | "abandoned";
  label: string;
  value: number;
};

export type AnalyticsOutcomePoint = {
  abandoned: number | null;
  failed: number | null;
  label: string;
  pending: number | null;
  successful: number | null;
};

export type AnalyticsPaymentHealth = {
  captured: number;
  expired: number;
  failed: number;
  pending: number;
  refunded: number;
  successRate: number | null;
  total: number;
};

const salesChartConfig = {
  comparisonOrders: {
    color: "#94a3b8",
    label: "Previous orders",
  },
  comparisonSales: {
    color: "#a1a1aa",
    label: "Previous sales",
  },
  orders: {
    color: chartColors.pending,
    label: "Orders",
  },
  sales: {
    color: chartColors.flame,
    label: "Gross sales",
  },
} satisfies ChartConfig;

const outcomeChartConfig = {
  abandoned: {
    color: chartColors.abandoned,
    label: "Abandoned",
  },
  failed: {
    color: chartColors.failed,
    label: "Failed",
  },
  pending: {
    color: chartColors.pending,
    label: "In progress",
  },
  successful: {
    color: chartColors.captured,
    label: "Successful",
  },
} satisfies ChartConfig;

function formatCompactMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    currency,
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(value);
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="grid h-64 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center dark:border-white/10 dark:bg-white/[0.025]">
      <div>
        <span className="mx-auto grid size-10 place-items-center rounded-full bg-white text-slate-400 shadow-sm dark:bg-white/[0.06] dark:text-zinc-500">
          <BarChart3Icon className="size-4" />
        </span>
        <p className="mt-3 text-sm font-medium text-slate-700 dark:text-zinc-300">
          No chart activity yet
        </p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-zinc-500">
          {message}
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
  value: string;
}) {
  return (
    <div className="flex min-w-44 items-center gap-2">
      <span
        className="size-2.5 shrink-0 rounded-[3px]"
        style={{ backgroundColor: color }}
      />
      <span className="min-w-0 flex-1 text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

export function SalesOrdersChart({
  comparisonEnabled,
  currency,
  data,
}: {
  comparisonEnabled: boolean;
  currency: string;
  data: AnalyticsSalesPoint[];
}) {
  const hasActivity = data.some(
    (point) =>
      (point.sales ?? 0) > 0 ||
      (point.orders ?? 0) > 0 ||
      (point.comparisonSales ?? 0) > 0 ||
      (point.comparisonOrders ?? 0) > 0,
  );

  if (!hasActivity) {
    return (
      <ChartEmptyState message="Sales and paid-order movement will appear here as commerce activity is recorded in the selected period." />
    );
  }

  return (
    <ChartContainer
      className="h-[320px] w-full min-w-0 aspect-auto sm:h-[360px]"
      config={salesChartConfig}
      initialDimension={{ height: 360, width: 920 }}
    >
      <ComposedChart
        accessibilityLayer
        data={data}
        margin={{ bottom: 4, left: 2, right: 4, top: 12 }}
      >
        <defs>
          <linearGradient id="analytics-sales-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="4%" stopColor="var(--color-sales)" stopOpacity={0.3} />
            <stop offset="96%" stopColor="var(--color-sales)" stopOpacity={0.015} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 5" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="label"
          minTickGap={28}
          tickLine={false}
          tickMargin={10}
        />
        <YAxis
          axisLine={false}
          tickFormatter={(value: number) => formatCompactMoney(value, currency)}
          tickLine={false}
          tickMargin={8}
          width={68}
          yAxisId="sales"
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          orientation="right"
          tickLine={false}
          tickMargin={8}
          width={32}
          yAxisId="orders"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => {
                const key = String(name);
                const isSales = key.toLowerCase().includes("sales");
                const config = salesChartConfig[key as keyof typeof salesChartConfig];

                return (
                  <TooltipValue
                    color={item.color ?? config?.color ?? chartColors.flame}
                    label={String(config?.label ?? name)}
                    value={
                      isSales
                        ? formatMoney(Number(value), currency)
                        : Number(value).toLocaleString("en-ZA")
                    }
                  />
                );
              }}
              indicator="dot"
            />
          }
          cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
        />
        <Area
          dataKey="sales"
          fill="url(#analytics-sales-fill)"
          stroke="var(--color-sales)"
          strokeWidth={2.5}
          type="monotone"
          yAxisId="sales"
        />
        {comparisonEnabled ? (
          <Line
            connectNulls
            dataKey="comparisonSales"
            dot={false}
            stroke="var(--color-comparisonSales)"
            strokeDasharray="5 5"
            strokeWidth={1.75}
            type="monotone"
            yAxisId="sales"
          />
        ) : null}
        <Bar
          dataKey="orders"
          fill="var(--color-orders)"
          fillOpacity={0.32}
          maxBarSize={20}
          radius={[4, 4, 0, 0]}
          yAxisId="orders"
        />
        {comparisonEnabled ? (
          <Line
            connectNulls
            dataKey="comparisonOrders"
            dot={false}
            stroke="var(--color-comparisonOrders)"
            strokeDasharray="2 4"
            strokeWidth={1.5}
            type="monotone"
            yAxisId="orders"
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  );
}

export function CheckoutOutcomeChart({
  data,
  total,
}: {
  data: AnalyticsCheckoutOutcome[];
  total: number;
}) {
  const visibleData = data.filter((item) => item.value > 0);

  if (total === 0 || visibleData.length === 0) {
    return (
      <ChartEmptyState message="Checkout outcomes will be classified after tracked sessions begin moving through checkout." />
    );
  }

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
      <div className="relative min-w-0">
        <ChartContainer
          className="mx-auto h-60 w-full max-w-[320px] aspect-auto"
          config={outcomeChartConfig}
          initialDimension={{ height: 240, width: 300 }}
        >
          <PieChart accessibilityLayer>
            <ChartTooltip
              content={<ChartTooltipContent hideLabel nameKey="id" />}
              cursor={false}
            />
            <Pie
              cornerRadius={5}
              data={visibleData}
              dataKey="value"
              innerRadius={70}
              nameKey="id"
              outerRadius={98}
              paddingAngle={2}
              strokeWidth={0}
            >
              {visibleData.map((item) => (
                <Cell
                  fill={`var(--color-${item.id})`}
                  key={item.id}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
              {total.toLocaleString("en-ZA")}
            </p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Sessions
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2.5">
        {data.map((item) => (
          <div className="flex min-w-0 items-center gap-2" key={item.id}>
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: `var(--color-${item.id})` }}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-zinc-400">
              {item.label}
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-zinc-950 dark:text-white">
              {item.value.toLocaleString("en-ZA")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CheckoutOutcomeTimelineChart({
  data,
}: {
  data: AnalyticsOutcomePoint[];
}) {
  const hasActivity = data.some(
    (point) =>
      (point.successful ?? 0) +
        (point.pending ?? 0) +
        (point.failed ?? 0) +
        (point.abandoned ?? 0) >
      0,
  );

  if (!hasActivity) {
    return (
      <ChartEmptyState message="The outcome mix over time will appear after checkout sessions are tracked in this range." />
    );
  }

  return (
    <ChartContainer
      className="h-[300px] w-full min-w-0 aspect-auto"
      config={outcomeChartConfig}
      initialDimension={{ height: 300, width: 760 }}
    >
      <BarChart
        accessibilityLayer
        data={data}
        margin={{ bottom: 4, left: 0, right: 4, top: 12 }}
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
          width={34}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <Bar
          dataKey="successful"
          fill="var(--color-successful)"
          maxBarSize={36}
          radius={[0, 0, 3, 3]}
          stackId="outcomes"
        />
        <Bar
          dataKey="pending"
          fill="var(--color-pending)"
          maxBarSize={36}
          stackId="outcomes"
        />
        <Bar
          dataKey="failed"
          fill="var(--color-failed)"
          maxBarSize={36}
          stackId="outcomes"
        />
        <Bar
          dataKey="abandoned"
          fill="var(--color-abandoned)"
          maxBarSize={36}
          radius={[3, 3, 0, 0]}
          stackId="outcomes"
        />
      </BarChart>
    </ChartContainer>
  );
}

export function PaymentHealthChart({ data }: { data: AnalyticsPaymentHealth }) {
  if (data.total === 0 || data.successRate === null) {
    return (
      <ChartEmptyState message="Payment success and exception rates will appear after payment attempts are recorded." />
    );
  }

  const gaugeData = [
    {
      fill: chartColors.captured,
      name: "Success rate",
      value: Math.max(0, Math.min(100, data.successRate)),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
      <div className="relative min-w-0">
        <ChartContainer
          className="mx-auto h-60 w-full max-w-[320px] aspect-auto"
          config={{
            successRate: {
              color: chartColors.captured,
              label: "Payment success",
            },
          }}
          initialDimension={{ height: 240, width: 300 }}
        >
          <RadialBarChart
            accessibilityLayer
            barSize={14}
            data={gaugeData}
            endAngle={-270}
            innerRadius={76}
            outerRadius={104}
            startAngle={90}
          >
            <PolarAngleAxis domain={[0, 100]} tick={false} type="number" />
            <RadialBar
              background={{ fill: "var(--muted)" }}
              cornerRadius={8}
              dataKey="value"
            />
          </RadialBarChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
              {data.successRate.toFixed(1)}%
            </p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Successful
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2.5">
        {[
          ["Captured", data.captured, chartColors.captured],
          ["Pending", data.pending, chartColors.pending],
          ["Failed", data.failed, chartColors.failed],
          ["Expired", data.expired, chartColors.expired],
          ["Refunded", data.refunded, chartColors.refunded],
        ].map(([label, value, color]) => (
          <div className="flex min-w-0 items-center gap-2" key={String(label)}>
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: String(color) }}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-zinc-400">
              {String(label)}
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-zinc-950 dark:text-white">
              {Number(value).toLocaleString("en-ZA")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
