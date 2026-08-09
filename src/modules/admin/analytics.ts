import "server-only";

import {
  and,
  eq,
  gte,
  isNotNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/src/db";
import {
  brands,
  categories,
  checkoutAnalyticsEvents,
  checkoutAnalyticsSessions,
  orderItems,
  orders,
  payfastItnEvents,
  paymentReconciliationExceptions,
  paymentRefunds,
  payments,
  products,
  productVariants,
} from "@/src/db/schema";
import {
  ADMIN_ANALYTICS_TIME_ZONE,
  type AdminAnalyticsMetricComparison,
  type AdminAnalyticsRangeKey,
  type CheckoutAnalyticsOutcome,
  classifyCheckoutAnalyticsOutcome,
  createAdminAnalyticsMetricComparison,
  getAdminAnalyticsTelemetryCoverage,
  getAdminAnalyticsBucketIndex,
  getAdminAnalyticsBucketStart,
  isAdminAnalyticsRangeKey,
  resolveAdminAnalyticsRange,
} from "@/src/modules/admin/analytics-core";
import type { CheckoutAnalyticsEventName } from "@/src/modules/analytics/checkout-contracts";
import type { CampaignAttributionSnapshot } from "@/src/modules/marketing/campaign-attribution";

export type { AdminAnalyticsMetricComparison };

export type AdminCommerceAnalyticsInput = Readonly<{
  now?: Date;
  range?: AdminAnalyticsRangeKey;
}>;

export type AdminAnalyticsSerializedRange = Readonly<{
  comparisonEnd: string;
  comparisonStart: string;
  end: string;
  granularity: "day" | "hour" | "week";
  key: AdminAnalyticsRangeKey;
  label: string;
  start: string;
  timeZone: typeof ADMIN_ANALYTICS_TIME_ZONE;
}>;

export type AdminAnalyticsSummary = Readonly<{
  abandonedCheckouts: AdminAnalyticsMetricComparison;
  averageOrderValue: AdminAnalyticsMetricComparison;
  checkoutConversionRate: AdminAnalyticsMetricComparison;
  checkoutStarts: AdminAnalyticsMetricComparison;
  grossSales: AdminAnalyticsMetricComparison;
  netSales: AdminAnalyticsMetricComparison;
  paidOrders: AdminAnalyticsMetricComparison;
  refundedAmount: AdminAnalyticsMetricComparison;
}>;

export type AdminAnalyticsSalesSeriesPoint = Readonly<{
  comparisonGrossSales: number | null;
  comparisonLabel: string | null;
  comparisonNetSales: number | null;
  comparisonPaidOrders: number | null;
  comparisonRefundedAmount: number | null;
  comparisonStart: string | null;
  grossSales: number | null;
  key: string;
  label: string | null;
  netSales: number | null;
  paidOrders: number | null;
  refundedAmount: number | null;
  start: string | null;
}>;

export type AdminAnalyticsOutcomeCounts = Readonly<{
  abandoned: number;
  failed: number;
  pending: number;
  successful: number;
  total: number;
}>;

export type AdminAnalyticsOutcomeSeriesPoint = Readonly<{
  abandoned: number | null;
  comparisonAbandoned: number | null;
  comparisonFailed: number | null;
  comparisonLabel: string | null;
  comparisonPending: number | null;
  comparisonStart: string | null;
  comparisonStarted: number | null;
  comparisonSuccessful: number | null;
  failed: number | null;
  key: string;
  label: string | null;
  pending: number | null;
  start: string | null;
  started: number | null;
  successful: number | null;
}>;

export type AdminAnalyticsFunnelStage = Readonly<{
  dropOffRateFromPrevious: number;
  key:
    | "address_completed"
    | "checkout_started"
    | "order_created"
    | "payment_reached"
    | "shipping_completed"
    | "successful";
  label: string;
  rateFromStart: number;
  sessions: number;
}>;

export type AdminAnalyticsPaymentHealth = Readonly<{
  attempts: number;
  basis: "payment_attempt_created_in_period";
  captureRate: number;
  captured: number;
  expired: number;
  failed: number;
  openReconciliationExceptions: number;
  pending: number;
  providerReportedFailed: number;
  reconciliationScope: "current_open_global";
  rejectedWebhookEvents: number;
  refunded: number;
}>;

export type AdminAnalyticsTopProduct = Readonly<{
  brand: string | null;
  category: string | null;
  grossSales: number;
  id: string;
  orders: number;
  productSales: number;
  title: string;
  units: number;
}>;

export type AdminAnalyticsChannelRow = Readonly<{
  checkoutConversionRate: number;
  grossSales: number;
  key: string;
  label: string;
  orders: number;
  paidOrders: number;
  sessions: number;
  sharePercent: number;
  successfulCheckouts: number;
}>;

export type AdminAnalyticsBreakdownRow = Readonly<{
  grossSales: number;
  key: string;
  label: string;
  orders: number;
  sharePercent: number;
}>;

export type AdminAnalyticsRecentCheckout = Readonly<{
  cartValue: number | null;
  currency: string;
  deviceCategory: "desktop" | "mobile" | "tablet" | "unknown";
  errorCode: string | null;
  firstSeenAt: string;
  id: string;
  itemCount: number | null;
  landingPath: string | null;
  lastSeenAt: string;
  latestStep: CheckoutAnalyticsEventName;
  minutesInactive: number;
  order: {
    grandTotal: number;
    id: string;
    orderNumber: string;
    status: string;
  } | null;
  outcome: Exclude<CheckoutAnalyticsOutcome, "successful">;
  referrerHost: string | null;
  totalQuantity: number | null;
}>;

export type AdminAnalyticsTelemetry = Readonly<{
  comparisonCoverage: "full" | "none" | "partial";
  comparisonRangeIncludesPreInstrumentationHistory: boolean;
  coverage: "full" | "none" | "partial";
  firstTrackedCheckoutAt: string | null;
  note: string;
  paidOrdersBeforeTracking: number;
  selectedRangeIncludesPreInstrumentationHistory: boolean;
}>;

export type AdminCommerceAnalytics = Readonly<{
  channels: AdminAnalyticsChannelRow[];
  checkoutOutcomes: AdminAnalyticsOutcomeCounts;
  currency: "ZAR";
  funnel: AdminAnalyticsFunnelStage[];
  generatedAt: string;
  outcomeSeries: AdminAnalyticsOutcomeSeriesPoint[];
  paymentHealth: AdminAnalyticsPaymentHealth;
  provinces: AdminAnalyticsBreakdownRow[];
  range: AdminAnalyticsSerializedRange;
  recentCheckouts: AdminAnalyticsRecentCheckout[];
  salesSeries: AdminAnalyticsSalesSeriesPoint[];
  summary: AdminAnalyticsSummary;
  telemetry: AdminAnalyticsTelemetry;
  topProducts: AdminAnalyticsTopProduct[];
}>;

export const adminAnalyticsMetricDefinitions = {
  abandonedCheckouts:
    "Checkout sessions with no captured payment, no explicit failure and at least 30 minutes without activity.",
  averageOrderValue:
    "Gross sales divided by provider-confirmed paid orders in the selected period.",
  checkoutConversionRate:
    "Checkout sessions started in the period that link to a provider-confirmed captured payment.",
  checkoutStarts:
    "Distinct first-party checkout sessions first seen in the selected period.",
  grossSales:
    "Grand totals of orders with a provider-confirmed captured payment, before completed refunds.",
  netSales:
    "Provider-confirmed gross sales minus refunds completed during the selected period.",
  paidOrders:
    "Distinct orders paid in the period with a COMPLETE PayFast capture. Later-refunded orders remain part of historical gross sales.",
  refundedAmount:
    "Refunds whose payment workflow reached completed status during the selected period.",
} as const;

export const adminAnalyticsPanelDefinitions = {
  channels:
    "First-party checkout sessions and captured orders grouped by consent-aware campaign source or referrer. Direct / untracked includes visits without attributable campaign data.",
  paymentHealth:
    "Payment attempts are grouped by the period in which each attempt was created. Open reconciliation exceptions are a current global workload, not a period cohort.",
  topProducts:
    "Gross product-line sales from captured orders in the period. Product sales exclude delivery charges and are shown before refunds.",
} as const;

type PaidOrderRow = {
  campaignAttribution: CampaignAttributionSnapshot | null;
  deliveryAddress: { province?: unknown } | null;
  grandTotal: string;
  id: string;
  paidAt: Date;
};

type CompletedRefundRow = {
  amount: string;
  completedAt: Date;
};

type CheckoutSessionRow = {
  campaignAttribution: CampaignAttributionSnapshot | null;
  cartValue: string | null;
  currency: string | null;
  deviceCategory: "desktop" | "mobile" | "tablet" | "unknown";
  firstSeenAt: Date;
  hasCapturedPayment: boolean;
  id: string;
  itemCount: number | null;
  landingPath: string | null;
  lastErrorCode: string | null;
  lastSeenAt: Date;
  latestStep: CheckoutAnalyticsEventName;
  orderGrandTotal: string | null;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  referrerHost: string | null;
  status: "active" | "completed" | "failed";
  totalQuantity: number | null;
};

type MutableSalesValues = {
  grossSales: number;
  paidOrders: number;
  refundedAmount: number;
};

type MutableOutcomeValues = {
  abandoned: number;
  failed: number;
  pending: number;
  started: number;
  successful: number;
};

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function toPercent(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function isInPeriod(value: Date, start: Date, end: Date) {
  const time = value.getTime();

  return time >= start.getTime() && time < end.getTime();
}

function getComparisonBucketCount(
  comparisonStart: Date,
  comparisonEnd: Date,
  bucketMilliseconds: number,
) {
  return Math.max(
    1,
    Math.ceil(
      (comparisonEnd.getTime() - comparisonStart.getTime()) /
        bucketMilliseconds,
    ),
  );
}

function formatBucketLabel(value: Date, granularity: "day" | "hour" | "week") {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    ...(granularity === "hour"
      ? { hour: "2-digit", minute: "2-digit" }
      : {}),
    month: "short",
    timeZone: ADMIN_ANALYTICS_TIME_ZONE,
  }).format(value);
}

