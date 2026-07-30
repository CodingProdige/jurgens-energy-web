import type { Metadata } from "next";
import Link from "next/link";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { CourierGuyShipmentActions } from "@/app/(admin)/admin/(dashboard)/shipping/shipment-actions";
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
import { hasAdminCapability } from "@/src/modules/admin/staff";
import { getAdminShippingData } from "@/src/modules/admin/shipping";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "Admin Shipping",
  description:
    "Book Courier Guy shipments, create waybills, and monitor delivery events.",
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
  if (
    [
      "booking",
      "booked",
      "cancelling",
      "ready_for_collection",
      "waybill_ready",
    ].includes(status)
  ) {
    return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
  }

  if (["collected", "in_transit", "out_for_delivery", "delivered", "processed"].includes(status)) {
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }

  if (
    ["cancelled", "failed_delivery", "returned", "undeliverable"].includes(
      status,
    )
  ) {
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

  const canManageShipments = hasAdminCapability(
    access.session.user.adminCapabilities,
    "admin.orders.manage",
  );
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
      description: "New shipments fulfilled through The Courier Guy.",
      id: "courier_guy_shipments",
      label: "Courier Guy",
      value: data.metrics.courierGuyShipments,
    },
    {
      color: "slate",
      description: "Recent Courier Guy webhook rows and shipment events.",
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
                The Courier Guy integration
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                Customer prices stay fixed. Provider rates are used privately
                when an administrator books each packed drop-off shipment.
              </p>
            </div>
            <Link
              className="h-9 w-fit rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-slate-50 dark:border-white/18 dark:text-white dark:hover:bg-white/10"
              href="/settings/platform?section=shipping"
            >
              Shipping settings
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {[
              [
                "Customer delivery",
                data.courierGuy.shippingEnabled ? "Enabled" : "Disabled",
              ],
              [
                "Courier Guy",
                data.courierGuy.enabled ? "Enabled" : "Disabled",
              ],
              ["Mode", data.courierGuy.mode],
              ["Drop-off", labelize(data.courierGuy.dropoffType)],
              [
                "Account code",
                data.courierGuy.hasActiveAccountCode ? "Set" : "Missing",
              ],
              [
                "API key",
                data.courierGuy.hasActiveApiKey ? "Set" : "Missing",
              ],
              [
                "Webhook token",
                data.courierGuy.hasWebhookToken ? "Set" : "Missing",
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
                <TableHead className={dashboardTableHeadClass}>Cost</TableHead>
                <TableHead className={dashboardTableHeadClass}>Actions</TableHead>
                <TableHead className={dashboardTableHeadClass}>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.shipments.length === 0 ? (
                <TableRow className={dashboardTableRowClass}>
                  <TableCell
                    className={cn("h-28 text-center", dashboardTableCellClass)}
                    colSpan={7}
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
                        {shipment.providerEnvironment ? (
                          <p className={dashboardTableSecondaryTextClass}>
                            {shipment.providerEnvironment}
                            {shipment.providerAccountCode
                              ? ` · account ${shipment.providerAccountCode}`
                              : ""}
                          </p>
                        ) : null}
                        {shipment.status === "booking" ? (
                          <p className="max-w-60 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
                            Reconcile in The Courier Guy portal with reference{" "}
                            {shipment.bookingReference}.
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTablePrimaryTextClass}>
                        {shipment.orderNumber}
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
                        {shipment.trackingUrl ||
                        (shipment.provider === "courier_guy" &&
                          shipment.providerShipmentId &&
                          canManageShipments) ? (
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {shipment.trackingUrl ? (
                              <Link
                                className={dashboardTableSecondaryTextClass}
                                href={shipment.trackingUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                Open tracking
                              </Link>
                            ) : null}
                            {shipment.provider === "courier_guy" &&
                            shipment.providerShipmentId &&
                            canManageShipments ? (
                              <Link
                                className={dashboardTableSecondaryTextClass}
                                href={`/shipping/${shipment.id}/waybill`}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                Generate fresh waybill
                              </Link>
                            ) : null}
                          </div>
                        ) : (
                          <p className={dashboardTableSecondaryTextClass}>
                            Waybill not ready
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <div>
                        <p className={dashboardTableMutedTextClass}>
                          {shipment.providerCostAmount
                            ? formatMoney(shipment.providerCostAmount)
                            : "Not quoted"}
                        </p>
                        <p className={dashboardTableSecondaryTextClass}>
                          {shipment.parcelCount} parcel
                          {shipment.parcelCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      {shipment.provider === "courier_guy" &&
                      canManageShipments ? (
                        <CourierGuyShipmentActions
                          bookingReference={shipment.bookingReference}
                          shipmentId={shipment.id}
                          status={shipment.status}
                          trackingNumber={shipment.trackingNumber}
                        />
                      ) : shipment.provider === "courier_guy" ? (
                        <span className={dashboardTableSecondaryTextClass}>
                          Read only
                        </span>
                      ) : (
                        <span className={dashboardTableSecondaryTextClass}>
                          Managed locally
                        </span>
                      )}
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
                Customer delivery quotes
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Fixed order-level checkout pricing; carrier costs are stored on
                booked shipments above.
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
                          {quote.provider === "manual"
                            ? "Customer policy"
                            : `Historical ${labelize(quote.provider)} record`}
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
                        No customer delivery quotes have been captured yet.
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
                Courier Guy webhook events
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
                  <TableRow
                    className={dashboardTableRowClass}
                    key={`${event.providerEnvironment}:${event.providerEventId}`}
                  >
                    <TableCell className={dashboardTableCellClass}>
                      <div>
                        <p className={dashboardTablePrimaryTextClass}>
                          {event.topic}
                        </p>
                        <p className={dashboardTableSecondaryTextClass}>
                          {event.providerEnvironment}
                        </p>
                      </div>
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
                        No Courier Guy webhook events have been received yet.
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
