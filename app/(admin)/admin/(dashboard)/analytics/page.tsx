import type { Metadata } from "next";
import { z } from "zod";

import { AnalyticsDashboard } from "@/app/(admin)/admin/(dashboard)/analytics/analytics-dashboard";
import { AnalyticsFilters } from "@/app/(admin)/admin/(dashboard)/analytics/analytics-filters";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-controls";
import {
  adminAnalyticsRangeKeys,
  type AdminAnalyticsGranularity,
} from "@/src/modules/admin/analytics-core";
import { getAdminCommerceAnalytics } from "@/src/modules/admin/analytics";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Analytics",
  description:
    "Review Jurgens Energy sales, checkout conversion, product performance, and payment health.",
  robots: {
    follow: false,
    index: false,
  },
};

const analyticsQuerySchema = z.object({
  compare: z.preprocess(
    firstQueryValue,
    z.enum(["previous_period", "none"]).catch("previous_period"),
  ),
  period: z.preprocess(
    firstQueryValue,
    z.enum(adminAnalyticsRangeKeys).catch("30d"),
  ),
});

const periodDateFormatter = new Intl.DateTimeFormat("en-ZA", {
  day: "2-digit",
  month: "short",
  timeZone: "Africa/Johannesburg",
  year: "numeric",
});
const periodDateTimeFormatter = new Intl.DateTimeFormat("en-ZA", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "Africa/Johannesburg",
});

function firstQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function formatPeriodBoundary(value: string, granularity: AdminAnalyticsGranularity) {
  const formatter =
    granularity === "hour" ? periodDateTimeFormatter : periodDateFormatter;

  return formatter.format(new Date(value));
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    compare?: string | string[];
    period?: string | string[];
  }>;
}) {
  const access = await requireAdminCapability("admin.analytics.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const query = analyticsQuerySchema.parse(await searchParams);
  const analytics = await getAdminCommerceAnalytics({ range: query.period });
  const comparisonEnabled = query.compare === "previous_period";
  const periodLabel = `${analytics.range.label} · ${formatPeriodBoundary(
    analytics.range.start,
    analytics.range.granularity,
  )} – ${formatPeriodBoundary(
    analytics.range.end,
    analytics.range.granularity,
  )}`;

  return (
    <>
      <DashboardPageHeader breadcrumbs={["Analytics"]} title="Analytics" />
      <div className="grid min-w-0 gap-4">
        <AnalyticsFilters
          activeComparison={query.compare}
          activePeriod={query.period}
          periodLabel={periodLabel}
        />
        <AnalyticsDashboard
          analytics={analytics}
          comparisonEnabled={comparisonEnabled}
        />
      </div>
    </>
  );
}
