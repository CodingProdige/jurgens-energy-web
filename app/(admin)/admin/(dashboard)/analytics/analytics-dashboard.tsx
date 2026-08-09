import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  CircleOffIcon,
  CircleHelpIcon,
  Clock3Icon,
  CreditCardIcon,
  GaugeIcon,
  MapPinIcon,
  MousePointerClickIcon,
  PackagePlusIcon,
  PackageSearchIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
  RouteIcon,
  ShoppingCartIcon,
  WalletCardsIcon,
} from "lucide-react";

import {
  CartJourneyChart,
  type AnalyticsCartJourneyPoint,
} from "@/app/(admin)/admin/(dashboard)/analytics/cart-journey-chart";

import {
  CheckoutOutcomeChart,
  CheckoutOutcomeTimelineChart,
  PaymentHealthChart,
  SalesOrdersChart,
  type AnalyticsCheckoutOutcome,
  type AnalyticsOutcomePoint,
  type AnalyticsPaymentHealth,
  type AnalyticsSalesPoint,
} from "@/app/(admin)/admin/(dashboard)/analytics/analytics-charts";
import {
  dashboardPanelClass,
  dashboardTableCellClass,
  dashboardTableClass,
  dashboardTableContainerClass,
  dashboardTableHeadClass,
  dashboardTableHeaderRowClass,
  dashboardTableRowClass,
} from "@/components/dashboard/dashboard-controls";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  adminAnalyticsMetricDefinitions,
  adminAnalyticsPanelDefinitions,
  type AdminCommerceAnalytics,
} from "@/src/modules/admin/analytics";
import type { AdminAnalyticsMetricComparison } from "@/src/modules/admin/analytics-core";

export type AnalyticsMetricFormat = "currency" | "number" | "percent";

export type AnalyticsKpi = {
  available: boolean;
  comparisonAvailable: boolean;
  coverage: "full" | "partial" | null;
  deltaPercent: number | null;
  description: string;
  direction: "down" | "neutral" | "up";
  format: AnalyticsMetricFormat;
  id:
    | "abandoned_carts"
    | "add_to_cart_actions"
    | "average_order_value"
    | "cart_journeys"
    | "cart_to_checkout"
    | "cart_to_purchase"
    | "checkout_conversion"
    | "checkout_sessions"
    | "gross_sales"
    | "net_sales"
    | "paid_orders";
  label: string;
  previousValue: number | null;
  sparkline: number[];
  value: number;
};

export type AnalyticsFunnelStage = {
  conversionRate: number | null;
  count: number;
  dropoffRate: number | null;
  id: string;
  label: string;
};

export type AnalyticsProductRow = {
  brand: string | null;
  category: string | null;
  id: string;
  orders: number;
  revenue: number;
  title: string;
  units: number;
};

export type AnalyticsAddedProductRow = {
  actions: number;
  brand: string | null;
  cartJourneys: number;
  id: string;
  title: string;
  units: number;
};

export type AnalyticsBreakdownRow = {
  label: string;
  orders: number;
  revenue: number;
  sharePercent: number;
};

export type AnalyticsChannelRow = {
  conversionRate: number;
  label: string;
  orders: number;
  revenue: number;
  sessions: number;
  sharePercent: number;
};

export type AnalyticsRecentCheckout = {
  cartValue: number | null;
  deviceCategory: "desktop" | "mobile" | "tablet" | "unknown";
  errorCode: string | null;
  id: string;
  landingPath: string | null;
  lastSeenAt: string;
  latestStep: string;
  minutesInactive: number;
  orderId: string | null;
  orderNumber: string | null;
  orderValue: number | null;
  outcome: "abandoned" | "failed" | "pending";
  referrerHost: string | null;
  startedAt: string;
  totalQuantity: number | null;
};

export type AnalyticsPaymentHealthView = AnalyticsPaymentHealth & {
  openReconciliationExceptions: number;
  providerReportedFailed: number;
  rejectedWebhookEvents: number;
};

export type AnalyticsDashboardViewModel = {
  cartComparisonEnabled: boolean;
  cartKpis: AnalyticsKpi[];
  cartTelemetry: {
    comparisonCoverage: "full" | "none" | "partial";
    coverage: "full" | "none" | "partial";
    note: string;
    startedAt: string | null;
    trackedJourneys: number;
  };
  cartTrend: AnalyticsCartJourneyPoint[];
  channels: AnalyticsChannelRow[];
  checkoutOutcomes: AnalyticsCheckoutOutcome[];
  checkoutOutcomeTotal: number;
  checkoutTimeline: AnalyticsOutcomePoint[];
  comparisonEnabled: boolean;
  comparisonLabel: string | null;
  currency: string;
  funnel: AnalyticsFunnelStage[];
  generatedAt: string;
  kpis: AnalyticsKpi[];
  paymentHealth: AnalyticsPaymentHealthView;
  periodEnd: string;
  periodStart: string;
  provinces: AnalyticsBreakdownRow[];
  recentCheckouts: AnalyticsRecentCheckout[];
  sales: AnalyticsSalesPoint[];
  telemetry: {
    comparisonCoverage: "full" | "none" | "partial";
    coverage: "full" | "none" | "partial";
    note: string;
    paidOrdersBeforeTracking: number;
    startedAt: string | null;
    status: "active" | "starting";
    trackedSessions: number;
  };
  topAddedProducts: AnalyticsAddedProductRow[];
  topProducts: AnalyticsProductRow[];
};

const kpiIcons: Record<
  AnalyticsKpi["id"],
  ComponentType<{ className?: string }>
> = {
  abandoned_carts: CircleOffIcon,
  add_to_cart_actions: PackagePlusIcon,
  average_order_value: ReceiptTextIcon,
  cart_journeys: ShoppingCartIcon,
  cart_to_checkout: RouteIcon,
  cart_to_purchase: BadgeCheckIcon,
  checkout_conversion: GaugeIcon,
  checkout_sessions: MousePointerClickIcon,
  gross_sales: BanknoteIcon,
  net_sales: WalletCardsIcon,
  paid_orders: CheckCircle2Icon,
};

const moneyFormatterCache = new Map<string, Intl.NumberFormat>();
const countFormatter = new Intl.NumberFormat("en-ZA", {
  maximumFractionDigits: 0,
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Johannesburg",
});

