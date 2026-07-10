"use client";

import Image from "next/image";
import { useActionState, useMemo, useState, useEffect } from "react";
import {
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  FilterIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import {
  approveProductReview,
  requestProductReviewChanges,
  type ProductReviewMutationState,
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  AdminProductReviewRow,
  AdminProductReviewsData,
  AdminProductReviewStatus,
} from "@/src/modules/admin/product-reviews";

type StatusFilter = "all" | AdminProductReviewStatus;

const initialMutationState: ProductReviewMutationState = {};
const adminPrimaryClass =
  "bg-[#c4982d] text-white shadow-[#c4982d]/20 hover:bg-[#a87920]";
const modalContentClass =
  "!w-[min(64rem,calc(100vw-2rem))] !max-w-[min(64rem,calc(100vw-2rem))] border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white";
const modalInputClass =
  "border-slate-300 bg-white text-zinc-950 placeholder:text-slate-400 focus-visible:border-[#c4982d] focus-visible:ring-[#c4982d]/20 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500";
const selectContentClass =
  "border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white";
const selectItemClass =
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

function formatMoney(value: string | null) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    style: "currency",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function humanizeStatus(status: string) {
  return status
    .split("_")
    .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
    .join(" ");
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

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-md border-0 px-2 text-xs font-semibold",
        status === "pending_review" && "bg-amber-100 text-amber-700",
        status === "changes_requested" && "bg-red-100 text-red-700",
        status === "approved" && "bg-blue-100 text-blue-700",
        (status === "live" || status === "active") &&
          "bg-emerald-100 text-emerald-700",
        status === "draft" && "bg-slate-100 text-slate-700",
        status === "paused" && "bg-violet-100 text-violet-700",
        status === "admin_suspended" && "bg-red-100 text-red-700",
        status === "archived" && "bg-slate-100 text-slate-700",
      )}
    >
      {humanizeStatus(status)}
    </Badge>
  );
}

function FulfillmentBadge({
  mode,
}: {
  mode: AdminProductReviewRow["fulfillmentMode"];
}) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-md border-0 px-2 text-xs font-semibold",
        mode === "piessang_fulfilled"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-100 text-slate-700",
      )}
    >
      {mode === "piessang_fulfilled" ? "Jurgens delivery" : "Bob Go courier"}
    </Badge>
  );
}

