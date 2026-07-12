"use client";

import { useMemo, useState } from "react";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

import { updateScheduledDeliveryStatusAction } from "@/app/(admin)/admin/(dashboard)/orders/scheduled/actions";
import {
  DashboardButton,
  DashboardTablePagination,
  dashboardPanelClass,
  dashboardTableActionCellClass,
  dashboardTableActionHeadClass,
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
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AdminScheduledOrderRow } from "@/src/modules/admin/scheduled-orders";

const pageSizeOptions = [10, 25, 50];
const statusOptions = [
  "scheduled",
  "preparing",
  "out_for_delivery",
  "completed",
  "missed",
  "rescheduled",
  "cancelled",
] as const;

const statusLabels: Record<(typeof statusOptions)[number], string> = {
  cancelled: "Cancelled",
  completed: "Completed",
  missed: "Missed",
  out_for_delivery: "Out for delivery",
  preparing: "Preparing",
  rescheduled: "Rescheduled",
  scheduled: "Scheduled",
};

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeZone: "Africa/Johannesburg",
});

function formatMoney(value: string) {
  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    style: "currency",
  }).format(Number(value) || 0);
}

function dateToLocalDate(value: string) {
  return new Date(`${value}T00:00:00+02:00`);
}

function formatDate(value: string) {
  return dateFormatter.format(dateToLocalDate(value));
}

function formatWindow(row: Pick<AdminScheduledOrderRow, "windowEnd" | "windowLabel" | "windowStart">) {
  return `${row.windowLabel} (${row.windowStart}-${row.windowEnd})`;
}

function statusClass(status: string) {
  if (status === "completed") {
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "out_for_delivery") {
    return "bg-blue-500/12 text-blue-700 dark:text-blue-300";
  }

  if (status === "cancelled" || status === "missed") {
    return "bg-red-500/12 text-red-700 dark:text-red-300";
  }

  return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
}

function getMonthDays(monthCursor: Date) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: string | null; day: number | null }> = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push({ date: null, day: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const iso = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    cells.push({ date: iso, day });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null });
  }

  return cells;
}

function monthLabel(monthCursor: Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
  }).format(monthCursor);
}