function moneyFormatter(currency: string) {
  const existing = moneyFormatterCache.get(currency);

  if (existing) {
    return existing;
  }

  const formatter = new Intl.NumberFormat("en-ZA", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  });
  moneyFormatterCache.set(currency, formatter);

  return formatter;
}

function formatMoney(value: number, currency: string) {
  return moneyFormatter(currency).format(value);
}

function formatMetricValue(metric: AnalyticsKpi, currency: string) {
  if (!metric.available) {
    return "—";
  }

  if (metric.format === "currency") {
    return formatMoney(metric.value, currency);
  }

  if (metric.format === "percent") {
    return `${metric.value.toFixed(1)}%`;
  }

  return countFormatter.format(metric.value);
}

function formatDate(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function comparisonLabelForRange(
  key: AdminCommerceAnalytics["range"]["key"],
) {
  switch (key) {
    case "24h":
      return "previous 24 hours";
    case "7d":
      return "previous 7 days";
    case "30d":
      return "previous 30 days";
    case "90d":
      return "previous 90 days";
    case "this_month":
    case "last_month":
      return "previous month";
  }
}

function toKpi({
  available = true,
  comparisonEnabled,
  comparisonAvailable = true,
  coverage = null,
  description,
  direction = "up",
  format,
  id,
  label,
  metric,
  sparkline,
}: {
  available?: boolean;
  comparisonEnabled: boolean;
  comparisonAvailable?: boolean;
  coverage?: AnalyticsKpi["coverage"];
  description: string;
  direction?: AnalyticsKpi["direction"];
  format: AnalyticsMetricFormat;
  id: AnalyticsKpi["id"];
  label: string;
  metric: AdminAnalyticsMetricComparison;
  sparkline: number[];
}): AnalyticsKpi {
  return {
    available,
    comparisonAvailable,
    coverage,
    deltaPercent:
      comparisonEnabled && comparisonAvailable ? metric.changePercent : null,
    description,
    direction,
    format,
    id,
    label,
    previousValue: comparisonEnabled ? metric.previousValue : null,
    sparkline,
    value: metric.value,
  };
}

export function createAnalyticsDashboardViewModel({
  analytics,
  comparisonEnabled,
}: {
  analytics: AdminCommerceAnalytics;
  comparisonEnabled: boolean;
}): AnalyticsDashboardViewModel {
  const currentSalesPoints = analytics.salesSeries.filter(
    (point) => point.start !== null,
  );
  const currentOutcomePoints = analytics.outcomeSeries.filter(
    (point) => point.start !== null,
  );
  const grossSalesSparkline = currentSalesPoints.map(
    (point) => point.grossSales ?? 0,
  );
  const netSalesSparkline = currentSalesPoints.map(
    (point) => point.netSales ?? 0,
  );
  const paidOrdersSparkline = currentSalesPoints.map(
    (point) => point.paidOrders ?? 0,
  );
  const checkoutStartsSparkline = currentOutcomePoints.map(
    (point) => point.started ?? 0,
  );
  const conversionSparkline = currentOutcomePoints.map((point) => {
    const started = point.started ?? 0;

    return started > 0 ? ((point.successful ?? 0) / started) * 100 : 0;
  });
  const averageOrderValueSparkline = currentSalesPoints.map((point) => {
    const paidOrders = point.paidOrders ?? 0;

    return paidOrders > 0 ? (point.grossSales ?? 0) / paidOrders : 0;
  });
  const currentCartPoints = analytics.cartSeries.filter(
    (point) => point.start !== null,
  );
  const addToCartSparkline = currentCartPoints.map(
    (point) => point.addToCartActions ?? 0,
  );
  const cartJourneySparkline = currentCartPoints.map(
    (point) => point.cartJourneys ?? 0,
  );
  const cartToCheckoutSparkline = currentCartPoints.map((point) => {
    const carts = point.cartJourneys ?? 0;

    return carts > 0 ? ((point.checkoutStarts ?? 0) / carts) * 100 : 0;
  });
  const cartToPurchaseSparkline = currentCartPoints.map((point) => {
    const carts = point.cartJourneys ?? 0;

    return carts > 0 ? ((point.purchases ?? 0) / carts) * 100 : 0;
  });
  const comparisonLabel = comparisonEnabled
    ? comparisonLabelForRange(analytics.range.key)
    : null;
  const comparisonTelemetryCoverage = analytics.telemetry.comparisonCoverage;
  const checkoutComparisonAvailable =
    analytics.telemetry.coverage === "full" &&
    comparisonTelemetryCoverage === "full";
  const checkoutMetricCoverage =
    analytics.telemetry.coverage === "partial" ? "partial" : "full";
  const cartComparisonAvailable =
    analytics.telemetry.cartCoverage === "full" &&
    analytics.telemetry.cartComparisonCoverage === "full";
  const cartMetricCoverage =
    analytics.telemetry.cartCoverage === "partial" ? "partial" : "full";

  return {
    cartComparisonEnabled: comparisonEnabled && cartComparisonAvailable,
    cartKpis: [
      toKpi({
        available: analytics.telemetry.cartCoverage !== "none",
        comparisonAvailable: cartComparisonAvailable,
        comparisonEnabled,
        coverage: cartMetricCoverage,
        description: adminAnalyticsMetricDefinitions.addToCartActions,
        format: "number",
        id: "add_to_cart_actions",
        label: "Add-to-cart actions",
        metric: analytics.summary.addToCartActions,
        sparkline: addToCartSparkline,
      }),
      toKpi({
        available: analytics.telemetry.cartCoverage !== "none",
        comparisonAvailable: cartComparisonAvailable,
        comparisonEnabled,
        coverage: cartMetricCoverage,
        description: adminAnalyticsMetricDefinitions.uniqueCartJourneys,
        format: "number",
        id: "cart_journeys",
        label: "Unique cart journeys",
        metric: analytics.summary.uniqueCartJourneys,
        sparkline: cartJourneySparkline,
      }),
      toKpi({
        available: analytics.telemetry.cartCoverage !== "none",
        comparisonAvailable: cartComparisonAvailable,
        comparisonEnabled,
        coverage: cartMetricCoverage,
        description: adminAnalyticsMetricDefinitions.cartToCheckoutRate,
        format: "percent",
        id: "cart_to_checkout",
        label: "Cart to checkout",
        metric: analytics.summary.cartToCheckoutRate,
        sparkline: cartToCheckoutSparkline,
      }),
      toKpi({
        available: analytics.telemetry.cartCoverage !== "none",
        comparisonAvailable: cartComparisonAvailable,
        comparisonEnabled,
        coverage: cartMetricCoverage,
        description: adminAnalyticsMetricDefinitions.cartToPurchaseRate,
        format: "percent",
        id: "cart_to_purchase",
        label: "Cart to purchase",
        metric: analytics.summary.cartToPurchaseRate,
        sparkline: cartToPurchaseSparkline,
      }),
      toKpi({
        available: analytics.telemetry.cartCoverage !== "none",
        comparisonAvailable: cartComparisonAvailable,
        comparisonEnabled,
        coverage: cartMetricCoverage,
        description: adminAnalyticsMetricDefinitions.abandonedCarts,
        direction: "down",
        format: "number",
        id: "abandoned_carts",
        label: "Abandoned carts",
        metric: analytics.summary.abandonedCarts,
        sparkline: [],
      }),
    ],
    cartTelemetry: {
      comparisonCoverage: analytics.telemetry.cartComparisonCoverage,
      coverage: analytics.telemetry.cartCoverage,
      note: analytics.telemetry.cartNote,
      startedAt: analytics.telemetry.firstTrackedCartAt,
      trackedJourneys: analytics.summary.uniqueCartJourneys.value,
    },
    cartTrend: currentCartPoints.map((point) => ({
      addToCartActions: point.addToCartActions,
      cartJourneys: point.cartJourneys,
      comparisonAddToCartActions:
        comparisonEnabled && cartComparisonAvailable
          ? point.comparisonAddToCartActions
          : null,
      label: point.label ?? "",
    })),
    channels: analytics.channels.map((row) => ({
      conversionRate: row.checkoutConversionRate,
      label: row.label,
      orders: row.paidOrders,
      revenue: row.grossSales,
      sessions: row.sessions,
      sharePercent: row.sharePercent,
    })),
    checkoutOutcomes: [
      {
        id: "successful",
        label: "Successful",
        value: analytics.checkoutOutcomes.successful,
      },
      {
        id: "pending",
        label: "In progress",
        value: analytics.checkoutOutcomes.pending,
      },
      {
        id: "failed",
        label: "Failed",
        value: analytics.checkoutOutcomes.failed,
      },
      {
        id: "abandoned",
        label: "Abandoned",
        value: analytics.checkoutOutcomes.abandoned,
      },
    ],
    checkoutOutcomeTotal: analytics.checkoutOutcomes.total,
    checkoutTimeline: analytics.outcomeSeries
      .filter((point) => point.start !== null)
      .map((point) => ({
        abandoned: point.abandoned,
        failed: point.failed,
        label: point.label ?? "",
        pending: point.pending,
        successful: point.successful,
      })),
    comparisonEnabled,
    comparisonLabel,
    currency: analytics.currency,
    funnel: analytics.funnel.map((stage, index) => ({
      conversionRate: stage.rateFromStart,
      count: stage.sessions,
      dropoffRate: index === 0 ? null : stage.dropOffRateFromPrevious,
      id: stage.key,
      label: stage.label,
    })),
    generatedAt: analytics.generatedAt,
    kpis: [
      toKpi({
        comparisonEnabled,
        description: adminAnalyticsMetricDefinitions.grossSales,
        format: "currency",
        id: "gross_sales",
        label: "Gross sales",
        metric: analytics.summary.grossSales,
        sparkline: grossSalesSparkline,
      }),
      toKpi({
        comparisonEnabled,
        description: adminAnalyticsMetricDefinitions.netSales,
        format: "currency",
        id: "net_sales",
        label: "Net sales",
        metric: analytics.summary.netSales,
        sparkline: netSalesSparkline,
      }),
      toKpi({
        comparisonEnabled,
        description: adminAnalyticsMetricDefinitions.paidOrders,
        format: "number",
        id: "paid_orders",
        label: "Paid orders",
        metric: analytics.summary.paidOrders,
        sparkline: paidOrdersSparkline,
      }),
      toKpi({
        available: analytics.telemetry.coverage !== "none",
        comparisonAvailable: checkoutComparisonAvailable,
        comparisonEnabled,
        coverage: checkoutMetricCoverage,
        description: adminAnalyticsMetricDefinitions.checkoutStarts,
        format: "number",
        id: "checkout_sessions",
        label: "Checkout sessions",
        metric: analytics.summary.checkoutStarts,
        sparkline: checkoutStartsSparkline,
      }),
      toKpi({
        available: analytics.telemetry.coverage !== "none",
        comparisonAvailable: checkoutComparisonAvailable,
        comparisonEnabled,
        coverage: checkoutMetricCoverage,
        description: adminAnalyticsMetricDefinitions.checkoutConversionRate,
        format: "percent",
        id: "checkout_conversion",
        label: "Checkout conversion",
        metric: analytics.summary.checkoutConversionRate,
        sparkline: conversionSparkline,
      }),
      toKpi({
        comparisonEnabled,
        description: adminAnalyticsMetricDefinitions.averageOrderValue,
        format: "currency",
        id: "average_order_value",
        label: "Average order value",
        metric: analytics.summary.averageOrderValue,
        sparkline: averageOrderValueSparkline,
      }),
    ],
    paymentHealth: {
      captured: analytics.paymentHealth.captured,
      expired: analytics.paymentHealth.expired,
      failed: analytics.paymentHealth.failed,
      openReconciliationExceptions:
        analytics.paymentHealth.openReconciliationExceptions,
      pending: analytics.paymentHealth.pending,
      providerReportedFailed: analytics.paymentHealth.providerReportedFailed,
      refunded: analytics.paymentHealth.refunded,
      rejectedWebhookEvents: analytics.paymentHealth.rejectedWebhookEvents,
      successRate:
        analytics.paymentHealth.attempts > 0
          ? analytics.paymentHealth.captureRate
          : null,
      total: analytics.paymentHealth.attempts,
    },
    periodEnd: analytics.range.end,
    periodStart: analytics.range.start,
    provinces: analytics.provinces.map((row) => ({
      label: row.label,
      orders: row.orders,
      revenue: row.grossSales,
      sharePercent: row.sharePercent,
    })),
    recentCheckouts: analytics.recentCheckouts.map((row) => ({
      cartValue: row.cartValue,
      deviceCategory: row.deviceCategory,
      errorCode: row.errorCode,
      id: row.id,
      landingPath: row.landingPath,
      lastSeenAt: row.lastSeenAt,
      latestStep: row.latestStep,
      minutesInactive: row.minutesInactive,
      orderId: row.order?.id ?? null,
      orderNumber: row.order?.orderNumber ?? null,
      orderValue: row.order?.grandTotal ?? null,
      outcome: row.outcome,
      referrerHost: row.referrerHost,
      startedAt: row.firstSeenAt,
      totalQuantity: row.totalQuantity,
    })),
    sales: analytics.salesSeries
      .filter((point) => point.start !== null)
      .map((point) => ({
        comparisonOrders: comparisonEnabled
          ? point.comparisonPaidOrders
          : null,
        comparisonSales: comparisonEnabled
          ? point.comparisonGrossSales
          : null,
        label: point.label ?? "",
        orders: point.paidOrders,
        sales: point.grossSales,
      })),
    telemetry: {
      comparisonCoverage: comparisonTelemetryCoverage,
      coverage: analytics.telemetry.coverage,
      note: analytics.telemetry.note,
      paidOrdersBeforeTracking: analytics.telemetry.paidOrdersBeforeTracking,
      startedAt: analytics.telemetry.firstTrackedCheckoutAt,
      status: analytics.telemetry.firstTrackedCheckoutAt
        ? "active"
        : "starting",
      trackedSessions: analytics.checkoutOutcomes.total,
    },
    topAddedProducts: analytics.topAddedProducts.map((row) => ({
      actions: row.actions,
      brand: row.brand,
      cartJourneys: row.uniqueCartJourneys,
      id: row.id,
      title: row.title,
      units: row.quantity,
    })),
    topProducts: analytics.topProducts.map((row) => ({
      brand: row.brand,
      category: row.category,
      id: row.id,
      orders: row.orders,
      revenue: row.productSales,
      title: row.title,
      units: row.units,
    })),
  };
}

function MetricInfo({
  description,
  label,
}: {
  description: string;
  label: string;
}) {
  return (
    <span className="group/info relative inline-flex shrink-0">
      <button
        aria-label={`${label} info`}
        className="grid size-[18px] place-items-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:border-white/10 dark:bg-white/10 dark:text-zinc-400 dark:hover:bg-white/15 dark:hover:text-zinc-200"
        type="button"
      >
        <CircleHelpIcon className="size-3.5" />
      </button>
      <span
        className="pointer-events-none absolute left-0 top-full z-[80] mt-2 hidden w-56 max-w-[min(14rem,calc(100vw-2rem))] whitespace-normal rounded-lg border border-slate-200 bg-white p-2 text-left font-sans text-xs font-normal leading-snug tracking-normal text-slate-600 shadow-xl group-hover/info:block group-focus-within/info:block dark:border-white/10 dark:bg-[#151719] dark:text-zinc-300"
        role="tooltip"
      >
        {description}
      </span>
    </span>
  );
}

function Panel({
  children,
  className,
  description,
  title,
}: {
  children: ReactNode;
  className?: string;
  description: string;
  title: string;
}) {
  return (
    <section className={cn("relative", dashboardPanelClass, className)}>
      <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
            {title}
          </h2>
          <MetricInfo description={description} label={title} />
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
      <div className="min-w-0 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function buildSparkline(values: number[]) {
  if (values.length < 2) {
    return null;
  }

  const width = 160;
  const height = 42;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = maximum - minimum;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const normalized = spread === 0 ? 0.5 : (value - minimum) / spread;
      const y = height - 4 - normalized * (height - 8);

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return { height, points, width };
}

function Sparkline({ values }: { values: number[] }) {
  const line = buildSparkline(values);

  if (!line) {
    return (
      <div className="flex h-[42px] items-end text-[10px] text-slate-400 dark:text-zinc-600">
        Trend builds with activity
      </div>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-[42px] w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox={`0 0 ${line.width} ${line.height}`}
    >
      <defs>
        <linearGradient id={`spark-${line.points.length}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ff5a1f" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#spark-${line.points.length})`}
        points={`0,${line.height} ${line.points} ${line.width},${line.height}`}
      />
      <polyline
        fill="none"
        points={line.points}
        stroke="#ff5a1f"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function metricDeltaTone(metric: AnalyticsKpi) {
  if (metric.deltaPercent === null || metric.deltaPercent === 0) {
    return "neutral";
  }

  const movedUp = metric.deltaPercent > 0;

  if (metric.direction === "neutral") {
    return "neutral";
  }

  return (metric.direction === "up" && movedUp) ||
    (metric.direction === "down" && !movedUp)
    ? "good"
    : "bad";
}

function KpiCard({
  comparisonLabel,
  currency,
  metric,
}: {
  comparisonLabel: string | null;
  currency: string;
  metric: AnalyticsKpi;
}) {
  const Icon = kpiIcons[metric.id];
  const tone = metricDeltaTone(metric);
  const DeltaIcon =
    metric.deltaPercent !== null && metric.deltaPercent < 0
      ? ArrowDownRightIcon
      : ArrowUpRightIcon;

  return (
    <article className={cn("relative p-4", dashboardPanelClass)}>
      <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-brand-amber to-transparent" />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-xs font-medium text-slate-600 dark:text-zinc-400">
              {metric.label}
            </p>
            <MetricInfo description={metric.description} label={metric.label} />
          </div>
          <p className="mt-3 truncate text-[26px] font-bold leading-none tracking-tight tabular-nums text-zinc-950 dark:text-white">
            {formatMetricValue(metric, currency)}
          </p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15 dark:text-brand-amber">
          <Icon className="size-4" />
        </span>
      </div>

      <div className="mt-3 flex min-h-5 items-center gap-1.5">
        {!metric.available ? (
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
            Tracking not available
          </span>
        ) : metric.coverage === "partial" ? (
          <span className="text-[11px] font-medium text-sky-700 dark:text-sky-300">
            Partial tracking coverage
          </span>
        ) : !metric.comparisonAvailable && comparisonLabel ? (
          <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-500">
            Comparison tracking incomplete
          </span>
        ) : metric.deltaPercent !== null && comparisonLabel ? (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
                tone === "good" && "text-emerald-700 dark:text-emerald-300",
                tone === "bad" && "text-red-700 dark:text-red-300",
                tone === "neutral" && "text-slate-600 dark:text-zinc-400",
              )}
            >
              {metric.deltaPercent === 0 ? null : <DeltaIcon className="size-3.5" />}
              {Math.abs(metric.deltaPercent).toFixed(1)}%
            </span>
            <span className="truncate text-[11px] text-slate-500 dark:text-zinc-500">
              vs {comparisonLabel}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-slate-500 dark:text-zinc-500">
            {comparisonLabel ? "No comparable baseline" : "Comparison off"}
          </span>
        )}
      </div>

      <div className="mt-2 border-t border-slate-100 pt-2 dark:border-white/[0.06]">
        {metric.available ? (
          <Sparkline values={metric.sparkline} />
        ) : (
          <div className="flex h-[42px] items-end text-[10px] text-slate-400 dark:text-zinc-600">
            Tracking not available for this range
          </div>
        )}
      </div>
    </article>
  );
}

function getTelemetryCoverage(data: AnalyticsDashboardViewModel) {
  return data.telemetry.coverage;
}

function TelemetryNotice({ data }: { data: AnalyticsDashboardViewModel }) {
  const coverage = getTelemetryCoverage(data);
  const comparisonHasGap =
    data.comparisonEnabled && data.telemetry.comparisonCoverage !== "full";

  if (
    data.telemetry.status === "active" &&
    coverage === "full" &&
    !comparisonHasGap
  ) {
    return null;
  }

  const startedLabel = data.telemetry.startedAt
    ? formatDate(data.telemetry.startedAt)
    : null;
  const isStarting = data.telemetry.status === "starting" || coverage === "none";

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-start",
        isStarting
          ? "border-amber-400/35 bg-amber-500/[0.08] dark:border-amber-400/20 dark:bg-amber-500/[0.06]"
          : "border-sky-400/30 bg-sky-500/[0.06] dark:border-sky-400/20 dark:bg-sky-500/[0.05]",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          isStarting
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : "bg-sky-500/12 text-sky-700 dark:text-sky-300",
        )}
      >
        {isStarting ? (
          <MousePointerClickIcon className="size-4" />
        ) : (
          <Clock3Icon className="size-4" />
        )}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            {isStarting
              ? data.telemetry.startedAt
                ? "Checkout tracking was not available in this range"
                : "Checkout session telemetry starts here"
              : coverage === "partial"
                ? "Checkout telemetry covers part of this range"
                : "Comparison checkout telemetry is incomplete"}
          </p>
          <Badge
            className={cn(
              "border-0",
              isStarting
                ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                : "bg-sky-500/12 text-sky-800 dark:text-sky-200",
            )}
          >
            {data.telemetry.trackedSessions.toLocaleString("en-ZA")} tracked
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-zinc-300">
          {data.telemetry.note}
          {startedLabel ? ` Tracking began ${startedLabel} SAST.` : ""}
          {comparisonHasGap
            ? " Checkout-session changes are hidden until both the selected and comparison periods have full telemetry coverage."
            : ""}
          {data.telemetry.paidOrdersBeforeTracking > 0
            ? ` ${data.telemetry.paidOrdersBeforeTracking.toLocaleString("en-ZA")} paid orders predate session tracking.`
            : ""}
        </p>
      </div>
    </section>
  );
}