function getChannel(
  attribution: CampaignAttributionSnapshot | null,
  referrerHost?: string | null,
): { key: string; label: string } {
  const source = attribution?.utmSource?.trim();
  const medium = attribution?.utmMedium?.trim();

  if (source) {
    return {
      key: `${source.toLowerCase()}::${medium?.toLowerCase() ?? ""}`,
      label: medium ? `${source} / ${medium}` : source,
    };
  }

  if (attribution?.gclid || attribution?.gbraid || attribution?.wbraid) {
    return { key: "google-ads", label: "Google Ads" };
  }

  if (referrerHost) {
    const normalizedHost = referrerHost.trim().toLowerCase();

    if (normalizedHost) {
      return {
        key: `referral::${normalizedHost}`,
        label: `Referral · ${normalizedHost}`,
      };
    }
  }

  return { key: "direct-or-untracked", label: "Direct / untracked" };
}

function buildChannelBreakdown(
  ordersInPeriod: PaidOrderRow[],
  sessionsInPeriod: CheckoutSessionRow[],
): AdminAnalyticsChannelRow[] {
  const rows = new Map<
    string,
    {
      grossSales: number;
      key: string;
      label: string;
      paidOrders: number;
      sessions: number;
      successfulCheckouts: number;
    }
  >();
  const totalGrossSales = ordersInPeriod.reduce(
    (total, order) => total + toNumber(order.grandTotal),
    0,
  );
  const sessionByOrderId = new Map(
    sessionsInPeriod.flatMap((session) =>
      session.orderId ? [[session.orderId, session] as const] : [],
    ),
  );
  const getRow = (channel: { key: string; label: string }) => {
    const existing = rows.get(channel.key);

    if (existing) {
      return existing;
    }

    const created = {
      grossSales: 0,
      key: channel.key,
      label: channel.label,
      paidOrders: 0,
      sessions: 0,
      successfulCheckouts: 0,
    };

    rows.set(channel.key, created);
    return created;
  };

  for (const order of ordersInPeriod) {
    const linkedSession = sessionByOrderId.get(order.id);
    const row = getRow(
      getChannel(
        order.campaignAttribution ?? linkedSession?.campaignAttribution ?? null,
        linkedSession?.referrerHost,
      ),
    );

    row.grossSales += toNumber(order.grandTotal);
    row.paidOrders += 1;
  }

  for (const session of sessionsInPeriod) {
    const row = getRow(
      getChannel(session.campaignAttribution, session.referrerHost),
    );

    row.sessions += 1;
    row.successfulCheckouts += session.hasCapturedPayment ? 1 : 0;
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      checkoutConversionRate: toPercent(
        row.successfulCheckouts,
        row.sessions,
      ),
      grossSales: roundMoney(row.grossSales),
      orders: row.paidOrders,
      sharePercent: toPercent(row.grossSales, totalGrossSales),
    }))
    .sort(
      (first, second) =>
        second.grossSales - first.grossSales ||
        second.sessions - first.sessions ||
        first.label.localeCompare(second.label),
    )
    .slice(0, 8);
}

