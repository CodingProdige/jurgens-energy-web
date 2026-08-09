import "server-only";

import {
  and,
  eq,
  gte,
  isNotNull,
  lt,
  min,
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
  isCartJourneyAbandoned,
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
  addToCartActions: AdminAnalyticsMetricComparison;
  abandonedCarts: AdminAnalyticsMetricComparison;
  abandonedCheckouts: AdminAnalyticsMetricComparison;
  averageOrderValue: AdminAnalyticsMetricComparison;
  cartToCheckoutRate: AdminAnalyticsMetricComparison;
  cartToPurchaseRate: AdminAnalyticsMetricComparison;
  checkoutConversionRate: AdminAnalyticsMetricComparison;
  checkoutStarts: AdminAnalyticsMetricComparison;
  grossSales: AdminAnalyticsMetricComparison;
  netSales: AdminAnalyticsMetricComparison;
  paidOrders: AdminAnalyticsMetricComparison;
  refundedAmount: AdminAnalyticsMetricComparison;
  uniqueCartJourneys: AdminAnalyticsMetricComparison;
}>;

export type AdminAnalyticsCartSeriesPoint = Readonly<{
  addToCartActions: number | null;
  cartJourneys: number | null;
  checkoutStarts: number | null;
  comparisonAddToCartActions: number | null;
  comparisonCartJourneys: number | null;
  comparisonCheckoutStarts: number | null;
  comparisonLabel: string | null;
  comparisonPurchases: number | null;
  comparisonStart: string | null;
  key: string;
  label: string | null;
  purchases: number | null;
  start: string | null;
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
    | "added_to_cart"
    | "checkout_started"
    | "order_created"
    | "payment_confirmed";
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

export type AdminAnalyticsTopAddedProduct = Readonly<{
  actions: number;
  brand: string | null;
  id: string;
  quantity: number;
  title: string;
  uniqueCartJourneys: number;
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
  cartComparisonCoverage: "full" | "none" | "partial";
  cartCoverage: "full" | "none" | "partial";
  cartNote: string;
  comparisonCoverage: "full" | "none" | "partial";
  comparisonRangeIncludesPreCartInstrumentationHistory: boolean;
  comparisonRangeIncludesPreInstrumentationHistory: boolean;
  coverage: "full" | "none" | "partial";
  firstTrackedCheckoutAt: string | null;
  firstTrackedCartAt: string | null;
  note: string;
  paidOrdersBeforeTracking: number;
  selectedRangeIncludesPreInstrumentationHistory: boolean;
  selectedRangeIncludesPreCartInstrumentationHistory: boolean;
}>;

export type AdminCommerceAnalytics = Readonly<{
  cartSeries: AdminAnalyticsCartSeriesPoint[];
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
  topAddedProducts: AdminAnalyticsTopAddedProduct[];
  topProducts: AdminAnalyticsTopProduct[];
}>;

export const adminAnalyticsMetricDefinitions = {
  addToCartActions:
    "Every first-party add-to-cart action recorded in the selected period. Repeated additions in one cart journey are counted separately.",
  abandonedCarts:
    "Cart journeys started in the selected period with no checkout start and at least 30 minutes since their last cart activity.",
  abandonedCheckouts:
    "Checkout sessions with no captured payment, no explicit failure and at least 30 minutes without activity.",
  averageOrderValue:
    "Gross sales divided by provider-confirmed paid orders in the selected period.",
  cartToCheckoutRate:
    "Cart journeys started in the period that subsequently reached checkout.",
  cartToPurchaseRate:
    "Cart journeys started in the period that subsequently linked to a provider-confirmed captured payment.",
  checkoutConversionRate:
    "Checkout sessions started in the period that link to a provider-confirmed captured payment.",
  checkoutStarts:
    "Distinct first-party cart journeys whose checkout started in the selected period.",
  grossSales:
    "Grand totals of orders with a provider-confirmed captured payment, before completed refunds.",
  netSales:
    "Provider-confirmed gross sales minus refunds completed during the selected period.",
  paidOrders:
    "Distinct orders paid in the period with a COMPLETE PayFast capture. Later-refunded orders remain part of historical gross sales.",
  refundedAmount:
    "Refunds whose payment workflow reached completed status during the selected period.",
  uniqueCartJourneys:
    "Distinct first-party cart journeys whose first add-to-cart action occurred in the selected period. This is a session measure, not a count of identifiable people.",
} as const;

export const adminAnalyticsPanelDefinitions = {
  cartFunnel:
    "Cart journeys that began in the selected period, followed through checkout, order creation and provider-confirmed payment.",
  channels:
    "First-party checkout sessions and captured orders grouped by consent-aware campaign source or referrer. Direct / untracked includes visits without attributable campaign data.",
  paymentHealth:
    "Payment attempts are grouped by the period in which each attempt was created. Open reconciliation exceptions are a current global workload, not a period cohort.",
  topProducts:
    "Gross product-line sales from captured orders in the period. Product sales exclude delivery charges and are shown before refunds.",
  topAddedProducts:
    "Products ranked by units added to carts during the selected period. Actions count add interactions; cart journeys count distinct first-party sessions.",
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
  cartStartedAt: Date | null;
  checkoutStartedAt: Date | null;
  currency: string | null;
  deviceCategory: "desktop" | "mobile" | "tablet" | "unknown";
  firstSeenAt: Date;
  hasCapturedPayment: boolean;
  id: string;
  itemCount: number | null;
  landingPath: string | null;
  lastErrorCode: string | null;
  lastCartActivityAt: Date | null;
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

type CartAddEventRow = {
  occurredAt: Date;
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

type MutableCartValues = {
  addToCartActions: number;
  cartJourneys: number;
  checkoutStarts: number;
  purchases: number;
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

function emptyCartValues(): MutableCartValues {
  return {
    addToCartActions: 0,
    cartJourneys: 0,
    checkoutStarts: 0,
    purchases: 0,
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

  return { orderCreated };
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
    {
      key: "added_to_cart",
      label: "Added to cart",
      sessions: startCount,
    },
    {
      key: "checkout_started",
      label: "Checkout started",
      sessions: sessions.filter((item) => item.checkoutStartedAt).length,
    },
    {
      key: "order_created",
      label: "Order created",
      sessions: progress.filter((item) => item.orderCreated).length,
    },
    {
      key: "payment_confirmed",
      label: "Payment confirmed",
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
  comparisonAddEvents,
  comparisonCartSessions,
  comparisonOrders,
  comparisonRefunds,
  comparisonCheckoutSessions,
  currentAddEvents,
  currentCartSessions,
  currentOrders,
  currentRefunds,
  currentCheckoutSessions,
  now,
  range,
}: {
  comparisonAddEvents: CartAddEventRow[];
  comparisonCartSessions: CheckoutSessionRow[];
  comparisonOrders: PaidOrderRow[];
  comparisonRefunds: CompletedRefundRow[];
  comparisonCheckoutSessions: CheckoutSessionRow[];
  currentAddEvents: CartAddEventRow[];
  currentCartSessions: CheckoutSessionRow[];
  currentOrders: PaidOrderRow[];
  currentRefunds: CompletedRefundRow[];
  currentCheckoutSessions: CheckoutSessionRow[];
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
  const currentCart = Array.from(
    { length: range.bucketCount },
    emptyCartValues,
  );
  const comparisonCart = Array.from(
    { length: comparisonBucketCount },
    emptyCartValues,
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
      if (!session.checkoutStartedAt) {
        continue;
      }

      const index = getAdminAnalyticsBucketIndex(
        session.checkoutStartedAt,
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

  const addCartJourneyStarts = (
    rows: CheckoutSessionRow[],
    values: MutableCartValues[],
    start: Date,
  ) => {
    for (const session of rows) {
      if (!session.cartStartedAt) {
        continue;
      }

      const index = getAdminAnalyticsBucketIndex(
        session.cartStartedAt,
        start,
        range.bucketMilliseconds,
        values.length,
      );

      if (index >= 0) {
        values[index].cartJourneys += 1;
      }
    }
  };
  const addCheckoutStarts = (
    rows: CheckoutSessionRow[],
    values: MutableCartValues[],
    start: Date,
  ) => {
    for (const session of rows) {
      if (!session.cartStartedAt || !session.checkoutStartedAt) {
        continue;
      }

      const index = getAdminAnalyticsBucketIndex(
        session.cartStartedAt,
        start,
        range.bucketMilliseconds,
        values.length,
      );

      if (index >= 0) {
        values[index].checkoutStarts += 1;
      }
    }
  };
  const addPurchases = (
    rows: CheckoutSessionRow[],
    values: MutableCartValues[],
    start: Date,
  ) => {
    for (const session of rows) {
      if (!session.cartStartedAt || !session.hasCapturedPayment) {
        continue;
      }

      const index = getAdminAnalyticsBucketIndex(
        session.cartStartedAt,
        start,
        range.bucketMilliseconds,
        values.length,
      );

      if (index >= 0) {
        values[index].purchases += 1;
      }
    }
  };
  const addCartActions = (
    rows: CartAddEventRow[],
    values: MutableCartValues[],
    start: Date,
  ) => {
    for (const event of rows) {
      const index = getAdminAnalyticsBucketIndex(
        event.occurredAt,
        start,
        range.bucketMilliseconds,
        values.length,
      );

      if (index >= 0) {
        values[index].addToCartActions += 1;
      }
    }
  };

  addOrders(currentOrders, currentSales, range.start);
  addOrders(comparisonOrders, comparisonSales, range.comparisonStart);
  addRefunds(currentRefunds, currentSales, range.start);
  addRefunds(comparisonRefunds, comparisonSales, range.comparisonStart);
  addSessions(currentCheckoutSessions, currentOutcomes, range.start);
  addSessions(
    comparisonCheckoutSessions,
    comparisonOutcomes,
    range.comparisonStart,
  );
  addCartJourneyStarts(currentCartSessions, currentCart, range.start);
  addCartJourneyStarts(
    comparisonCartSessions,
    comparisonCart,
    range.comparisonStart,
  );
  addCheckoutStarts(currentCartSessions, currentCart, range.start);
  addCheckoutStarts(
    comparisonCartSessions,
    comparisonCart,
    range.comparisonStart,
  );
  addPurchases(currentCartSessions, currentCart, range.start);
  addPurchases(
    comparisonCartSessions,
    comparisonCart,
    range.comparisonStart,
  );
  addCartActions(currentAddEvents, currentCart, range.start);
  addCartActions(comparisonAddEvents, comparisonCart, range.comparisonStart);

  const cartSeries: AdminAnalyticsCartSeriesPoint[] = [];
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
    const currentCartValues = currentCart[index] ?? null;
    const previousCartValues = comparisonCart[index] ?? null;

    cartSeries.push({
      addToCartActions: currentCartValues?.addToCartActions ?? null,
      cartJourneys: currentCartValues?.cartJourneys ?? null,
      checkoutStarts: currentCartValues?.checkoutStarts ?? null,
      comparisonAddToCartActions:
        previousCartValues?.addToCartActions ?? null,
      comparisonCartJourneys: previousCartValues?.cartJourneys ?? null,
      comparisonCheckoutStarts: previousCartValues?.checkoutStarts ?? null,
      comparisonLabel: previousStart
        ? formatBucketLabel(previousStart, range.granularity)
        : null,
      comparisonPurchases: previousCartValues?.purchases ?? null,
      comparisonStart: previousStart?.toISOString() ?? null,
      key: `bucket-${index}`,
      label: currentStart
        ? formatBucketLabel(currentStart, range.granularity)
        : null,
      purchases: currentCartValues?.purchases ?? null,
      start: currentStart?.toISOString() ?? null,
    });
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

  return { cartSeries, outcomeSeries, salesSeries };
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
      gte(checkoutAnalyticsSessions.checkoutStartedAt, range.start),
      lt(checkoutAnalyticsSessions.checkoutStartedAt, range.end),
    ),
    and(
      gte(checkoutAnalyticsSessions.checkoutStartedAt, range.comparisonStart),
      lt(checkoutAnalyticsSessions.checkoutStartedAt, range.comparisonEnd),
    ),
  );
  const cartPeriod = or(
    and(
      gte(checkoutAnalyticsSessions.cartStartedAt, range.start),
      lt(checkoutAnalyticsSessions.cartStartedAt, range.end),
    ),
    and(
      gte(checkoutAnalyticsSessions.cartStartedAt, range.comparisonStart),
      lt(checkoutAnalyticsSessions.cartStartedAt, range.comparisonEnd),
    ),
  );
  const sessionPeriod = or(checkoutPeriod, cartPeriod);
  const addEventPeriod = or(
    and(
      gte(checkoutAnalyticsEvents.occurredAt, range.start),
      lt(checkoutAnalyticsEvents.occurredAt, range.end),
    ),
    and(
      gte(checkoutAnalyticsEvents.occurredAt, range.comparisonStart),
      lt(checkoutAnalyticsEvents.occurredAt, range.comparisonEnd),
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
    cartAddEventRows,
    topAddedProductRows,
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
        cartStartedAt: checkoutAnalyticsSessions.cartStartedAt,
        checkoutStartedAt: checkoutAnalyticsSessions.checkoutStartedAt,
        currency: checkoutAnalyticsSessions.currency,
        deviceCategory: checkoutAnalyticsSessions.deviceCategory,
        firstSeenAt: checkoutAnalyticsSessions.firstSeenAt,
        hasCapturedPayment: successfulSessionPayment,
        id: checkoutAnalyticsSessions.id,
        itemCount: checkoutAnalyticsSessions.itemCount,
        landingPath: checkoutAnalyticsSessions.landingPath,
        lastErrorCode: checkoutAnalyticsSessions.lastErrorCode,
        lastCartActivityAt: checkoutAnalyticsSessions.lastCartActivityAt,
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
      .where(sessionPeriod),
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
      .where(or(checkoutPeriod, cartPeriod)),
    db
      .select({
        occurredAt: checkoutAnalyticsEvents.occurredAt,
      })
      .from(checkoutAnalyticsEvents)
      .where(
        and(
          eq(checkoutAnalyticsEvents.eventName, "add_to_cart"),
          addEventPeriod,
        ),
      ),
    db
      .select({
        actions: sql<number>`count(*)::int`,
        brand: sql<string | null>`max(${checkoutAnalyticsEvents.brandNameSnapshot})`,
        id: checkoutAnalyticsEvents.productId,
        quantity: sql<number>`coalesce(sum(${checkoutAnalyticsEvents.quantityDelta}), 0)::int`,
        title: sql<string>`coalesce(max(${checkoutAnalyticsEvents.productTitleSnapshot}), max(${products.title}), 'Unknown product')`,
        uniqueCartJourneys: sql<number>`count(distinct ${checkoutAnalyticsEvents.sessionId})::int`,
      })
      .from(checkoutAnalyticsEvents)
      .leftJoin(products, eq(products.id, checkoutAnalyticsEvents.productId))
      .where(
        and(
          eq(checkoutAnalyticsEvents.eventName, "add_to_cart"),
          isNotNull(checkoutAnalyticsEvents.productId),
          gte(checkoutAnalyticsEvents.occurredAt, range.start),
          lt(checkoutAnalyticsEvents.occurredAt, range.end),
        ),
      )
      .groupBy(checkoutAnalyticsEvents.productId)
      .orderBy(
        sql`sum(${checkoutAnalyticsEvents.quantityDelta}) desc`,
        sql`count(*) desc`,
      )
      .limit(8),
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
        firstTrackedCartAt: min(checkoutAnalyticsSessions.cartStartedAt),
        firstTrackedCheckoutAt: min(
          checkoutAnalyticsSessions.checkoutStartedAt,
        ),
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
  const normalizedCartAddEventRows = cartAddEventRows as CartAddEventRow[];
  const currentCartSessions = normalizedSessionRows.filter(
    (session) =>
      session.cartStartedAt &&
      isInPeriod(session.cartStartedAt, range.start, range.end),
  );
  const comparisonCartSessions = normalizedSessionRows.filter(
    (session) =>
      session.cartStartedAt &&
      isInPeriod(
        session.cartStartedAt,
        range.comparisonStart,
        range.comparisonEnd,
      ),
  );
  const currentCheckoutSessions = normalizedSessionRows.filter(
    (session) =>
      session.checkoutStartedAt &&
      isInPeriod(session.checkoutStartedAt, range.start, range.end),
  );
  const comparisonCheckoutSessions = normalizedSessionRows.filter(
    (session) =>
      session.checkoutStartedAt &&
      isInPeriod(
        session.checkoutStartedAt,
        range.comparisonStart,
        range.comparisonEnd,
      ),
  );
  const currentAddEvents = normalizedCartAddEventRows.filter((event) =>
    isInPeriod(event.occurredAt, range.start, range.end),
  );
  const comparisonAddEvents = normalizedCartAddEventRows.filter((event) =>
    isInPeriod(
      event.occurredAt,
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

  const currentOutcomes = summarizeOutcomes(currentCheckoutSessions, now);
  const comparisonOutcomes = summarizeOutcomes(
    comparisonCheckoutSessions,
    now,
  );
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
  const { cartSeries, outcomeSeries, salesSeries } = createSeries({
    comparisonAddEvents,
    comparisonCartSessions,
    comparisonCheckoutSessions,
    comparisonOrders,
    comparisonRefunds,
    currentAddEvents,
    currentCartSessions,
    currentCheckoutSessions,
    currentOrders,
    currentRefunds,
    now,
    range,
  });
  const firstTrackedCheckoutAt =
    telemetryRows[0]?.firstTrackedCheckoutAt ?? null;
  const firstTrackedCartAt = telemetryRows[0]?.firstTrackedCartAt ?? null;
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
  const cartCoverage = getAdminAnalyticsTelemetryCoverage(
    range.start,
    range.end,
    firstTrackedCartAt,
  );
  const cartComparisonCoverage = getAdminAnalyticsTelemetryCoverage(
    range.comparisonStart,
    range.comparisonEnd,
    firstTrackedCartAt,
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
  const currentAbandonedCarts = currentCartSessions.filter((session) =>
    isCartJourneyAbandoned(session, now),
  ).length;
  const comparisonAbandonedCarts = comparisonCartSessions.filter((session) =>
    isCartJourneyAbandoned(session, now),
  ).length;
  const currentCartCheckouts = currentCartSessions.filter(
    (session) => session.checkoutStartedAt,
  ).length;
  const comparisonCartCheckouts = comparisonCartSessions.filter(
    (session) => session.checkoutStartedAt,
  ).length;
  const currentCartPurchases = currentCartSessions.filter(
    (session) => session.hasCapturedPayment,
  ).length;
  const comparisonCartPurchases = comparisonCartSessions.filter(
    (session) => session.hasCapturedPayment,
  ).length;

  return {
    cartSeries,
    channels: buildChannelBreakdown(currentOrders, currentCheckoutSessions),
    checkoutOutcomes: currentOutcomes,
    currency: "ZAR",
    funnel: buildFunnel(currentCartSessions, eventNamesBySessionId),
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
    recentCheckouts: currentCheckoutSessions
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
        firstSeenAt:
          session.checkoutStartedAt?.toISOString() ??
          session.firstSeenAt.toISOString(),
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
      addToCartActions: createAdminAnalyticsMetricComparison(
        currentAddEvents.length,
        comparisonAddEvents.length,
      ),
      abandonedCarts: createAdminAnalyticsMetricComparison(
        currentAbandonedCarts,
        comparisonAbandonedCarts,
      ),
      abandonedCheckouts: createAdminAnalyticsMetricComparison(
        currentOutcomes.abandoned,
        comparisonOutcomes.abandoned,
      ),
      averageOrderValue: createAdminAnalyticsMetricComparison(
        roundMoney(currentAov),
        roundMoney(comparisonAov),
      ),
      cartToCheckoutRate: createAdminAnalyticsMetricComparison(
        toPercent(currentCartCheckouts, currentCartSessions.length),
        toPercent(
          comparisonCartCheckouts,
          comparisonCartSessions.length,
        ),
      ),
      cartToPurchaseRate: createAdminAnalyticsMetricComparison(
        toPercent(currentCartPurchases, currentCartSessions.length),
        toPercent(
          comparisonCartPurchases,
          comparisonCartSessions.length,
        ),
      ),
      checkoutConversionRate: createAdminAnalyticsMetricComparison(
        toPercent(currentOutcomes.successful, currentOutcomes.total),
        toPercent(comparisonOutcomes.successful, comparisonOutcomes.total),
      ),
      checkoutStarts: createAdminAnalyticsMetricComparison(
        currentCheckoutSessions.length,
        comparisonCheckoutSessions.length,
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
      uniqueCartJourneys: createAdminAnalyticsMetricComparison(
        currentCartSessions.length,
        comparisonCartSessions.length,
      ),
    },
    telemetry: {
      cartComparisonCoverage,
      cartCoverage,
      cartNote:
        cartCoverage === "full"
          ? "First-party cart telemetry covers this entire selected period."
          : cartCoverage === "partial"
            ? "Cart metrics cover only the portion after first-party cart tracking was deployed; earlier cart activity cannot be backfilled."
            : "No first-party cart activity was recorded in this historical period. Cart history starts from deployment and cannot be backfilled.",
      comparisonCoverage,
      comparisonRangeIncludesPreCartInstrumentationHistory:
        cartComparisonCoverage !== "full",
      comparisonRangeIncludesPreInstrumentationHistory:
        comparisonCoverage !== "full",
      coverage,
      firstTrackedCheckoutAt: firstTrackedCheckoutAt?.toISOString() ?? null,
      firstTrackedCartAt: firstTrackedCartAt?.toISOString() ?? null,
      note:
        coverage === "full"
          ? "First-party checkout telemetry covers this entire selected period."
          : coverage === "partial"
            ? "Sales are complete, but checkout-session metrics cover only the portion after the first recorded checkout session."
            : "Sales are complete, but no first-party checkout sessions were recorded in this historical period.",
      paidOrdersBeforeTracking: paidBeforeTrackingRow?.count ?? 0,
      selectedRangeIncludesPreInstrumentationHistory: coverage !== "full",
      selectedRangeIncludesPreCartInstrumentationHistory:
        cartCoverage !== "full",
    },
    topAddedProducts: topAddedProductRows.flatMap((product) =>
      product.id
        ? [
            {
              actions: product.actions,
              brand: product.brand,
              id: product.id,
              quantity: product.quantity,
              title: product.title,
              uniqueCartJourneys: product.uniqueCartJourneys,
            },
          ]
        : [],
    ),
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
