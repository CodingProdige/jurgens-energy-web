"use client";

import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";
import {
  DownloadIcon,
  Edit3Icon,
  FilterIcon,
  PlusIcon,
  PackageCheckIcon,
  SearchIcon,
  TruckIcon,
  XIcon,
} from "lucide-react";

import {
  updateSellerProductShipping,
  type SellerProductMutationState,
} from "@/app/(seller)/seller/(dashboard)/products/actions";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  SellerProductRow,
  SellerProductsPageData,
  SellerProductVariant,
} from "@/src/modules/sellers/products";

type ProductStatusFilter = "all" | "active" | "draft" | "archived";
type ReadinessFilter = "all" | "ready" | "missing";
type FulfillmentFilter = "all" | "seller_fulfilled" | "piessang_fulfilled";

const initialMutationState: SellerProductMutationState = {};
const pageSizeOptions = [10, 25, 50];
const modalContentClass =
  "max-w-3xl border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white";
const modalFieldClass =
  "h-10 border-slate-300 bg-white text-zinc-950 placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500";
const modalLabelClass = "text-sm font-semibold text-zinc-900 dark:text-white";
const selectContentClass =
  "border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white";
const selectItemClass =
  "cursor-pointer px-2 py-2 text-zinc-800 focus:bg-slate-100 focus:text-zinc-950 dark:text-zinc-200 dark:focus:bg-white/10 dark:focus:text-white";
const toolbarButtonClass =
  "h-8 w-full gap-1.5 px-3 md:w-auto [&_svg]:size-3.5";

const missingFieldLabels: Record<string, string> = {
  heightMm: "height",
  lengthMm: "length",
  weightGrams: "weight",
  widthMm: "width",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatCurrency(value: string) {
  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    style: "currency",
  }).format(Number(value));
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

