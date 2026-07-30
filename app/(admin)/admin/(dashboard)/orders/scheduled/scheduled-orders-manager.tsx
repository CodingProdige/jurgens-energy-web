"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  RotateCcwIcon,
} from "lucide-react";

import {
  retryScheduledDeliveryNotificationAction,
  saveScheduledDeliveryPlanAction,
  type ScheduledDeliveryActionState,
  updateScheduledDeliveryStatusAction,
} from "@/app/(admin)/admin/(dashboard)/orders/scheduled/actions";
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
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  AdminLocalDeliveryStatus,
  AdminScheduledOrderRow,
} from "@/src/modules/admin/scheduled-orders";
import {
  canEditJurgensDeliveryPlan,
  getAllowedJurgensDeliveryStatusTransitions,
} from "@/src/modules/orders/jurgens-delivery-workflow";

const pageSizeOptions = [10, 25, 50];
const initialActionState: ScheduledDeliveryActionState = {
  message: "",
  ok: false,
};
const statusLabels: Record<AdminLocalDeliveryStatus, string> = {
  cancelled: "Cancelled",
  completed: "Completed",
  missed: "Missed",
  out_for_delivery: "Out for delivery",
  preparing: "Preparing",
  rescheduled: "Rescheduled",
  scheduled: "Scheduled",
  unscheduled: "Needs a date",
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

function formatDate(value: string | null) {
  return value ? dateFormatter.format(dateToLocalDate(value)) : "Needs admin date";
}

function formatWindow(
  row: Pick<
    AdminScheduledOrderRow,
    "windowEnd" | "windowLabel" | "windowStart"
  >,
) {
  if (!row.windowEnd || !row.windowLabel || !row.windowStart) {
    return "No specific delivery window";
  }

  return `${row.windowLabel} (${row.windowStart}-${row.windowEnd})`;
}

function getTodayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Johannesburg",
    year: "numeric",
  }).format(new Date());
}