function MutationMessage({ state }: { state: ProductReviewMutationState }) {
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

function ProductReviewSummary({ review }: { review: AdminProductReviewRow }) {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="relative aspect-square max-h-48 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]">
          {review.coverMediaUrl ? (
            <Image
              alt={review.title}
              className="object-cover"
              fill
              sizes="240px"
              src={review.coverMediaUrl}
            />
          ) : (
            <div className="grid size-full place-items-center text-sm text-slate-500">
              No media
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0 space-y-4">
        <div>
          <p className="break-words text-lg font-semibold text-zinc-950 dark:text-white">
            {review.title}
          </p>
          <p className="mt-1 line-clamp-4 break-words text-sm text-slate-600 dark:text-zinc-400">
            {review.shortDescription || "No short description supplied."}
          </p>
        </div>
        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Catalog
            </p>
            <p className="truncate font-medium">{review.sellerName}</p>
            <p className="truncate text-xs text-slate-500">{review.sellerSlug}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Category
            </p>
            <p className="truncate font-medium">
              {review.categoryPath ?? "Uncategorized"}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Brand
            </p>
            <p className="truncate font-medium">{review.brandName ?? "No brand"}</p>
            {review.needsBrandReview ? (
              <p className="text-xs text-amber-700">Brand request still pending.</p>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Review status
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <StatusBadge status={review.status} />
              <FulfillmentBadge mode={review.fulfillmentMode} />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Submitted
            </p>
            <p className="font-medium">{formatDate(review.submittedAt)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Listing details
            </p>
            <p className="font-medium">
              {review.variants.length} variants, {review.mediaCount} media
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function VariantReviewDetails({ review }: { review: AdminProductReviewRow }) {
  return (
    <section className="grid gap-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
          Variants
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          {review.variants.length} variant
          {review.variants.length === 1 ? "" : "s"} submitted for review.
        </p>
      </div>
      <div className="grid gap-3">
        {review.variants.map((variant) => (
          <article
            key={variant.id}
            className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-zinc-950 dark:text-white">
                  {variant.title}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  {humanizeStatus(variant.status)}
                </p>
              </div>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-white/10 dark:text-zinc-200 dark:ring-white/10">
                {formatMoney(variant.price)}
              </span>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  SKU
                </dt>
                <dd className="break-words text-slate-800 dark:text-zinc-200">
                  {variant.sku}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Stock
                </dt>
                <dd className="text-slate-800 dark:text-zinc-200">
                  {variant.continueSellingOutOfStock
                    ? "Oversell enabled"
                    : variant.stockOnHand.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Parcel
                </dt>
                <dd className="text-slate-800 dark:text-zinc-200">
                  {variant.missingShippingFields.length > 0
                    ? `Missing ${variant.missingShippingFields.length}`
                    : `${variant.weightGrams} g, ${variant.lengthMm} x ${variant.widthMm} x ${variant.heightMm} mm`}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Barcode
                </dt>
                <dd className="break-words text-slate-800 dark:text-zinc-200">
                  {variant.barcode ?? "None"}
                </dd>
              </div>
              {variant.compareAtPrice ? (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Compare-at
                  </dt>
                  <dd className="text-slate-800 dark:text-zinc-200">
                    {formatMoney(variant.compareAtPrice)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function ApproveProductForm({
  onSuccess,
  review,
}: {
  onSuccess: () => void;
  review: AdminProductReviewRow;
}) {
  const [state, formAction, isPending] = useActionState(
    approveProductReview,
    initialMutationState,
  );

  useEffect(() => {
    if (state.ok) {
      onSuccess();
    }
  }, [onSuccess, state.ok]);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="productId" value={review.id} />
      <DialogBody className="grid gap-4">
        <MutationMessage state={state} />
        <ProductReviewSummary review={review} />
        {review.needsBrandReview ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This product has a pending brand request. Review that brand request
            before approving the product.
          </p>
        ) : null}
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Approved products become live immediately.
        </p>
      </DialogBody>
      <DialogFooter>
        <Button
          className={cn("h-10 rounded-lg px-4", adminPrimaryClass)}
          disabled={isPending || review.needsBrandReview}
          type="submit"
        >
          <CheckIcon className="size-4" />
          {isPending ? "Approving..." : "Approve product"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RequestChangesForm({
  onSuccess,
  review,
}: {
  onSuccess: () => void;
  review: AdminProductReviewRow;
}) {
  const [state, formAction, isPending] = useActionState(
    requestProductReviewChanges,
    initialMutationState,
  );

  useEffect(() => {
    if (state.ok) {
      onSuccess();
    }
  }, [onSuccess, state.ok]);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="productId" value={review.id} />
      <DialogBody className="grid gap-4">
        <div className="grid gap-2">
          <Label className="text-sm font-semibold text-zinc-900 dark:text-white">
            Change request reason
          </Label>
          <Textarea
            className={cn("min-h-32", modalInputClass)}
            maxLength={1000}
            minLength={10}
            name="reason"
            placeholder="Describe exactly what must be fixed before this product can go live."
            required
          />
        </div>
        <MutationMessage state={state} />
      </DialogBody>
      <DialogFooter>
        <Button
          className="h-10 rounded-lg bg-red-600 px-4 text-white hover:bg-red-700"
          disabled={isPending}
          type="submit"
        >
          <XIcon className="size-4" />
          {isPending ? "Requesting..." : "Request changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProductReviewManager({
  metrics,
  reviews,
}: AdminProductReviewsData) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewReview, setViewReview] = useState<AdminProductReviewRow | null>(null);
  const [approveReview, setApproveReview] =
    useState<AdminProductReviewRow | null>(null);
  const [changesReview, setChangesReview] =
    useState<AdminProductReviewRow | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const reviewMetrics = useMemo<DashboardMetricDefinition[]>(
    () => [
      {
        color: "#f59e0b",
        description: "Products waiting for an admin review decision.",
        id: "pending",
        label: "Pending",
        value: metrics.pending,
      },
      {
        color: "#ef4444",
        description: "Products returned for requested changes.",
        id: "changes-requested",
        label: "Changes requested",
        value: metrics.changesRequested,
      },
      {
        color: "#3b82f6",
        description: "Products in the approved status from earlier workflows.",
        id: "approved",
        label: "Approved",
        value: metrics.approved,
      },
      {
        color: "#10b981",
        description: "Approved products visible to buyers.",
        id: "live",
        label: "Live",
        value: metrics.live,
      },
      {
        color: "#8b5cf6",
        description: "Submitted products delivered through Bob Go courier bookings.",
        id: "in-house-fulfillment",
        label: "Bob Go",
        value: metrics.inHouseFulfilled,
      },
      {
        color: "#64748b",
        description: "Submitted products configured for Jurgens Energy delivery.",
        id: "warehouse-fulfillment",
        label: "Jurgens delivery",
        value: metrics.warehouseFulfilled,
      },
      {
        color: "#f97316",
        description: "Variants missing required parcel data for accurate shipping.",
        id: "missing-parcel-data",
        label: "Missing parcel data",
        value: metrics.missingParcelData,
      },
      {
        color: "#0ea5e9",
        description: "All non-draft product submissions in the review lifecycle.",
        id: "total-submitted",
        label: "Submitted",
        value: metrics.totalSubmitted,
      },
    ],
    [metrics],
  );

  const filteredReviews = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return reviews.filter((review) => {
      const matchesStatus =
        statusFilter === "all" || review.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        [
          review.title,
          review.sellerName,
          review.sellerSlug,
          review.brandName,
          review.categoryPath,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesSearch;
    });
  }, [reviews, searchTerm, statusFilter]);

  const activePage = Math.min(
    currentPage,
    Math.max(1, Math.ceil(filteredReviews.length / pageSize)),
  );
  const pageReviews = filteredReviews.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );

  function exportReviewsCsv() {
    const headers = [
      "Product",
      "Catalog",
      "Status",
      "Fulfillment",
      "Brand",
      "Category",
      "Variants",
      "Missing Parcel Variants",
      "Submitted",
    ];
    const rows = filteredReviews.map((review) => [
      review.title,
      review.sellerName,
      review.status,
      review.fulfillmentMode,
      review.brandName,
      review.categoryPath,
      review.variants.length,
      review.missingParcelVariantCount,
      formatDate(review.submittedAt),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `jurgens-energy-product-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={["Products", "Product reviews"]}
        title="Product reviews"
      />

      <div className="grid gap-4">
        <DashboardCompactMetrics
          metrics={reviewMetrics}
          storageKey="jurgens:admin:product-review-metrics"
        />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <DashboardInput
              className="pl-9"
              onChange={(event) => {
                setCurrentPage(1);
                setSearchTerm(event.target.value);
              }}
              placeholder="Search product reviews..."
              value={searchTerm}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
            <DashboardButton onClick={() => setFilterOpen(true)} type="button">
              <FilterIcon className="size-3.5" />
              Filter
            </DashboardButton>
            <DashboardButton onClick={exportReviewsCsv} type="button">
              <DownloadIcon className="size-3.5" />
              Export
            </DashboardButton>
          </div>
        </div>

        <section
          className={cn(
            dashboardPanelClass,
            dashboardTableContainerClass,
            "overflow-visible",
          )}
        >
          <Table className={dashboardTableClass}>
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>Product</TableHead>
                <TableHead
                  className={cn(dashboardTableHeadClass, "hidden md:table-cell")}
                >
                  Seller
                </TableHead>
                <TableHead
                  className={cn(dashboardTableHeadClass, "hidden lg:table-cell")}
                >
                  Status
                </TableHead>
                <TableHead
                  className={cn(dashboardTableHeadClass, "hidden lg:table-cell")}
                >
                  Fulfillment
                </TableHead>
                <TableHead
                  className={cn(dashboardTableHeadClass, "hidden xl:table-cell")}
                >
                  Submitted
                </TableHead>
                <TableHead
                  className={cn(
                    dashboardTableHeadClass,
                    dashboardTableActionHeadClass,
                  )}
                >
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageReviews.length > 0 ? (
                pageReviews.map((review) => (
                  <TableRow key={review.id} className={dashboardTableRowClass}>
                    <TableCell className={cn("min-w-0", dashboardTableCellClass)}>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative hidden size-10 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 sm:block">
                          {review.coverMediaUrl ? (
                            <Image
                              alt={review.title}
                              className="object-cover"
                              fill
                              sizes="40px"
                              src={review.coverMediaUrl}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className={cn("truncate", dashboardTablePrimaryTextClass)}>
                            {review.title}
                          </p>
                          <p className={cn("truncate", dashboardTableSecondaryTextClass)}>
                            {review.variants.length} variants ·{" "}
                            {review.brandName ?? "No brand"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "hidden max-w-[220px] md:table-cell",
                        dashboardTableCellClass,
                      )}
                    >
                      <p className={cn("truncate", dashboardTableMutedTextClass)}>
                        {review.sellerName}
                      </p>
                      <p className={cn("truncate", dashboardTableSecondaryTextClass)}>
                        {review.sellerSlug}
                      </p>
                    </TableCell>
                    <TableCell className={cn("hidden lg:table-cell", dashboardTableCellClass)}>
                      <StatusBadge status={review.status} />
                    </TableCell>
                    <TableCell className={cn("hidden lg:table-cell", dashboardTableCellClass)}>
                      <FulfillmentBadge mode={review.fulfillmentMode} />
                    </TableCell>
                    <TableCell className={cn("hidden xl:table-cell", dashboardTableCellClass, dashboardTableMutedTextClass)}>
                      {formatDate(review.submittedAt)}
                    </TableCell>
                    <TableCell className={dashboardTableActionCellClass}>
                      <div className="inline-flex items-center">
                        <DashboardRowActionMenu
                          ariaLabel={`Open actions for ${review.title}`}
                          className="w-60"
                        >
                          <button
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-zinc-800 transition hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-white/10"
                            onClick={() => setViewReview(review)}
                            type="button"
                          >
                            <EyeIcon className="size-4" />
                            View review
                          </button>
                          <button
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-zinc-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-zinc-200 dark:hover:bg-white/10"
                            disabled={review.status !== "pending_review"}
                            onClick={() => setApproveReview(review)}
                            type="button"
                          >
                            <CheckIcon className="size-4" />
                            Approve
                          </button>
                          <button
                            className="flex w-full items-center gap-3 border-t border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                            disabled={review.status !== "pending_review"}
                            onClick={() => setChangesReview(review)}
                            type="button"
                          >
                            <XIcon className="size-4" />
                            Request changes
                          </button>
                        </DashboardRowActionMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-slate-200 dark:border-white/10">
                  <TableCell colSpan={6} className="px-5 py-12 text-center">
                    <div className="mx-auto grid max-w-sm gap-1">
                      <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                        No product reviews found
                      </p>
                      <p className="text-sm text-slate-500 dark:text-zinc-400">
                        {searchTerm || statusFilter !== "all"
                          ? "Try changing the search or filters."
                          : "Submitted products will appear here when review is required."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <DashboardTablePagination
            currentPage={activePage}
            itemLabel="reviews"
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setCurrentPage(1);
              setPageSize(nextPageSize);
            }}
            pageSize={pageSize}
            totalItems={filteredReviews.length}
          />
        </section>
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-w-md border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader>
            <DialogTitle>Filter product reviews</DialogTitle>
            <DialogDescription>Narrow the current review queue.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label className="text-sm font-semibold">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value: string | null) => {
                  setCurrentPage(1);
                  setStatusFilter((value ?? "all") as StatusFilter);
                }}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-300 bg-white text-sm dark:border-white/18 dark:bg-[#151719] dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="all" className={selectItemClass}>
                    All statuses
                  </SelectItem>
                  <SelectItem value="pending_review" className={selectItemClass}>
                    Pending review
                  </SelectItem>
                  <SelectItem value="changes_requested" className={selectItemClass}>
                    Changes requested
                  </SelectItem>
                  <SelectItem value="approved" className={selectItemClass}>
                    Approved
                  </SelectItem>
                  <SelectItem value="live" className={selectItemClass}>
                    Live
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewReview)}
        onOpenChange={(open) => !open && setViewReview(null)}
      >
        <DialogContent className={modalContentClass}>
          <DialogHeader>
            <DialogTitle>Review product</DialogTitle>
            <DialogDescription>
              Inspect the submitted listing, delivery method, and variants.
            </DialogDescription>
          </DialogHeader>
          {viewReview ? (
            <DialogBody className="grid gap-5 overflow-x-hidden">
              <ProductReviewSummary review={viewReview} />
              <VariantReviewDetails review={viewReview} />
            </DialogBody>
          ) : null}
          <DialogFooter>
            {viewReview?.status === "pending_review" ? (
              <>
                <Button
                  className="h-10 rounded-lg bg-red-600 px-4 text-white hover:bg-red-700"
                  onClick={() => {
                    setChangesReview(viewReview);
                    setViewReview(null);
                  }}
                  type="button"
                >
                  <XIcon className="size-4" />
                  Request changes
                </Button>
                <Button
                  className={cn("h-10 rounded-lg px-4", adminPrimaryClass)}
                  onClick={() => {
                    setApproveReview(viewReview);
                    setViewReview(null);
                  }}
                  type="button"
                >
                  <CheckIcon className="size-4" />
                  Approve
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(approveReview)}
        onOpenChange={(open) => !open && setApproveReview(null)}
      >
        <DialogContent className={modalContentClass}>
          <DialogHeader>
            <DialogTitle>Approve product</DialogTitle>
            <DialogDescription>
              Confirm how this submission should move through the product lifecycle.
            </DialogDescription>
          </DialogHeader>
          {approveReview ? (
            <ApproveProductForm
              onSuccess={() => setApproveReview(null)}
              review={approveReview}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(changesReview)}
        onOpenChange={(open) => !open && setChangesReview(null)}
      >
        <DialogContent className="max-w-xl border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              Keep the reason specific so staff can fix the listing cleanly.
            </DialogDescription>
          </DialogHeader>
          {changesReview ? (
            <RequestChangesForm
              onSuccess={() => setChangesReview(null)}
              review={changesReview}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
