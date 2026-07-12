import type { Metadata } from "next";
import Link from "next/link";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import {
  DashboardCompactMetrics,
  type DashboardMetricDefinition,
} from "@/components/dashboard/dashboard-compact-metrics";
import {
  DashboardPageHeader,
  dashboardPanelClass,
  dashboardTableCellClass,
  dashboardTableClass,
  dashboardTableContainerClass,
  dashboardTableHeadClass,
  dashboardTableHeaderRowClass,
  dashboardTableMutedTextClass,
  dashboardTablePrimaryTextClass,
  dashboardTableRowClass,
  dashboardTableSecondaryTextClass,
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
import { getAdminShippingData } from "@/src/modules/admin/shipping";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "Admin Shipping",
  description: "Monitor Jurgens Energy shipping, BobGo quotes, and webhook events.",
  robots: {
    follow: false,
    index: false,
  },
};

const moneyFormatter = new Intl.NumberFormat("en-ZA", {
  currency: "ZAR",
  style: "currency",
});
const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatMoney(value: string | number) {
  return moneyFormatter.format(Number(value) || 0);
}

function formatDate(value: Date) {
  return dateFormatter.format(value);
}

function statusClass(status: string) {
  if (["booked", "ready_for_collection", "waybill_ready"].includes(status)) {
    return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
  }

  if (["collected", "in_transit", "out_for_delivery", "delivered", "processed"].includes(status)) {
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }

  if (["cancelled", "failed_delivery", "returned"].includes(status)) {
    return "bg-red-500/12 text-red-700 dark:text-red-300";
  }

  return "bg-slate-500/12 text-slate-700 dark:text-slate-300";
}

function labelize(value: string) {
  return value.replaceAll("_", " ");
}

