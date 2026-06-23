"use client";

import Image from "next/image";
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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  AdminProductReviewRow,
  AdminProductReviewStatus,
  AdminProductsData,
} from "@/src/modules/admin/product-reviews";

type StatusFilter = "all" | AdminProductReviewStatus;
type FulfillmentFilter = "all" | "seller_fulfilled" | "piessang_fulfilled";
type CategoryFilter = "all" | string;

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

function humanizeStatus(status: string) {
  return status
    .split("_")
    .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatMoney(value: string | null) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    style: "currency",
  }).format(Number.isFinite(amount) ? amount : 0);
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
        status === "draft" && "bg-slate-100 text-slate-700",
        status === "pending_review" && "bg-amber-100 text-amber-700",
        status === "changes_requested" && "bg-red-100 text-red-700",
        status === "approved" && "bg-blue-100 text-blue-700",
        (status === "live" || status === "active") &&
          "bg-emerald-100 text-emerald-700",
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
      {mode === "piessang_fulfilled" ? "FBP" : "Seller fulfilled"}
    </Badge>
  );
}

function ProductFilterPanel({
  categoryFilter,
  categoryOptions,
  fulfillmentFilter,
  statusFilter,
  onChangeCategory,
  onChangeFulfillment,
  onChangeStatus,
  onClear,
  onClose,
}: {
  categoryFilter: CategoryFilter;
  categoryOptions: string[];
  fulfillmentFilter: FulfillmentFilter;
  statusFilter: StatusFilter;
  onChangeCategory: (value: CategoryFilter) => void;
  onChangeFulfillment: (value: FulfillmentFilter) => void;
  onChangeStatus: (value: StatusFilter) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#151719] dark:text-white">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Filter products</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Narrow products by status, category, and fulfillment.
          </p>
        </div>
        <button
          aria-label="Close product filters"
          className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={onClose}
          type="button"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
            Status
          </span>
          <Select
            value={statusFilter}
            onValueChange={(value) => onChangeStatus(value as StatusFilter)}
          >
            <SelectTrigger className="h-9 border-slate-300 bg-white dark:border-white/18 dark:bg-[#101214]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem value="all" className={selectItemClass}>
                All statuses
              </SelectItem>
              <SelectItem value="draft" className={selectItemClass}>
                Draft
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
              <SelectItem value="active" className={selectItemClass}>
                Active
              </SelectItem>
              <SelectItem value="live" className={selectItemClass}>
                Live
              </SelectItem>
              <SelectItem value="paused" className={selectItemClass}>
                Paused
              </SelectItem>
              <SelectItem value="admin_suspended" className={selectItemClass}>
                Admin suspended
              </SelectItem>
              <SelectItem value="archived" className={selectItemClass}>
                Archived
              </SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
            Category
          </span>
          <Select
            value={categoryFilter}
            onValueChange={(value) => onChangeCategory(value as CategoryFilter)}
          >
            <SelectTrigger className="h-9 border-slate-300 bg-white dark:border-white/18 dark:bg-[#101214]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              className={cn(selectContentClass, "max-h-[min(18rem,var(--available-height))]")}
              collisionPadding={12}
            >
              <SelectItem value="all" className={selectItemClass}>
                All categories
              </SelectItem>
              {categoryOptions.map((category) => (
                <SelectItem key={category} value={category} className={selectItemClass}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
            Fulfillment mode
          </span>
          <Select
            value={fulfillmentFilter}
            onValueChange={(value) =>
              onChangeFulfillment(value as FulfillmentFilter)
            }
          >
            <SelectTrigger className="h-9 border-slate-300 bg-white dark:border-white/18 dark:bg-[#101214]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem value="all" className={selectItemClass}>
                All fulfillment
              </SelectItem>
              <SelectItem value="seller_fulfilled" className={selectItemClass}>
                Seller fulfilled
              </SelectItem>
              <SelectItem value="piessang_fulfilled" className={selectItemClass}>
                Fulfilled by Piessang
              </SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <button
        className="mt-4 text-xs font-medium text-[#8a641f] hover:text-[#5f4416] dark:text-[#f0c760] dark:hover:text-[#ffe08a]"
        onClick={onClear}
        type="button"
      >
        Clear filters
      </button>
    </div>
  );
}

function ProductDetails({ product }: { product: AdminProductReviewRow }) {
  const firstVariant = product.variants[0];

  return (
    <DialogBody className="grid gap-5 overflow-x-hidden">
      <div className="grid min-w-0 gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="relative aspect-square max-h-48 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]">
            {product.coverMediaUrl ? (
              <Image
                alt={product.title}
                className="object-cover"
                fill
                sizes="240px"
                src={product.coverMediaUrl}
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
              {product.title}
            </p>
            <p className="mt-1 line-clamp-4 break-words text-sm text-slate-600 dark:text-zinc-400">
              {product.shortDescription || "No short description supplied."}
            </p>
          </div>
          <div className="grid gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Seller
              </p>
              <p className="truncate font-medium">{product.sellerName}</p>
              <p className="truncate text-xs text-slate-500">{product.sellerSlug}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Category
              </p>
              <p className="truncate font-medium">
                {product.categoryPath ?? "Uncategorized"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Brand
              </p>
              <p className="truncate font-medium">
                {product.brandName ?? "No brand"}
              </p>
              {product.needsBrandReview ? (
                <p className="text-xs text-amber-700">Brand request pending.</p>
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Lifecycle
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <StatusBadge status={product.status} />
                <FulfillmentBadge mode={product.fulfillmentMode} />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Price
              </p>
              <p className="font-medium">
                {firstVariant ? formatMoney(firstVariant.price) : "No variants"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Updated
              </p>
              <p className="font-medium">{formatDate(product.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>
      <section className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
            Variants
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {product.variants.length} variant
            {product.variants.length === 1 ? "" : "s"} on this product.
          </p>
        </div>
        <div className="grid gap-3">
          {product.variants.map((variant) => (
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
              </dl>
            </article>
          ))}
        </div>
      </section>
    </DialogBody>
  );
}

export function AdminProductManager({ metrics, products }: AdminProductsData) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fulfillmentFilter, setFulfillmentFilter] =
    useState<FulfillmentFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState<AdminProductReviewRow | null>(
    null,
  );

  const productMetrics = useMemo<DashboardMetricDefinition[]>(
    () => [
      {
        color: "#3b82f6",
        description: "Every product record across all seller accounts.",
        id: "products",
        label: "Products",
        value: metrics.products,
      },
      {
        color: "#10b981",
        description: "Products approved and visible to buyers.",
        id: "live",
        label: "Live",
        value: metrics.live,
      },
      {
        color: "#f59e0b",
        description: "Products waiting for admin review.",
        id: "pending",
        label: "Pending review",
        value: metrics.pending,
      },
      {
        color: "#64748b",
        description: "Seller drafts that have not been submitted yet.",
        id: "draft",
        label: "Drafts",
        value: metrics.draft,
      },
      {
        color: "#8b5cf6",
        description: "Products configured for Fulfilled by Piessang.",
        id: "fbp",
        label: "FBP",
        value: metrics.fbp,
      },
      {
        color: "#ef4444",
        description: "Products returned to sellers with required changes.",
        id: "changes-requested",
        label: "Changes requested",
        value: metrics.changesRequested,
      },
      {
        color: "#f97316",
        description: "Variants missing parcel data required for shipping rates.",
        id: "missing-parcel-data",
        label: "Missing parcel data",
        value: metrics.missingParcelData,
      },
      {
        color: "#0ea5e9",
        description: "Total sellable variant rows across all products.",
        id: "variants",
        label: "Variants",
        value: metrics.variants,
      },
    ],
    [metrics],
  );
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => product.categoryPath)
            .filter((category): category is string => Boolean(category)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter;
      const matchesFulfillment =
        fulfillmentFilter === "all" ||
        product.fulfillmentMode === fulfillmentFilter;
      const matchesCategory =
        categoryFilter === "all" || product.categoryPath === categoryFilter;
      const matchesSearch =
        !normalizedSearch ||
        [
          product.title,
          product.sellerName,
          product.sellerSlug,
          product.brandName,
          product.categoryPath,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesFulfillment && matchesCategory && matchesSearch;
    });
  }, [categoryFilter, fulfillmentFilter, products, searchTerm, statusFilter]);
  const activeFilterCount =
    Number(statusFilter !== "all") +
    Number(categoryFilter !== "all") +
    Number(fulfillmentFilter !== "all");

  function clearFilters() {
    setStatusFilter("all");
    setCategoryFilter("all");
    setFulfillmentFilter("all");
    setCurrentPage(1);
  }

  const activePage = Math.min(
    currentPage,
    Math.max(1, Math.ceil(filteredProducts.length / pageSize)),
  );
  const pageProducts = filteredProducts.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );

  function exportProductsCsv() {
    const headers = [
      "Product",
      "Seller",
      "Status",
      "Fulfillment",
      "Brand",
      "Category",
      "Variants",
      "Media",
      "Updated",
    ];
    const rows = filteredProducts.map((product) => [
      product.title,
      product.sellerName,
      product.status,
      product.fulfillmentMode,
      product.brandName,
      product.categoryPath,
      product.variants.length,
      product.mediaCount,
      formatDate(product.updatedAt),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `piessang-products-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={["Products", "All products"]}
        title="All products"
      />

      <div className="grid gap-4">
        <DashboardCompactMetrics
          metrics={productMetrics}
          storageKey="piessang:admin:all-product-metrics"
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
              placeholder="Search products..."
              value={searchTerm}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
            <div className="relative min-w-0">
              <DashboardButton
                onClick={() => setFilterOpen((isOpen) => !isOpen)}
                type="button"
              >
                <FilterIcon className="size-3.5" />
                Filter
                {activeFilterCount > 0 ? (
                  <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#c4982d] px-1 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </DashboardButton>
              {filterOpen ? (
                <>
                  <button
                    aria-label="Close product filters"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setFilterOpen(false)}
                    type="button"
                  />
                  <ProductFilterPanel
                    categoryFilter={categoryFilter}
                    categoryOptions={categoryOptions}
                    fulfillmentFilter={fulfillmentFilter}
                    statusFilter={statusFilter}
                    onChangeCategory={(value) => {
                      setCategoryFilter(value);
                      setCurrentPage(1);
                    }}
                    onChangeFulfillment={(value) => {
                      setFulfillmentFilter(value);
                      setCurrentPage(1);
                    }}
                    onChangeStatus={(value) => {
                      setStatusFilter(value);
                      setCurrentPage(1);
                    }}
                    onClear={clearFilters}
                    onClose={() => setFilterOpen(false)}
                  />
                </>
              ) : null}
            </div>
            <DashboardButton onClick={exportProductsCsv} type="button">
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
                  Updated
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
              {pageProducts.length > 0 ? (
                pageProducts.map((product) => (
                  <TableRow key={product.id} className={dashboardTableRowClass}>
                    <TableCell className={cn("min-w-0", dashboardTableCellClass)}>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative hidden size-10 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 sm:block">
                          {product.coverMediaUrl ? (
                            <Image
                              alt={product.title}
                              className="object-cover"
                              fill
                              sizes="40px"
                              src={product.coverMediaUrl}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className={cn("truncate", dashboardTablePrimaryTextClass)}>
                            {product.title}
                          </p>
                          <p className={cn("truncate", dashboardTableSecondaryTextClass)}>
                            {product.variants.length} variants ·{" "}
                            {product.brandName ?? "No brand"}
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
                        {product.sellerName}
                      </p>
                      <p className={cn("truncate", dashboardTableSecondaryTextClass)}>
                        {product.sellerSlug}
                      </p>
                    </TableCell>
                    <TableCell className={cn("hidden lg:table-cell", dashboardTableCellClass)}>
                      <StatusBadge status={product.status} />
                    </TableCell>
                    <TableCell className={cn("hidden lg:table-cell", dashboardTableCellClass)}>
                      <FulfillmentBadge mode={product.fulfillmentMode} />
                    </TableCell>
                    <TableCell className={cn("hidden xl:table-cell", dashboardTableCellClass, dashboardTableMutedTextClass)}>
                      {formatDate(product.updatedAt)}
                    </TableCell>
                    <TableCell className={dashboardTableActionCellClass}>
                      <div className="inline-flex items-center">
                        <DashboardRowActionMenu
                          ariaLabel={`Open actions for ${product.title}`}
                          className="w-56"
                        >
                          <button
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-zinc-800 transition hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-white/10"
                            onClick={() => setViewProduct(product)}
                            type="button"
                          >
                            <EyeIcon className="size-4" />
                            View product
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
                        No products found
                      </p>
                      <p className="text-sm text-slate-500 dark:text-zinc-400">
                        {searchTerm || activeFilterCount > 0
                          ? "Try changing the search or filters."
                          : "Products will appear here once sellers create listings."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <DashboardTablePagination
            currentPage={activePage}
            itemLabel="products"
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setCurrentPage(1);
              setPageSize(nextPageSize);
            }}
            pageSize={pageSize}
            totalItems={filteredProducts.length}
          />
        </section>
      </div>

      <Dialog
        open={Boolean(viewProduct)}
        onOpenChange={(open) => !open && setViewProduct(null)}
      >
        <DialogContent className="!w-[min(64rem,calc(100vw-2rem))] !max-w-[min(64rem,calc(100vw-2rem))] border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader>
            <DialogTitle>Product details</DialogTitle>
            <DialogDescription>
              Inspect seller, lifecycle, fulfillment, media, and variant data.
            </DialogDescription>
          </DialogHeader>
          {viewProduct ? <ProductDetails product={viewProduct} /> : null}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}
