"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CheckIcon,
  EyeOffIcon,
  SearchIcon,
  StarIcon,
  XIcon,
} from "lucide-react";

import {
  approveCustomerProductReview,
  hideCustomerProductReview,
  rejectCustomerProductReview,
} from "@/app/(admin)/admin/(dashboard)/products/reviews/actions";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  AdminCustomerReviewRow,
  AdminCustomerReviewsData,
  AdminCustomerReviewStatus,
} from "@/src/modules/admin/customer-reviews";

type StatusFilter = "all" | AdminCustomerReviewStatus;

const statusLabels: Record<StatusFilter, string> = {
  all: "All statuses",
  approved: "Approved",
  hidden: "Hidden",
  pending: "Pending",
  rejected: "Rejected",
};

function formatDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeZone: "Africa/Johannesburg",
  }).format(value);
}

function formatRatingMetric(value: number | null) {
  if (value === null) {
    return 0;
  }

  return Number.isInteger(value) ? value : Math.round(value * 10) / 10;
}

function StatusBadge({ status }: { status: AdminCustomerReviewStatus }) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-md border-0 px-2 text-xs font-bold",
        status === "pending" && "bg-amber-100 text-amber-700",
        status === "approved" && "bg-emerald-100 text-emerald-700",
        status === "rejected" && "bg-red-100 text-red-700",
        status === "hidden" && "bg-slate-200 text-slate-700",
      )}
    >
      {statusLabels[status]}
    </Badge>
  );
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span
      aria-label={`${rating} out of 5 stars`}
      className="inline-flex items-center gap-0.5 text-[#ff5a1f]"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <StarIcon
          aria-hidden="true"
          className={cn("size-3.5", index < rating && "fill-current")}
          key={index}
        />
      ))}
    </span>
  );
}