function buildOrderBreakdown(
  orderRows: PaidOrderRow[],
  getKeyAndLabel: (order: PaidOrderRow) => { key: string; label: string },
) {
  const rows = new Map<
    string,
    { grossSales: number; key: string; label: string; orders: number }
  >();
  const totalSales = orderRows.reduce(
    (total, order) => total + toNumber(order.grandTotal),
    0,
  );

  for (const order of orderRows) {
    const item = getKeyAndLabel(order);
    const current = rows.get(item.key) ?? {
      grossSales: 0,
      key: item.key,
      label: item.label,
      orders: 0,
    };

    current.grossSales += toNumber(order.grandTotal);
    current.orders += 1;
    rows.set(item.key, current);
  }

  return Array.from(rows.values())
    .map((row): AdminAnalyticsBreakdownRow => ({
      ...row,
      grossSales: roundMoney(row.grossSales),
      sharePercent: toPercent(row.grossSales, totalSales),
    }))
    .sort(
      (first, second) =>
        second.grossSales - first.grossSales ||
        second.orders - first.orders ||
        first.label.localeCompare(second.label),
    )
    .slice(0, 8);
}

function emptySalesValues(): MutableSalesValues {
  return { grossSales: 0, paidOrders: 0, refundedAmount: 0 };
}

function emptyOutcomeValues(): MutableOutcomeValues {
  return {
    abandoned: 0,
    failed: 0,
    pending: 0,
    started: 0,
    successful: 0,
  };
}

function getSessionEventProgress(
  events: ReadonlySet<CheckoutAnalyticsEventName>,
  row: CheckoutSessionRow,
) {
  const hasAny = (...names: CheckoutAnalyticsEventName[]) =>
    names.some((name) => events.has(name));
  const orderCreated =
    Boolean(row.orderId) || hasAny("order_created", "payment_confirmed");
  const paymentReached =
    orderCreated ||
    hasAny("payment_reached", "payment_attempted", "payfast_redirected");
  const shippingCompleted = paymentReached || hasAny("shipping_completed");
  const addressCompleted = shippingCompleted || hasAny("address_completed");

  return { addressCompleted, orderCreated, paymentReached, shippingCompleted };
}

