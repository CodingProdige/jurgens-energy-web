import type { Metadata } from "next";
import Link from "next/link";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { DashboardCompactMetrics, type DashboardMetricDefinition } from "@/components/dashboard/dashboard-compact-metrics";
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
import { getAdminOrders, type AdminOrderRow } from "@/src/modules/admin/orders";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "Admin Orders",
  description: "Review Jurgens Energy customer orders and fulfillment status.",
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

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function statusClass(status: string) {
  if (["paid", "fulfilled", "captured", "delivered"].includes(status)) {
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }

  if (["cancelled", "failed", "refunded"].includes(status)) {
    return "bg-red-500/12 text-red-700 dark:text-red-300";
  }

  return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
}

function OrderPayments({ order }: { order: AdminOrderRow }) {
  const payment = order.payments[0];

  if (!payment) {
    return <span className={dashboardTableSecondaryTextClass}>No payment</span>;
  }

  return (
    <div className="min-w-0 space-y-1">
      <Badge className={cn("rounded-md border-0 capitalize", statusClass(payment.status))}>
        {payment.status}
      </Badge>
      <p className={dashboardTableSecondaryTextClass}>
        {payment.provider} · {formatMoney(payment.amount)}
      </p>
    </div>
  );
}

function OrderShipments({ order }: { order: AdminOrderRow }) {
  const shipment = order.shipments[0];

  if (!shipment) {
    return <span className={dashboardTableSecondaryTextClass}>Not shipped</span>;
  }

  return (
    <div className="min-w-0 space-y-1">
      <Badge className={cn("rounded-md border-0 capitalize", statusClass(shipment.status))}>
        {shipment.status.replaceAll("_", " ")}
      </Badge>
      <p className={dashboardTableSecondaryTextClass}>
        {[shipment.waybillNumber, shipment.trackingNumber].filter(Boolean).join(" · ") ||
          shipment.provider}
      </p>
    </div>
  );
}

export default async function AdminOrdersPage() {
  const access = await requireAdminCapability("admin.orders.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const data = await getAdminOrders();
  const metrics: DashboardMetricDefinition[] = [
    {
      color: "blue",
      description: "All customer orders currently stored in the database.",
      id: "total",
      label: "Total orders",
      value: data.metrics.total,
    },
    {
      color: "amber",
      description: "Orders created but not yet marked as paid.",
      id: "pending",
      label: "Pending",
      value: data.metrics.pending,
    },
    {
      color: "emerald",
      description: "Orders with a paid status.",
      id: "paid",
      label: "Paid",
      value: data.metrics.paid,
    },
    {
      color: "emerald",
      description: "Orders marked fulfilled.",
      id: "fulfilled",
      label: "Fulfilled",
      value: data.metrics.fulfilled,
    },
    {
      color: "red",
      description: "Cancelled or refunded orders.",
      id: "exceptions",
      label: "Exceptions",
      value: data.metrics.cancelled + data.metrics.refunded,
    },
    {
      color: "slate",
      description: "Shipping collected from customers across orders.",
      id: "shipping",
      label: "Shipping",
      value: Math.round(data.metrics.shippingCollected),
    },
    {
      color: "#ff5a1f",
      description: "Gross order value across all orders.",
      id: "revenue",
      label: "Revenue",
      value: Math.round(data.metrics.revenue),
    },
  ];

  return (
    <>
      <DashboardPageHeader breadcrumbs={["Orders"]} title="Orders" />

      <div className="grid gap-4">
        <DashboardCompactMetrics
          metrics={metrics}
          storageKey="jurgens:admin:order-metrics"
        />

        <section className={cn("overflow-hidden", dashboardPanelClass, dashboardTableContainerClass)}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
            <p className="text-sm font-semibold text-zinc-950 dark:text-white">
              Order queue
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {data.orders.length} orders shown
            </p>
          </div>

          <Table className={dashboardTableClass}>
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>Order</TableHead>
                <TableHead className={dashboardTableHeadClass}>Customer</TableHead>
                <TableHead className={dashboardTableHeadClass}>Items</TableHead>
                <TableHead className={dashboardTableHeadClass}>Payment</TableHead>
                <TableHead className={dashboardTableHeadClass}>Shipping</TableHead>
                <TableHead className={dashboardTableHeadClass}>Total</TableHead>
                <TableHead className={dashboardTableHeadClass}>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orders.length === 0 ? (
                <TableRow className={dashboardTableRowClass}>
                  <TableCell
                    className={cn("h-28 text-center", dashboardTableCellClass)}
                    colSpan={7}
                  >
                    <span className={dashboardTableMutedTextClass}>
                      No orders have been created yet.
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                data.orders.map((order) => (
                  <TableRow className={dashboardTableRowClass} key={order.id}>
                    <TableCell className={dashboardTableCellClass}>
                      <div className="min-w-0 space-y-1">
                        <Link
                          className={`${dashboardTablePrimaryTextClass} transition hover:text-[#ff5a1f]`}
                          href={`/orders/${order.id}`}
                        >
                          {order.orderNumber ?? `#${shortId(order.id)}`}
                        </Link>
                        <Badge className={cn("rounded-md border-0 capitalize", statusClass(order.status))}>
                          {order.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <div className="min-w-0">
                        <p className={dashboardTablePrimaryTextClass}>
                          {order.customerName ?? "Guest customer"}
                        </p>
                        <p className={dashboardTableSecondaryTextClass}>
                          {order.customerEmail ?? "No email"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <div className="min-w-0">
                        <p className={dashboardTableMutedTextClass}>
                          {order.itemCount} item{order.itemCount === 1 ? "" : "s"} ·{" "}
                          {order.totalQuantity} unit{order.totalQuantity === 1 ? "" : "s"}
                        </p>
                        <p className={dashboardTableSecondaryTextClass}>
                          {order.itemTitles.join(", ") || "No item rows"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <OrderPayments order={order} />
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <OrderShipments order={order} />
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <div className="min-w-0">
                        <p className={dashboardTablePrimaryTextClass}>
                          {formatMoney(order.grandTotal)}
                        </p>
                        <p className={dashboardTableSecondaryTextClass}>
                          Shipping {formatMoney(order.shippingTotal)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTableMutedTextClass}>
                        {formatDate(order.createdAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </>
  );
}