function ReviewModerationForms({
  canManage,
  review,
}: {
  canManage: boolean;
  review: AdminCustomerReviewRow;
}) {
  if (!canManage) {
    return (
      <p className="text-right text-xs text-slate-500 dark:text-zinc-400">
        View only
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {review.status !== "approved" ? (
        <form action={approveCustomerProductReview}>
          <input name="reviewId" type="hidden" value={review.id} />
          <DashboardButton
            className="h-8 border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            type="submit"
          >
            <CheckIcon className="size-3.5" />
            Approve
          </DashboardButton>
        </form>
      ) : null}

      {review.status !== "rejected" ? (
        <form action={rejectCustomerProductReview} className="grid justify-items-end gap-2">
          <input name="reviewId" type="hidden" value={review.id} />
          <Textarea
            className="min-h-16 w-48 resize-none rounded-md border-slate-300 bg-white text-xs dark:border-white/18 dark:bg-[#151719]"
            maxLength={1000}
            name="reason"
            placeholder="Optional rejection note"
          />
          <DashboardButton
            className="h-8 border-red-500/30 text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
            type="submit"
          >
            <XIcon className="size-3.5" />
            Reject
          </DashboardButton>
        </form>
      ) : null}

      {review.status === "approved" ? (
        <form action={hideCustomerProductReview}>
          <input name="reviewId" type="hidden" value={review.id} />
          <DashboardButton
            className="h-8 border-slate-400/40 text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-white/10"
            type="submit"
          >
            <EyeOffIcon className="size-3.5" />
            Hide
          </DashboardButton>
        </form>
      ) : null}
    </div>
  );
}

export function ProductReviewManager({
  canManage,
  data,
}: {
  canManage: boolean;
  data: AdminCustomerReviewsData;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredReviews = useMemo(
    () =>
      data.reviews.filter((review) => {
        if (status !== "all" && review.status !== status) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [
          review.body,
          review.brandName,
          review.customerDisplayName,
          review.customerEmail,
          review.customerName,
          review.orderNumber,
          review.productTitle,
          review.title,
          review.variantTitle,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      }),
    [data.reviews, normalizedQuery, status],
  );
  const pageCount = Math.max(1, Math.ceil(filteredReviews.length / pageSize));
  const activePage = Math.min(page, pageCount);
  const pageReviews = filteredReviews.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );
  const metrics: DashboardMetricDefinition[] = [
    {
      color: "slate",
      description: "Customer-submitted product reviews across every status.",
      id: "reviews",
      label: "Reviews",
      value: data.metrics.reviews,
    },
    {
      color: "amber",
      description:
        "Reviews waiting for admin moderation before they appear publicly.",
      id: "pending",
      label: "Pending",
      value: data.metrics.pending,
    },
    {
      color: "emerald",
      description:
        "Approved reviews currently counted in storefront rating averages.",
      id: "approved",
      label: "Approved",
      value: data.metrics.approved,
    },
    {
      color: "#ff5a1f",
      description: "Average rating across approved reviews.",
      id: "average-rating",
      label: "Avg rating",
      value: formatRatingMetric(data.metrics.averageRating),
    },
  ];

  return (
    <div className="grid gap-5">
      <DashboardPageHeader
        breadcrumbs={["Admin", "Products", "Reviews"]}
        title="Product Reviews"
      />

      <DashboardCompactMetrics
        metrics={metrics}
        storageKey="jurgens-energy:admin-product-reviews-metrics"
      />

      <section className={cn(dashboardPanelClass, "overflow-hidden")}>
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-white/10 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="relative min-w-0">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <DashboardInput
              className="pl-9"
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder="Search product, customer, order or review..."
              value={query}
            />
          </label>
          <Select
            value={status}
            onValueChange={(value) => {
              setPage(1);
              setStatus((value as StatusFilter | null) ?? "all");
            }}
          >
            <SelectTrigger className="h-10 rounded-lg border-slate-300 bg-white text-sm dark:border-white/18 dark:bg-[#151719]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white">
              {(Object.keys(statusLabels) as StatusFilter[]).map((value) => (
                <SelectItem
                  className="cursor-pointer px-2 py-2 text-zinc-800 focus:bg-slate-100 focus:text-zinc-950 dark:text-zinc-200 dark:focus:bg-white/10 dark:focus:text-white"
                  key={value}
                  value={value}
                >
                  {statusLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={cn("overflow-x-auto", dashboardTableContainerClass)}>
          <Table className={dashboardTableClass}>
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>Review</TableHead>
                <TableHead className={dashboardTableHeadClass}>Customer</TableHead>
                <TableHead className={dashboardTableHeadClass}>Product</TableHead>
                <TableHead className={dashboardTableHeadClass}>Status</TableHead>
                <TableHead className={dashboardTableActionHeadClass}>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageReviews.length > 0 ? (
                pageReviews.map((review) => (
                  <TableRow className={dashboardTableRowClass} key={review.id}>
                    <TableCell className={cn(dashboardTableCellClass, "align-top")}>
                      <div className="grid max-w-xl gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <ReviewStars rating={review.rating} />
                          <span className={dashboardTableSecondaryTextClass}>
                            {formatDate(review.createdAt)}
                          </span>
                          {review.isVerifiedPurchase ? (
                            <Badge className="h-5 rounded-md border-0 bg-emerald-100 px-1.5 text-[10px] font-black text-emerald-700">
                              Verified purchase
                            </Badge>
                          ) : null}
                        </div>
                        {review.title ? (
                          <p className={dashboardTablePrimaryTextClass}>
                            {review.title}
                          </p>
                        ) : null}
                        <p className={dashboardTableMutedTextClass}>
                          {review.body || "No written review supplied."}
                        </p>
                        {review.rejectedReason ? (
                          <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-700 dark:text-red-300">
                            {review.rejectedReason}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "align-top")}>
                      <div className="min-w-0">
                        <p className={dashboardTablePrimaryTextClass}>
                          {review.customerDisplayName ??
                            review.customerName ??
                            "Customer"}
                        </p>
                        <p className={dashboardTableSecondaryTextClass}>
                          {review.customerEmail ?? "No email"}
                        </p>
                        {review.orderId && review.orderNumber ? (
                          <Link
                            className="mt-1 inline-flex text-xs font-bold text-[#ff5a1f] hover:underline"
                            href={`/orders/${review.orderId}`}
                          >
                            {review.orderNumber}
                          </Link>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "align-top")}>
                      <div className="min-w-0">
                        <Link
                          className={cn(
                            dashboardTablePrimaryTextClass,
                            "hover:text-[#ff5a1f]",
                          )}
                          href={`/products/${review.productId}/edit`}
                        >
                          {review.productTitle}
                        </Link>
                        <p className={dashboardTableSecondaryTextClass}>
                          {review.variantTitle ?? "Product level"}
                        </p>
                        <Link
                          className="mt-1 inline-flex text-xs font-bold text-[#ff5a1f] hover:underline"
                          href={`/products/${review.productSlug}`}
                          target="_blank"
                        >
                          View storefront
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "align-top")}>
                      <StatusBadge status={review.status} />
                    </TableCell>
                    <TableCell className={cn(dashboardTableActionCellClass, "align-top")}>
                      <ReviewModerationForms canManage={canManage} review={review} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="px-5 py-10 text-center text-sm text-slate-500 dark:text-zinc-400"
                    colSpan={5}
                  >
                    No product reviews match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DashboardTablePagination
          currentPage={activePage}
          itemLabel="reviews"
          onPageChange={setPage}
          onPageSizeChange={(nextSize) => {
            setPage(1);
            setPageSize(nextSize);
          }}
          pageSize={pageSize}
          totalItems={filteredReviews.length}
        />
      </section>
    </div>
  );
}
