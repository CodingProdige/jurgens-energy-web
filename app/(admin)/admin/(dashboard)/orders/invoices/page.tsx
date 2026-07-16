import type { Metadata } from "next";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
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
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { hasAdminCapability } from "@/src/modules/admin/staff";
import {
  listAdminInvoices,
  type InvoiceListRow,
} from "@/src/modules/invoices/access";
import { retryInvoiceDelivery } from "@/app/(admin)/admin/(dashboard)/orders/invoices/actions";

export const metadata: Metadata = {
  title: "Admin Invoices",
  description: "Review and download Jurgens Energy customer invoices.",
  robots: {
    follow: false,
    index: false,
  },
};

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    currency,
    style: "currency",
  }).format(value);
}

function statusClass(status: string) {
  if (["issued", "ready"].includes(status)) {
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }

  if (["failed", "credited"].includes(status)) {
    return "bg-red-500/12 text-red-700 dark:text-red-300";
  }

  return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
}

function InvoiceStatus({ invoice }: { invoice: InvoiceListRow }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      <Badge
        className={cn(
          "rounded-md border-0 capitalize",
          statusClass(invoice.status),
        )}
      >
        {invoice.status.replaceAll("_", " ")}
      </Badge>
      <Badge
        className={cn(
          "rounded-md border-0 capitalize",
          statusClass(invoice.renderStatus),
        )}
      >
        PDF {invoice.renderStatus}
      </Badge>
    </div>
  );
}

export default async function AdminInvoicesPage() {
  const access = await requireAdminCapability("admin.orders.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const invoiceRows = await listAdminInvoices();
  const canManageOrders = hasAdminCapability(
    access.session.user.adminCapabilities,
    "admin.orders.manage",
  );

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={["Orders", "Invoices"]}
        title="Invoices"
      />

      <section
        className={cn(
          "overflow-hidden",
          dashboardPanelClass,
          dashboardTableContainerClass,
        )}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            Invoice register
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {invoiceRows.length} invoice{invoiceRows.length === 1 ? "" : "s"} shown
          </p>
        </div>

        <Table className={dashboardTableClass}>
          <TableHeader>
            <TableRow className={dashboardTableHeaderRowClass}>
              <TableHead className={dashboardTableHeadClass}>Invoice</TableHead>
              <TableHead className={dashboardTableHeadClass}>Order</TableHead>
              <TableHead className={dashboardTableHeadClass}>Customer</TableHead>
              <TableHead className={dashboardTableHeadClass}>Issued</TableHead>
              <TableHead className={dashboardTableHeadClass}>Status</TableHead>
              <TableHead className={dashboardTableHeadClass}>Delivery</TableHead>
              <TableHead className={dashboardTableHeadClass}>Total</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "text-right")}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoiceRows.length === 0 ? (
              <TableRow className={dashboardTableRowClass}>
                <TableCell
                  className={cn("h-28 text-center", dashboardTableCellClass)}
                  colSpan={8}
                >
                  <span className={dashboardTableMutedTextClass}>
                    No invoices have been issued yet.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              invoiceRows.map((invoice) => (
                <TableRow className={dashboardTableRowClass} key={invoice.id}>
                  <TableCell className={dashboardTableCellClass}>
                    <span className={dashboardTablePrimaryTextClass}>
                      {invoice.invoiceNumber}
                    </span>
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <span className={dashboardTableMutedTextClass}>
                      {invoice.orderNumber}
                    </span>
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <div className="min-w-0">
                      <p className={dashboardTablePrimaryTextClass}>
                        {invoice.customerName || "Guest customer"}
                      </p>
                      <p className={dashboardTableSecondaryTextClass}>
                        {invoice.customerEmail || "No email"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <span className={dashboardTableMutedTextClass}>
                      {dateFormatter.format(invoice.issuedAt)}
                    </span>
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <InvoiceStatus invoice={invoice} />
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <div className="grid gap-1 text-xs">
                      <span
                        className={
                          invoice.emailSentAt
                            ? "text-emerald-700 dark:text-emerald-300"
                            : dashboardTableSecondaryTextClass
                        }
                      >
                        Email {invoice.emailSentAt ? "sent" : "not sent"}
                      </span>
                      <span
                        className={
                          invoice.whatsappSentAt
                            ? "text-emerald-700 dark:text-emerald-300"
                            : dashboardTableSecondaryTextClass
                        }
                      >
                        WhatsApp {invoice.whatsappSentAt ? "sent" : "not sent"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <div className="min-w-0">
                      <p className={dashboardTablePrimaryTextClass}>
                        {formatMoney(invoice.totalIncludingTax, invoice.currency)}
                      </p>
                      <p className={dashboardTableSecondaryTextClass}>
                        VAT inclusive
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                    <div className="flex justify-end gap-2">
                      {invoice.renderStatus === "ready" ? (
                        <a
                          aria-label={`Download invoice ${invoice.invoiceNumber}`}
                          className={buttonVariants({
                            className: "gap-1.5",
                            size: "sm",
                            variant: "outline",
                          })}
                          href={`/api/invoices/${invoice.id}/pdf`}
                        >
                          <DownloadIcon className="size-3.5" />
                          Download
                        </a>
                      ) : (
                        <span className={dashboardTableSecondaryTextClass}>
                          {invoice.renderStatus === "failed"
                            ? "Unavailable"
                            : "Preparing"}
                        </span>
                      )}
                      {canManageOrders ? (
                        <form action={retryInvoiceDelivery}>
                          <input name="invoiceId" type="hidden" value={invoice.id} />
                          <button
                            className={buttonVariants({
                              className: "gap-1.5",
                              size: "sm",
                              variant: "outline",
                            })}
                            type="submit"
                          >
                            <RefreshCwIcon className="size-3.5" />
                            Retry delivery
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