function exportProducts(products: SellerProductRow[]) {
  const headers = [
    "Product",
    "Status",
    "Fulfillment mode",
    "Variants",
    "Ready variants",
    "Stock",
    "Updated",
  ];
  const rows = products.map((product) => [
    product.title,
    product.status,
    product.fulfillmentMode,
    product.variants.length,
    product.readyVariantCount,
    product.totalStock,
    formatDate(product.updatedAt),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `seller-products-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: SellerProductRow["status"] }) {
  const className =
    status === "active"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200"
      : status === "draft"
        ? "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300"
        : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";

  return (
    <Badge className={cn("rounded-md px-2 py-1 text-xs font-semibold", className)}>
      {status[0].toUpperCase()}
      {status.slice(1)}
    </Badge>
  );
}

function FulfillmentBadge({
  mode,
}: {
  mode: SellerProductRow["fulfillmentMode"];
}) {
  const isPiessang = mode === "piessang_fulfilled";

  return (
    <Badge
      className={cn(
        "rounded-md px-2 py-1 text-xs font-semibold",
        isPiessang
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200"
          : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300",
      )}
    >
      {isPiessang ? "Piessang" : "Seller"}
    </Badge>
  );
}

function ReadinessBadge({ product }: { product: SellerProductRow }) {
  if (product.shippingReady) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
        <PackageCheckIcon className="size-3.5" />
        Ready
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
      <TruckIcon className="size-3.5" />
      {product.readyVariantCount}/{product.variants.length || 0} ready
    </span>
  );
}

function ProductFilterPanel({
  fulfillmentFilter,
  readinessFilter,
  statusFilter,
  onChangeFulfillment,
  onChangeReadiness,
  onChangeStatus,
  onClear,
  onClose,
}: {
  fulfillmentFilter: FulfillmentFilter;
  readinessFilter: ReadinessFilter;
  statusFilter: ProductStatusFilter;
  onChangeFulfillment: (value: FulfillmentFilter) => void;
  onChangeReadiness: (value: ReadinessFilter) => void;
  onChangeStatus: (value: ProductStatusFilter) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#151719] dark:text-white">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Filter products</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Narrow products by readiness and fulfillment.
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
          <Select value={statusFilter} onValueChange={(value) => onChangeStatus(value as ProductStatusFilter)}>
            <SelectTrigger className="h-9 border-slate-300 bg-white dark:border-white/18 dark:bg-[#101214]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem value="all" className={selectItemClass}>All statuses</SelectItem>
              <SelectItem value="active" className={selectItemClass}>Active</SelectItem>
              <SelectItem value="draft" className={selectItemClass}>Draft</SelectItem>
              <SelectItem value="archived" className={selectItemClass}>Archived</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
            Shipping readiness
          </span>
          <Select value={readinessFilter} onValueChange={(value) => onChangeReadiness(value as ReadinessFilter)}>
            <SelectTrigger className="h-9 border-slate-300 bg-white dark:border-white/18 dark:bg-[#101214]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem value="all" className={selectItemClass}>All readiness</SelectItem>
              <SelectItem value="ready" className={selectItemClass}>Ready</SelectItem>
              <SelectItem value="missing" className={selectItemClass}>Missing parcel data</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
            Fulfillment mode
          </span>
          <Select value={fulfillmentFilter} onValueChange={(value) => onChangeFulfillment(value as FulfillmentFilter)}>
            <SelectTrigger className="h-9 border-slate-300 bg-white dark:border-white/18 dark:bg-[#101214]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem value="all" className={selectItemClass}>All fulfillment</SelectItem>
              <SelectItem value="seller_fulfilled" className={selectItemClass}>Seller fulfilled</SelectItem>
              <SelectItem value="piessang_fulfilled" className={selectItemClass}>Fulfilled by Piessang</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <button
        className="mt-4 text-xs font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
        onClick={onClear}
        type="button"
      >
        Clear filters
      </button>
    </div>
  );
}

function VariantParcelFields({ variant }: { variant: SellerProductVariant }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <input name="variantId" type="hidden" value={variant.id} />
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
            {variant.title}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
            {variant.sku} · {formatCurrency(variant.price)} · {variant.stockOnHand} in stock
          </p>
        </div>
        {variant.missingShippingFields.length === 0 ? (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
            Ready
          </Badge>
        ) : (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
            Missing {variant.missingShippingFields.length}
          </Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={modalLabelClass}>Weight (g)</span>
          <Input
            className={modalFieldClass}
            defaultValue={variant.weightGrams ?? ""}
            min={1}
            name={`weightGrams:${variant.id}`}
            required
            type="number"
          />
        </label>
        <label className="grid gap-1.5">
          <span className={modalLabelClass}>Length (mm)</span>
          <Input
            className={modalFieldClass}
            defaultValue={variant.lengthMm ?? ""}
            min={1}
            name={`lengthMm:${variant.id}`}
            required
            type="number"
          />
        </label>
        <label className="grid gap-1.5">
          <span className={modalLabelClass}>Width (mm)</span>
          <Input
            className={modalFieldClass}
            defaultValue={variant.widthMm ?? ""}
            min={1}
            name={`widthMm:${variant.id}`}
            required
            type="number"
          />
        </label>
        <label className="grid gap-1.5">
          <span className={modalLabelClass}>Height (mm)</span>
          <Input
            className={modalFieldClass}
            defaultValue={variant.heightMm ?? ""}
            min={1}
            name={`heightMm:${variant.id}`}
            required
            type="number"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
          <Checkbox
            name={`shipsAlone:${variant.id}`}
            defaultChecked={variant.shipsAlone}
            className="size-4 rounded-[4px] border-slate-300 bg-white data-checked:border-emerald-600 data-checked:bg-emerald-600 data-checked:text-white"
          />
          Ships alone
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
          <Checkbox
            name={`isFragile:${variant.id}`}
            defaultChecked={variant.isFragile}
            className="size-4 rounded-[4px] border-slate-300 bg-white data-checked:border-emerald-600 data-checked:bg-emerald-600 data-checked:text-white"
          />
          Fragile
        </label>
      </div>
    </div>
  );
}

function ProductShippingForm({
  product,
  onDone,
}: {
  product: SellerProductRow;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateSellerProductShipping,
    initialMutationState,
  );

  return (
    <form action={formAction}>
      <DialogBody className="grid gap-4">
        <input name="productId" type="hidden" value={product.id} />

        <label className="grid gap-1.5">
          <span className={modalLabelClass}>Fulfillment mode</span>
          <Select name="fulfillmentMode" defaultValue={product.fulfillmentMode}>
            <SelectTrigger className="h-10 border-slate-300 bg-white dark:border-white/18 dark:bg-[#151719]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem value="seller_fulfilled" className={selectItemClass}>
                Seller fulfilled
              </SelectItem>
              <SelectItem value="piessang_fulfilled" className={selectItemClass}>
                Fulfilled by Piessang
              </SelectItem>
            </SelectContent>
          </Select>
        </label>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs leading-5 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
          Accurate parcel data is required before checkout can quote Bob Go rates.
          Do not estimate unless the seller has physically confirmed the packed parcel.
        </div>

        <div className="grid gap-3">
          {product.variants.map((variant) => (
            <VariantParcelFields key={variant.id} variant={variant} />
          ))}
        </div>

        {state.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            {state.success}
          </p>
        ) : null}
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" type="button" onClick={onDone}>
          Close
        </Button>
        <Button
          className="bg-emerald-700 text-white hover:bg-emerald-800"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving..." : "Save shipping details"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SellerProductManager({
  data,
}: {
  data: SellerProductsPageData;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("all");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [fulfillmentFilter, setFulfillmentFilter] =
    useState<FulfillmentFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SellerProductRow | null>(
    null,
  );

  const availableMetrics: DashboardMetricDefinition[] = [
    {
      color: "#10b981",
      description: "All products connected to this seller account.",
      id: "products",
      label: "Products",
      value: data.metrics.products,
    },
    {
      color: "#22c55e",
      description: "Products currently set to active.",
      id: "active_products",
      label: "Active",
      value: data.metrics.activeProducts,
    },
    {
      color: "#64748b",
      description: "Products still in draft status.",
      id: "draft_products",
      label: "Draft",
      value: data.metrics.draftProducts,
    },
    {
      color: "#0ea5e9",
      description: "Product variants connected to these products.",
      id: "variants",
      label: "Variants",
      value: data.metrics.variants,
    },
    {
      color: "#10b981",
      description: "Products where every variant has required parcel data.",
      id: "ready_for_rates",
      label: "Ready for rates",
      value: data.metrics.readyForRates,
    },
    {
      color: "#f59e0b",
      description: "Variants missing weight, length, width, or height.",
      id: "missing_parcel_data",
      label: "Missing parcel data",
      value: data.metrics.missingParcelData,
    },
    {
      color: "#64748b",
      description: "Products that the seller fulfills directly.",
      id: "seller_fulfilled",
      label: "Seller fulfilled",
      value: data.metrics.sellerFulfilled,
    },
    {
      color: "#8b5cf6",
      description: "Products marked for fulfilled by Piessang.",
      id: "piessang_fulfilled",
      label: "Piessang fulfilled",
      value: data.metrics.piessangFulfilled,
    },
  ];

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return data.products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.title.toLowerCase().includes(normalizedSearch) ||
        product.slug.toLowerCase().includes(normalizedSearch) ||
        product.variants.some(
          (variant) =>
            variant.title.toLowerCase().includes(normalizedSearch) ||
            variant.sku.toLowerCase().includes(normalizedSearch),
        );
      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter;
      const matchesReadiness =
        readinessFilter === "all" ||
        (readinessFilter === "ready" && product.shippingReady) ||
        (readinessFilter === "missing" && !product.shippingReady);
      const matchesFulfillment =
        fulfillmentFilter === "all" ||
        product.fulfillmentMode === fulfillmentFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesReadiness &&
        matchesFulfillment
      );
    });
  }, [data.products, fulfillmentFilter, readinessFilter, searchTerm, statusFilter]);

  const activeFilterCount =
    Number(statusFilter !== "all") +
    Number(readinessFilter !== "all") +
    Number(fulfillmentFilter !== "all");
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const visibleProducts = filteredProducts.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );

  function resetToFirstPage() {
    setCurrentPage(1);
  }

  function clearFilters() {
    setStatusFilter("all");
    setReadinessFilter("all");
    setFulfillmentFilter("all");
    resetToFirstPage();
  }

  function getMissingSummary(product: SellerProductRow) {
    const missing = new Set<string>();

    for (const variant of product.variants) {
      for (const field of variant.missingShippingFields) {
        missing.add(missingFieldLabels[field] ?? field);
      }
    }

    return missing.size > 0 ? Array.from(missing).join(", ") : "None";
  }

  return (
    <div>
      <DashboardPageHeader
        breadcrumbs={["Seller", "Products"]}
        title="Products"
      />

      <DashboardCompactMetrics
        metrics={availableMetrics}
        storageKey={`seller:${data.seller?.id ?? "unknown"}:product-counts`}
      />

      <section className="mt-4 grid gap-3 md:mt-5 md:flex md:items-center md:justify-between">
        <div className="relative w-full md:max-w-[420px]">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <DashboardInput
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              resetToFirstPage();
            }}
            placeholder="Search products"
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
          <div className="relative min-w-0">
            <DashboardButton
              className={toolbarButtonClass}
              onClick={() => setIsFilterPanelOpen((isOpen) => !isOpen)}
              type="button"
            >
              <FilterIcon className="size-3.5" />
              Filter
              {activeFilterCount > 0 ? (
                <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </DashboardButton>
            {isFilterPanelOpen ? (
              <>
                <button
                  aria-label="Close product filters"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setIsFilterPanelOpen(false)}
                  type="button"
                />
                <ProductFilterPanel
                  fulfillmentFilter={fulfillmentFilter}
                  readinessFilter={readinessFilter}
                  statusFilter={statusFilter}
                  onChangeFulfillment={(value) => {
                    setFulfillmentFilter(value);
                    resetToFirstPage();
                  }}
                  onChangeReadiness={(value) => {
                    setReadinessFilter(value);
                    resetToFirstPage();
                  }}
                  onChangeStatus={(value) => {
                    setStatusFilter(value);
                    resetToFirstPage();
                  }}
                  onClear={clearFilters}
                  onClose={() => setIsFilterPanelOpen(false)}
                />
              </>
            ) : null}
          </div>
          <DashboardButton
            className={toolbarButtonClass}
            type="button"
            onClick={() => exportProducts(filteredProducts)}
            disabled={filteredProducts.length === 0}
          >
            <DownloadIcon className="size-3.5" />
            Export
          </DashboardButton>
          <DashboardButton
            className={cn(
              "col-span-2 border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 md:col-span-1",
              toolbarButtonClass,
            )}
            onClick={() => router.push("/products/new")}
            type="button"
          >
            <PlusIcon className="size-3.5" />
            New product
          </DashboardButton>
        </div>
      </section>

      <section
        className={cn("mt-5", dashboardTableContainerClass, dashboardPanelClass)}
      >
        <Table className={dashboardTableClass}>
          <TableHeader>
            <TableRow className={dashboardTableHeaderRowClass}>
              <TableHead className={dashboardTableHeadClass}>Product</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Status</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Fulfillment</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Variants</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Shipping readiness</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Updated</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, dashboardTableActionHeadClass)}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleProducts.length > 0 ? (
              visibleProducts.map((product) => (
                <TableRow key={product.id} className={dashboardTableRowClass}>
                  <TableCell className={cn("min-w-0", dashboardTableCellClass)}>
                    <div className="min-w-0">
                      <p className={cn(dashboardTablePrimaryTextClass, "truncate")}>
                        {product.title}
                      </p>
                      <p className={cn(dashboardTableSecondaryTextClass, "truncate")}>
                        {product.slug} · {product.totalStock} in stock
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <StatusBadge status={product.status} />
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <FulfillmentBadge mode={product.fulfillmentMode} />
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <span className={dashboardTableMutedTextClass}>
                      {product.readyVariantCount}/{product.variants.length} ready
                    </span>
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <div className="grid gap-1">
                      <ReadinessBadge product={product} />
                      {!product.shippingReady ? (
                        <span className={dashboardTableSecondaryTextClass}>
                          Missing {getMissingSummary(product)}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <span className={dashboardTableMutedTextClass}>
                      {formatDate(product.updatedAt)}
                    </span>
                  </TableCell>
                  <TableCell className={dashboardTableActionCellClass}>
                    <div className="flex justify-end gap-1 md:gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
                        aria-label={`Edit ${product.title}`}
                        onClick={() => setEditingProduct(product)}
                        type="button"
                      >
                        <Edit3Icon className="size-4" />
                      </Button>
                      <DashboardRowActionMenu
                        ariaLabel={`Open actions for ${product.title}`}
                      >
                        <button
                          className="flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06]"
                          onClick={() => setEditingProduct(product)}
                          type="button"
                        >
                          <PackageCheckIcon className="size-4" />
                          Shipping details
                        </button>
                      </DashboardRowActionMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 px-5 text-center text-sm text-slate-500 dark:text-zinc-400"
                >
                  No products match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <DashboardTablePagination
          currentPage={activePage}
          itemLabel="products"
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalItems={filteredProducts.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setCurrentPage(1);
          }}
        />
      </section>

      <Dialog
        open={Boolean(editingProduct)}
        onOpenChange={(open) => !open && setEditingProduct(null)}
      >
        {editingProduct ? (
          <DialogContent className={modalContentClass}>
            <DialogHeader>
              <DialogTitle>Shipping details</DialogTitle>
              <DialogDescription>
                Manage parcel data and fulfillment mode for {editingProduct.title}.
              </DialogDescription>
            </DialogHeader>
            <ProductShippingForm
              product={editingProduct}
              onDone={() => setEditingProduct(null)}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