export default async function AdminShippingPage() {
  const access = await requireAdminCapability("admin.orders.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const data = await getAdminShippingData();
  const metrics: DashboardMetricDefinition[] = [
    {
      color: "blue",
      description: "Shipment records currently stored in the database.",
      id: "shipments",
      label: "Shipments",
      value: data.metrics.shipments,
    },
    {
      color: "amber",
      description: "Shipments waiting to be booked with a carrier.",
      id: "pending",
      label: "Pending booking",
      value: data.metrics.pendingBooking,
    },
    {
      color: "amber",
      description: "Shipments booked or ready for collection.",
      id: "ready",
      label: "Ready",
      value: data.metrics.booked + data.metrics.readyForCollection,
    },
    {
      color: "emerald",
      description: "Shipments already moving with a carrier.",
      id: "in_transit",
      label: "In transit",
      value: data.metrics.inTransit,
    },
    {
      color: "emerald",
      description: "Shipments marked delivered.",
      id: "delivered",
      label: "Delivered",
      value: data.metrics.delivered,
    },
    {
      color: "#ff5a1f",
      description: "BobGo rate quote rows captured by checkout.",
      id: "bobgo_quotes",
      label: "BobGo quotes",
      value: data.metrics.bobgoQuotes,
    },
    {
      color: "slate",
      description: "Recent BobGo webhook rows and shipment event rows.",
      id: "webhooks",
      label: "Events",
      value: data.metrics.webhookEvents,
    },
  ];

  return (
    <>
      <DashboardPageHeader breadcrumbs={["Orders", "Shipping"]} title="Shipping" />

      <div className="grid gap-4">
        <DashboardCompactMetrics
          metrics={metrics}
          storageKey="jurgens:admin:shipping-metrics"
        />

        <section className={cn("grid gap-4 p-5", dashboardPanelClass)}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                BobGo integration
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                Checkout can quote rates when shipping, BobGo, booking mode, and
                the active API key are configured.
              </p>
            </div>
            <Link
              className="h-9 w-fit rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-slate-50 dark:border-white/18 dark:text-white dark:hover:bg-white/10"
              href="/settings/platform?section=shipping"
            >
              Shipping settings
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ["Shipping", data.bobgo.shippingEnabled ? "Enabled" : "Disabled"],
              ["BobGo", data.bobgo.enabled ? "Enabled" : "Disabled"],
              ["Mode", data.bobgo.mode],
              ["Booking", labelize(data.bobgo.bookingMode)],
              ["API key", data.bobgo.hasActiveApiKey ? "Set" : "Missing"],
              [
                "Webhook secret",
                data.bobgo.hasActiveWebhookSecret ? "Set" : "Missing",
              ],
            ].map(([label, value]) => (
              <div
                className="rounded-lg border border-slate-200 p-3 dark:border-white/10"
                key={label}
              >
                <p className={dashboardTableSecondaryTextClass}>{label}</p>
                <p className="mt-1 text-sm font-semibold capitalize text-zinc-950 dark:text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className={cn("overflow-hidden", dashboardPanelClass, dashboardTableContainerClass)}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
            <p className="text-sm font-semibold text-zinc-950 dark:text-white">
              Shipment queue
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {data.shipments.length} shipments shown
            </p>
          </div>

          <Table className={dashboardTableClass}>
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>Shipment</TableHead>
                <TableHead className={dashboardTableHeadClass}>Order</TableHead>
                <TableHead className={dashboardTableHeadClass}>Provider</TableHead>
                <TableHead className={dashboardTableHeadClass}>Tracking</TableHead>
                <TableHead className={dashboardTableHeadClass}>Parcels</TableHead>
                <TableHead className={dashboardTableHeadClass}>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.shipments.length === 0 ? (
                <TableRow className={dashboardTableRowClass}>
                  <TableCell
                    className={cn("h-28 text-center", dashboardTableCellClass)}
                    colSpan={6}
                  >
                    <span className={dashboardTableMutedTextClass}>
                      No shipments have been created yet.
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                data.shipments.map((shipment) => (
                  <TableRow className={dashboardTableRowClass} key={shipment.id}>
                    <TableCell className={dashboardTableCellClass}>
                      <div className="min-w-0 space-y-1">
                        <Badge className={cn("rounded-md border-0 capitalize", statusClass(shipment.status))}>
                          {labelize(shipment.status)}
                        </Badge>
                        <p className={dashboardTableSecondaryTextClass}>
                          {shipment.providerShipmentId ?? shipment.id.slice(0, 8)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTablePrimaryTextClass}>
                        #{shipment.orderId.slice(0, 8).toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={cn("capitalize", dashboardTableMutedTextClass)}>
                        {shipment.provider}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <div className="min-w-0">
                        <p className={dashboardTableMutedTextClass}>
                          {shipment.waybillNumber ?? shipment.trackingNumber ?? "No tracking yet"}
                        </p>
                        {shipment.trackingUrl ? (
                          <Link
                            className={dashboardTableSecondaryTextClass}
                            href={shipment.trackingUrl}
                            target="_blank"
                          >
                            Open tracking
                          </Link>
                        ) : (
                          <p className={dashboardTableSecondaryTextClass}>
                            Waybill {shipment.waybillUrl ? "ready" : "not ready"}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTableMutedTextClass}>
                        {shipment.parcelCount}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTableMutedTextClass}>
                        {formatDate(shipment.updatedAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className={cn("overflow-hidden", dashboardPanelClass, dashboardTableContainerClass)}>
            <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                Recent rate quotes
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                BobGo checkout quote history
              </p>
            </div>
            <Table className="table-fixed md:min-w-[680px]">
              <TableHeader>
                <TableRow className={dashboardTableHeaderRowClass}>
                  <TableHead className={dashboardTableHeadClass}>Service</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Status</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Customer</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.quotes.slice(0, 8).map((quote) => (
                  <TableRow className={dashboardTableRowClass} key={quote.id}>
                    <TableCell className={dashboardTableCellClass}>
                      <div className="min-w-0">
                        <p className={dashboardTablePrimaryTextClass}>{quote.serviceName}</p>
                        <p className={dashboardTableSecondaryTextClass}>
                          Provider {formatMoney(quote.providerAmount)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <Badge className={cn("rounded-md border-0 capitalize", statusClass(quote.status))}>
                        {quote.status}
                      </Badge>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTableMutedTextClass}>
                        {formatMoney(quote.customerAmount)}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTableMutedTextClass}>
                        {formatDate(quote.createdAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {data.quotes.length === 0 ? (
                  <TableRow className={dashboardTableRowClass}>
                    <TableCell className="h-24 text-center" colSpan={4}>
                      <span className={dashboardTableMutedTextClass}>
                        No BobGo quotes have been captured yet.
                      </span>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </section>

          <section className={cn("overflow-hidden", dashboardPanelClass, dashboardTableContainerClass)}>
            <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                BobGo webhook events
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Latest signed webhook payloads received
              </p>
            </div>
            <Table className="table-fixed md:min-w-[680px]">
              <TableHeader>
                <TableRow className={dashboardTableHeaderRowClass}>
                  <TableHead className={dashboardTableHeadClass}>Topic</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Status</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Shipment</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.webhookEvents.map((event) => (
                  <TableRow className={dashboardTableRowClass} key={event.providerEventId}>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTablePrimaryTextClass}>
                        {event.topic}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <Badge className={cn("rounded-md border-0 capitalize", statusClass(event.status))}>
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTableMutedTextClass}>
                        {event.providerShipmentId ?? "No shipment id"}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTableMutedTextClass}>
                        {formatDate(event.receivedAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {data.webhookEvents.length === 0 ? (
                  <TableRow className={dashboardTableRowClass}>
                    <TableCell className="h-24 text-center" colSpan={4}>
                      <span className={dashboardTableMutedTextClass}>
                        No BobGo webhook events have been received yet.
                      </span>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </section>
        </div>
      </div>
    </>
  );
}
