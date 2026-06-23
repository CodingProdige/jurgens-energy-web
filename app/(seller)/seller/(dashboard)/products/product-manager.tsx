"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  DownloadIcon,
  Edit3Icon,
  FileSpreadsheetIcon,
  FilterIcon,
  LinkIcon,
  Loader2Icon,
  PlusIcon,
  PackageCheckIcon,
  PackageIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  TruckIcon,
  Undo2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";

import {
  activateSellerProduct,
  cancelSellerProductReview,
  checkSellerProductCsvImport,
  deleteOrArchiveSellerProduct,
  importSellerProductLinkDraft,
  importSellerProductCsvDrafts,
  pauseSellerProduct,
  submitSavedSellerProductForReview,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "@/src/modules/sellers/products";

type ProductStatusFilter = SellerProductRow["status"] | "all";
type ReadinessFilter = "all" | "ready" | "missing";
type FulfillmentFilter = "all" | "seller_fulfilled" | "piessang_fulfilled";
type ProductLifecycleAction =
  | "activate"
  | "cancel_review"
  | "delete_or_archive"
  | "pause"
  | "submit_review";
type PendingProductAction = {
  action: ProductLifecycleAction;
  description: string;
  label: string;
  product: SellerProductRow;
  tone: "danger" | "default";
} | null;
type CsvImportDecision = "import" | "replace_draft" | "skip";
type CsvImportRow = {
  barcode?: string;
  brandName?: string;
  categoryPath?: string;
  compareAtPrice?: string;
  continueSellingOutOfStock: boolean;
  decision: CsvImportDecision;
  duplicateExistingProductId?: string | null;
  duplicateExistingProductStatus?: string | null;
  duplicateProductInCsv?: boolean;
  duplicateSkuInCsv?: boolean;
  existingSkuProductId?: string | null;
  fulfillmentMode: "seller_fulfilled" | "piessang_fulfilled";
  fullDescription?: string;
  heightMm?: string;
  id: string;
  issues?: string[];
  lengthMm?: string;
  mediaUrls: string[];
  optionValues: Array<{ name: string; value: string }>;
  price?: string;
  productName: string;
  ready?: boolean;
  rowNumber: number;
  selected: boolean;
  shortDescription?: string;
  sku: string;
  stock?: string;
  weightGrams?: string;
  widthMm?: string;
};
type ImportedProductImage = {
  alt: string;
  url: string;
};
type ImportedProductScan = {
  barcode: string;
  brandName: string;
  compareAtPrice: string;
  description: string;
  images: ImportedProductImage[];
  longDescription: string;
  price: string;
  productName: string;
  sku: string;
  sourceUrl: string;
};
type ImportLinkStep = {
  message: string;
  tone: "error" | "success" | "working";
};

const pageSizeOptions = [10, 25, 50];
const selectContentClass =
  "border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white";
const selectItemClass =
  "cursor-pointer px-2 py-2 text-zinc-800 focus:bg-slate-100 focus:text-zinc-950 dark:text-zinc-200 dark:focus:bg-white/10 dark:focus:text-white";
const toolbarButtonClass =
  "h-8 w-full gap-1.5 px-3 md:w-auto [&_svg]:size-3.5";
const csvTemplateHeaders = [
  "product_name",
  "sku",
  "barcode",
  "brand",
  "category",
  "short_description",
  "full_description",
  "price_vat_incl",
  "compare_at_price_vat_incl",
  "stock",
  "continue_selling_when_out_of_stock",
  "weight_g",
  "length_mm",
  "width_mm",
  "height_mm",
  "fulfillment_mode",
  "media_urls",
  "option_1_name",
  "option_1_value",
  "option_2_name",
  "option_2_value",
  "option_3_name",
  "option_3_value",
];

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

function downloadCsvTemplate() {
  const example = [
    "La Vie De Luc Sparkling Water 1L",
    "LVDL-SPARK-1L",
    "6000000000001",
    "La Vie De Luc",
    "Food & Beverage > Drinks > Water",
    "Premium sparkling mountain water in a 1L bottle.",
    "Crisp sparkling water for everyday refreshment.",
    "29.99",
    "39.99",
    "24",
    "false",
    "1200",
    "85",
    "85",
    "300",
    "seller_fulfilled",
    "https://example.com/image-1.jpg|https://example.com/image-2.jpg",
    "Size",
    "1L",
    "Pack",
    "Single",
    "",
    "",
  ];
  const csv = [csvTemplateHeaders, example]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "piessang-product-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getMappedValue(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias];

    if (value?.trim()) {
      return value.trim();
    }
  }

  return "";
}

function toTitleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

function splitList(value: string) {
  return value
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value: string) {
  return ["1", "true", "yes", "y", "on"].includes(value.trim().toLowerCase());
}

function buildCsvImportRows(csvText: string): CsvImportRow[] {
  const rows = parseCsv(csvText);
  const headers = rows[0]?.map(normalizeHeader) ?? [];

  return rows.slice(1).map((cells, index) => {
    const row = headers.reduce<Record<string, string>>((record, header, cellIndex) => {
      record[header] = cells[cellIndex] ?? "";
      return record;
    }, {});
    const optionValues = [1, 2, 3, 4, 5, 6]
      .map((optionIndex) => {
        const name = getMappedValue(row, [
          `option_${optionIndex}_name`,
          `variant_${optionIndex}_name`,
          `option${optionIndex}_name`,
        ]);
        const value = getMappedValue(row, [
          `option_${optionIndex}_value`,
          `variant_${optionIndex}_value`,
          `option${optionIndex}_value`,
        ]);

        return name && value
          ? {
              name: toTitleCase(name),
              value: toTitleCase(value),
            }
          : null;
      })
      .filter((option): option is { name: string; value: string } => Boolean(option));
    const productName = toTitleCase(
      getMappedValue(row, ["product_name", "title", "name", "product", "item_name"]),
    );
    const sku = getMappedValue(row, ["sku", "variant_sku", "stock_keeping_unit"]);

    return {
      barcode: getMappedValue(row, ["barcode", "ean", "gtin", "upc"]) || undefined,
      brandName:
        toTitleCase(getMappedValue(row, ["brand", "brand_name", "vendor", "manufacturer"])) ||
        undefined,
      categoryPath:
        getMappedValue(row, ["category", "category_path", "product_category"]) ||
        undefined,
      compareAtPrice:
        getMappedValue(row, [
          "compare_at_price_vat_incl",
          "compare_at_price",
          "was_price",
          "rrp",
        ]) || undefined,
      continueSellingOutOfStock: parseBoolean(
        getMappedValue(row, [
          "continue_selling_when_out_of_stock",
          "continue_selling",
          "oversell",
        ]),
      ),
      decision: "import",
      fulfillmentMode:
        getMappedValue(row, ["fulfillment_mode", "fulfilment_mode"]) ===
        "piessang_fulfilled"
          ? "piessang_fulfilled"
          : "seller_fulfilled",
      fullDescription:
        getMappedValue(row, ["full_description", "description_html", "body", "body_html"]) ||
        undefined,
      heightMm: getMappedValue(row, ["height_mm", "height", "parcel_height_mm"]) || undefined,
      id: `csv-row-${index + 2}`,
      lengthMm: getMappedValue(row, ["length_mm", "length", "parcel_length_mm"]) || undefined,
      mediaUrls: splitList(getMappedValue(row, ["media_urls", "image_urls", "images"])).slice(
        0,
        10,
      ),
      optionValues,
      price:
        getMappedValue(row, ["price_vat_incl", "price", "selling_price", "sale_price"]) ||
        undefined,
      productName,
      rowNumber: index + 2,
      selected: Boolean(productName && sku),
      shortDescription:
        getMappedValue(row, ["short_description", "summary", "subtitle"]) || undefined,
      sku,
      stock: getMappedValue(row, ["stock", "quantity", "qty", "inventory"]) || undefined,
      weightGrams: getMappedValue(row, ["weight_g", "weight_grams", "weight"]) || undefined,
      widthMm: getMappedValue(row, ["width_mm", "width", "parcel_width_mm"]) || undefined,
    };
  });
}

