"use client";

import { useActionState, useMemo, useState } from "react";
import {
  CheckIcon,
  DownloadIcon,
  MoreVerticalIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import {
  approveBrandRequest,
  deleteBrandRequest,
  rejectBrandRequest,
  type BrandRequestMutationState,
} from "@/app/(admin)/admin/(dashboard)/brand-requests/actions";
import {
  DashboardButton,
  DashboardInput,
  DashboardMetricStrip,
  DashboardPageHeader,
  DashboardTablePagination,
  dashboardPanelClass,
  dashboardTableCellClass,
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AdminBrandRequest } from "@/src/modules/catalog/admin";

type BrandRequestDashboardProps = {
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  requests: AdminBrandRequest[];
  totalCount: number;
};

type RequestStatusFilter = "all" | "pending" | "approved" | "rejected";

const initialState: BrandRequestMutationState = {};
const adminPrimaryClass =
  "bg-[#c4982d] text-white shadow-[#c4982d]/20 hover:bg-[#a87920]";
const modalContentClass =
  "max-w-xl border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white";
const modalTextareaClass =
  "min-h-24 border-slate-300 bg-white text-zinc-950 placeholder:text-slate-400 focus-visible:border-[#c4982d] focus-visible:ring-[#c4982d]/20 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500";
const modalSelectContentClass =
  "border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white";
const modalSelectItemClass =
  "cursor-pointer px-2 py-2 text-zinc-800 focus:bg-slate-100 focus:text-zinc-950 dark:text-zinc-200 dark:focus:bg-white/10 dark:focus:text-white";

function formatDate(date: Date | null) {
  if (!date) {
    return "-";
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

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function RequestMessage({ state }: { state: BrandRequestMutationState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={cn(
        "rounded-lg border p-3 text-sm",
        state.ok
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
      )}
    >
      {state.message}
    </p>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-md border-0 px-2 text-xs font-semibold",
        status === "pending" && "bg-amber-100 text-amber-700",
        status === "approved" && "bg-emerald-100 text-emerald-700",
        status === "rejected" && "bg-red-100 text-red-700",
      )}
    >
      {status[0]?.toUpperCase()}
      {status.slice(1)}
    </Badge>
  );
}

function ApproveRequestForm({ request }: { request: AdminBrandRequest }) {
  const [state, formAction, isPending] = useActionState(
    approveBrandRequest,
    initialState,
  );

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="id" value={request.id} />
      <DialogBody className="grid gap-4">
        <RequestMessage state={state} />
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          Approving <strong>{request.brandName}</strong> creates the approved
          brand if it does not already exist, then links this request to it.
        </div>
      </DialogBody>
      <DialogFooter className="border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#101214]/95">
        <Button
          type="submit"
          disabled={isPending}
          className={cn("h-10 rounded-lg px-4", adminPrimaryClass)}
        >
          <CheckIcon className="size-4" />
          {isPending ? "Approving..." : "Approve request"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RejectRequestForm({ request }: { request: AdminBrandRequest }) {
  const [state, formAction, isPending] = useActionState(
    rejectBrandRequest,
    initialState,
  );

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="id" value={request.id} />
      <DialogBody className="grid gap-4">
        <div className="grid gap-2">
          <Label className="text-sm font-semibold text-zinc-900 dark:text-white">
            Rejection reason
          </Label>
          <Textarea
            name="rejectionReason"
            required
            minLength={2}
            maxLength={500}
            className={modalTextareaClass}
          />
        </div>
        <RequestMessage state={state} />
      </DialogBody>
      <DialogFooter className="border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#101214]/95">
        <Button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-lg bg-red-600 px-4 text-white hover:bg-red-700"
        >
          <XIcon className="size-4" />
          {isPending ? "Rejecting..." : "Reject request"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteRequestForm({ request }: { request: AdminBrandRequest }) {
  const [state, formAction, isPending] = useActionState(
    deleteBrandRequest,
    initialState,
  );

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="id" value={request.id} />
      <DialogBody className="grid gap-4">
        <RequestMessage state={state} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
          This permanently deletes the request for{" "}
          <strong>{request.brandName}</strong>. It does not delete any approved
          brand.
        </div>
      </DialogBody>
      <DialogFooter className="border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#101214]/95">
        <Button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-lg bg-red-600 px-4 text-white hover:bg-red-700"
        >
          <Trash2Icon className="size-4" />
          {isPending ? "Deleting..." : "Delete request"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function BrandRequestDashboard({
  approvedCount,
  pendingCount,
  rejectedCount,
  requests,
  totalCount,
}: BrandRequestDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>("all");
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [approveRequest, setApproveRequest] = useState<AdminBrandRequest | null>(null);
  const [rejectRequest, setRejectRequest] = useState<AdminBrandRequest | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<AdminBrandRequest | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRequests = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesSearch =
        !normalizedTerm ||
        request.brandName.toLowerCase().includes(normalizedTerm) ||
        request.slug.toLowerCase().includes(normalizedTerm) ||
        request.sellerName?.toLowerCase().includes(normalizedTerm) ||
        request.requestedByEmail?.toLowerCase().includes(normalizedTerm);
      const matchesStatus =
        statusFilter === "all" || request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const pageRequests = filteredRequests.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );

  function exportRequestsCsv() {
    const headers = [
      "Brand Name",
      "Slug",
      "Status",
      "Seller",
      "Requested By",
      "Website URL",
      "Notes",
      "Rejection Reason",
      "Created At",
      "Reviewed At",
    ];
    const rows = filteredRequests.map((request) => [
      request.brandName,
      request.slug,
      request.status,
      request.sellerName,
      request.requestedByEmail,
      request.websiteUrl,
      request.notes,
      request.rejectionReason,
      formatDate(request.createdAt),
      formatDate(request.reviewedAt),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `piessang-brand-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <DashboardPageHeader
        title="Brand requests"
        breadcrumbs={["Catalog", "Brand requests"]}
      />

      <div className="grid gap-4">
        <DashboardMetricStrip
          metrics={[
            { label: "Pending", value: pendingCount },
            { label: "Approved", value: approvedCount },
            { label: "Rejected", value: rejectedCount },
          ]}
        />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <DashboardInput
              value={searchTerm}
              onChange={(event) => {
                setCurrentPage(1);
                setSearchTerm(event.target.value);
              }}
              placeholder="Search brand requests..."
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
            <Select
              value={statusFilter}
              onValueChange={(value: string | null) => {
                setCurrentPage(1);
                setStatusFilter(value as RequestStatusFilter);
              }}
            >
              <SelectTrigger className="h-8 rounded-md border-slate-300 bg-white text-xs dark:border-white/18 dark:bg-[#151719] dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={modalSelectContentClass}>
                <SelectItem value="all" className={modalSelectItemClass}>
                  All statuses
                </SelectItem>
                <SelectItem value="pending" className={modalSelectItemClass}>
                  Pending
                </SelectItem>
                <SelectItem value="approved" className={modalSelectItemClass}>
                  Approved
                </SelectItem>
                <SelectItem value="rejected" className={modalSelectItemClass}>
                  Rejected
                </SelectItem>
              </SelectContent>
            </Select>
            <DashboardButton onClick={exportRequestsCsv} type="button">
              <DownloadIcon className="size-3.5" />
              Export
            </DashboardButton>
          </div>
        </div>

        <section className={cn(dashboardPanelClass, "overflow-visible [&_[data-slot=table-container]]:overflow-visible")}>
          <Table className="table-fixed md:table-auto">
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>
                  Brand
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                  Seller
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                  Status
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden lg:table-cell")}>
                  Requested At
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "w-[86px] pr-4 text-right md:w-auto md:pr-5")}>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRequests.map((request) => (
                <TableRow
                  key={request.id}
                  className={dashboardTableRowClass}
                >
                  <TableCell className={cn("min-w-0", dashboardTableCellClass)}>
                    <p className={cn("truncate", dashboardTablePrimaryTextClass)}>
                      {request.brandName}
                    </p>
                    <p className={cn("truncate", dashboardTableSecondaryTextClass)}>
                      {request.websiteUrl || request.slug}
                    </p>
                  </TableCell>
                  <TableCell className={cn("hidden max-w-[220px] truncate md:table-cell", dashboardTableCellClass, dashboardTableMutedTextClass)}>
                    {request.sellerName ?? request.requestedByEmail ?? "Unknown"}
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <StatusBadge status={request.status} />
                  </TableCell>
                  <TableCell className={cn("hidden lg:table-cell", dashboardTableCellClass, dashboardTableMutedTextClass)}>
                    {formatDate(request.createdAt)}
                  </TableCell>
                  <TableCell className="w-[86px] pr-4 text-right md:w-auto md:pr-5">
                    <div className="relative inline-flex items-center">
                      <Button
                        aria-label={`Open actions for ${request.brandName}`}
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
                        onClick={() =>
                          setOpenActionId((current) =>
                            current === request.id ? null : request.id,
                          )
                        }
                        type="button"
                      >
                        <MoreVerticalIcon className="size-4" />
                      </Button>
                      {openActionId === request.id ? (
                        <div className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xl dark:border-white/10 dark:bg-[#151719]">
                          <button
                            type="button"
                            disabled={request.status !== "pending"}
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-zinc-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-zinc-200 dark:hover:bg-white/10"
                            onClick={() => {
                              setApproveRequest(request);
                              setOpenActionId(null);
                            }}
                          >
                            <CheckIcon className="size-4" />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={request.status !== "pending"}
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-zinc-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-zinc-200 dark:hover:bg-white/10"
                            onClick={() => {
                              setRejectRequest(request);
                              setOpenActionId(null);
                            }}
                          >
                            <XIcon className="size-4" />
                            Reject
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 border-t border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                            onClick={() => {
                              setDeleteRequest(request);
                              setOpenActionId(null);
                            }}
                          >
                            <Trash2Icon className="size-4" />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <DashboardTablePagination
            currentPage={activePage}
            itemLabel="requests"
            pageSize={pageSize}
            totalItems={filteredRequests.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setCurrentPage(1);
              setPageSize(nextPageSize);
            }}
          />
        </section>
      </div>

      <Dialog open={Boolean(approveRequest)} onOpenChange={(open) => !open && setApproveRequest(null)}>
        <DialogContent className={modalContentClass}>
          <DialogHeader>
            <DialogTitle>Approve brand request</DialogTitle>
            <DialogDescription>
              Add this brand to the approved catalog list.
            </DialogDescription>
          </DialogHeader>
          {approveRequest ? <ApproveRequestForm request={approveRequest} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejectRequest)} onOpenChange={(open) => !open && setRejectRequest(null)}>
        <DialogContent className={modalContentClass}>
          <DialogHeader>
            <DialogTitle>Reject brand request</DialogTitle>
            <DialogDescription>
              Give the seller a clear reason for the rejection.
            </DialogDescription>
          </DialogHeader>
          {rejectRequest ? <RejectRequestForm request={rejectRequest} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteRequest)} onOpenChange={(open) => !open && setDeleteRequest(null)}>
        <DialogContent className={modalContentClass}>
          <DialogHeader>
            <DialogTitle>Delete brand request</DialogTitle>
            <DialogDescription>
              Remove this request from the review queue.
            </DialogDescription>
          </DialogHeader>
          {deleteRequest ? <DeleteRequestForm request={deleteRequest} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