function buildFunnel(
  sessions: CheckoutSessionRow[],
  eventNamesBySessionId: ReadonlyMap<
    string,
    ReadonlySet<CheckoutAnalyticsEventName>
  >,
) {
  const startCount = sessions.length;
  const progress = sessions.map((session) =>
    getSessionEventProgress(
      eventNamesBySessionId.get(session.id) ?? new Set(),
      session,
    ),
  );
  const stages: Array<{
    key: AdminAnalyticsFunnelStage["key"];
    label: string;
    sessions: number;
  }> = [
    { key: "checkout_started", label: "Checkout started", sessions: startCount },
    {
      key: "address_completed",
      label: "Address completed",
      sessions: progress.filter((item) => item.addressCompleted).length,
    },
    {
      key: "shipping_completed",
      label: "Shipping completed",
      sessions: progress.filter((item) => item.shippingCompleted).length,
    },
    {
      key: "payment_reached",
      label: "Payment reached",
      sessions: progress.filter((item) => item.paymentReached).length,
    },
    {
      key: "order_created",
      label: "Order created",
      sessions: progress.filter((item) => item.orderCreated).length,
    },
    {
      key: "successful",
      label: "Payment captured",
      sessions: sessions.filter((item) => item.hasCapturedPayment).length,
    },
  ];

  return stages.map((stage, index): AdminAnalyticsFunnelStage => {
    const previous = stages[index - 1]?.sessions ?? stage.sessions;

    return {
      ...stage,
      dropOffRateFromPrevious:
        index === 0 ? 0 : Math.max(0, toPercent(previous - stage.sessions, previous)),
      rateFromStart: toPercent(stage.sessions, startCount),
    };
  });
}

function createSeries({
  comparisonOrders,
  comparisonRefunds,
  comparisonSessions,
  currentOrders,
  currentRefunds,
  currentSessions,
  now,
  range,
}: {
  comparisonOrders: PaidOrderRow[];
  comparisonRefunds: CompletedRefundRow[];
  comparisonSessions: CheckoutSessionRow[];
  currentOrders: PaidOrderRow[];
  currentRefunds: CompletedRefundRow[];
  currentSessions: CheckoutSessionRow[];
  now: Date;
  range: ReturnType<typeof resolveAdminAnalyticsRange>;
}) {
  const comparisonBucketCount = getComparisonBucketCount(
    range.comparisonStart,
    range.comparisonEnd,
    range.bucketMilliseconds,
  );
  const pointCount = Math.max(range.bucketCount, comparisonBucketCount);
  const currentSales = Array.from(
    { length: range.bucketCount },
    emptySalesValues,
  );
  const comparisonSales = Array.from(
    { length: comparisonBucketCount },
    emptySalesValues,
  );
  const currentOutcomes = Array.from(
    { length: range.bucketCount },
    emptyOutcomeValues,
  );
  const comparisonOutcomes = Array.from(
    { length: comparisonBucketCount },
    emptyOutcomeValues,
  );

  const addOrders = (
    rows: PaidOrderRow[],
    values: MutableSalesValues[],
    start: Date,
  ) => {
    for (const order of rows) {
      const index = getAdminAnalyticsBucketIndex(
        order.paidAt,
        start,
        range.bucketMilliseconds,
        values.length,
      );

      if (index >= 0) {
        values[index].grossSales += toNumber(order.grandTotal);
        values[index].paidOrders += 1;
      }
    }
  };
  const addRefunds = (
    rows: CompletedRefundRow[],
    values: MutableSalesValues[],
    start: Date,
  ) => {
    for (const refund of rows) {
      const index = getAdminAnalyticsBucketIndex(
        refund.completedAt,
        start,
        range.bucketMilliseconds,
        values.length,
      );

      if (index >= 0) {
        values[index].refundedAmount += toNumber(refund.amount);
      }
    }
  };
  const addSessions = (
    rows: CheckoutSessionRow[],
    values: MutableOutcomeValues[],
    start: Date,
  ) => {
    for (const session of rows) {
      const index = getAdminAnalyticsBucketIndex(
        session.firstSeenAt,
        start,
        range.bucketMilliseconds,
        values.length,
      );

      if (index < 0) {
        continue;
      }

      const outcome = classifyCheckoutAnalyticsOutcome(
        {
          hasCapturedPayment: session.hasCapturedPayment,
          lastSeenAt: session.lastSeenAt,
          status: session.status,
        },
        now,
      );

      values[index].started += 1;
      values[index][outcome] += 1;
    }
  };

  addOrders(currentOrders, currentSales, range.start);
  addOrders(comparisonOrders, comparisonSales, range.comparisonStart);
  addRefunds(currentRefunds, currentSales, range.start);
  addRefunds(comparisonRefunds, comparisonSales, range.comparisonStart);
  addSessions(currentSessions, currentOutcomes, range.start);
  addSessions(comparisonSessions, comparisonOutcomes, range.comparisonStart);

  const salesSeries: AdminAnalyticsSalesSeriesPoint[] = [];
  const outcomeSeries: AdminAnalyticsOutcomeSeriesPoint[] = [];

  for (let index = 0; index < pointCount; index += 1) {
    const currentStart =
      index < range.bucketCount
        ? getAdminAnalyticsBucketStart(
            range.start,
            range.bucketMilliseconds,
            index,
          )
        : null;
    const previousStart =
      index < comparisonBucketCount
        ? getAdminAnalyticsBucketStart(
            range.comparisonStart,
            range.bucketMilliseconds,
            index,
          )
        : null;
    const currentSale = currentSales[index] ?? null;
    const previousSale = comparisonSales[index] ?? null;
    const currentOutcome = currentOutcomes[index] ?? null;
    const previousOutcome = comparisonOutcomes[index] ?? null;

    salesSeries.push({
      comparisonGrossSales: previousSale
        ? roundMoney(previousSale.grossSales)
        : null,
      comparisonLabel: previousStart
        ? formatBucketLabel(previousStart, range.granularity)
        : null,
      comparisonNetSales: previousSale
        ? roundMoney(previousSale.grossSales - previousSale.refundedAmount)
        : null,
      comparisonPaidOrders: previousSale?.paidOrders ?? null,
      comparisonRefundedAmount: previousSale
        ? roundMoney(previousSale.refundedAmount)
        : null,
      comparisonStart: previousStart?.toISOString() ?? null,
      grossSales: currentSale ? roundMoney(currentSale.grossSales) : null,
      key: `bucket-${index}`,
      label: currentStart
        ? formatBucketLabel(currentStart, range.granularity)
        : null,
      netSales: currentSale
        ? roundMoney(currentSale.grossSales - currentSale.refundedAmount)
        : null,
      paidOrders: currentSale?.paidOrders ?? null,
      refundedAmount: currentSale
        ? roundMoney(currentSale.refundedAmount)
        : null,
      start: currentStart?.toISOString() ?? null,
    });
    outcomeSeries.push({
      abandoned: currentOutcome?.abandoned ?? null,
      comparisonAbandoned: previousOutcome?.abandoned ?? null,
      comparisonFailed: previousOutcome?.failed ?? null,
      comparisonLabel: previousStart
        ? formatBucketLabel(previousStart, range.granularity)
        : null,
      comparisonPending: previousOutcome?.pending ?? null,
      comparisonStart: previousStart?.toISOString() ?? null,
      comparisonStarted: previousOutcome?.started ?? null,
      comparisonSuccessful: previousOutcome?.successful ?? null,
      failed: currentOutcome?.failed ?? null,
      key: `bucket-${index}`,
      label: currentStart
        ? formatBucketLabel(currentStart, range.granularity)
        : null,
      pending: currentOutcome?.pending ?? null,
      start: currentStart?.toISOString() ?? null,
      started: currentOutcome?.started ?? null,
      successful: currentOutcome?.successful ?? null,
    });
  }

  return { outcomeSeries, salesSeries };
}