function CartTelemetryNotice({ data }: { data: AnalyticsDashboardViewModel }) {
  const comparisonHasGap =
    data.comparisonEnabled &&
    data.cartTelemetry.comparisonCoverage !== "full";

  if (data.cartTelemetry.coverage === "full" && !comparisonHasGap) {
    return null;
  }

  const startedLabel = data.cartTelemetry.startedAt
    ? formatDate(data.cartTelemetry.startedAt)
    : null;
  const isStarting = data.cartTelemetry.coverage === "none";

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-start",
        isStarting
          ? "border-amber-400/35 bg-amber-500/[0.08] dark:border-amber-400/20 dark:bg-amber-500/[0.06]"
          : "border-sky-400/30 bg-sky-500/[0.06] dark:border-sky-400/20 dark:bg-sky-500/[0.05]",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          isStarting
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : "bg-sky-500/12 text-sky-700 dark:text-sky-300",
        )}
      >
        <ShoppingCartIcon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            {isStarting
              ? "Cart journey analytics starts here"
              : data.cartTelemetry.coverage === "partial"
                ? "Cart analytics covers part of this range"
                : "Comparison cart analytics is incomplete"}
          </p>
          <Badge
            className={cn(
              "border-0",
              isStarting
                ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                : "bg-sky-500/12 text-sky-800 dark:text-sky-200",
            )}
          >
            {data.cartTelemetry.trackedJourneys.toLocaleString("en-ZA")} journeys
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-zinc-300">
          {data.cartTelemetry.note}
          {startedLabel ? ` Tracking began ${startedLabel} SAST.` : ""}
          {comparisonHasGap
            ? " Cart changes are hidden until both periods have complete first-party coverage."
            : ""}
          {" "}A cart journey represents one browser session, not an identifiable person.
        </p>
      </div>
    </section>
  );
}

