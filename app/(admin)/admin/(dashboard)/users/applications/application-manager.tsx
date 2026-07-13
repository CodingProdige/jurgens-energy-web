"use client";

import { useMemo, useState } from "react";
import {
  DownloadIcon,
  EyeIcon,
  FilterIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import {
  DashboardButton,
  DashboardInput,
  DashboardPageHeader,
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
import {
  DashboardCompactMetrics,
  type DashboardMetricDefinition,
} from "@/components/dashboard/dashboard-compact-metrics";
import { DashboardRowActionMenu } from "@/components/dashboard/dashboard-row-action-menu";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  AdminSellerApplication,
  AdminSellerApplicationsData,
  AdminSellerApplicationStatus,
} from "@/src/modules/users/seller-applications";

type StatusFilter = "all" | AdminSellerApplicationStatus;

function formatDate(date: Date | null) {
  if (!date) {
    return "Not reviewed";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function escapeCsvValue(value: string | number | null) {
  if (value === null) {
    return "";
  }

  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function StatusBadge({ status }: { status: AdminSellerApplicationStatus }) {
  const className =
    status === "approved"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200"
      : status === "rejected"
        ? "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-200"
        : "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200";

  return (
    <Badge className={cn("h-6 rounded-md border-0 px-2 text-xs font-semibold capitalize", className)}>
      {status}
    </Badge>
  );
}

function SellerApplicationFilterPanel({
  activeFilterCount,
  onChangeStatus,
  onClear,
  onClose,
  statusFilter,
}: {
  activeFilterCount: number;
  onChangeStatus: (status: StatusFilter) => void;
  onClear: () => void;
  onClose: () => void;
  statusFilter: StatusFilter;
}) {
  return (
    <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(28rem,calc(100dvh-8rem))] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xl [scrollbar-width:thin] dark:border-white/10 dark:bg-[#151719] md:left-auto md:right-0 md:w-80">
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-[#151719]">
        <div>
          <p className="text-sm font-bold text-zinc-950 dark:text-white">
            Filter applications
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Narrow seller applications by status.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
            disabled={activeFilterCount === 0}
            onClick={onClear}
            type="button"
          >
            Clear
          </Button>
          <Button
            aria-label="Close seller application filters"
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onClose}
            type="button"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
          Status
        </Label>
        <Select
          value={statusFilter}
          onValueChange={(value: string | null) => {
            if (value) {
              onChangeStatus(value as StatusFilter);
            }
          }}
        >
          <SelectTrigger className="h-9 rounded-lg border-slate-300 bg-white text-sm dark:border-white/18 dark:bg-[#151719] dark:text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white">
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-slate-800 dark:text-zinc-200">
        {value || "None"}
      </p>
    </div>
  );
}

function ApplicationDetailsDialog({
  application,
  onOpenChange,
}: {
  application: AdminSellerApplication | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(application)} onOpenChange={onOpenChange}>
      {application ? (
        <DialogContent className="max-w-2xl border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader>
            <DialogTitle>Seller application</DialogTitle>
            <DialogDescription>
              Review submitted seller details for {application.storeName}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid min-w-0 gap-4">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                    {application.storeName}
                  </p>
                  <p className="truncate text-sm text-slate-600 dark:text-zinc-400">
                    {application.email}
                  </p>
                </div>
                <StatusBadge status={application.status} />
              </div>
            </div>
            <div className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10 sm:grid-cols-2">
              <DetailRow label="Applicant" value={application.fullName ?? application.userName} />
              <DetailRow label="Account email" value={application.userEmail} />
              <DetailRow label="Store slug" value={application.storeSlug} />
              <DetailRow label="Business type" value={application.businessType} />
              <DetailRow label="Phone" value={application.phone} />
              <DetailRow label="Country / region" value={application.countryRegion} />
              <DetailRow label="Address" value={application.addressLine1} />
              <DetailRow label="Address line 2" value={application.addressLine2} />
              <DetailRow label="City" value={application.city} />
              <DetailRow label="State / province" value={application.stateProvince} />
              <DetailRow label="Postal code" value={application.postalCode} />
              <DetailRow label="Submitted" value={formatDate(application.createdAt)} />
              <DetailRow label="Reviewed" value={formatDate(application.reviewedAt)} />
              <DetailRow label="Rejection reason" value={application.rejectionReason} />
            </div>
          </DialogBody>
          <DialogFooter showCloseButton />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function SellerApplicationManager({
  applications,
  approvedCount,
  pendingCount,
  rejectedCount,
  totalCount,
}: AdminSellerApplicationsData) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [detailsApplication, setDetailsApplication] =
    useState<AdminSellerApplication | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const activeFilterCount = statusFilter === "all" ? 0 : 1;
  const metrics = useMemo<DashboardMetricDefinition[]>(
    () => [
      {
        color: "blue",
        description: "All submitted seller applications.",
        id: "total",
        label: "Applications",
        value: totalCount,
      },
      {
        color: "amber",
        description: "Seller applications waiting for admin review.",
        id: "pending",
        label: "Pending",
        value: pendingCount,
      },
      {
        color: "emerald",
        description: "Seller applications approved by an admin.",
        id: "approved",
        label: "Approved",
        value: approvedCount,
      },
      {
        color: "red",
        description: "Seller applications rejected by an admin.",
        id: "rejected",
        label: "Rejected",
        value: rejectedCount,
      },
    ],
    [approvedCount, pendingCount, rejectedCount, totalCount],
  );
  const filteredApplications = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return applications.filter((application) => {
      const matchesSearch =
        !normalizedTerm ||
        application.storeName.toLowerCase().includes(normalizedTerm) ||
        application.storeSlug.toLowerCase().includes(normalizedTerm) ||
        application.email.toLowerCase().includes(normalizedTerm) ||
        application.fullName?.toLowerCase().includes(normalizedTerm) ||
        application.userEmail?.toLowerCase().includes(normalizedTerm);
      const matchesStatus =
        statusFilter === "all" || application.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [applications, searchTerm, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedApplications = filteredApplications.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );

  function clearFilters() {
    setStatusFilter("all");
  }

  function exportApplications() {
    const rows = filteredApplications.map((application) => [
      application.storeName,
      application.storeSlug,
      application.email,
      application.fullName ?? application.userName ?? "",
      application.businessType,
      application.countryRegion,
      application.status,
      formatDate(application.createdAt),
      formatDate(application.reviewedAt),
    ]);
    const csv = [
      [
        "Store",
        "Slug",
        "Email",
        "Applicant",
        "Business type",
        "Country",
        "Status",
        "Submitted",
        "Reviewed",
      ],
      ...rows,
    ]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `seller-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <DashboardPageHeader
        breadcrumbs={["Users & Access", "Seller applications"]}
        title="Seller applications"
      />

      <DashboardCompactMetrics
        metrics={metrics}
        storageKey="piessang:admin:seller-application-metrics"
      />

      <section className="mt-4 grid gap-3 md:mt-5 md:flex md:items-center md:justify-between">
        <div className="relative w-full md:max-w-[420px]">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <DashboardInput
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search applications"
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
          <div className="relative min-w-0">
            <DashboardButton
              className="w-full md:w-auto"
              onClick={() => setIsFilterPanelOpen((isOpen) => !isOpen)}
              type="button"
            >
              <FilterIcon className="size-3.5" />
              Filter
              {activeFilterCount > 0 ? (
                <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-admin-primary px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </DashboardButton>
            {isFilterPanelOpen ? (
              <>
                <button
                  aria-label="Close seller application filters"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setIsFilterPanelOpen(false)}
                  type="button"
                />
                <SellerApplicationFilterPanel
                  activeFilterCount={activeFilterCount}
                  onChangeStatus={(status) => {
                    setStatusFilter(status);
                    setCurrentPage(1);
                  }}
                  onClear={clearFilters}
                  onClose={() => setIsFilterPanelOpen(false)}
                  statusFilter={statusFilter}
                />
              </>
            ) : null}
          </div>
          <DashboardButton
            className="w-full md:w-auto"
            disabled={filteredApplications.length === 0}
            onClick={exportApplications}
            type="button"
          >
            <DownloadIcon className="size-3.5" />
            Export
          </DashboardButton>
        </div>
      </section>

      <section
        className={cn("mt-5", dashboardTableContainerClass, dashboardPanelClass)}
      >
        <Table className={dashboardTableClass}>
          <TableHeader>
            <TableRow className={dashboardTableHeaderRowClass}>
              <TableHead className={dashboardTableHeadClass}>Application</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                Applicant
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                Status
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                Region
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                Submitted
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, dashboardTableActionHeadClass)}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedApplications.length > 0 ? (
              paginatedApplications.map((application) => (
                <TableRow key={application.id} className={dashboardTableRowClass}>
                  <TableCell className={cn("min-w-0", dashboardTableCellClass)}>
                    <p className={dashboardTablePrimaryTextClass}>
                      {application.storeName}
                    </p>
                    <p className={dashboardTableSecondaryTextClass}>
                      {application.storeSlug}
                    </p>
                    <p className={cn("mt-1 truncate md:hidden", dashboardTableSecondaryTextClass)}>
                      {application.email} · {application.status}
                    </p>
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <p className={dashboardTableMutedTextClass}>
                      {application.fullName ?? application.userName ?? "Unnamed applicant"}
                    </p>
                    <p className={dashboardTableSecondaryTextClass}>
                      {application.email}
                    </p>
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <StatusBadge status={application.status} />
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <span className={dashboardTableMutedTextClass}>
                      {application.countryRegion}
                    </span>
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <span className={dashboardTableMutedTextClass}>
                      {formatDate(application.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell className={dashboardTableActionCellClass}>
                    <div className="flex justify-end gap-1 md:gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
                        aria-label={`View ${application.storeName}`}
                        onClick={() => setDetailsApplication(application)}
                        type="button"
                      >
                        <EyeIcon className="size-4" />
                      </Button>
                      <DashboardRowActionMenu
                        ariaLabel={`Open actions for ${application.storeName}`}
                      >
                        <button
                          className="flex h-12 w-full items-center gap-3 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 dark:text-zinc-100 dark:hover:bg-white/[0.06]"
                          onClick={() => setDetailsApplication(application)}
                          type="button"
                        >
                          <EyeIcon className="size-4" />
                          View details
                        </button>
                      </DashboardRowActionMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 px-5 text-center text-sm text-slate-500 dark:text-zinc-400"
                >
                  No seller applications match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <DashboardTablePagination
          currentPage={activePage}
          itemLabel="applications"
          pageSize={pageSize}
          totalItems={filteredApplications.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setCurrentPage(1);
          }}
        />
      </section>

      <ApplicationDetailsDialog
        application={detailsApplication}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsApplication(null);
          }
        }}
      />
    </div>
  );
}