function statusClass(status: AdminLocalDeliveryStatus) {
  if (status === "completed") {
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "out_for_delivery") {
    return "bg-blue-500/12 text-blue-700 dark:text-blue-300";
  }

  if (
    status === "cancelled" ||
    status === "missed" ||
    status === "unscheduled"
  ) {
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

function MutationMessage({ state }: { state: ScheduledDeliveryActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={cn(
        "max-w-72 rounded-md px-2.5 py-2 text-xs leading-4",
        state.ok
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200"
          : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-200",
      )}
    >
      {state.message}
    </p>
  );
}

function StatusActionForm({ row }: { row: AdminScheduledOrderRow }) {
  const [state, formAction, pending] = useActionState(
    updateScheduledDeliveryStatusAction,
    initialActionState,
  );

  if (row.status === "unscheduled" || !row.scheduleId) {
    return null;
  }

  const nextStatuses = getAllowedJurgensDeliveryStatusTransitions(
    row.status,
  ).filter((status) => status !== "rescheduled");

  if (nextStatuses.length === 0) {
    return null;
  }

  return (
    <form
      action={formAction}
      className="grid min-w-0 gap-2"
      onSubmit={(event) => {
        const status = new FormData(event.currentTarget).get("status");

        if (
          status === "cancelled" &&
          !window.confirm("Cancel this Jurgens local delivery?")
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="scheduleId" type="hidden" value={row.scheduleId} />
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <select
          aria-label={`Next status for ${row.orderNumber}`}
          className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 text-xs text-zinc-950 shadow-none dark:border-white/18 dark:bg-[#151719] dark:text-white"
          name="status"
        >
          {nextStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
        <Button
          className="h-9 shrink-0 rounded-md px-3 text-xs"
          disabled={pending}
          type="submit"
          variant="outline"
        >
          {pending ? "Updating…" : "Apply status"}
        </Button>
      </div>
      <MutationMessage state={state} />
    </form>
  );
}

function RetryNotificationForm({ row }: { row: AdminScheduledOrderRow }) {
  const [state, formAction, pending] = useActionState(
    retryScheduledDeliveryNotificationAction,
    initialActionState,
  );

  if (!row.scheduleId) {
    return null;
  }

  const notificationPending = row.lastNotifiedStatus !== row.status;

  return (
    <form action={formAction} className="grid gap-2">
      <input name="scheduleId" type="hidden" value={row.scheduleId} />
      <Button
        className="h-9 w-full justify-center rounded-md px-3 text-xs sm:w-auto"
        disabled={pending}
        type="submit"
        variant={notificationPending ? "outline" : "ghost"}
      >
        <RotateCcwIcon className="size-3.5" />
        {pending
          ? "Sending…"
          : notificationPending
            ? "Retry customer update"
            : "Resend customer update"}
      </Button>
      <MutationMessage state={state} />
    </form>
  );
}

function DeliveryActions({
  onPlan,
  row,
}: {
  onPlan: (shipmentId: string) => void;
  row: AdminScheduledOrderRow;
}) {
  const canPlan =
    row.status === "unscheduled" || canEditJurgensDeliveryPlan(row.status);
  const planLabel =
    row.status === "unscheduled"
      ? "Schedule delivery"
      : row.status === "missed"
        ? "Reschedule"
        : "Edit plan";

  return (
    <div className="grid min-w-0 gap-2">
      {canPlan ? (
        <Button
          className={cn(
            "h-9 w-full justify-center rounded-md px-3 text-xs sm:w-auto",
            row.status === "unscheduled" &&
              "bg-[#ff5a1f] text-white hover:bg-[#e64d16]",
          )}
          onClick={() => onPlan(row.shipmentId)}
          type="button"
          variant={row.status === "unscheduled" ? "default" : "outline"}
        >
          <PencilIcon className="size-3.5" />
          {planLabel}
        </Button>
      ) : null}
      <StatusActionForm row={row} />
      <RetryNotificationForm row={row} />
    </div>
  );
}

function DeliveryStatus({ row }: { row: AdminScheduledOrderRow }) {
  const notificationPending =
    Boolean(row.scheduleId) && row.lastNotifiedStatus !== row.status;

  return (
    <div className="min-w-0 space-y-1">
      <Badge className={cn("rounded-md border-0", statusClass(row.status))}>
        {statusLabels[row.status]}
      </Badge>
      <p className={dashboardTableSecondaryTextClass}>
        Shipment: {row.shipmentStatus.replaceAll("_", " ")}
      </p>
      {notificationPending ? (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
          Customer update pending
        </p>
      ) : row.scheduleId ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Customer update sent
        </p>
      ) : null}
    </div>
  );
}

function DeliveryPlanForm({
  onClose,
  row,
  todayIso,
}: {
  onClose: () => void;
  row: AdminScheduledOrderRow;
  todayIso: string;
}) {
  const [state, formAction, pending] = useActionState(
    saveScheduledDeliveryPlanAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="grid gap-4">
        <input name="shipmentId" type="hidden" value={row.shipmentId} />

        <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
          <p className="truncate font-semibold text-zinc-950 dark:text-white">
            {row.orderNumber} · {row.customerName}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {row.itemSummary}
          </p>
        </div>

        <label className="grid gap-1.5">
          <Label htmlFor={`delivery-date-${row.shipmentId}`}>
            Delivery date *
          </Label>
          <Input
            defaultValue={row.scheduledDate ?? todayIso}
            id={`delivery-date-${row.shipmentId}`}
            min={todayIso}
            name="scheduledDate"
            required
            type="date"
          />
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            This is the date staff will actually deliver the Jurgens items.
          </span>
        </label>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1.5">
            <Label htmlFor={`window-start-${row.shipmentId}`}>
              Window start
            </Label>
            <Input
              defaultValue={row.windowStart ?? ""}
              id={`window-start-${row.shipmentId}`}
              name="windowStart"
              type="time"
            />
          </label>
          <label className="grid min-w-0 gap-1.5">
            <Label htmlFor={`window-end-${row.shipmentId}`}>Window end</Label>
            <Input
              defaultValue={row.windowEnd ?? ""}
              id={`window-end-${row.shipmentId}`}
              name="windowEnd"
              type="time"
            />
          </label>
        </div>

        <label className="grid gap-1.5">
          <Label htmlFor={`window-label-${row.shipmentId}`}>
            Window label
          </Label>
          <Input
            defaultValue={row.windowLabel ?? ""}
            id={`window-label-${row.shipmentId}`}
            maxLength={80}
            name="windowLabel"
            placeholder="For example: Morning route"
          />
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            Optional. Start and end times must either both be entered or both be
            blank.
          </span>
        </label>

        <label className="grid gap-1.5">
          <Label htmlFor={`instructions-${row.shipmentId}`}>
            Delivery instructions
          </Label>
          <Textarea
            defaultValue={row.deliveryInstructions ?? ""}
            id={`instructions-${row.shipmentId}`}
            maxLength={2_000}
            name="deliveryInstructions"
            placeholder="Gate access, cylinder exchange notes, route details, or staff instructions"
            rows={4}
          />
        </label>

        <MutationMessage state={state} />
      </DialogBody>
      <DialogFooter>
        <Button disabled={pending} type="submit">
          {pending
            ? "Saving…"
            : row.status === "unscheduled"
              ? "Schedule delivery"
              : row.status === "missed"
                ? "Reschedule delivery"
                : "Save delivery plan"}
        </Button>
        <Button onClick={onClose} type="button" variant="outline">
          Close
        </Button>
      </DialogFooter>
    </form>
  );
}

function MobileDeliveryCard({
  canManage,
  onPlan,
  row,
}: {
  canManage: boolean;
  onPlan: (shipmentId: string) => void;
  row: AdminScheduledOrderRow;
}) {
  return (
    <article className="grid min-w-0 gap-4 border-b border-slate-200 p-4 last:border-b-0 dark:border-white/10">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-950 dark:text-white">
            {formatDate(row.scheduledDate)}
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {formatWindow(row)}
          </p>
        </div>
        <DeliveryStatus row={row} />
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-500">
            Customer
          </p>
          <p className="mt-1 truncate text-sm font-semibold">{row.customerName}</p>
          <p className="break-all text-xs text-slate-500 dark:text-zinc-400">
            {row.customerPhone} · {row.customerEmail}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-500">
            Order
          </p>
          <Link
            className="mt-1 block truncate text-sm font-semibold text-[#d94b17] hover:underline"
            href={`/orders/${row.orderId}`}
          >
            {row.orderNumber}
          </Link>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {formatMoney(row.grandTotal)}
          </p>
        </div>
      </div>

      <div className="min-w-0 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-white/[0.03] dark:text-zinc-300">
        <p>{row.itemSummary}</p>
        {row.deliveryInstructions ? (
          <p className="mt-2 border-t border-slate-200 pt-2 dark:border-white/10">
            {row.deliveryInstructions}
          </p>
        ) : null}
      </div>

      {canManage ? (
        <DeliveryActions onPlan={onPlan} row={row} />
      ) : (
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          View-only access
        </p>
      )}
    </article>
  );
}

export function ScheduledOrdersManager({
  canManage,
  rows,
}: {
  canManage: boolean;
  rows: AdminScheduledOrderRow[];
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [planShipmentId, setPlanShipmentId] = useState<string | null>(null);
  const todayIso = useMemo(() => getTodayIsoDate(), []);
  const [monthCursor, setMonthCursor] = useState(() =>
    dateToLocalDate(todayIso),
  );
  const planRow =
    rows.find((row) => row.shipmentId === planShipmentId) ?? null;
  const scheduleCountByDate = useMemo(() => {
    const countMap = new Map<string, number>();

    for (const row of rows) {
      if (row.scheduledDate) {
        countMap.set(
          row.scheduledDate,
          (countMap.get(row.scheduledDate) ?? 0) + 1,
        );
      }
    }

    return countMap;
  }, [rows]);
  const monthCells = useMemo(() => getMonthDays(monthCursor), [monthCursor]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const pageRows = rows.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );

  function changeMonth(offset: number) {
    setMonthCursor(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <section className={cn("min-w-0 overflow-hidden p-4", dashboardPanelClass)}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDaysIcon className="size-5 shrink-0 text-[#ff5a1f]" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                Delivery calendar
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Actual dates assigned to paid Jurgens local deliveries.
              </p>
            </div>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <DashboardButton
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
              size="icon-sm"
              type="button"
            >
              <ChevronLeftIcon className="size-4" />
            </DashboardButton>
            <span className="min-w-32 text-center text-sm font-semibold">
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
            <DashboardButton
              onClick={() => setMonthCursor(dateToLocalDate(todayIso))}
              size="sm"
              type="button"
            >
              Today
            </DashboardButton>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-7 overflow-hidden rounded-lg border border-slate-200 text-xs dark:border-white/10">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              className="min-w-0 truncate border-b border-slate-200 bg-slate-50 px-1 py-2 text-center font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400 sm:px-2 sm:text-left"
              key={day}
            >
              {day}
            </div>
          ))}
          {monthCells.map((cell, index) => {
            const count = cell.date
              ? (scheduleCountByDate.get(cell.date) ?? 0)
              : 0;
            const isToday = cell.date === todayIso;

            return (
              <div
                className={cn(
                  "relative min-h-16 min-w-0 border-b border-r border-slate-200 p-1.5 dark:border-white/10 sm:min-h-20 sm:p-2",
                  !cell.date && "bg-slate-50/70 dark:bg-white/[0.02]",
                  isToday &&
                    "bg-[#fff3ec] ring-2 ring-inset ring-[#ff5a1f] dark:bg-[#ff5a1f]/12 dark:ring-[#ff7a4b]",
                )}
                key={`${cell.date ?? "empty"}-${index}`}
              >
                {cell.day ? (
                  <>
                    <span
                      className={cn(
                        "inline-grid size-6 place-items-center rounded-full text-xs font-semibold text-zinc-950 dark:text-white",
                        isToday && "bg-[#ff5a1f] text-white shadow-sm",
                      )}
                    >
                      {cell.day}
                    </span>
                    {count > 0 ? (
                      <span
                        aria-label={`${count} local deliveries`}
                        className={cn(
                          "mt-1 block w-fit max-w-full truncate rounded-md bg-[#ff5a1f]/10 px-1.5 py-1 text-[10px] font-semibold text-[#c44511] dark:text-[#ffb196] sm:mt-2 sm:px-2 sm:text-[11px]",
                          isToday &&
                            "bg-[#ff5a1f] text-white dark:text-white",
                        )}
                        title={`${count} local deliveries`}
                      >
                        {count} {count === 1 ? "delivery" : "deliveries"}
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
          "min-w-0 overflow-hidden",
          dashboardPanelClass,
          dashboardTableContainerClass,
        )}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            Local delivery queue
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {rows.length} paid Jurgens deliveries shown. Schedule every row
            marked Needs a date before progressing it.
          </p>
        </div>

        <div className="md:hidden">
          {pageRows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-zinc-400">
              No paid Jurgens local deliveries yet.
            </p>
          ) : (
            pageRows.map((row) => (
              <MobileDeliveryCard
                canManage={canManage}
                key={row.shipmentId}
                onPlan={setPlanShipmentId}
                row={row}
              />
            ))
          )}
        </div>

        <div className="hidden min-w-0 overflow-x-auto md:block">
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
                      No paid Jurgens local deliveries yet.
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => (
                  <TableRow
                    className={dashboardTableRowClass}
                    key={row.shipmentId}
                  >
                    <TableCell className={dashboardTableCellClass}>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            dashboardTablePrimaryTextClass,
                            !row.scheduledDate &&
                              "font-semibold text-red-700 dark:text-red-300",
                          )}
                        >
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
                        <Link
                          className={cn(
                            dashboardTablePrimaryTextClass,
                            "text-[#d94b17] hover:underline",
                          )}
                          href={`/orders/${row.orderId}`}
                        >
                          {row.orderNumber}
                        </Link>
                        <p className={dashboardTableSecondaryTextClass}>
                          {formatMoney(row.grandTotal)}
                        </p>
                        <p className="line-clamp-2 text-xs text-slate-500 dark:text-zinc-400">
                          {row.itemSummary}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <DeliveryStatus row={row} />
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTableMutedTextClass}>
                        {row.zoneName ?? "Direct delivery"}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableActionCellClass}>
                      {canManage ? (
                        <DeliveryActions onPlan={setPlanShipmentId} row={row} />
                      ) : (
                        <span className={dashboardTableMutedTextClass}>
                          View only
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DashboardTablePagination
          currentPage={activePage}
          itemLabel="local deliveries"
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

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPlanShipmentId(null);
          }
        }}
        open={canManage && Boolean(planRow)}
      >
        <DialogContent className="!w-[min(38rem,calc(100vw-2rem))] !max-w-[min(38rem,calc(100vw-2rem))] border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader>
            <DialogTitle>
              {planRow?.status === "unscheduled"
                ? "Schedule local delivery"
                : planRow?.status === "missed"
                  ? "Reschedule local delivery"
                  : "Edit local delivery plan"}
            </DialogTitle>
            <DialogDescription>
              Assign the actual delivery date, optional time window, and route
              instructions. A changed date sends the customer a rescheduled
              update.
            </DialogDescription>
          </DialogHeader>
          {planRow ? (
            <DeliveryPlanForm
              key={planRow.shipmentId}
              onClose={() => setPlanShipmentId(null)}
              row={planRow}
              todayIso={todayIso}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