function Funnel({ stages }: { stages: AnalyticsFunnelStage[] }) {
  const hasActivity = stages.some((stage) => stage.count > 0);

  if (!hasActivity) {
    return (
      <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center dark:border-white/10 dark:bg-white/[0.025]">
        <div>
          <MousePointerClickIcon className="mx-auto size-5 text-slate-400 dark:text-zinc-500" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-zinc-300">
            Funnel waiting for tracked sessions
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
            Each cart and checkout milestone will appear here with its stage-to-stage drop-off.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {stages.map((stage, index) => {
        const conversion = Math.max(0, Math.min(100, stage.conversionRate ?? 0));

        return (
          <div key={stage.id}>
            <div className="mb-2 flex min-w-0 items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-zinc-950 dark:text-white">
                  <span className="mr-2 font-mono text-[10px] text-slate-400 dark:text-zinc-600">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {stage.label}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500">
                  {stage.count.toLocaleString("en-ZA")} sessions
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-xs font-semibold tabular-nums text-zinc-950 dark:text-white">
                  {conversion.toFixed(1)}%
                </p>
                {stage.dropoffRate !== null ? (
                  <p className="mt-1 text-[10px] font-medium text-red-600 dark:text-red-300">
                    {stage.dropoffRate.toFixed(1)}% drop-off
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] text-slate-400 dark:text-zinc-600">
                    Funnel entry
                  </p>
                )}
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.07]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-brand-amber transition-[width]"
                style={{ width: `${conversion}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankingEmpty({
  detail = "Results will appear as commerce activity is recorded.",
  label,
}: {
  detail?: string;
  label: string;
}) {
  return (
    <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-slate-200 px-4 text-center dark:border-white/10">
      <div>
        <PackageSearchIcon className="mx-auto size-5 text-slate-400 dark:text-zinc-500" />
        <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
          {label}: {detail}
        </p>
      </div>
    </div>
  );
}

function AddedProductRanking({ rows }: { rows: AnalyticsAddedProductRow[] }) {
  if (rows.length === 0) {
    return (
      <RankingEmpty
        detail="products will rank once customers add them to a cart."
        label="No product additions yet"
      />
    );
  }

  const maximum = Math.max(...rows.map((row) => row.units), 1);

  return (
    <div className="grid gap-4">
      {rows.map((row, index) => (
        <div className="min-w-0" key={row.id}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 font-mono text-[11px] font-semibold text-primary dark:bg-primary/15 dark:text-brand-amber">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-zinc-950 dark:text-white">
                    {row.title}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-zinc-500">
                    {row.brand ?? "Unbranded"} ·{" "}
                    {row.cartJourneys.toLocaleString("en-ZA")} carts ·{" "}
                    {row.actions.toLocaleString("en-ZA")} actions
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs font-semibold tabular-nums text-zinc-950 dark:text-white">
                    {row.units.toLocaleString("en-ZA")}
                  </p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-400 dark:text-zinc-600">
                    units added
                  </p>
                </div>
              </div>
              <RankingBar percentage={(row.units / maximum) * 100} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RankingBar({ percentage }: { percentage: number }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.07]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-brand-amber"
        style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
      />
    </div>
  );
}

function ProductRanking({
  currency,
  rows,
}: {
  currency: string;
  rows: AnalyticsProductRow[];
}) {
  if (rows.length === 0) {
    return <RankingEmpty label="Product performance" />;
  }

  const maximum = Math.max(...rows.map((row) => row.revenue), 1);

  return (
    <div className="grid gap-4">
      {rows.map((row, index) => (
        <div className="min-w-0" key={row.id}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-slate-100 font-mono text-[11px] font-semibold text-slate-500 dark:bg-white/[0.07] dark:text-zinc-400">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-zinc-950 dark:text-white">
                    {row.title}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-zinc-500">
                    {[row.brand, row.category].filter(Boolean).join(" · ") ||
                      "Unclassified"}{" "}
                    · {row.units.toLocaleString("en-ZA")} units ·{" "}
                    {row.orders.toLocaleString("en-ZA")} orders
                  </p>
                </div>
                <p className="shrink-0 font-mono text-xs font-semibold tabular-nums text-zinc-950 dark:text-white">
                  {formatMoney(row.revenue, currency)}
                </p>
              </div>
              <RankingBar percentage={(row.revenue / maximum) * 100} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChannelRanking({
  currency,
  rows,
}: {
  currency: string;
  rows: AnalyticsChannelRow[];
}) {
  if (rows.length === 0) {
    return <RankingEmpty label="Channel performance" />;
  }

  const maximum = Math.max(...rows.map((row) => row.revenue), 1);

  return (
    <div className="grid gap-4">
      {rows.map((row) => (
        <div className="min-w-0" key={row.label}>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-950 dark:text-white">
                {row.label}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500 dark:text-zinc-500">
                {row.sessions.toLocaleString("en-ZA")} sessions ·{" "}
                {row.orders.toLocaleString("en-ZA")} paid orders ·{" "}
                {row.conversionRate.toFixed(1)}% conversion ·{" "}
                {row.sharePercent.toFixed(1)}% sales
              </p>
            </div>
            <p className="shrink-0 font-mono text-xs font-semibold tabular-nums text-zinc-950 dark:text-white">
              {formatMoney(row.revenue, currency)}
            </p>
          </div>
          <RankingBar percentage={(row.revenue / maximum) * 100} />
        </div>
      ))}
    </div>
  );
}

function ProvinceRanking({
  currency,
  rows,
}: {
  currency: string;
  rows: AnalyticsBreakdownRow[];
}) {
  if (rows.length === 0) {
    return <RankingEmpty label="Provincial performance" />;
  }

  const maximum = Math.max(...rows.map((row) => row.revenue), 1);

  return (
    <div className="grid gap-4">
      {rows.map((row) => (
        <div className="min-w-0" key={row.label}>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <MapPinIcon className="size-3.5 shrink-0 text-slate-400 dark:text-zinc-500" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-zinc-950 dark:text-white">
                  {row.label}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-zinc-500">
                  {row.orders.toLocaleString("en-ZA")} orders ·{" "}
                  {row.sharePercent.toFixed(1)}% of gross sales
                </p>
              </div>
            </div>
            <p className="shrink-0 font-mono text-xs font-semibold tabular-nums text-zinc-950 dark:text-white">
              {formatMoney(row.revenue, currency)}
            </p>
          </div>
          <RankingBar percentage={(row.revenue / maximum) * 100} />
        </div>
      ))}
    </div>
  );
}

function statusClasses(status: string) {
  if (["captured", "paid", "successful"].includes(status)) {
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }

  if (["abandoned", "failed", "cancelled"].includes(status)) {
    return "bg-red-500/12 text-red-700 dark:text-red-300";
  }

  if (status === "refunded") {
    return "bg-sky-500/12 text-sky-700 dark:text-sky-300";
  }

  return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
}

function RecentCheckoutTable({
  currency,
  rows,
}: {
  currency: string;
  rows: AnalyticsRecentCheckout[];
}) {
  return (
    <section
      className={cn(
        "overflow-hidden",
        dashboardPanelClass,
        dashboardTableContainerClass,
      )}
    >
      <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
            Recent checkout sessions and issues
          </h2>
          <MetricInfo
            description="Most recent tracked checkout sessions, including payment outcomes and the latest actionable issue."
            label="Recent checkout sessions and issues"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          Practical detail for investigating failed, pending, and abandoned checkouts.
        </p>
      </div>

      <Table className={cn(dashboardTableClass, "min-w-[1040px] table-auto")}>
        <TableHeader>
          <TableRow className={dashboardTableHeaderRowClass}>
            <TableHead className={dashboardTableHeadClass}>Session</TableHead>
            <TableHead className={dashboardTableHeadClass}>Source</TableHead>
            <TableHead className={dashboardTableHeadClass}>Latest step</TableHead>
            <TableHead className={dashboardTableHeadClass}>Outcome</TableHead>
            <TableHead className={dashboardTableHeadClass}>Value / items</TableHead>
            <TableHead className={dashboardTableHeadClass}>Last activity</TableHead>
            <TableHead className={dashboardTableHeadClass}>Issue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className={dashboardTableRowClass}>
              <TableCell
                className={cn("h-28 text-center", dashboardTableCellClass)}
                colSpan={7}
              >
                <span className="text-sm text-slate-500 dark:text-zinc-400">
                  No checkout sessions were tracked in this period.
                </span>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow className={dashboardTableRowClass} key={row.id}>
                <TableCell className={dashboardTableCellClass}>
                  <p className="font-mono text-xs font-semibold text-zinc-950 dark:text-white">
                    {row.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-[10px] text-slate-500 dark:text-zinc-500">
                    Started {formatDate(row.startedAt)}
                  </p>
                  {row.orderId && row.orderNumber ? (
                    <Link
                      className="mt-1 block text-xs font-medium text-primary hover:underline dark:text-brand-amber"
                      href={`/orders/${row.orderId}`}
                    >
                      {row.orderNumber}
                    </Link>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                      No order yet
                    </p>
                  )}
                </TableCell>
                <TableCell className={dashboardTableCellClass}>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-950 dark:text-white">
                      {row.referrerHost ?? "Direct / untracked"}
                    </p>
                    <p className="mt-1 truncate text-[10px] capitalize text-slate-500 dark:text-zinc-500">
                      {row.deviceCategory}
                      {row.landingPath ? ` · ${row.landingPath}` : ""}
                    </p>
                  </div>
                </TableCell>
                <TableCell className={dashboardTableCellClass}>
                  <span className="text-xs font-medium capitalize text-slate-700 dark:text-zinc-300">
                    {row.latestStep.replaceAll("_", " ")}
                  </span>
                </TableCell>
                <TableCell className={dashboardTableCellClass}>
                  <Badge
                    className={cn(
                      "border-0 capitalize",
                      statusClasses(row.outcome),
                    )}
                  >
                    {row.outcome}
                  </Badge>
                </TableCell>
                <TableCell className={dashboardTableCellClass}>
                  {row.orderValue !== null || row.cartValue !== null ? (
                    <div>
                      <span className="font-mono text-xs font-semibold tabular-nums text-zinc-950 dark:text-white">
                        {formatMoney(row.orderValue ?? row.cartValue ?? 0, currency)}
                      </span>
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-500">
                        {row.orderValue !== null ? "Order total" : "Cart value"}
                        {row.totalQuantity !== null
                          ? ` · ${row.totalQuantity.toLocaleString("en-ZA")} units`
                          : ""}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-zinc-500">
                      Not captured
                    </span>
                  )}
                </TableCell>
                <TableCell className={dashboardTableCellClass}>
                  <div>
                    <span className="whitespace-nowrap text-xs text-slate-600 dark:text-zinc-400">
                      {formatDate(row.lastSeenAt)}
                    </span>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-500">
                      {row.minutesInactive.toLocaleString("en-ZA")} min inactive
                    </p>
                  </div>
                </TableCell>
                <TableCell className={dashboardTableCellClass}>
                  {row.errorCode ? (
                    <div className="flex max-w-xs items-start gap-1.5 text-xs leading-5 text-red-700 dark:text-red-300">
                      <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                      <span className="font-mono text-[11px]">{row.errorCode}</span>
                    </div>
                  ) : (
                    <div className="max-w-xs text-xs leading-5 text-slate-500 dark:text-zinc-500">
                      {row.outcome === "abandoned"
                        ? `Inactive for ${row.minutesInactive.toLocaleString("en-ZA")} minutes`
                        : row.outcome === "failed"
                          ? "Failure status recorded"
                          : "Awaiting the next checkout event"}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}

function EmptyPeriodNotice({ telemetryOnly }: { telemetryOnly: boolean }) {
  return (
    <section className={cn("px-5 py-8 text-center", dashboardPanelClass)}>
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/[0.07] dark:text-zinc-400">
        {telemetryOnly ? (
          <MousePointerClickIcon className="size-5" />
        ) : (
          <PackageSearchIcon className="size-5" />
        )}
      </span>
      <h2 className="mt-4 text-sm font-semibold text-zinc-950 dark:text-white">
        {telemetryOnly
          ? "Session telemetry is ready for new checkouts"
          : "No commerce activity in this period"}
      </h2>
      <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-slate-500 dark:text-zinc-400">
        {telemetryOnly
          ? "This is not counted as zero conversion: no first-party checkout telemetry exists for the selected range. New tracked sessions will populate the funnel and outcome views automatically."
          : "The selected period contains no cart journeys, paid orders, payment attempts, or tracked checkout sessions. Choose a wider range to review earlier activity."}
      </p>
    </section>
  );
}

export function AnalyticsDashboard({
  analytics,
  comparisonEnabled,
}: {
  analytics: AdminCommerceAnalytics;
  comparisonEnabled: boolean;
}) {
  const data = createAnalyticsDashboardViewModel({
    analytics,
    comparisonEnabled,
  });
  const coverage = getTelemetryCoverage(data);
  const hasActivity =
    data.sales.some(
      (point) => (point.sales ?? 0) > 0 || (point.orders ?? 0) > 0,
    ) ||
    data.cartKpis.some((metric) => metric.available && metric.value > 0) ||
    data.checkoutOutcomeTotal > 0 ||
    data.paymentHealth.total > 0;
  const checkoutOutcomeValues = Object.fromEntries(
    data.checkoutOutcomes.map((outcome) => [outcome.id, outcome.value]),
  );
  const successfulCheckouts = checkoutOutcomeValues.successful ?? 0;
  const periodPaymentIssueCount =
    data.paymentHealth.failed +
    data.paymentHealth.pending +
    data.paymentHealth.expired +
    data.paymentHealth.rejectedWebhookEvents;
  const paymentIssueCount =
    periodPaymentIssueCount + data.paymentHealth.openReconciliationExceptions;

  return (
    <div className="grid min-w-0 gap-4">
      <TelemetryNotice data={data} />

      <section
        aria-label="Commerce performance indicators"
        className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
      >
        {data.kpis.map((metric) => (
          <KpiCard
            comparisonLabel={data.comparisonLabel}
            currency={data.currency}
            key={metric.id}
            metric={metric}
          />
        ))}
      </section>

      <div className="mt-2 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
              Cart engagement
            </h2>
            <MetricInfo
              description="First-party cart journeys connect product additions to checkout starts and provider-confirmed purchases."
              label="Cart engagement"
            />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            See what customers add, where journeys stop, and how carts convert.
          </p>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500 sm:mt-0">
          Unique journeys are browser sessions, not identifiable people.
        </p>
      </div>

      <CartTelemetryNotice data={data} />

      <section
        aria-label="Cart engagement indicators"
        className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        {data.cartKpis.map((metric) => (
          <KpiCard
            comparisonLabel={data.comparisonLabel}
            currency={data.currency}
            key={metric.id}
            metric={metric}
          />
        ))}
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.5fr_0.5fr]">
        <Panel
          description={
            data.cartComparisonEnabled && data.comparisonLabel
              ? `Add-to-cart actions and unique cart journeys against ${data.comparisonLabel}.`
              : "Add-to-cart actions and unique cart journeys across the selected period."
          }
          title="Cart activity over time"
        >
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-primary" /> Add-to-cart actions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-brand-amber" /> Unique cart journeys
            </span>
            {data.cartComparisonEnabled ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 border-t border-dashed border-slate-400" /> Previous add-to-cart actions
              </span>
            ) : null}
          </div>
          <CartJourneyChart
            comparisonEnabled={data.cartComparisonEnabled}
            data={data.cartTrend}
          />
        </Panel>

        <Panel
          description={adminAnalyticsPanelDefinitions.topAddedProducts}
          title="Most added products"
        >
          <AddedProductRanking rows={data.topAddedProducts} />
        </Panel>
      </div>

      {!hasActivity ? (
        <EmptyPeriodNotice telemetryOnly={coverage === "none"} />
      ) : null}

      <Panel
        description={
          data.comparisonEnabled && data.comparisonLabel
            ? `Gross captured sales and paid orders against ${data.comparisonLabel}.`
            : "Gross captured sales and paid orders across the selected period."
        }
        title="Sales and orders over time"
      >
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" /> Gross sales
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-brand-amber" /> Paid orders
          </span>
          {data.comparisonEnabled ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t border-dashed border-slate-400" /> Comparison
            </span>
          ) : null}
        </div>
        <SalesOrdersChart
          comparisonEnabled={data.comparisonEnabled}
          currency={data.currency}
          data={data.sales}
        />
      </Panel>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel
          description="Tracked sessions grouped by their latest checkout result in this period."
          title="Checkout outcomes"
        >
          <CheckoutOutcomeChart
            data={data.checkoutOutcomes}
            total={data.checkoutOutcomeTotal}
          />
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
            <div className="rounded-lg bg-emerald-500/[0.07] p-3 dark:bg-emerald-500/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Successful
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums text-zinc-950 dark:text-white">
                {successfulCheckouts.toLocaleString("en-ZA")}
              </p>
            </div>
            <div className="rounded-lg bg-red-500/[0.06] p-3 dark:bg-red-500/[0.05]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                Needs attention
              </p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums text-zinc-950 dark:text-white">
                {(
                  (checkoutOutcomeValues.failed ?? 0) +
                  (checkoutOutcomeValues.abandoned ?? 0)
                ).toLocaleString("en-ZA")}
              </p>
            </div>
          </div>
        </Panel>

        <Panel
          description={adminAnalyticsPanelDefinitions.cartFunnel}
          title="Commerce funnel and drop-off"
        >
          <Funnel stages={data.funnel} />
        </Panel>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel
          description="How successful, in-progress, failed, and abandoned checkout sessions changed across the range."
          title="Checkout outcomes over time"
        >
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500 dark:text-zinc-400">
            {[
              ["Successful", "bg-emerald-500"],
              ["In progress", "bg-brand-amber"],
              ["Failed", "bg-red-500"],
              ["Abandoned", "bg-slate-500"],
            ].map(([label, color]) => (
              <span className="inline-flex items-center gap-1.5" key={label}>
                <span className={cn("size-2.5 rounded-sm", color)} /> {label}
              </span>
            ))}
          </div>
          <CheckoutOutcomeTimelineChart data={data.checkoutTimeline} />
        </Panel>

        <Panel
          description={adminAnalyticsPanelDefinitions.paymentHealth}
          title="Payment health"
        >
          <PaymentHealthChart data={data.paymentHealth} />
          <div
            className={cn(
              "mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
              paymentIssueCount > 0
                ? "border-amber-400/30 bg-amber-500/[0.07] text-amber-800 dark:border-amber-400/20 dark:text-amber-200"
                : "border-emerald-400/25 bg-emerald-500/[0.06] text-emerald-800 dark:border-emerald-400/15 dark:text-emerald-200",
            )}
          >
            {paymentIssueCount > 0 ? (
              <TriangleAlertIcon className="size-3.5 shrink-0" />
            ) : (
              <CreditCardIcon className="size-3.5 shrink-0" />
            )}
            <span>
              {paymentIssueCount > 0
                ? `${periodPaymentIssueCount.toLocaleString("en-ZA")} period payment or webhook exceptions; ${data.paymentHealth.openReconciliationExceptions.toLocaleString("en-ZA")} open reconciliation exceptions globally.`
                : "No period payment exceptions or open reconciliation exceptions need review."}
            </span>
          </div>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <Panel
          description={adminAnalyticsPanelDefinitions.topProducts}
          title="Top products"
        >
          <ProductRanking currency={data.currency} rows={data.topProducts} />
        </Panel>
        <Panel
          description={adminAnalyticsPanelDefinitions.channels}
          title="Sales by channel"
        >
          <ChannelRanking currency={data.currency} rows={data.channels} />
        </Panel>
        <Panel
          description="Captured order revenue grouped by the delivery province snapshot."
          title="Sales by province"
        >
          <ProvinceRanking currency={data.currency} rows={data.provinces} />
        </Panel>
      </div>

      <RecentCheckoutTable currency={data.currency} rows={data.recentCheckouts} />

      <footer className="flex flex-col gap-1 border-t border-slate-200 pt-3 text-[11px] text-slate-500 dark:border-white/10 dark:text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p>PostgreSQL commerce data · session metrics respect telemetry coverage.</p>
        <p className="font-mono tabular-nums">
          Last updated {formatDate(data.generatedAt)} SAST
        </p>
      </footer>
    </div>
  );
}