function summarizeOutcomes(
  sessions: CheckoutSessionRow[],
  now: Date,
): AdminAnalyticsOutcomeCounts {
  const summary: AdminAnalyticsOutcomeCounts = {
    abandoned: 0,
    failed: 0,
    pending: 0,
    successful: 0,
    total: sessions.length,
  };

  for (const session of sessions) {
    const outcome = classifyCheckoutAnalyticsOutcome(
      {
        hasCapturedPayment: session.hasCapturedPayment,
        lastSeenAt: session.lastSeenAt,
        status: session.status,
      },
      now,
    );

    // The object is readonly to consumers, but is intentionally accumulated
    // locally before it leaves this function.
    (summary as Record<CheckoutAnalyticsOutcome, number>)[outcome] += 1;
  }

  return summary;
}

export async function getAdminCommerceAnalytics(
  input: AdminCommerceAnalyticsInput = {},
): Promise<AdminCommerceAnalytics> {
  const now = input.now ? new Date(input.now) : new Date();
  const rangeKey = isAdminAnalyticsRangeKey(input.range)
    ? input.range
    : "30d";
  const range = resolveAdminAnalyticsRange(rangeKey, now);
  const paidOrderPeriod = or(
    and(gte(orders.paidAt, range.start), lt(orders.paidAt, range.end)),
    and(
      gte(orders.paidAt, range.comparisonStart),
      lt(orders.paidAt, range.comparisonEnd),
    ),
  );
  const refundPeriod = or(
    and(
      gte(paymentRefunds.completedAt, range.start),
      lt(paymentRefunds.completedAt, range.end),
    ),
    and(
      gte(paymentRefunds.completedAt, range.comparisonStart),
      lt(paymentRefunds.completedAt, range.comparisonEnd),
    ),
  );
  const checkoutPeriod = or(
    and(
      gte(checkoutAnalyticsSessions.firstSeenAt, range.start),
      lt(checkoutAnalyticsSessions.firstSeenAt, range.end),
    ),
    and(
      gte(checkoutAnalyticsSessions.firstSeenAt, range.comparisonStart),
      lt(checkoutAnalyticsSessions.firstSeenAt, range.comparisonEnd),
    ),
  );
  const successfulOrderPayment = sql<boolean>`exists (
    select 1
    from ${payments} as successful_payment
    where successful_payment.order_id = ${orders.id}
      and successful_payment.provider_status = 'COMPLETE'
      and successful_payment.status::text in ('captured', 'refunded')
  )`;
  const successfulSessionPayment = sql<boolean>`exists (
    select 1
    from ${payments} as successful_payment
    where successful_payment.order_id = ${checkoutAnalyticsSessions.orderId}
      and successful_payment.provider_status = 'COMPLETE'
      and successful_payment.status::text in ('captured', 'refunded')
  )`;

  const [
    paidOrderRows,
    completedRefundRows,
    sessionRows,
    sessionEventRows,
    topProductRows,
    paymentHealthRows,
    rejectedWebhookRows,
    reconciliationRows,
    telemetryRows,
  ] = await Promise.all([
    db
      .select({
        campaignAttribution: orders.campaignAttributionSnapshot,
        deliveryAddress: orders.deliveryAddressSnapshot,
        grandTotal: orders.grandTotal,
        id: orders.id,
        paidAt: orders.paidAt,
      })
      .from(orders)
      .where(
        and(
          isNotNull(orders.paidAt),
          paidOrderPeriod,
          successfulOrderPayment,
        ),
      ),
    db
      .select({
        amount: paymentRefunds.amount,
        completedAt: paymentRefunds.completedAt,
      })
      .from(paymentRefunds)
      .where(
        and(
          eq(paymentRefunds.status, "completed"),
          isNotNull(paymentRefunds.completedAt),
          refundPeriod,
        ),
      ),
    db
      .select({
        campaignAttribution:
          checkoutAnalyticsSessions.campaignAttributionSnapshot,
        cartValue: checkoutAnalyticsSessions.cartValue,
        currency: checkoutAnalyticsSessions.currency,
        deviceCategory: checkoutAnalyticsSessions.deviceCategory,
        firstSeenAt: checkoutAnalyticsSessions.firstSeenAt,
        hasCapturedPayment: successfulSessionPayment,
        id: checkoutAnalyticsSessions.id,
        itemCount: checkoutAnalyticsSessions.itemCount,
        landingPath: checkoutAnalyticsSessions.landingPath,
        lastErrorCode: checkoutAnalyticsSessions.lastErrorCode,
        lastSeenAt: checkoutAnalyticsSessions.lastSeenAt,
        latestStep: checkoutAnalyticsSessions.latestStep,
        orderGrandTotal: orders.grandTotal,
        orderId: checkoutAnalyticsSessions.orderId,
        orderNumber: orders.orderNumber,
        orderStatus: orders.status,
        referrerHost: checkoutAnalyticsSessions.referrerHost,
        status: checkoutAnalyticsSessions.status,
        totalQuantity: checkoutAnalyticsSessions.totalQuantity,
      })
      .from(checkoutAnalyticsSessions)
      .leftJoin(orders, eq(orders.id, checkoutAnalyticsSessions.orderId))
      .where(checkoutPeriod),
    db
      .select({
        eventName: checkoutAnalyticsEvents.eventName,
        sessionId: checkoutAnalyticsEvents.sessionId,
      })
      .from(checkoutAnalyticsEvents)
      .innerJoin(
        checkoutAnalyticsSessions,
        eq(checkoutAnalyticsSessions.id, checkoutAnalyticsEvents.sessionId),
      )
      .where(checkoutPeriod),
    db
      .select({
        brand: brands.name,
        category: categories.name,
        grossSales: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)::text`,
        id: products.id,
        orders: sql<number>`count(distinct ${orderItems.orderId})::int`,
        title: products.title,
        units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(
        productVariants,
        eq(productVariants.id, orderItems.variantId),
      )
      .innerJoin(products, eq(products.id, productVariants.productId))
      .leftJoin(brands, eq(brands.id, orderItems.brandId))
      .leftJoin(categories, eq(categories.id, orderItems.categoryId))
      .where(
        and(
          isNotNull(orders.paidAt),
          gte(orders.paidAt, range.start),
          lt(orders.paidAt, range.end),
          successfulOrderPayment,
        ),
      )
      .groupBy(
        products.id,
        products.title,
        brands.name,
        categories.name,
      )
      .orderBy(
        sql`sum(${orderItems.unitPrice} * ${orderItems.quantity}) desc`,
      )
      .limit(8),
    db
      .select({
        attempts: sql<number>`count(*)::int`,
        captured: sql<number>`count(*) filter (
          where ${payments.providerStatus} = 'COMPLETE'
            and ${payments.status} = 'captured'
        )::int`,
        expired: sql<number>`count(*) filter (
          where ${payments.status} = 'failed'
            and ${payments.providerStatus} = 'EXPIRED'
        )::int`,
        failed: sql<number>`count(*) filter (
          where ${payments.status} = 'failed'
            and coalesce(${payments.providerStatus}, '') <> 'EXPIRED'
        )::int`,
        pending: sql<number>`count(*) filter (
          where ${payments.status} = 'pending'
        )::int`,
        providerReportedFailed: sql<number>`count(*) filter (
          where ${payments.status} = 'failed'
            and ${payments.providerStatus} = 'FAILED'
        )::int`,
        refunded: sql<number>`count(*) filter (
          where ${payments.providerStatus} = 'COMPLETE'
            and ${payments.status} = 'refunded'
        )::int`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.provider, "payfast"),
          gte(payments.createdAt, range.start),
          lt(payments.createdAt, range.end),
        ),
      ),
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(payfastItnEvents)
      .where(
        and(
          eq(payfastItnEvents.status, "rejected"),
          gte(payfastItnEvents.receivedAt, range.start),
          lt(payfastItnEvents.receivedAt, range.end),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentReconciliationExceptions)
      .where(eq(paymentReconciliationExceptions.status, "open")),
    db
      .select({
        firstTrackedCheckoutAt: sql<Date | null>`min(${checkoutAnalyticsSessions.firstSeenAt})`,
      })
      .from(checkoutAnalyticsSessions),
  ]);

  const normalizedOrderRows = paidOrderRows as PaidOrderRow[];
  const normalizedRefundRows = completedRefundRows as CompletedRefundRow[];
  const normalizedSessionRows = sessionRows as CheckoutSessionRow[];
  const currentOrders = normalizedOrderRows.filter((order) =>
    isInPeriod(order.paidAt, range.start, range.end),
  );
  const comparisonOrders = normalizedOrderRows.filter((order) =>
    isInPeriod(order.paidAt, range.comparisonStart, range.comparisonEnd),
  );
  const currentRefunds = normalizedRefundRows.filter((refund) =>
    isInPeriod(refund.completedAt, range.start, range.end),
  );
  const comparisonRefunds = normalizedRefundRows.filter((refund) =>
    isInPeriod(
      refund.completedAt,
      range.comparisonStart,
      range.comparisonEnd,
    ),
  );
  const currentSessions = normalizedSessionRows.filter((session) =>
    isInPeriod(session.firstSeenAt, range.start, range.end),
  );
  const comparisonSessions = normalizedSessionRows.filter((session) =>
    isInPeriod(
      session.firstSeenAt,
      range.comparisonStart,
      range.comparisonEnd,
    ),
  );
  const eventNamesBySessionId = new Map<
    string,
    Set<CheckoutAnalyticsEventName>
  >();

  for (const event of sessionEventRows) {
    const names = eventNamesBySessionId.get(event.sessionId) ?? new Set();

    names.add(event.eventName);
    eventNamesBySessionId.set(event.sessionId, names);
  }

  const currentOutcomes = summarizeOutcomes(currentSessions, now);
  const comparisonOutcomes = summarizeOutcomes(comparisonSessions, now);
  const currentGrossSales = currentOrders.reduce(
    (total, order) => total + toNumber(order.grandTotal),
    0,
  );
  const comparisonGrossSales = comparisonOrders.reduce(
    (total, order) => total + toNumber(order.grandTotal),
    0,
  );
  const currentRefundedAmount = currentRefunds.reduce(
    (total, refund) => total + toNumber(refund.amount),
    0,
  );
  const comparisonRefundedAmount = comparisonRefunds.reduce(
    (total, refund) => total + toNumber(refund.amount),
    0,
  );
  const currentAov =
    currentOrders.length > 0 ? currentGrossSales / currentOrders.length : 0;
  const comparisonAov =
    comparisonOrders.length > 0
      ? comparisonGrossSales / comparisonOrders.length
      : 0;
  const { outcomeSeries, salesSeries } = createSeries({
    comparisonOrders,
    comparisonRefunds,
    comparisonSessions,
    currentOrders,
    currentRefunds,
    currentSessions,
    now,
    range,
  });
  const firstTrackedCheckoutAt =
    telemetryRows[0]?.firstTrackedCheckoutAt ?? null;
  const [paidBeforeTrackingRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        isNotNull(orders.paidAt),
        firstTrackedCheckoutAt
          ? lt(orders.paidAt, firstTrackedCheckoutAt)
          : isNotNull(orders.paidAt),
        successfulOrderPayment,
      ),
    );
  const coverage = getAdminAnalyticsTelemetryCoverage(
    range.start,
    range.end,
    firstTrackedCheckoutAt,
  );
  const comparisonCoverage = getAdminAnalyticsTelemetryCoverage(
    range.comparisonStart,
    range.comparisonEnd,
    firstTrackedCheckoutAt,
  );
  const paymentHealth = paymentHealthRows[0] ?? {
    attempts: 0,
    captured: 0,
    expired: 0,
    failed: 0,
    pending: 0,
    providerReportedFailed: 0,
    refunded: 0,
  };

  return {
    channels: buildChannelBreakdown(currentOrders, currentSessions),
    checkoutOutcomes: currentOutcomes,
    currency: "ZAR",
    funnel: buildFunnel(currentSessions, eventNamesBySessionId),
    generatedAt: now.toISOString(),
    outcomeSeries,
    paymentHealth: {
      ...paymentHealth,
      basis: "payment_attempt_created_in_period",
      captureRate: toPercent(
        paymentHealth.captured + paymentHealth.refunded,
        paymentHealth.attempts,
      ),
      openReconciliationExceptions: reconciliationRows[0]?.count ?? 0,
      reconciliationScope: "current_open_global",
      rejectedWebhookEvents: rejectedWebhookRows[0]?.count ?? 0,
    },
    provinces: buildOrderBreakdown(currentOrders, (order) => {
      const province =
        typeof order.deliveryAddress?.province === "string"
          ? order.deliveryAddress.province.trim()
          : "";

      return province
        ? { key: province.toLowerCase(), label: province }
        : { key: "unknown", label: "Unknown province" };
    }),
    range: {
      comparisonEnd: range.comparisonEnd.toISOString(),
      comparisonStart: range.comparisonStart.toISOString(),
      end: range.end.toISOString(),
      granularity: range.granularity,
      key: range.key,
      label: range.label,
      start: range.start.toISOString(),
      timeZone: range.timeZone,
    },
    recentCheckouts: currentSessions
      .map((session) => ({
        outcome: classifyCheckoutAnalyticsOutcome(
          {
            hasCapturedPayment: session.hasCapturedPayment,
            lastSeenAt: session.lastSeenAt,
            status: session.status,
          },
          now,
        ),
        session,
      }))
      .filter(
        (item): item is typeof item & {
          outcome: Exclude<CheckoutAnalyticsOutcome, "successful">;
        } => item.outcome !== "successful",
      )
      .sort(
        (first, second) =>
          second.session.lastSeenAt.getTime() -
          first.session.lastSeenAt.getTime(),
      )
      .slice(0, 12)
      .map(({ outcome, session }) => ({
        cartValue:
          session.cartValue === null ? null : toNumber(session.cartValue),
        currency: session.currency ?? "ZAR",
        deviceCategory: session.deviceCategory,
        errorCode: session.lastErrorCode,
        firstSeenAt: session.firstSeenAt.toISOString(),
        id: session.id,
        itemCount: session.itemCount,
        landingPath: session.landingPath,
        lastSeenAt: session.lastSeenAt.toISOString(),
        latestStep: session.latestStep,
        minutesInactive: Math.max(
          0,
          Math.floor((now.getTime() - session.lastSeenAt.getTime()) / 60_000),
        ),
        order:
          session.orderId &&
          session.orderNumber &&
          session.orderStatus &&
          session.orderGrandTotal !== null
            ? {
                grandTotal: toNumber(session.orderGrandTotal),
                id: session.orderId,
                orderNumber: session.orderNumber,
                status: session.orderStatus,
              }
            : null,
        outcome,
        referrerHost: session.referrerHost,
        totalQuantity: session.totalQuantity,
      })),
    salesSeries,
    summary: {
      abandonedCheckouts: createAdminAnalyticsMetricComparison(
        currentOutcomes.abandoned,
        comparisonOutcomes.abandoned,
      ),
      averageOrderValue: createAdminAnalyticsMetricComparison(
        roundMoney(currentAov),
        roundMoney(comparisonAov),
      ),
      checkoutConversionRate: createAdminAnalyticsMetricComparison(
        toPercent(currentOutcomes.successful, currentOutcomes.total),
        toPercent(comparisonOutcomes.successful, comparisonOutcomes.total),
      ),
      checkoutStarts: createAdminAnalyticsMetricComparison(
        currentSessions.length,
        comparisonSessions.length,
      ),
      grossSales: createAdminAnalyticsMetricComparison(
        roundMoney(currentGrossSales),
        roundMoney(comparisonGrossSales),
      ),
      netSales: createAdminAnalyticsMetricComparison(
        roundMoney(currentGrossSales - currentRefundedAmount),
        roundMoney(comparisonGrossSales - comparisonRefundedAmount),
      ),
      paidOrders: createAdminAnalyticsMetricComparison(
        currentOrders.length,
        comparisonOrders.length,
      ),
      refundedAmount: createAdminAnalyticsMetricComparison(
        roundMoney(currentRefundedAmount),
        roundMoney(comparisonRefundedAmount),
      ),
    },
    telemetry: {
      comparisonCoverage,
      comparisonRangeIncludesPreInstrumentationHistory:
        comparisonCoverage !== "full",
      coverage,
      firstTrackedCheckoutAt: firstTrackedCheckoutAt?.toISOString() ?? null,
      note:
        coverage === "full"
          ? "First-party checkout telemetry covers this entire selected period."
          : coverage === "partial"
            ? "Sales are complete, but checkout-session metrics cover only the portion after the first recorded checkout session."
            : "Sales are complete, but no first-party checkout sessions were recorded in this historical period.",
      paidOrdersBeforeTracking: paidBeforeTrackingRow?.count ?? 0,
      selectedRangeIncludesPreInstrumentationHistory: coverage !== "full",
    },
    topProducts: topProductRows.map((product) => ({
      brand: product.brand,
      category: product.category,
      grossSales: roundMoney(toNumber(product.grossSales)),
      id: product.id,
      orders: product.orders,
      productSales: roundMoney(toNumber(product.grossSales)),
      title: product.title,
      units: product.units,
    })),
  };
}