export function ScheduledOrdersManager({
  rows,
}: {
  rows: AdminScheduledOrderRow[];
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [monthCursor, setMonthCursor] = useState(() => {
    const firstDate = rows[0]?.scheduledDate;

    return firstDate ? dateToLocalDate(firstDate) : new Date();
  });
  const scheduleCountByDate = useMemo(() => {
    const countMap = new Map<string, number>();

    for (const row of rows) {
      countMap.set(row.scheduledDate, (countMap.get(row.scheduledDate) ?? 0) + 1);
    }

    return countMap;
  }, [rows]);
  const monthCells = useMemo(() => getMonthDays(monthCursor), [monthCursor]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const pageRows = rows.slice((activePage - 1) * pageSize, activePage * pageSize);

  function changeMonth(offset: number) {
    setMonthCursor(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  return (
    <div className="grid gap-4">
      <section className={cn("overflow-hidden p-4", dashboardPanelClass)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDaysIcon className="size-5 text-[#ff5a1f]" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                Delivery calendar
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Jurgens direct-delivery load by selected delivery date.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DashboardButton
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
              size="icon-sm"
              type="button"
            >
              <ChevronLeftIcon className="size-4" />
            </DashboardButton>
            <span className="min-w-36 text-center text-sm font-semibold">
              {monthLabel(monthCursor)}
            </span>
            <DashboardButton
              aria-label="Next month"
              onClick={() => changeMonth(1)}
              size="icon-sm"
              type="button"
            >
              <ChevronRightIcon className="size-4" />
            </DashboardButton>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 text-xs dark:border-white/10">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              className="border-b border-slate-200 bg-slate-50 px-2 py-2 font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400"
              key={day}
            >
              {day}
            </div>
          ))}
          {monthCells.map((cell, index) => {
            const count = cell.date ? scheduleCountByDate.get(cell.date) ?? 0 : 0;

            return (
              <div
                className={cn(
                  "min-h-20 border-b border-r border-slate-200 p-2 dark:border-white/10",
                  !cell.date && "bg-slate-50/70 dark:bg-white/[0.02]",
                )}
                key={`${cell.date ?? "empty"}-${index}`}
              >
                {cell.day ? (
                  <>
                    <span className="text-xs font-semibold text-zinc-950 dark:text-white">
                      {cell.day}
                    </span>
                    {count > 0 ? (
                      <span className="mt-2 block w-fit rounded-md bg-[#ff5a1f]/10 px-2 py-1 text-[11px] font-semibold text-[#c44511] dark:text-[#ffb196]">
                        {count} scheduled
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section
        className={cn(
          "overflow-hidden",
          dashboardPanelClass,
          dashboardTableContainerClass,
        )}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            Scheduled delivery queue
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {rows.length} Jurgens direct deliveries shown.
          </p>
        </div>

        <Table className={dashboardTableClass}>
          <TableHeader>
            <TableRow className={dashboardTableHeaderRowClass}>
              <TableHead className={dashboardTableHeadClass}>Delivery</TableHead>
              <TableHead className={dashboardTableHeadClass}>Customer</TableHead>
              <TableHead className={dashboardTableHeadClass}>Order</TableHead>
              <TableHead className={dashboardTableHeadClass}>Status</TableHead>
              <TableHead className={dashboardTableHeadClass}>Zone</TableHead>
              <TableHead className={dashboardTableActionHeadClass}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow className={dashboardTableRowClass}>
                <TableCell
                  className={cn("h-28 text-center", dashboardTableCellClass)}
                  colSpan={6}
                >
                  <span className={dashboardTableMutedTextClass}>
                    No scheduled Jurgens deliveries yet.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow className={dashboardTableRowClass} key={row.scheduleId}>
                  <TableCell className={dashboardTableCellClass}>
                    <div className="min-w-0">
                      <p className={dashboardTablePrimaryTextClass}>
                        {formatDate(row.scheduledDate)}
                      </p>
                      <p className={dashboardTableSecondaryTextClass}>
                        {formatWindow(row)}
                      </p>
                      {row.deliveryInstructions ? (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-zinc-400">
                          {row.deliveryInstructions}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <div className="min-w-0">
                      <p className={dashboardTablePrimaryTextClass}>
                        {row.customerName}
                      </p>
                      <p className={dashboardTableSecondaryTextClass}>
                        {row.customerPhone}
                      </p>
                      <p className={dashboardTableSecondaryTextClass}>
                        {row.customerEmail}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <div className="min-w-0">
                      <p className={dashboardTablePrimaryTextClass}>
                        {row.orderNumber}
                      </p>
                      <p className={dashboardTableSecondaryTextClass}>
                        {formatMoney(row.grandTotal)}
                      </p>
                      <p className="line-clamp-2 text-xs text-slate-500 dark:text-zinc-400">
                        {row.itemSummary}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <div className="min-w-0 space-y-1">
                      <Badge
                        className={cn(
                          "rounded-md border-0",
                          statusClass(row.status),
                        )}
                      >
                        {statusLabels[row.status]}
                      </Badge>
                      {row.shipmentStatus ? (
                        <p className={dashboardTableSecondaryTextClass}>
                          Shipment: {row.shipmentStatus.replaceAll("_", " ")}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <span className={dashboardTableMutedTextClass}>
                      {row.zoneName ?? "Direct delivery"}
                    </span>
                  </TableCell>
                  <TableCell className={dashboardTableActionCellClass}>
                    <form
                      action={updateScheduledDeliveryStatusAction}
                      className="flex min-w-0 flex-col items-end gap-2"
                    >
                      <input
                        name="scheduleId"
                        type="hidden"
                        value={row.scheduleId}
                      />
                      <select
                        className="h-8 w-36 rounded-md border border-slate-300 bg-white px-2 text-xs text-zinc-950 shadow-none dark:border-white/18 dark:bg-[#151719] dark:text-white"
                        defaultValue={row.status}
                        name="status"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {statusLabels[status]}
                          </option>
                        ))}
                      </select>
                      <Button
                        className="h-8 rounded-md px-3 text-xs"
                        type="submit"
                        variant="outline"
                      >
                        Update
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <DashboardTablePagination
          currentPage={activePage}
          itemLabel="scheduled deliveries"
          onPageChange={setCurrentPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setCurrentPage(1);
          }}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalItems={rows.length}
        />
      </section>
    </div>
  );
}