function StatusBadge({ status }: { status: SellerProductRow["status"] }) {
  const config: Record<SellerProductRow["status"], { className: string; label: string }> = {
    active: {
      className:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
      label: "Active",
    },
    admin_suspended: {
      className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
      label: "Suspended",
    },
    approved: {
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
      label: "Approved",
    },
    archived: {
      className: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300",
      label: "Archived",
    },
    changes_requested: {
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
      label: "Changes requested",
    },
    draft: {
      className: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300",
      label: "Draft",
    },
    live: {
      className:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
      label: "Live",
    },
    paused: {
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
      label: "Paused",
    },
    pending_review: {
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
      label: "Pending review",
    },
  };
  const statusConfig = config[status];

  return (
    <Badge
      className={cn(
        "rounded-md px-2 py-1 text-xs font-semibold",
        statusConfig.className,
      )}
    >
      {statusConfig.label}
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

function StockSummary({ product }: { product: SellerProductRow }) {
  if (product.fulfillmentMode === "piessang_fulfilled") {
    return (
      <span className={dashboardTableMutedTextClass}>
        Piessang managed
      </span>
    );
  }

  const variantCount = product.variants.length;

  return (
    <span className={dashboardTableMutedTextClass}>
      {variantCount > 1
        ? `${product.totalStock} total across ${variantCount} variants`
        : `${product.totalStock} in stock`}
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
              <SelectItem value="draft" className={selectItemClass}>Draft</SelectItem>
              <SelectItem value="pending_review" className={selectItemClass}>Pending review</SelectItem>
              <SelectItem value="changes_requested" className={selectItemClass}>Changes requested</SelectItem>
              <SelectItem value="approved" className={selectItemClass}>Approved</SelectItem>
              <SelectItem value="active" className={selectItemClass}>Active</SelectItem>
              <SelectItem value="live" className={selectItemClass}>Live</SelectItem>
              <SelectItem value="paused" className={selectItemClass}>Paused</SelectItem>
              <SelectItem value="admin_suspended" className={selectItemClass}>Suspended</SelectItem>
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

function CsvImportDialog({
  open,
  rows,
  status,
  onOpenChange,
  onRowsChange,
  onStatusChange,
  onImported,
}: {
  open: boolean;
  rows: CsvImportRow[];
  status: string;
  onOpenChange: (open: boolean) => void;
  onRowsChange: (rows: CsvImportRow[]) => void;
  onStatusChange: (status: string) => void;
  onImported: () => void;
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const selectedCount = rows.filter((row) => row.selected && row.decision !== "skip")
    .length;

  async function handleFile(file: File | null) {
    if (!file) {
      return;
    }

    setIsScanning(true);
    onStatusChange("Reading CSV file...");

    try {
      const text = await file.text();
      onStatusChange("Mapping product columns...");
      const mappedRows = buildCsvImportRows(text);

      if (mappedRows.length === 0) {
        onRowsChange([]);
        onStatusChange("No product rows were found in this CSV.");
        return;
      }

      onStatusChange("Checking duplicate SKUs and existing drafts...");
      const checked = await checkSellerProductCsvImport(
        mappedRows.map((csvRow) => {
          const { selected, ...row } = csvRow;
          void selected;
          return row;
        }),
      );

      if (!checked.ok || !("rows" in checked) || !checked.rows) {
        onRowsChange(mappedRows);
        onStatusChange(checked.message ?? "The CSV could not be checked.");
        return;
      }

      onRowsChange(
        checked.rows.map((row) => ({
          ...row,
          decision:
            row.duplicateExistingProductStatus === "draft"
              ? "replace_draft"
              : row.existingSkuProductId
                ? "skip"
                : "import",
          selected: !row.existingSkuProductId && Boolean(row.productName && row.sku),
        })),
      );
      onStatusChange(`${checked.rows.length} product row${checked.rows.length === 1 ? "" : "s"} ready for review.`);
    } catch {
      onRowsChange([]);
      onStatusChange("This CSV could not be read. Check the file and try again.");
    } finally {
      setIsScanning(false);
    }
  }

  async function handleImport() {
    const selectedRows = rows
      .filter((row) => row.selected)
      .map((csvRow) => {
        const { selected, ...row } = csvRow;
        void selected;
        return row;
      });

    if (selectedRows.length === 0) {
      onStatusChange("Select at least one product row to import.");
      return;
    }

    setIsImporting(true);
    onStatusChange("Creating product drafts...");

    try {
      const result = await importSellerProductCsvDrafts(selectedRows);
      onStatusChange(result.message ?? "CSV import finished.");

      if (result.ok) {
        onImported();
      }
    } finally {
      setIsImporting(false);
    }
  }

  function updateRow(rowId: string, updates: Partial<CsvImportRow>) {
    onRowsChange(
      rows.map((row) => (row.id === rowId ? { ...row, ...updates } : row)),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-5xl overflow-hidden border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
        <DialogHeader>
          <DialogTitle>Import products from CSV</DialogTitle>
          <DialogDescription>
            Upload a Piessang template or any seller CSV. Products are reviewed
            first, then saved as drafts.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-4 overflow-y-auto">
          <div className="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-white/10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                Use our exact template for the cleanest import.
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                It includes product, variant, VAT-inclusive pricing, media URL,
                and parcel metric columns.
              </p>
            </div>
            <DashboardButton type="button" onClick={downloadCsvTemplate}>
              <DownloadIcon className="size-3.5" />
              Download template
            </DashboardButton>
          </div>

          <label
            className="grid cursor-pointer place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center transition hover:border-emerald-500 hover:bg-emerald-50/70 dark:border-white/15 dark:bg-white/[0.03] dark:hover:border-emerald-400/60 dark:hover:bg-emerald-400/10"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void handleFile(event.dataTransfer.files.item(0));
            }}
          >
            <UploadIcon className="mb-3 size-8 text-emerald-700 dark:text-emerald-300" />
            <span className="text-sm font-semibold text-zinc-950 dark:text-white">
              Drop CSV here or select from your device
            </span>
            <span className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              We scan and show everything before importing.
            </span>
            <input
              accept=".csv,text/csv"
              className="sr-only"
              type="file"
              onChange={(event) => {
                void handleFile(event.target.files?.item(0) ?? null);
                event.currentTarget.value = "";
              }}
            />
          </label>

          {status ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:text-zinc-300">
              {isScanning || isImporting ? (
                <Loader2Icon className="size-4 animate-spin text-emerald-700" />
              ) : (
                <CheckCircleIcon className="size-4 text-emerald-700" />
              )}
              {status}
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className={cn(dashboardPanelClass, dashboardTableContainerClass)}>
              <Table className="table-fixed md:min-w-[980px] md:table-auto">
                <TableHeader>
                  <TableRow className={dashboardTableHeaderRowClass}>
                    <TableHead className="w-12 px-4">
                      <Checkbox
                        checked={rows.every((row) => row.selected)}
                        onCheckedChange={(checked) =>
                          onRowsChange(
                            rows.map((row) => ({
                              ...row,
                              selected: Boolean(checked),
                            })),
                          )
                        }
                      />
                    </TableHead>
                    <TableHead className={dashboardTableHeadClass}>Product</TableHead>
                    <TableHead className={dashboardTableHeadClass}>SKU</TableHead>
                    <TableHead className={dashboardTableHeadClass}>Price</TableHead>
                    <TableHead className={dashboardTableHeadClass}>Status</TableHead>
                    <TableHead className={dashboardTableHeadClass}>Import action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} className={dashboardTableRowClass}>
                      <TableCell className="px-4">
                        <Checkbox
                          checked={row.selected}
                          onCheckedChange={(checked) =>
                            updateRow(row.id, { selected: Boolean(checked) })
                          }
                        />
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <div className="min-w-0">
                          <p className={cn(dashboardTablePrimaryTextClass, "truncate")}>
                            {row.productName || `Row ${row.rowNumber}`}
                          </p>
                          <p className={cn(dashboardTableSecondaryTextClass, "truncate")}>
                            {row.brandName || "No brand"} · {row.categoryPath || "No category"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableMutedTextClass}>
                          {row.sku || "Missing"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableMutedTextClass}>
                          {row.price ? `R ${row.price}` : "Missing"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        {row.issues?.length ? (
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-200">
                            {row.issues[0]}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                            Ready
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <Select
                          value={row.decision}
                          onValueChange={(value) =>
                            updateRow(row.id, { decision: value as CsvImportDecision })
                          }
                        >
                          <SelectTrigger className="h-8 border-slate-300 bg-white text-sm dark:border-white/18 dark:bg-[#151719]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={selectContentClass}>
                            <SelectItem value="import" className={selectItemClass}>
                              Import as draft
                            </SelectItem>
                            <SelectItem
                              value="replace_draft"
                              className={selectItemClass}
                              disabled={row.duplicateExistingProductStatus !== "draft"}
                            >
                              Replace draft
                            </SelectItem>
                            <SelectItem value="skip" className={selectItemClass}>
                              Skip
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            className="bg-emerald-700 text-white hover:bg-emerald-800"
            disabled={isScanning || isImporting || selectedCount === 0}
            onClick={handleImport}
            type="button"
          >
            {isImporting ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Import {selectedCount || ""} draft{selectedCount === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenCsv?: () => void;
  onImported: () => void;
}) {
  const [linkUrl, setLinkUrl] = useState("");
  const [steps, setSteps] = useState<ImportLinkStep[]>([]);
  const [product, setProduct] = useState<ImportedProductScan | null>(null);
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const displayedSteps = useMemo(
    () =>
      steps.map((step, index) => {
        if (step.tone !== "working" || index === steps.length - 1) {
          return step;
        }

        return { ...step, tone: "success" as const };
      }),
    [steps],
  );

  function resetLinkImport() {
    setLinkUrl("");
    setSteps([]);
    setProduct(null);
    setSelectedImageUrls([]);
    setIsScanning(false);
    setIsSaving(false);
  }

  async function scanLink() {
    const url = linkUrl.trim();

    if (!url) {
      setSteps([{ message: "Paste a product page link first.", tone: "error" }]);
      return;
    }

    setIsScanning(true);
    setProduct(null);
    setSelectedImageUrls([]);
    setSteps([{ message: "Starting product import scan...", tone: "working" }]);

    try {
      const response = await fetch("/products/new/import-link", {
        body: JSON.stringify({ url }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.body) {
        throw new Error("The importer did not return a readable response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const event = JSON.parse(line) as
            | { message: string; step: string; type: "error" | "status" }
            | {
                message: string;
                product: ImportedProductScan;
                step: string;
                type: "result";
              };

          setSteps((current) => [
            ...current,
            {
              message: event.message,
              tone:
                event.type === "error"
                  ? "error"
                  : event.type === "result"
                    ? "success"
                    : "working",
            },
          ]);

          if (event.type === "result") {
            setProduct(event.product);
            setSelectedImageUrls(
              event.product.images.slice(0, 10).map((image) => image.url),
            );
          }
        }
      }
    } catch (error) {
      setSteps((current) => [
        ...current,
        {
          message:
            error instanceof Error
              ? error.message
              : "The product could not be scanned.",
          tone: "error",
        },
      ]);
    } finally {
      setIsScanning(false);
    }
  }

  async function saveImportedDraft() {
    if (!product) {
      return;
    }

    setIsSaving(true);
    setSteps((current) => [
      ...current,
      { message: "Saving imported product as a draft...", tone: "working" },
    ]);

    try {
      const result = await importSellerProductLinkDraft({
        ...product,
        images: product.images.filter((image) =>
          selectedImageUrls.includes(image.url),
        ),
      });

      setSteps((current) => [
        ...current,
        {
          message: result.message ?? "Import finished.",
          tone: result.ok ? "success" : "error",
        },
      ]);

      if (result.ok) {
        onImported();
        onOpenChange(false);
        resetLinkImport();
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);

        if (!nextOpen) {
          resetLinkImport();
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-hidden border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
        <DialogHeader>
          <DialogTitle>Import products</DialogTitle>
          <DialogDescription>
            Scan a product page, review what was found, then save it as a draft.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-4 overflow-y-auto">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-10 border-slate-300 bg-white pl-9 text-sm dark:border-white/18 dark:bg-[#151719]"
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="Paste product link here"
                  value={linkUrl}
                />
              </div>
              <DashboardButton
                className="h-10"
                disabled={isScanning || isSaving}
                onClick={scanLink}
                type="button"
              >
                {isScanning ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <SearchIcon className="size-3.5" />
                )}
                Scan
              </DashboardButton>
            </div>

            {displayedSteps.length > 0 ? (
              <div className="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
                  Import progress
                </p>
                {displayedSteps.map((step, index) => (
                  <div
                    key={`${step.message}-${index}`}
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300"
                  >
                    {step.tone === "working" ? (
                      <Loader2Icon className="size-4 animate-spin text-amber-600" />
                    ) : step.tone === "success" ? (
                      <CheckCircleIcon className="size-4 text-emerald-700" />
                    ) : (
                      <XIcon className="size-4 text-red-600" />
                    )}
                    {step.message}
                  </div>
                ))}
              </div>
            ) : null}

            {product ? (
              <div className="grid gap-4 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Product name
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {product.productName || "Not found"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Brand
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {product.brandName || "Not found"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      SKU
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {product.sku || "Will be generated"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      VAT-inclusive price
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {product.price || "Not found"}
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
                  {product.description || "No description was found."}
                </p>
                {product.images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {product.images.map((image) => {
                      const selected = selectedImageUrls.includes(image.url);

                      return (
                        <button
                          key={image.url}
                          className={cn(
                            "relative aspect-square overflow-hidden rounded-lg border bg-slate-50",
                            selected
                              ? "border-emerald-500 ring-2 ring-emerald-500/25"
                              : "border-slate-200 dark:border-white/10",
                          )}
                          onClick={() =>
                            setSelectedImageUrls((current) =>
                              current.includes(image.url)
                                ? current.filter((url) => url !== image.url)
                                : current.length >= 10
                                  ? current
                                  : [...current, image.url],
                            )
                          }
                          type="button"
                        >
                          <Image
                            alt={image.alt}
                            className="object-cover"
                            fill
                            sizes="120px"
                            src={image.url}
                            unoptimized
                          />
                          {selected ? (
                            <span className="absolute left-2 top-2 rounded-full bg-emerald-600 p-1 text-white">
                              <CheckCircleIcon className="size-3.5" />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {product ? (
            <Button
              className="bg-emerald-700 text-white hover:bg-emerald-800"
              disabled={isScanning || isSaving}
              onClick={saveImportedDraft}
              type="button"
            >
              {isSaving ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SparklesIcon className="size-4" />
              )}
              Save as draft
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [csvImportRows, setCsvImportRows] = useState<CsvImportRow[]>([]);
  const [csvImportStatus, setCsvImportStatus] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingProductAction>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const [isRunningProductAction, startProductActionTransition] = useTransition();

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
      description: "Products currently active or live.",
      id: "active_products",
      label: "Active/live",
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

  function editProduct(product: SellerProductRow) {
    router.push(`/products/${product.id}/edit`);
  }

  function openProductAction(product: SellerProductRow, action: ProductLifecycleAction) {
    const config: Record<ProductLifecycleAction, Omit<NonNullable<PendingProductAction>, "action" | "product">> = {
      activate: {
        description:
          "This will make the product available again if it is approved and ready.",
        label: "Activate product",
        tone: "default",
      },
      cancel_review: {
        description:
          "This returns the product to draft so you can edit it before submitting again.",
        label: "Cancel review",
        tone: "default",
      },
      delete_or_archive: {
        description:
          "Products with no order history are permanently deleted. Products with order history are archived instead.",
        label: "Delete or archive",
        tone: "danger",
      },
      pause: {
        description:
          "This will remove the product from active sale until you activate it again.",
        label: "Pause product",
        tone: "default",
      },
      submit_review: {
        description:
          "This validates the saved product details and sends it to admin review.",
        label: "Submit for review",
        tone: "default",
      },
    };

    setActionFeedback(null);
    setPendingAction({
      action,
      product,
      ...config[action],
    });
  }

  function runPendingProductAction() {
    if (!pendingAction) {
      return;
    }

    const action = pendingAction.action;
    const productId = pendingAction.product.id;

    startProductActionTransition(() => {
      const promise =
        action === "activate"
          ? activateSellerProduct({ productId })
          : action === "cancel_review"
            ? cancelSellerProductReview({ productId })
            : action === "delete_or_archive"
              ? deleteOrArchiveSellerProduct({ productId })
              : action === "submit_review"
                ? submitSavedSellerProductForReview({ productId })
                : pauseSellerProduct({ productId });

      void promise.then((result) => {
        setActionFeedback({
          message: result.message,
          tone: result.ok ? "success" : "error",
        });

        if (result.ok) {
          setPendingAction(null);
          router.refresh();
        }
      });
    });
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <DashboardButton className={toolbarButtonClass} type="button">
                  <UploadIcon className="size-3.5" />
                  Import
                  <ChevronDownIcon className="size-3.5" />
                </DashboardButton>
              }
            />
            <DropdownMenuContent
              align="end"
              className="w-56 border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white"
              collisionAvoidance={{
                align: "shift",
                fallbackAxisSide: "none",
                side: "flip",
              }}
              collisionPadding={12}
              sideOffset={8}
              sticky
            >
              <DropdownMenuItem
                className="cursor-pointer gap-2 px-3 py-2"
                onClick={() => setIsImportDialogOpen(true)}
              >
                <LinkIcon className="size-4" />
                Import product link
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 px-3 py-2"
                onClick={() => {
                  setCsvImportRows([]);
                  setCsvImportStatus("");
                  setIsCsvImportOpen(true);
                }}
              >
                <FileSpreadsheetIcon className="size-4" />
                Import CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        {actionFeedback ? (
          <div
            className={cn(
              "mx-4 mt-4 rounded-lg border px-3 py-2 text-sm font-semibold",
              actionFeedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200",
            )}
          >
            {actionFeedback.message}
          </div>
        ) : null}
        <Table className={dashboardTableClass}>
          <TableHeader>
            <TableRow className={dashboardTableHeaderRowClass}>
              <TableHead className={dashboardTableHeadClass}>Product</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Status</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Fulfillment</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Variants</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Stock</TableHead>
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
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="hidden size-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 md:block dark:border-white/10 dark:bg-white/[0.04]">
                        {product.primaryImage ? (
                          <Image
                            alt={product.primaryImage.altText ?? product.title}
                            className="h-full w-full object-cover"
                            height={48}
                            src={product.primaryImage.url}
                            width={48}
                          />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-slate-400 dark:text-zinc-500">
                            <PackageIcon className="size-4" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={cn(dashboardTablePrimaryTextClass, "truncate")}>
                          {product.title}
                        </p>
                        <p className={cn(dashboardTableSecondaryTextClass, "truncate")}>
                          {product.slug}
                        </p>
                      </div>
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
                    <StockSummary product={product} />
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
                        onClick={() => editProduct(product)}
                        type="button"
                      >
                        <Edit3Icon className="size-4" />
                      </Button>
                      <DashboardRowActionMenu
                        ariaLabel={`Open actions for ${product.title}`}
                      >
                        <button
                          className="flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06]"
                          onClick={() => editProduct(product)}
                          type="button"
                        >
                          <Edit3Icon className="size-4" />
                          Edit
                        </button>
                        {["draft", "changes_requested"].includes(product.status) ? (
                          <button
                            className="flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06]"
                            onClick={() => openProductAction(product, "submit_review")}
                            type="button"
                          >
                            <PackageCheckIcon className="size-4" />
                            Submit for review
                          </button>
                        ) : null}
                        {product.status === "pending_review" ? (
                          <button
                            className="flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06]"
                            onClick={() => openProductAction(product, "cancel_review")}
                            type="button"
                          >
                            <Undo2Icon className="size-4" />
                            Cancel review
                          </button>
                        ) : null}
                        {["active", "live"].includes(product.status) ? (
                          <button
                            className="flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06]"
                            onClick={() => openProductAction(product, "pause")}
                            type="button"
                          >
                            <PauseIcon className="size-4" />
                            Pause
                          </button>
                        ) : null}
                        {["approved", "paused"].includes(product.status) ? (
                          <button
                            className="flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06]"
                            onClick={() => openProductAction(product, "activate")}
                            type="button"
                          >
                            <PlayIcon className="size-4" />
                            Activate
                          </button>
                        ) : null}
                        {!["admin_suspended", "archived", "pending_review"].includes(product.status) ? (
                          <button
                            className="flex h-12 w-full items-center gap-3 px-4 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                            onClick={() => openProductAction(product, "delete_or_archive")}
                            type="button"
                          >
                            <Trash2Icon className="size-4" />
                            Delete or archive
                          </button>
                        ) : null}
                      </DashboardRowActionMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={8}
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
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open && !isRunningProductAction) {
            setPendingAction(null);
          }
        }}
      >
        {pendingAction ? (
          <DialogContent className="max-w-md border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
            <DialogHeader>
              <DialogTitle>{pendingAction.label}</DialogTitle>
              <DialogDescription>
                {pendingAction.description}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-white/10 dark:bg-white/[0.04]">
                <p className="font-semibold text-zinc-950 dark:text-white">
                  {pendingAction.product.title}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  Current status: {pendingAction.product.status.replaceAll("_", " ")}
                </p>
              </div>
              {actionFeedback?.tone === "error" ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                  {actionFeedback.message}
                </p>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button
                disabled={isRunningProductAction}
                onClick={() => setPendingAction(null)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className={cn(
                  pendingAction.tone === "danger"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-emerald-700 text-white hover:bg-emerald-800",
                )}
                disabled={isRunningProductAction}
                onClick={runPendingProductAction}
                type="button"
              >
                {isRunningProductAction ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                {pendingAction.label}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <CsvImportDialog
        open={isCsvImportOpen}
        rows={csvImportRows}
        status={csvImportStatus}
        onOpenChange={setIsCsvImportOpen}
        onRowsChange={setCsvImportRows}
        onStatusChange={setCsvImportStatus}
        onImported={() => router.refresh()}
      />
      <ProductImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onOpenCsv={() => {
          setCsvImportRows([]);
          setCsvImportStatus("");
          setIsCsvImportOpen(true);
        }}
        onImported={() => router.refresh()}
      />
    </div>
  );
}
