"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangleIcon,
  BoldIcon,
  CheckCircleIcon,
  CircleHelpIcon,
  Heading2Icon,
  Heading3Icon,
  ImagePlusIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  Loader2Icon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  PilcrowIcon,
  QuoteIcon,
  RefreshCwIcon,
  SaveIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  VideoIcon,
  XIcon,
  XCircleIcon,
} from "lucide-react";

import {
  DashboardBackButton,
  DashboardButton,
  DashboardPageHeader,
  dashboardTableActionCellClass,
  dashboardTableActionHeadClass,
  dashboardTableCellClass,
  dashboardTableClass,
  dashboardTableContainerClass,
  dashboardTableHeadClass,
  dashboardTableHeaderRowClass,
  dashboardTablePrimaryTextClass,
  dashboardTableRowClass,
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import { DashboardRowActionMenu } from "@/components/dashboard/dashboard-row-action-menu";
import { MediaManagerDialog } from "@/components/media/media-manager-dialog";
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
import { RequiredIndicator } from "@/components/ui/label";
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
import { getExchangeRequirementText } from "@/src/modules/cart/exchange-requirements";
import {
  createSellerParcelPreset,
  generateProductDescription,
  importProductLinkMedia,
  saveProductDraft,
} from "@/app/(seller)/seller/(dashboard)/products/new/actions";
import type { AdminMediaAsset } from "@/src/modules/media/admin";
import { normalizeMediaSelectionIds } from "@/src/modules/media/selection";
import { getVariantProfitability } from "@/src/modules/products/cost-price";
import { generatedProductDescriptionTextToHtml } from "@/src/modules/products/product-description";
import type {
  GoogleFulfillmentChannel,
  SellerCreateProductData,
  SellerEditableProductData,
  SellerProductCategory,
} from "@/src/modules/sellers/product-create";

type VariantOption = {
  id: string;
  name: string;
  values: string[];
};
type VariantStatus = "active" | "draft" | "sold_out" | "unavailable";
type ProductPublishStatus = "active" | "draft";
type GeneratedVariant = {
  barcode: string;
  compareAtPrice: string;
  costPrice: string;
  continueSellingOutOfStock: boolean;
  exchangeAcceptedReturnBrandsInput: string;
  exchangeConfirmationText: string;
  exchangeEmptyCylinderSize: string;
  exchangeRequiresEmpty: boolean;
  googleFulfillmentChannel: GoogleFulfillmentChannel;
  googleReturnPolicyLabel: string;
  heightMm: string;
  id: string;
  imageId: string | null;
  isFragile?: boolean;
  lengthMm: string;
  lowStockAlert: string;
  manufacturerMpn: string;
  notes: string;
  optionValues: string[];
  parcelPresetId: string | null;
  persistedVariantId?: string;
  price: string;
  shipsAlone?: boolean;
  sku: string;
  status: VariantStatus;
  stock: string;
  weightGrams: string;
  widthMm: string;
};
type SkuStatus = "available" | "checking" | "duplicate" | "error" | "idle";
type BrandSuggestion = {
  id: string;
  name: string;
  status: "active" | "pending";
};
type AiFeedback = {
  kind: "long" | "short";
  message: string;
  tone: "error" | "success";
} | null;
type DraftSaveFeedback = {
  message: string;
  tone: "error" | "success";
} | null;
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
  manufacturerMpn: string;
  price: string;
  productName: string;
  sku: string;
  sourceUrl: string;
};
type ImportLinkStep = {
  message: string;
  step: string;
  tone: "error" | "success" | "working";
};
type MediaSelectionTarget =
  | { type: "bulkVariants" }
  | { type: "product" }
  | { type: "variant"; variantId: string };
type BulkValueField = "compareAtPrice" | "costPrice" | "price" | "stock";
type BulkValueDialogState = {
  field: BulkValueField;
  label: string;
  placeholder: string;
  value: string;
} | null;
type ParcelPresetDialogTarget = { type: "product" } | { type: "variant"; variantId: string };
type ParcelPresetSaveDialogState = {
  isDefault: boolean;
  name: string;
  notes: string;
  target: ParcelPresetDialogTarget;
} | null;
type ListingChecklistItem = {
  complete: boolean;
  detail: string;
  title: string;
};
type EditorCommand =
  | "bold"
  | "createLink"
  | "formatBlock"
  | "insertOrderedList"
  | "insertUnorderedList"
  | "italic"
  | "removeFormat";

const fieldClass =
  "h-10 border-slate-300 bg-white text-sm text-zinc-950 placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500";
const textareaClass =
  "min-h-24 border-slate-300 bg-white text-sm text-zinc-950 placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500";
const labelClass = "text-sm font-semibold text-zinc-900 dark:text-white";
const selectContentClass =
  "border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white";
const selectItemClass =
  "cursor-pointer px-2 py-2 text-zinc-800 focus:bg-slate-100 focus:text-zinc-950 dark:text-zinc-200 dark:focus:bg-white/10 dark:focus:text-white";
const variantStatusConfig: Record<
  VariantStatus,
  { badgeClassName: string; label: string }
> = {
  active: {
    badgeClassName:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-200",
    label: "Active",
  },
  draft: {
    badgeClassName:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300",
    label: "Draft",
  },
  sold_out: {
    badgeClassName:
      "border-red-200 bg-red-100 text-red-700 dark:border-red-400/20 dark:bg-red-500/15 dark:text-red-200",
    label: "Sold out",
  },
  unavailable: {
    badgeClassName:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-200",
    label: "Unavailable",
  },
};
const productPublishStatusConfig: Record<
  ProductPublishStatus,
  { description: string; label: string }
> = {
  active: {
    description: "Visible on the marketplace once the product has active variants.",
    label: "Active",
  },
  draft: {
    description: "Saved internally and hidden from the marketplace.",
    label: "Draft",
  },
};
const productPublishStatusOptions = Object.entries(
  productPublishStatusConfig,
) as Array<
  [
    ProductPublishStatus,
    (typeof productPublishStatusConfig)[ProductPublishStatus],
  ]
>;
const googleFulfillmentChannelConfig: Record<
  GoogleFulfillmentChannel,
  { description: string; label: string }
> = {
  excluded: {
    description:
      "Keep this variant out of Google product listings while leaving the storefront offer unchanged.",
    label: "Excluded from Google",
  },
  local_lpg: {
    description:
      "Use for LPG and exchange offers delivered by Jurgens Energy within South Africa.",
    label: "Jurgens Energy delivery",
  },
  national_courier: {
    description:
      "Use when this exact variant can be sent by an approved courier within South Africa.",
    label: "South Africa courier",
  },
};
const googleFulfillmentChannelOptions = Object.entries(
  googleFulfillmentChannelConfig,
) as Array<
  [
    GoogleFulfillmentChannel,
    (typeof googleFulfillmentChannelConfig)[GoogleFulfillmentChannel],
  ]
>;
const googleFulfillmentChannelBadgeClass: Record<
  GoogleFulfillmentChannel,
  string
> = {
  excluded:
    "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300",
  local_lpg:
    "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200",
  national_courier:
    "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
};

function getInitialProductPublishStatus(
  status?: SellerEditableProductData["status"],
): ProductPublishStatus {
  return status === "draft" ? "draft" : "active";
}

function formatCategoryPath(
  path: string,
  categoriesByPath: Map<string, SellerProductCategory>,
) {
  const names: string[] = [];
  let currentPath = "";

  for (const slug of path.split("/")) {
    currentPath = currentPath ? `${currentPath}/${slug}` : slug;
    const category = categoriesByPath.get(currentPath);

    if (category) {
      names.push(category.name);
    }
  }

  return names.length ? names.join(" > ") : path;
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function toTitleCase(value: string) {
  return value.replace(/\S+/g, (word) => {
    const [first = "", ...rest] = word;

    return `${first.toUpperCase()}${rest.join("").toLowerCase()}`;
  });
}

function toTitleCaseInput(value: string) {
  return value.replace(/(^|[\s,-])(\S)/g, (_match, prefix: string, letter: string) =>
    `${prefix}${letter.toUpperCase()}`,
  );
}

function normalizeSkuPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function getVariantKey(optionValues: string[]) {
  return optionValues.map((value) => normalizeLookupValue(value)).join("|");
}

function generateVariantSku(baseSku: string, productName: string, optionValues: string[]) {
  const base = normalizeSkuPart(baseSku || productName || "PRODUCT") || "PRODUCT";
  const suffix = optionValues
    .map((value) => normalizeSkuPart(value).slice(0, 4))
    .filter(Boolean)
    .join("-");

  if (!suffix) {
    return base.slice(0, 50);
  }

  const maxBaseLength = Math.max(1, 49 - suffix.length);
  const boundedBase = base.slice(0, maxBaseLength).replace(/-+$/g, "");

  return `${boundedBase || "P"}-${suffix}`;
}

function getSkuStatusClass(status: SkuStatus) {
  if (status === "available") {
    return "border-emerald-500 pr-8 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20";
  }

  if (status === "duplicate") {
    return "border-red-500 pr-8 focus-visible:border-red-500 focus-visible:ring-red-500/20";
  }

  if (status === "checking") {
    return "border-amber-500 pr-8 focus-visible:border-amber-500 focus-visible:ring-amber-500/20";
  }

  if (status === "error") {
    return "border-amber-500 pr-8 focus-visible:border-amber-500 focus-visible:ring-amber-500/20";
  }

  return "pr-8";
}

function getVariantStatusSelectClass(status: VariantStatus) {
  return cn(
    "h-8 w-32 text-xs",
    variantStatusConfig[status].badgeClassName,
  );
}

function getDiscountPercent(price: string, compareAtPrice: string) {
  const priceNumber = Number(price);
  const compareAtNumber = Number(compareAtPrice);

  if (
    !Number.isFinite(priceNumber) ||
    !Number.isFinite(compareAtNumber) ||
    priceNumber <= 0 ||
    compareAtNumber <= priceNumber
  ) {
    return null;
  }

  return Math.round(((compareAtNumber - priceNumber) / compareAtNumber) * 100);
}

function formatRand(value: number) {
  return `R ${value.toFixed(2)}`;
}

const randMoneyFormatter = new Intl.NumberFormat("en-ZA", {
  currency: "ZAR",
  style: "currency",
});

const marginFormatter = new Intl.NumberFormat("en-ZA", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  style: "percent",
});

function ProfitabilityEstimate({
  costPrice,
  price,
}: {
  costPrice: string;
  price: string;
}) {
  const profitability = getVariantProfitability({
    costPrice: costPrice.trim() ? costPrice : null,
    price,
  });

  if (!costPrice.trim()) {
    return (
      <span className="text-slate-500 dark:text-zinc-400">
        Add a private cost to estimate gross profit and margin.
      </span>
    );
  }

  if (!profitability) {
    return (
      <span className="text-amber-700 dark:text-amber-300">
        Enter valid selling and cost prices to calculate profitability.
      </span>
    );
  }

  const isLoss = profitability.grossProfitCents < 0;
  const grossMargin =
    profitability.grossMarginBps === null
      ? "Unavailable"
      : marginFormatter.format(profitability.grossMarginBps / 10_000);

  return (
    <span
      className={cn(
        "font-medium",
        isLoss
          ? "text-red-600 dark:text-red-300"
          : "text-emerald-700 dark:text-emerald-300",
      )}
    >
      {isLoss ? "Estimated gross loss" : "Estimated gross profit"} (VAT-incl.
      basis): {" "}
      {randMoneyFormatter.format(profitability.grossProfitCents / 100)} · Margin {" "}
      {grossMargin}
    </span>
  );
}

function getPricingBreakdown(price: string, compareAtPrice: string) {
  const hasPrice = price.trim().length > 0;
  const hasCompareAtPrice = compareAtPrice.trim().length > 0;
  const priceNumber = Number(price);
  const compareAtNumber = Number(compareAtPrice);

  if (!hasPrice && !hasCompareAtPrice) {
    return {
      message:
        "Enter the final customer-facing selling price including VAT. Checkout should not need to add VAT on top.",
      title: "VAT-inclusive pricing",
      tone: "neutral" as const,
    };
  }

  if (!hasPrice || !Number.isFinite(priceNumber) || priceNumber <= 0) {
    return {
      message:
        "Add a valid VAT-inclusive selling price before we can calculate discounts.",
      title: "Price needed",
      tone: "warning" as const,
    };
  }

  if (!hasCompareAtPrice) {
    return {
      message:
        "Optional: add a higher VAT-inclusive compare-at price to show a markdown.",
      title: "No discount configured",
      tone: "neutral" as const,
    };
  }

  if (!Number.isFinite(compareAtNumber) || compareAtNumber <= 0) {
    return {
      message: "Compare-at price must be a valid VAT-inclusive amount.",
      title: "Invalid compare-at price",
      tone: "warning" as const,
    };
  }

  if (compareAtNumber <= priceNumber) {
    return {
      message:
        "Compare-at price must be higher than the selling price. Otherwise no discount should show.",
      title: "No discount will show",
      tone: "warning" as const,
    };
  }

  const saving = compareAtNumber - priceNumber;
  const discountPercent = Math.round((saving / compareAtNumber) * 100);

  return {
    message: `${formatRand(compareAtNumber)} compare-at - ${formatRand(priceNumber)} selling price = ${formatRand(saving)} customer saving.`,
    title: `${discountPercent}% off`,
    tone: "success" as const,
  };
}

function parsePositiveNumber(value: string) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function sanitizeWholeNumberInput(value: string) {
  return value.replace(/\D/g, "");
}

function sanitizeDecimalNumberInput(value: string) {
  const normalizedValue = value.replace(/,/g, ".");
  const [whole = "", ...decimalParts] = normalizedValue.split(".");
  const decimal = decimalParts.join("");
  const sanitizedWhole = whole.replace(/\D/g, "");
  const sanitizedDecimal = decimal.replace(/\D/g, "");

  if (normalizedValue.includes(".")) {
    return `${sanitizedWhole}.${sanitizedDecimal}`;
  }

  return sanitizedWhole;
}

function sanitizeShippingMetricInput(value: string) {
  return sanitizeDecimalNumberInput(value);
}

function formatMetricValue(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "").replace(/\.$/, "");
}

function clampPackagePreviewSize(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeStockInput(value: string) {
  return sanitizeWholeNumberInput(value);
}

function getPackagePreview(lengthMm: string, widthMm: string, heightMm: string) {
  const length = parsePositiveNumber(lengthMm);
  const width = parsePositiveNumber(widthMm);
  const height = parsePositiveNumber(heightMm);
  const hasDimensions = Boolean(length && width && height);
  const previewLength = length ?? 300;
  const previewWidth = width ?? 260;
  const previewHeight = height ?? 360;
  const millimetresPerHuman = 1800;
  const humanPreviewHeight = 118;
  const scale = humanPreviewHeight / millimetresPerHuman;

  return {
    depthPx: clampPackagePreviewSize(previewWidth * scale, 18, 112),
    hasDimensions,
    heightPx: clampPackagePreviewSize(previewHeight * scale, 24, 128),
    label: hasDimensions
      ? `${length} x ${width} x ${height} mm`
      : "Enter dimensions to shape the preview",
    widthPx: clampPackagePreviewSize(previewLength * scale, 18, 144),
  };
}

function generateSkuFromName(value: string) {
  const base = normalizeSkuPart(value)
    .split("-")
    .filter(Boolean)
    .slice(0, 4)
    .map((part) => part.slice(0, 4))
    .join("-");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${base || "PROD"}-${suffix}`;
}

function formatExchangeBrandInput(brands: string[]) {
  return brands.join(", ");
}

function parseExchangeBrandInput(value: string) {
  const brands = value
    .split(/[\n,]/)
    .map((brand) => brand.trim())
    .filter(Boolean);

  return [...new Set(brands)];
}

function getDefaultExchangeRequirementText(size: string) {
  return getExchangeRequirementText({
    emptySize: size,
    quantity: 1,
  });
}

function normalizeLookupValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getEditorTextLength(value: string) {
  if (typeof window === "undefined") {
    return value.replace(/<[^>]*>/g, "").length;
  }

  const parser = new DOMParser();
  return (parser.parseFromString(value, "text/html").body.textContent ?? "")
    .length;
}

function placeCaretAtEnd(element: HTMLElement) {
  element.focus();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function buildBrandSuggestions(
  brands: SellerCreateProductData["brands"],
  requests: SellerCreateProductData["brandRequests"],
) {
  const suggestions = new Map<string, BrandSuggestion>();

  for (const brand of brands) {
    suggestions.set(normalizeLookupValue(brand.name), {
      id: brand.id,
      name: brand.name,
      status: "active",
    });
  }

  for (const request of requests) {
    const key = normalizeLookupValue(request.name);

    if (!suggestions.has(key)) {
      suggestions.set(key, {
        id: request.id,
        name: request.name,
        status: "pending",
      });
    }
  }

  return [...suggestions.values()].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

function InfoHint({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hintRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!hintRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <span ref={hintRef} className="group/info relative inline-flex shrink-0">
      <button
        aria-label={`${label} info`}
        aria-expanded={isOpen}
        className="grid size-[18px] place-items-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-white/10 dark:bg-white/10 dark:text-zinc-400 dark:hover:bg-white/15 dark:hover:text-zinc-200"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((current) => !current);
        }}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        type="button"
      >
        <CircleHelpIcon className="size-3.5" />
      </button>
      <span
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-[80] mt-2 w-56 max-w-[min(14rem,calc(100vw-2rem))] -translate-x-1/2 whitespace-normal rounded-lg border border-slate-200 bg-white p-2 text-left font-sans text-xs font-normal leading-snug tracking-normal text-slate-600 shadow-xl group-hover/info:block dark:border-white/10 dark:bg-[#151719] dark:text-zinc-300",
          isOpen ? "block" : "hidden",
        )}
      >
        {text}
      </span>
    </span>
  );
}

function FieldLabel({
  children,
  info,
}: {
  children: React.ReactNode;
  info: string;
}) {
  const label =
    typeof children === "string" && children.trimEnd().endsWith("*")
      ? children.trimEnd().slice(0, -1).trimEnd()
      : children;
  const isRequired =
    typeof children === "string" && children.trimEnd().endsWith("*");

  return (
    <span className={cn("flex items-center gap-1.5", labelClass)}>
      {label}
      {isRequired ? <RequiredIndicator /> : null}
      <InfoHint label={String(children)} text={info} />
    </span>
  );
}

function ColumnInfoTitle({
  children,
  info,
}: {
  children: string;
  info: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <InfoHint label={children} text={info} />
    </span>
  );
}

function AiGenerateButton({
  disabled = false,
  feedback,
  isPending,
  onClick,
}: {
  disabled?: boolean;
  feedback: AiFeedback;
  isPending: boolean;
  onClick: () => void;
}) {
  return (
    <span className="relative inline-flex max-w-full shrink-0">
      <DashboardButton
        className="max-w-full px-2 text-xs sm:px-3 sm:text-[14px]"
        disabled={disabled || isPending}
        onClick={onClick}
        type="button"
      >
        <SparklesIcon className="size-3.5" />
        <span className="truncate">AI generate</span>
      </DashboardButton>
      {feedback ? (
        <span
          className={cn(
            "absolute right-0 top-[calc(100%+0.4rem)] z-50 w-64 max-w-[min(16rem,calc(100vw-2rem))] rounded-lg border bg-white p-2 text-xs leading-snug shadow-xl dark:bg-[#151719]",
            feedback.tone === "error"
              ? "border-red-200 text-red-700 dark:border-red-400/25 dark:text-red-200"
              : "border-emerald-200 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-200",
          )}
        >
          {feedback.message}
        </span>
      ) : null}
    </span>
  );
}

function ProductRichTextEditor({
  disabled = false,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  maxLength: number;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const textLength = getEditorTextLength(value);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor || editor.innerHTML === value) {
      return;
    }

    editor.innerHTML = value;
  }, [value]);

  function runCommand(command: EditorCommand, commandValue?: string) {
    if (disabled) {
      return;
    }

    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function handleInput() {
    if (disabled) {
      return;
    }

    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    const nextLength = editor.textContent?.length ?? 0;

    if (nextLength > maxLength) {
      editor.innerHTML = value;
      placeCaretAtEnd(editor);
      return;
    }

    onChange(editor.innerHTML);
  }

  function addLink() {
    if (disabled) {
      return;
    }

    setLinkHref("");
    setIsLinkDialogOpen(true);
  }

  function applyLink() {
    if (!linkHref || !URL.canParse(linkHref)) {
      return;
    }

    runCommand("createLink", linkHref);
    setIsLinkDialogOpen(false);
    setLinkHref("");
  }

  const tools = [
    {
      command: () => runCommand("formatBlock", "p"),
      icon: PilcrowIcon,
      label: "Paragraph",
    },
    {
      command: () => runCommand("formatBlock", "h2"),
      icon: Heading2Icon,
      label: "Heading 2",
    },
    {
      command: () => runCommand("formatBlock", "h3"),
      icon: Heading3Icon,
      label: "Heading 3",
    },
    { command: () => runCommand("bold"), icon: BoldIcon, label: "Bold" },
    { command: () => runCommand("italic"), icon: ItalicIcon, label: "Italic" },
    {
      command: () => runCommand("insertUnorderedList"),
      icon: ListIcon,
      label: "Bullet list",
    },
    {
      command: () => runCommand("insertOrderedList"),
      icon: ListOrderedIcon,
      label: "Numbered list",
    },
    {
      command: () => runCommand("formatBlock", "blockquote"),
      icon: QuoteIcon,
      label: "Quote",
    },
    { command: addLink, icon: LinkIcon, label: "Link" },
    { command: () => runCommand("removeFormat"), icon: XIcon, label: "Clear" },
  ];

  return (
    <>
      <div className="min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 dark:border-white/18 dark:bg-[#151719]">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50/70 p-2 dark:border-white/10 dark:bg-white/[0.04]">
          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Button
                key={tool.label}
                aria-label={tool.label}
                className="size-8 rounded-md border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                disabled={disabled}
                onClick={tool.command}
                size="icon-sm"
                title={tool.label}
                type="button"
                variant="outline"
              >
                <Icon className="size-4" />
              </Button>
            );
          })}
        </div>
        <div
          ref={editorRef}
          aria-label="Full description editor"
          className={cn(
            "rich-text-editor min-h-52 px-3 py-3 text-sm leading-6 text-zinc-950 outline-none dark:text-white",
            !value && "text-slate-400 dark:text-zinc-500",
          )}
          contentEditable={!disabled}
          data-placeholder={placeholder}
          onInput={handleInput}
          role="textbox"
          suppressContentEditableWarning
        />
        <div className="flex items-center justify-end border-t border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-white/10">
          {textLength}/{maxLength}
        </div>
      </div>
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add link</DialogTitle>
            <DialogDescription>
              Add a valid URL to the selected description text.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <label className="grid gap-1.5">
              <FieldLabel info="Use a full URL including https://.">
                URL
              </FieldLabel>
              <Input
                autoFocus
                className={fieldClass}
                onChange={(event) => setLinkHref(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }
                }}
                placeholder="https://example.com"
                value={linkHref}
              />
            </label>
          </DialogBody>
          <DialogFooter>
            <Button
              className="h-8 rounded-md border-emerald-700 bg-emerald-700 px-3 text-[14px] font-normal text-white hover:bg-emerald-800"
              onClick={applyLink}
              type="button"
            >
              Add link
            </Button>
            <Button
              className="h-8 rounded-md px-3 text-[14px] font-normal"
              onClick={() => setIsLinkDialogOpen(false)}
              type="button"
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PackageSizePreview({
  heightMm,
  lengthMm,
  widthMm,
}: {
  heightMm: string;
  lengthMm: string;
  widthMm: string;
}) {
  const preview = getPackagePreview(lengthMm, widthMm, heightMm);
  const packageStyle = {
    "--package-depth": `${preview.depthPx}px`,
    "--package-height": `${preview.heightPx}px`,
    "--package-width": `${preview.widthPx}px`,
  } as CSSProperties;

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-white">
        Package preview
        <InfoHint
          label="Package preview"
          text="A proportional parcel shape based on length, width, and height. Courier rates still use the exact values entered."
        />
      </div>
      <div
        aria-label={`Package size preview. ${preview.label}.`}
        className="package-preview-scene mt-3"
        role="img"
      >
        <span className="package-preview-height-guide" aria-hidden="true">
          <span>1.8 m</span>
        </span>
        <span className="package-preview-floor-guide" aria-hidden="true">
          <span>2 m reference</span>
        </span>
        <svg
          aria-hidden="true"
          className="package-preview-person"
          viewBox="0 0 64 180"
        >
          <path d="M32 7c9.1 0 15.7 7.3 15.7 17.4 0 9.7-6.6 18.2-15.7 18.2s-15.7-8.5-15.7-18.2C16.3 14.3 22.9 7 32 7Z" />
          <path d="M31.8 45c13.5 0 21.8 13.2 21.8 34.8v30.5c0 5.1-3.2 8.7-7.6 8.7-3.6 0-6.3-2.5-7-6.5l-2.2-13.8-1.5 28.4 9.2 38.1c1.4 5.8-2.1 10.1-7.5 10.1-4.2 0-7-2.3-7.8-6.8L32 134.6l-7.2 33.9c-.9 4.5-3.6 6.8-7.8 6.8-5.4 0-8.9-4.3-7.5-10.1l9.2-38.1-1.5-28.4-2.2 13.8c-.7 4-3.4 6.5-7 6.5-4.4 0-7.6-3.6-7.6-8.7V79.8C.4 58.2 8.5 45 22.2 45h9.6Z" />
        </svg>
        <div className="package-preview-box" style={packageStyle}>
          <span className="package-preview-face package-preview-face-front" />
          <span className="package-preview-face package-preview-face-back" />
          <span className="package-preview-face package-preview-face-right" />
          <span className="package-preview-face package-preview-face-left" />
          <span className="package-preview-face package-preview-face-top" />
          <span className="package-preview-face package-preview-face-bottom" />
        </div>
      </div>
      <p className="mt-2 truncate text-xs text-slate-600 dark:text-zinc-400">
        {preview.label}
      </p>
      {preview.hasDimensions ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
          Shape updates from the parcel dimensions.
        </p>
      ) : null}
    </div>
  );
}

function ExchangeRulesFields({
  acceptedBrandsInput,
  confirmationText,
  disabled,
  emptyCylinderSize,
  enabled,
  onAcceptedBrandsInputChange,
  onConfirmationTextChange,
  onEmptyCylinderSizeChange,
  onEnabledChange,
}: {
  acceptedBrandsInput: string;
  confirmationText: string;
  disabled: boolean;
  emptyCylinderSize: string;
  enabled: boolean;
  onAcceptedBrandsInputChange: (value: string) => void;
  onConfirmationTextChange: (value: string) => void;
  onEmptyCylinderSizeChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
}) {
  function handleEnabledChange(value: boolean) {
    onEnabledChange(value);

    if (value && !confirmationText.trim()) {
      onConfirmationTextChange(getDefaultExchangeRequirementText(emptyCylinderSize));
    }
  }

  function handleEmptyCylinderSizeChange(value: string) {
    const previousDefaultText =
      getDefaultExchangeRequirementText(emptyCylinderSize);
    const nextDefaultText = getDefaultExchangeRequirementText(value);

    onEmptyCylinderSizeChange(value);

    if (!confirmationText.trim() || confirmationText === previousDefaultText) {
      onConfirmationTextChange(nextDefaultText);
    }
  }

  return (
    <div className="grid gap-3">
      <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
        <Checkbox
          checked={enabled}
          className="mt-0.5 size-4 rounded-[4px] border-slate-300 bg-white data-checked:border-emerald-600 data-checked:bg-emerald-600 data-checked:text-white"
          disabled={disabled}
          onCheckedChange={(checked) => handleEnabledChange(Boolean(checked))}
        />
        <span>
          <span className="block font-semibold text-zinc-950 dark:text-white">
            Requires eligible empty-cylinder handover
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-zinc-400">
            Use this on exchange variants to show the required empty-cylinder
            size and accepted return brands to customers.
          </span>
        </span>
      </label>

      {enabled ? (
        <div className="grid gap-4 rounded-lg border border-orange-200 bg-orange-50/40 p-3 dark:border-orange-400/20 dark:bg-orange-500/10">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <FieldLabel info="The empty cylinder size the customer must hand over, for example 9kg, 14kg, 19kg, or 48kg.">
                Required empty size
              </FieldLabel>
              <Input
                className={fieldClass}
                disabled={disabled}
                onChange={(event) =>
                  handleEmptyCylinderSizeChange(event.target.value)
                }
                placeholder="9kg"
                value={emptyCylinderSize}
              />
            </label>
            <label className="grid gap-1.5">
              <FieldLabel info="Accepted returnable cylinder brands. Separate brands with commas or new lines.">
                Accepted return brands
              </FieldLabel>
              <Textarea
                className={cn(textareaClass, "min-h-20")}
                disabled={disabled}
                onChange={(event) =>
                  onAcceptedBrandsInputChange(event.target.value)
                }
                placeholder="Jurgens Energy, Afrox, Totalgaz"
                value={acceptedBrandsInput}
              />
            </label>
          </div>
          <label className="grid gap-1.5">
            <FieldLabel info="Additional exchange requirement text shown to customers for this option.">
              Customer exchange notice
            </FieldLabel>
            <Textarea
              className={cn(textareaClass, "min-h-20")}
              disabled={disabled}
              onChange={(event) => onConfirmationTextChange(event.target.value)}
              value={confirmationText}
            />
          </label>
          <p className="text-xs leading-5 text-slate-600 dark:text-zinc-300">
            Checkout snapshots the accepted brands and exchange notice on the
            order item so future catalog changes do not alter the fulfilment
            requirements.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function GoogleCommerceFields({
  disabled,
  fulfillmentChannel,
  manufacturerMpn,
  onFulfillmentChannelChange,
  onManufacturerMpnChange,
  onReturnPolicyLabelChange,
  returnPolicyLabel,
}: {
  disabled: boolean;
  fulfillmentChannel: GoogleFulfillmentChannel;
  manufacturerMpn: string;
  onFulfillmentChannelChange: (value: GoogleFulfillmentChannel) => void;
  onManufacturerMpnChange: (value: string) => void;
  onReturnPolicyLabelChange: (value: string) => void;
  returnPolicyLabel: string;
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-950 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100">
        These controls are internal and are never shown to storefront
        customers. They determine how this exact sellable offer can be
        represented to Google.
      </div>
      <label className="grid gap-1.5">
        <FieldLabel info="Classify the fulfilment Google may advertise for this exact variant. Excluded removes only the Google offer; it does not hide the variant from your storefront.">
          Google fulfilment channel
        </FieldLabel>
        <Select
          disabled={disabled}
          onValueChange={(value) =>
            onFulfillmentChannelChange(value as GoogleFulfillmentChannel)
          }
          value={fulfillmentChannel}
        >
          <SelectTrigger className={fieldClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentClass}>
            {googleFulfillmentChannelOptions.map(([value, config]) => (
              <SelectItem
                key={value}
                className={selectItemClass}
                value={value}
              >
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
          {googleFulfillmentChannelConfig[fulfillmentChannel].description}
        </span>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5">
          <FieldLabel info="Optional genuine manufacturer part number for this exact variant. Leave blank when the manufacturer has not supplied one.">
            Manufacturer MPN (optional)
          </FieldLabel>
          <Input
            className={fieldClass}
            disabled={disabled}
            maxLength={70}
            onChange={(event) =>
              onManufacturerMpnChange(event.target.value)
            }
            placeholder="Genuine manufacturer part number"
            value={manufacturerMpn}
          />
          <span className="text-xs leading-5 text-amber-700 dark:text-amber-300">
            Your internal SKU is not an MPN. Enter only a genuine number
            supplied by the manufacturer, or leave this blank.
          </span>
        </label>
        <label className="grid gap-1.5">
          <FieldLabel info="Optional Merchant Center return-policy label for this exact offer. It must exactly match a configured label in Merchant Center.">
            Return-policy label (optional)
          </FieldLabel>
          <Input
            className={fieldClass}
            disabled={disabled}
            maxLength={100}
            onChange={(event) =>
              onReturnPolicyLabelChange(event.target.value)
            }
            placeholder="Leave blank to use the default policy"
            value={returnPolicyLabel}
          />
          <span className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
            Leave blank to use the default Google return policy. Do not invent
            a label that is not configured in Merchant Center.
          </span>
        </label>
      </div>
    </div>
  );
}

function SkuStatusIcon({ status }: { status: SkuStatus }) {
  if (status === "available") {
    return <CheckCircleIcon className="size-4 text-emerald-600" />;
  }

  if (status === "duplicate") {
    return <XCircleIcon className="size-4 text-red-600" />;
  }

  if (status === "checking") {
    return <Loader2Icon className="size-4 animate-spin text-amber-600" />;
  }

  if (status === "error") {
    return <AlertTriangleIcon className="size-4 text-amber-600" />;
  }

  return null;
}

function ListingReadinessDrawer({
  completedCount,
  isOpen,
  items,
  onOpenChange,
}: {
  completedCount: number;
  isOpen: boolean;
  items: ListingChecklistItem[];
  onOpenChange: (open: boolean) => void;
}) {
  const totalCount = items.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label="Open listing readiness checklist"
        className="fixed right-0 top-1/2 z-40 flex h-20 w-12 -translate-y-1/2 flex-col items-center justify-center rounded-l-full border border-r-0 border-emerald-200 bg-white/90 text-emerald-800 shadow-lg backdrop-blur transition hover:w-14 hover:bg-emerald-50 dark:border-emerald-400/20 dark:bg-[#101214]/90 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
        onClick={() => onOpenChange(true)}
        type="button"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
          List
        </span>
        <span className="mt-1 text-sm font-bold">
          {completedCount}/{totalCount}
        </span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close listing readiness checklist"
            className="absolute inset-0 cursor-default bg-zinc-950/15 backdrop-blur-[1px] dark:bg-black/35"
            onClick={() => onOpenChange(false)}
            type="button"
          />
          <aside className="absolute bottom-3 right-3 top-3 flex w-[min(24rem,calc(100vw-1.5rem))] min-w-0 flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/88 text-zinc-950 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#101214]/88 dark:text-white">
            <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold">Listing readiness</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                    Complete the required listing details before publishing.
                  </p>
                </div>
                <Button
                  aria-label="Close checklist"
                  className="size-8 shrink-0 rounded-full"
                  onClick={() => onOpenChange(false)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                  <span>{completedCount} completed</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="grid gap-2">
                {items.map((item) => (
                  <div
                    key={item.title}
                    className={cn(
                      "rounded-xl border p-3 transition",
                      item.complete
                        ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-400/20 dark:bg-emerald-500/10"
                        : "border-slate-200 bg-white/78 dark:border-white/10 dark:bg-white/[0.04]",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                          item.complete
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-300 bg-white text-slate-400 dark:border-white/15 dark:bg-[#151719] dark:text-zinc-500",
                        )}
                      >
                        {item.complete ? (
                          <CheckCircleIcon className="size-3.5" />
                        ) : (
                          <span className="size-1.5 rounded-full bg-current" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-zinc-400">
                          {item.detail}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function createCombinations(options: VariantOption[]) {
  const usableOptions = options.filter(
    (option) => option.name.trim() && option.values.length > 0,
  );

  if (usableOptions.length === 0) {
    return [];
  }

  return usableOptions.reduce<string[][]>(
    (combinations, option) =>
      combinations.flatMap((combination) =>
        option.values.map((value) => [...combination, value]),
      ),
    [[]],
  );
}

function Panel({
  children,
  className,
  description,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  description?: string;
  title: string;
}) {
  return (
    <section className={cn("p-4 sm:p-5", dashboardPanelClass, className)}>
      <div className="mb-4">
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-zinc-950 dark:text-white">
          {title}
          <InfoHint label={title} text={description ?? `${title} details for this product.`} />
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-zinc-300">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MediaTile({
  asset,
  index,
  isCover,
  isDragging,
  onDragOver,
  onDragStart,
  onDrop,
  onPlay,
  onRemove,
}: {
  asset: AdminMediaAsset;
  index: number;
  isCover: boolean;
  isDragging: boolean;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragStart: () => void;
  onDrop: () => void;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const isVideo = asset.mimeType.startsWith("video/");
  const previewSrc = isVideo ? asset.thumbnailUrl : asset.publicUrl;

  return (
    <div
      className={cn(
        "group relative aspect-square cursor-grab overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition active:cursor-grabbing dark:border-white/10 dark:bg-white/[0.04]",
        isDragging &&
          "scale-[0.98] border-emerald-500 opacity-70 ring-4 ring-emerald-500/10",
      )}
      draggable
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
    >
      {previewSrc ? (
        <Image
          src={previewSrc}
          alt={asset.altText ?? asset.originalFileName ?? "Product media"}
          fill
          quality={90}
          sizes="(max-width: 640px) 45vw, 160px"
          className="object-cover"
        />
      ) : isVideo ? (
        <video
          aria-label={asset.altText ?? asset.originalFileName ?? "Product video"}
          className="size-full object-cover"
          muted
          preload="metadata"
          src={asset.publicUrl}
        >
          <track kind="captions" />
        </video>
      ) : (
        <div className="grid size-full place-items-center text-emerald-700 dark:text-emerald-300">
          <VideoIcon className="size-8" />
        </div>
      )}
      <span className="absolute left-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white/95 text-[11px] font-bold text-zinc-950 shadow-sm dark:bg-[#101214]/95 dark:text-white">
        {index + 1}
      </span>
      {isVideo ? (
        <button
          aria-label="Preview video"
          className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-emerald-700/95 text-white shadow-lg transition hover:bg-emerald-800"
          onClick={(event) => {
            event.stopPropagation();
            onPlay();
          }}
          type="button"
        >
          <PlayIcon className="ml-0.5 size-5 fill-current" />
        </button>
      ) : null}
      {isCover ? (
        <Badge className="absolute bottom-1 left-1 bg-emerald-700 text-white">
          Cover
        </Badge>
      ) : null}
      <button
        aria-label="Remove media"
        className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow-sm transition group-hover:opacity-100 dark:bg-[#101214]/90 dark:text-zinc-200"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        type="button"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}

export function ProductCreateWizard({
  data,
  enableGoogleCommerceSettings = false,
  enablePrivateCostPricing = false,
  initialProduct,
  initialPrivateCosts,
}: {
  data: SellerCreateProductData;
  enableGoogleCommerceSettings?: boolean;
  enablePrivateCostPricing?: boolean;
  initialProduct?: SellerEditableProductData | null;
  initialPrivateCosts?: {
    productCostPrice: string;
    variantCostPricesById: Record<string, string>;
  };
}) {
  const initialVariantOptions =
    initialProduct?.optionSchema.length
      ? initialProduct.optionSchema.map((option, index) => ({
          id: makeId(`option-${index}`),
          name: option.name,
          values: option.values,
        }))
      : [
          {
            id: makeId("option"),
            name: "Size",
            values: ["Small", "Medium", "Large"],
          },
        ];
  const [productName, setProductName] = useState(initialProduct?.productName ?? "");
  const [sku, setSku] = useState(initialProduct?.sku ?? "");
  const [skuStatus, setSkuStatus] = useState<SkuStatus>("idle");
  const [barcode, setBarcode] = useState(initialProduct?.barcode ?? "");
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [longDescription, setLongDescription] = useState(
    initialProduct?.longDescription ?? "",
  );
  const [aiFeedback, setAiFeedback] = useState<AiFeedback>(null);
  const [draftSaveFeedback, setDraftSaveFeedback] =
    useState<DraftSaveFeedback>(null);
  const [draftProductId, setDraftProductId] = useState<string | null>(
    initialProduct?.id ?? null,
  );
  const [isImportLinkOpen, setIsImportLinkOpen] = useState(false);
  const [importLinkUrl, setImportLinkUrl] = useState("");
  const [importLinkSteps, setImportLinkSteps] = useState<ImportLinkStep[]>([]);
  const [importedProduct, setImportedProduct] =
    useState<ImportedProductScan | null>(null);
  const [selectedImportedImageUrls, setSelectedImportedImageUrls] = useState<
    string[]
  >([]);
  const [isScanningImportLink, setIsScanningImportLink] = useState(false);
  const [isApplyingImport, startApplyImportTransition] = useTransition();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    initialProduct?.categoryId ?? null,
  );
  const [brandName, setBrandName] = useState(initialProduct?.brandName ?? "");
  const [isBrandPickerOpen, setIsBrandPickerOpen] = useState(false);
  const [mediaLibraryAssets, setMediaLibraryAssets] = useState(
    data.mediaLibrary.assets,
  );
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>(
    initialProduct?.mediaIds ?? [],
  );
  const [isReadinessOpen, setIsReadinessOpen] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [draggingMediaId, setDraggingMediaId] = useState<string | null>(null);
  const [previewVideoAsset, setPreviewVideoAsset] =
    useState<AdminMediaAsset | null>(null);
  const [mediaSelectionTarget, setMediaSelectionTarget] =
    useState<MediaSelectionTarget>({ type: "product" });
  const [price, setPrice] = useState(initialProduct?.price ?? "");
  const [compareAtPrice, setCompareAtPrice] = useState(
    initialProduct?.compareAtPrice ?? "",
  );
  const [costPrice, setCostPrice] = useState(
    initialPrivateCosts?.productCostPrice ?? "",
  );
  const [stock, setStock] = useState(initialProduct?.stock ?? "0");
  const [continueSellingOutOfStock, setContinueSellingOutOfStock] =
    useState(initialProduct?.continueSellingOutOfStock ?? false);
  const [exchangeRequiresEmpty, setExchangeRequiresEmpty] = useState(
    initialProduct?.exchangeRequiresEmpty ?? false,
  );
  const [exchangeEmptyCylinderSize, setExchangeEmptyCylinderSize] = useState(
    initialProduct?.exchangeEmptyCylinderSize ?? "",
  );
  const [exchangeAcceptedReturnBrandsInput, setExchangeAcceptedReturnBrandsInput] =
    useState(
      formatExchangeBrandInput(
        initialProduct?.exchangeAcceptedReturnBrands ?? [],
      ),
    );
  const [exchangeConfirmationText, setExchangeConfirmationText] = useState(
    initialProduct?.exchangeConfirmationText ?? "",
  );
  const [googleFulfillmentChannel, setGoogleFulfillmentChannel] =
    useState<GoogleFulfillmentChannel>(
      initialProduct?.googleFulfillmentChannel ??
        (initialProduct?.fulfillmentMode === "piessang_fulfilled"
          ? "local_lpg"
          : "national_courier"),
    );
  const [manufacturerMpn, setManufacturerMpn] = useState(
    initialProduct?.manufacturerMpn ?? "",
  );
  const [googleReturnPolicyLabel, setGoogleReturnPolicyLabel] = useState(
    initialProduct?.googleReturnPolicyLabel ?? "",
  );
  const [hasVariants, setHasVariants] = useState(initialProduct?.hasVariants ?? false);
  const [variantOptions, setVariantOptions] =
    useState<VariantOption[]>(initialVariantOptions);
  const [optionValueInputs, setOptionValueInputs] = useState<Record<string, string>>({});
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedVariant[]>(
    initialProduct?.variants.map((variant) => ({
      ...variant,
      costPrice: initialPrivateCosts?.variantCostPricesById[variant.id] ?? "",
      exchangeAcceptedReturnBrandsInput: formatExchangeBrandInput(
        variant.exchangeAcceptedReturnBrands,
      ),
      id: makeId("variant"),
      persistedVariantId: variant.id,
    })) ?? [],
  );
  const [singleVariantId, setSingleVariantId] = useState<string | null>(
    initialProduct && !initialProduct.hasVariants
      ? (initialProduct.variants[0]?.id ?? null)
      : null,
  );
  const [variantSkuStatuses, setVariantSkuStatuses] = useState<Record<string, SkuStatus>>(
    {},
  );
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [expandedVariantId, setExpandedVariantId] = useState<string | null>(null);
  const [bulkValueDialog, setBulkValueDialog] =
    useState<BulkValueDialogState>(null);
  const [parcelPresets, setParcelPresets] = useState(data.parcelPresets);
  const [parcelPresetId, setParcelPresetId] = useState<string | null>(
    initialProduct?.parcelPresetId ??
      data.parcelPresets.find((preset) => preset.isDefault)?.id ??
      null,
  );
  const [parcelPresetSaveDialog, setParcelPresetSaveDialog] =
    useState<ParcelPresetSaveDialogState>(null);
  const [parcelPresetFeedback, setParcelPresetFeedback] =
    useState<DraftSaveFeedback>(null);
  const [isSavingParcelPreset, startSaveParcelPresetTransition] = useTransition();
  const [pendingVariantCombinations, setPendingVariantCombinations] = useState<
    string[][] | null
  >(null);
  const [weightGrams, setWeightGrams] = useState(initialProduct?.weightGrams ?? "");
  const [lengthMm, setLengthMm] = useState(initialProduct?.lengthMm ?? "");
  const [widthMm, setWidthMm] = useState(initialProduct?.widthMm ?? "");
  const [heightMm, setHeightMm] = useState(initialProduct?.heightMm ?? "");
  const [fulfillmentMode, setFulfillmentMode] = useState<
    "seller_fulfilled" | "piessang_fulfilled"
  >(initialProduct?.fulfillmentMode ?? "seller_fulfilled");
  const [isGeneratingDescription, startDescriptionTransition] =
    useTransition();
  const [isSavingDraft, startSaveDraftTransition] = useTransition();
  const [productPublishStatus, setProductPublishStatus] =
    useState<ProductPublishStatus>(
      getInitialProductPublishStatus(initialProduct?.status),
    );
  const initialProductStatus = initialProduct?.status ?? "draft";
  const canFullyEditProduct =
    !["archived", "admin_suspended"].includes(initialProductStatus);
  const canSaveOperationalFields = false;
  const fullListingControlsDisabled = !canFullyEditProduct;
  const productIsLocked = Boolean(
    initialProduct && !canFullyEditProduct && !canSaveOperationalFields,
  );
  const saveDisabled = productIsLocked || isSavingDraft;

  const categoriesById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  );
  const categoriesByPath = useMemo(
    () => new Map(data.categories.map((category) => [category.path, category])),
    [data.categories],
  );
  const categoriesByParent = useMemo(() => {
    const grouped = new Map<string, SellerProductCategory[]>();

    for (const category of data.categories) {
      const key = category.parentId ?? "root";
      grouped.set(key, [...(grouped.get(key) ?? []), category]);
    }

    return grouped;
  }, [data.categories]);
  const selectedCategory = selectedCategoryId
    ? categoriesById.get(selectedCategoryId)
    : null;
  const selectedCategoryLabel = selectedCategory
    ? formatCategoryPath(selectedCategory.path, categoriesByPath)
    : "";
  const selectedCategoryChain = selectedCategory
    ? selectedCategory.path
        .split("/")
        .map((_, index, parts) =>
          categoriesByPath.get(parts.slice(0, index + 1).join("/")),
        )
        .filter(
          (category): category is SellerProductCategory => Boolean(category),
        )
    : [];
  const categorySelectorLevels = (() => {
    const levels: Array<{
      categories: SellerProductCategory[];
      label: string;
      placeholder: string;
      value: string;
    }> = [];
    let parentId: string | null = null;

    for (let index = 0; index <= selectedCategoryChain.length; index += 1) {
      const children = categoriesByParent.get(parentId ?? "root") ?? [];

      if (children.length === 0) {
        break;
      }

      const selectedAtLevel = selectedCategoryChain[index];

      levels.push({
        categories: children,
        label: index === 0 ? "Parent category" : `Subcategory level ${index}`,
        placeholder:
          index === 0
            ? "Select parent category"
            : "Optional: select a more specific category",
        value: selectedAtLevel?.id ?? "",
      });

      if (!selectedAtLevel) {
        break;
      }

      parentId = selectedAtLevel.id;
    }

    return levels;
  })();
  const brandSuggestions = useMemo(
    () => buildBrandSuggestions(data.brands, data.brandRequests),
    [data.brandRequests, data.brands],
  );
  const normalizedBrandName = normalizeLookupValue(brandName);
  const selectedBrandSuggestion =
    normalizedBrandName.length > 0
      ? brandSuggestions.find(
          (brand) => normalizeLookupValue(brand.name) === normalizedBrandName,
        )
      : null;
  const brandMatches = normalizedBrandName
    ? brandSuggestions
        .filter((brand) =>
          normalizeLookupValue(brand.name).includes(normalizedBrandName),
        )
        .slice(0, 8)
    : brandSuggestions.slice(0, 8);
  const selectedMedia = selectedMediaIds
    .map((id) => mediaLibraryAssets.find((asset) => asset.id === id))
    .filter((asset): asset is AdminMediaAsset => Boolean(asset));
  const mediaById = new Map(mediaLibraryAssets.map((asset) => [asset.id, asset]));
  const mediaDialogSelectedAssetId =
    mediaSelectionTarget.type === "variant"
      ? (generatedVariants.find(
          (variant) => variant.id === mediaSelectionTarget.variantId,
        )?.imageId ?? null)
      : null;
  const mediaDialogSelectedAssetIds =
    mediaSelectionTarget.type === "product" ? selectedMediaIds : undefined;
  const usableVariantOptions = variantOptions.filter(
    (option) => option.name.trim() && option.values.length > 0,
  );
  const variantCombinationCount = usableVariantOptions.reduce(
    (total, option) => total * option.values.length,
    usableVariantOptions.length > 0 ? 1 : 0,
  );
  const variantCombinationTone =
    variantCombinationCount > 150
      ? "danger"
      : variantCombinationCount > 50
        ? "warning"
        : "normal";
  const allGeneratedVariantsSelected =
    generatedVariants.length > 0 &&
    selectedVariantIds.length === generatedVariants.length;
  const selectedVariantCount = selectedVariantIds.length;
  const activeExpandedVariant =
    generatedVariants.find((variant) => variant.id === expandedVariantId) ?? null;
  const selectedParcelPreset = parcelPresetId
    ? parcelPresets.find((preset) => preset.id === parcelPresetId) ?? null
    : null;
  const isParcelPresetModified = selectedParcelPreset
    ? weightGrams !== formatMetricValue(selectedParcelPreset.weightGrams) ||
      lengthMm !== formatMetricValue(selectedParcelPreset.lengthMm) ||
      widthMm !== formatMetricValue(selectedParcelPreset.widthMm) ||
      heightMm !== formatMetricValue(selectedParcelPreset.heightMm)
    : false;
  const activeExpandedVariantParcelPreset = activeExpandedVariant?.parcelPresetId
    ? parcelPresets.find(
        (preset) => preset.id === activeExpandedVariant.parcelPresetId,
      ) ?? null
    : null;
  const isActiveExpandedVariantParcelPresetModified =
    activeExpandedVariant && activeExpandedVariantParcelPreset
      ? activeExpandedVariant.weightGrams !==
          formatMetricValue(activeExpandedVariantParcelPreset.weightGrams) ||
        activeExpandedVariant.lengthMm !==
          formatMetricValue(activeExpandedVariantParcelPreset.lengthMm) ||
        activeExpandedVariant.widthMm !==
          formatMetricValue(activeExpandedVariantParcelPreset.widthMm) ||
        activeExpandedVariant.heightMm !==
          formatMetricValue(activeExpandedVariantParcelPreset.heightMm)
      : false;
  const activeExpandedVariantImage = activeExpandedVariant?.imageId
    ? mediaById.get(activeExpandedVariant.imageId)
    : null;
  const activeExpandedPricingBreakdown = activeExpandedVariant
    ? getPricingBreakdown(
        activeExpandedVariant.price,
        activeExpandedVariant.compareAtPrice,
      )
    : null;
  const variantSkuSignature = generatedVariants
    .map((variant) => `${variant.id}:${variant.sku}`)
    .join("|");
  const pricingBreakdown = getPricingBreakdown(price, compareAtPrice);
  const isJurgensDelivery = fulfillmentMode === "piessang_fulfilled";
  const listingChecklistItems = useMemo<ListingChecklistItem[]>(() => {
    const priceNumber = parsePositiveNumber(price);
    const compareAtNumber = parsePositiveNumber(compareAtPrice);
    const basePricingReady =
      Boolean(priceNumber) &&
      (!compareAtPrice.trim() ||
        (Boolean(compareAtNumber) && compareAtNumber! > priceNumber!));
    const variantsReady =
      !hasVariants ||
      (generatedVariants.length > 0 &&
        generatedVariants.every((variant) => {
          const status = variantSkuStatuses[variant.id] ?? "idle";

          return variant.sku.trim() && status === "available";
        }));
    const variantPricingReady =
      !hasVariants ||
      (generatedVariants.length > 0 &&
        generatedVariants.every((variant) => {
          const variantPrice = parsePositiveNumber(variant.price);
          const variantCompareAt = parsePositiveNumber(variant.compareAtPrice);

          return (
            Boolean(variantPrice) &&
            (!variant.compareAtPrice.trim() ||
              (Boolean(variantCompareAt) && variantCompareAt! > variantPrice!))
          );
        }));
    const inventoryReady = hasVariants
      ? generatedVariants.length > 0 &&
        generatedVariants.every(
          (variant) =>
            variant.continueSellingOutOfStock ||
            (variant.stock.trim() && variant.lowStockAlert.trim()),
        )
      : continueSellingOutOfStock || stock.trim();
    const shippingReady = [weightGrams, lengthMm, widthMm, heightMm].every(
      (value) => Boolean(parsePositiveNumber(value)),
    );

    return [
      {
        complete: productName.trim().length > 0,
        detail: "Add a clear product name customers can recognize.",
        title: "Product name",
      },
      {
        complete: sku.trim().length > 0 && skuStatus === "available",
        detail: "Use a globally unique base SKU for this listing.",
        title: "Base SKU",
      },
      {
        complete: Boolean(selectedCategory),
        detail: "Choose the main category, and optional subcategories for discoverability.",
        title: "Category",
      },
      {
        complete: selectedBrandSuggestion?.status === "active",
        detail: "Select an active preset brand from the catalog.",
        title: "Brand",
      },
      {
        complete: description.trim().length > 0,
        detail: "Add the short marketplace summary shown near the product title.",
        title: "Short description",
      },
      {
        complete: getEditorTextLength(longDescription) > 0,
        detail: "Add the richer product details customers need before buying.",
        title: "Full description",
      },
      {
        complete: selectedMediaIds.length > 0,
        detail: "Select at least one image or video from the media manager.",
        title: "Product media",
      },
      {
        complete: hasVariants ? variantPricingReady : basePricingReady,
        detail: hasVariants
          ? "Enter VAT-inclusive prices on each generated variant row."
          : "Enter a VAT-inclusive selling price. Compare-at price must be higher.",
        title: "Pricing",
      },
      {
        complete: Boolean(inventoryReady),
        detail: "Set stock controls, or allow overselling when stock reaches zero.",
        title: "Inventory",
      },
      {
        complete: shippingReady,
        detail: "Provide packed weight and dimensions for accurate shipping rates.",
        title: "Parcel data",
      },
      {
        complete: true,
        detail:
          fulfillmentMode === "piessang_fulfilled"
            ? "Jurgens Energy delivery is selected for this listing."
            : "Bob Go courier delivery is selected for this listing.",
        title: "Delivery method",
      },
      {
        complete: variantsReady,
        detail: hasVariants
          ? "Generate the combinations you sell and keep every variant SKU unique."
          : "No variant combinations are required for this listing.",
        title: "Variants",
      },
    ];
  }, [
    compareAtPrice,
    continueSellingOutOfStock,
    description,
    fulfillmentMode,
    generatedVariants,
    hasVariants,
    heightMm,
    lengthMm,
    longDescription,
    price,
    productName,
    selectedBrandSuggestion,
    selectedCategory,
    selectedMediaIds.length,
    sku,
    skuStatus,
    stock,
    variantSkuStatuses,
    weightGrams,
    widthMm,
  ]);
  const completedChecklistCount = listingChecklistItems.filter(
    (item) => item.complete,
  ).length;
  const displayedImportLinkSteps = useMemo(
    () =>
      importLinkSteps.map((step, index) => {
        if (step.tone !== "working" || index === importLinkSteps.length - 1) {
          return step;
        }

        return { ...step, tone: "success" as const };
      }),
    [importLinkSteps],
  );

  useEffect(() => {
    const defaultPreset = parcelPresetId
      ? parcelPresets.find((preset) => preset.id === parcelPresetId)
      : null;

    if (
      defaultPreset &&
      !weightGrams &&
      !lengthMm &&
      !widthMm &&
      !heightMm
    ) {
      setWeightGrams(formatMetricValue(defaultPreset.weightGrams));
      setLengthMm(formatMetricValue(defaultPreset.lengthMm));
      setWidthMm(formatMetricValue(defaultPreset.widthMm));
      setHeightMm(formatMetricValue(defaultPreset.heightMm));
    }
  }, [heightMm, lengthMm, parcelPresetId, parcelPresets, weightGrams, widthMm]);

  useEffect(() => {
    const normalizedSku = sku.trim();

    if (!normalizedSku) {
      setSkuStatus("idle");
      return;
    }

    setSkuStatus("checking");
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/admin/products/new/check-sku?sku=${encodeURIComponent(normalizedSku)}${
            draftProductId ? `&productId=${encodeURIComponent(draftProductId)}` : ""
          }`,
          { signal: controller.signal },
        );
        const result = (await response.json()) as {
          available?: boolean;
          ok?: boolean;
        };

        if (!response.ok || !result.ok) {
          setSkuStatus("error");
          return;
        }

        setSkuStatus(result.available ? "available" : "duplicate");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSkuStatus("error");
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [draftProductId, sku]);

  useEffect(() => {
    const skuEntries = variantSkuSignature
      ? variantSkuSignature.split("|").map((entry) => {
          const [id = "", ...skuParts] = entry.split(":");

          return {
            id,
            sku: skuParts.join(":"),
          };
        })
      : [];

    if (skuEntries.length === 0) {
      setVariantSkuStatuses({});
      return;
    }

    const normalizedCounts = new Map<string, number>();

    for (const variant of skuEntries) {
      const normalizedSku = normalizeLookupValue(variant.sku);

      if (normalizedSku) {
        normalizedCounts.set(
          normalizedSku,
          (normalizedCounts.get(normalizedSku) ?? 0) + 1,
        );
      }
    }

    const initialStatuses: Record<string, SkuStatus> = Object.fromEntries(
      skuEntries.map((variant) => {
        const normalizedSku = normalizeLookupValue(variant.sku);

        if (!normalizedSku) {
          return [variant.id, "idle" satisfies SkuStatus];
        }

        if ((normalizedCounts.get(normalizedSku) ?? 0) > 1) {
          return [variant.id, "duplicate" satisfies SkuStatus];
        }

        return [variant.id, "checking" satisfies SkuStatus];
      }),
    );

    setVariantSkuStatuses(initialStatuses);

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const uniqueVariants = skuEntries.filter((variant) => {
        const normalizedSku = normalizeLookupValue(variant.sku);

        return normalizedSku && (normalizedCounts.get(normalizedSku) ?? 0) === 1;
      });

      const results = await Promise.allSettled(
        uniqueVariants.map(async (variant) => {
          try {
            const response = await fetch(
              `/admin/products/new/check-sku?sku=${encodeURIComponent(variant.sku.trim())}${
                draftProductId ? `&productId=${encodeURIComponent(draftProductId)}` : ""
              }`,
              { signal: controller.signal },
            );
            const result = (await response.json()) as {
              available?: boolean;
              ok?: boolean;
            };

            if (!response.ok || !result.ok) {
              return { id: variant.id, status: "error" as SkuStatus };
            }

            return {
              id: variant.id,
              status: result.available
                ? ("available" as SkuStatus)
                : ("duplicate" as SkuStatus),
            };
          } catch (error) {
            if ((error as Error).name === "AbortError") {
              throw error;
            }

            return { id: variant.id, status: "error" as SkuStatus };
          }
        }),
      );

      setVariantSkuStatuses((current) => {
        const next = { ...current };

        for (const result of results) {
          if (result.status === "fulfilled") {
            next[result.value.id] = result.value.status;
          }
        }

        return next;
      });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [draftProductId, variantSkuSignature]);

  useEffect(() => {
    if (!aiFeedback) {
      return;
    }

    const timeout = window.setTimeout(() => setAiFeedback(null), 5000);

    return () => window.clearTimeout(timeout);
  }, [aiFeedback]);

  function selectCategory(category: SellerProductCategory) {
    setSelectedCategoryId(category.id);
  }

  function clearCategoryLevel(levelIndex: number) {
    const fallbackCategory = selectedCategoryChain[levelIndex - 1];

    setSelectedCategoryId(fallbackCategory?.id ?? null);
  }

  function mergeMediaAssets(assets: AdminMediaAsset[]) {
    setMediaLibraryAssets((current) => {
      const nextById = new Map(current.map((asset) => [asset.id, asset]));

      for (const asset of assets) {
        nextById.set(asset.id, asset);
      }

      return Array.from(nextById.values());
    });
  }

  function addMedia(asset: AdminMediaAsset) {
    mergeMediaAssets([asset]);
    setSelectedMediaIds((current) =>
      current.includes(asset.id) || current.length >= 10
        ? current
        : [...current, asset.id],
    );
  }

  function openProductMediaManager() {
    if (fullListingControlsDisabled) {
      return;
    }

    setMediaSelectionTarget({ type: "product" });
    setIsMediaOpen(true);
  }

  function openVariantMediaManager(variantId: string) {
    if (fullListingControlsDisabled) {
      return;
    }

    setMediaSelectionTarget({ type: "variant", variantId });
    setIsMediaOpen(true);
  }

  function openBulkVariantMediaManager() {
    setMediaSelectionTarget({ type: "bulkVariants" });
    setIsMediaOpen(true);
  }

  function handleMediaSelect(asset: AdminMediaAsset) {
    if (mediaSelectionTarget.type === "product") {
      addMedia(asset);
      return;
    }

    if (mediaSelectionTarget.type === "variant") {
      updateGeneratedVariant(mediaSelectionTarget.variantId, {
        imageId: asset.id,
      });
      return;
    }

    updateBulkVariants({ imageId: asset.id });
  }

  function handleMediaSelectMany(assets: AdminMediaAsset[]) {
    mergeMediaAssets(assets);

    if (mediaSelectionTarget.type !== "product") {
      const [asset] = assets;

      if (asset) {
        handleMediaSelect(asset);
      }

      return;
    }

    setSelectedMediaIds(
      normalizeMediaSelectionIds(
        assets.map((asset) => asset.id),
        10,
      ),
    );
  }

  function moveSelectedMedia(fromId: string, toId: string) {
    if (fromId === toId) {
      return;
    }

    setSelectedMediaIds((current) => {
      const fromIndex = current.indexOf(fromId);
      const toIndex = current.indexOf(toId);

      if (fromIndex === -1 || toIndex === -1) {
        return current;
      }

      const next = [...current];
      const [movedId] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, movedId);

      return next;
    });
  }

  function updateVariantOption(optionId: string, patch: Partial<VariantOption>) {
    setVariantOptions((current) =>
      current.map((option) =>
        option.id === optionId ? { ...option, ...patch } : option,
      ),
    );
  }

  function addVariantOptionValue(optionId: string, value?: string) {
    const rawValue = (value ?? optionValueInputs[optionId] ?? "").trim();

    if (!rawValue) {
      return;
    }

    const nextValue = toTitleCase(rawValue);

    setVariantOptions((current) =>
      current.map((option) => {
        if (option.id !== optionId) {
          return option;
        }

        const valueExists = option.values.some(
          (value) => normalizeLookupValue(value) === normalizeLookupValue(nextValue),
        );

        return valueExists
          ? option
          : { ...option, values: [...option.values, nextValue] };
      }),
    );
    setOptionValueInputs((current) => ({ ...current, [optionId]: "" }));
  }

  function addVariantOptionValues(optionId: string, value: string) {
    const values = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    for (const nextValue of values) {
      addVariantOptionValue(optionId, nextValue);
    }
  }

  function removeVariantOptionValue(optionId: string, valueToRemove: string) {
    setVariantOptions((current) =>
      current.map((option) =>
        option.id === optionId
          ? {
              ...option,
              values: option.values.filter((value) => value !== valueToRemove),
            }
          : option,
      ),
    );
  }

  function updateGeneratedVariant(
    variantId: string,
    patch: Partial<GeneratedVariant>,
  ) {
    setGeneratedVariants((current) =>
      current.map((variant) =>
        variant.id === variantId ? { ...variant, ...patch } : variant,
      ),
    );
  }

  function removeGeneratedVariant(variantId: string) {
    setGeneratedVariants((current) =>
      current.filter((variant) => variant.id !== variantId),
    );
    setSelectedVariantIds((current) => current.filter((id) => id !== variantId));
    setVariantSkuStatuses((current) => {
      const next = { ...current };
      delete next[variantId];
      return next;
    });
    setExpandedVariantId((current) => (current === variantId ? null : current));
  }

  function removeGeneratedVariants(variantIds: string[]) {
    const idsToRemove = new Set(variantIds);

    setGeneratedVariants((current) =>
      current.filter((variant) => !idsToRemove.has(variant.id)),
    );
    setSelectedVariantIds((current) =>
      current.filter((id) => !idsToRemove.has(id)),
    );
    setVariantSkuStatuses((current) => {
      const next = { ...current };

      for (const variantId of idsToRemove) {
        delete next[variantId];
      }

      return next;
    });
    setExpandedVariantId((current) =>
      current && idsToRemove.has(current) ? null : current,
    );
  }

  function toggleVariantSelection(variantId: string) {
    setSelectedVariantIds((current) =>
      current.includes(variantId)
        ? current.filter((id) => id !== variantId)
        : [...current, variantId],
    );
  }

  function getBulkVariantIds() {
    return selectedVariantIds.length > 0
      ? selectedVariantIds
      : generatedVariants.map((variant) => variant.id);
  }

  function updateBulkVariants(patch: Partial<GeneratedVariant>) {
    const targetIds = new Set(getBulkVariantIds());

    setGeneratedVariants((current) =>
      current.map((variant) =>
        targetIds.has(variant.id) ? { ...variant, ...patch } : variant,
      ),
    );
  }

  function applyParcelPresetToProduct(presetId: string | null) {
    setParcelPresetId(presetId);

    if (!presetId) {
      return;
    }

    const preset = parcelPresets.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    setWeightGrams(formatMetricValue(preset.weightGrams));
    setLengthMm(formatMetricValue(preset.lengthMm));
    setWidthMm(formatMetricValue(preset.widthMm));
    setHeightMm(formatMetricValue(preset.heightMm));
  }

  function applyParcelPresetToVariant(variantId: string, presetId: string | null) {
    const preset = presetId
      ? parcelPresets.find((item) => item.id === presetId)
      : null;

    updateGeneratedVariant(variantId, {
      heightMm: preset ? formatMetricValue(preset.heightMm) : "",
      lengthMm: preset ? formatMetricValue(preset.lengthMm) : "",
      parcelPresetId: presetId,
      weightGrams: preset ? formatMetricValue(preset.weightGrams) : "",
      widthMm: preset ? formatMetricValue(preset.widthMm) : "",
    });
  }

  function applyParcelPresetToSelectedVariants(presetId: string) {
    const preset = parcelPresets.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    updateBulkVariants({
      heightMm: formatMetricValue(preset.heightMm),
      lengthMm: formatMetricValue(preset.lengthMm),
      parcelPresetId: preset.id,
      weightGrams: formatMetricValue(preset.weightGrams),
      widthMm: formatMetricValue(preset.widthMm),
    });
  }

  function openParcelPresetSaveDialog(target: ParcelPresetDialogTarget) {
    setParcelPresetFeedback(null);
    setParcelPresetSaveDialog({
      isDefault: false,
      name: "",
      notes: "",
      target,
    });
  }

  function saveParcelPresetFromDialog() {
    if (!parcelPresetSaveDialog) {
      return;
    }

    const target = parcelPresetSaveDialog.target;
    const source =
      target.type === "variant"
        ? generatedVariants.find((variant) => variant.id === target.variantId)
        : null;
    const presetInput = {
      heightMm:
        target.type === "variant"
          ? (source?.heightMm ?? "")
          : heightMm,
      isDefault: parcelPresetSaveDialog.isDefault,
      lengthMm:
        target.type === "variant"
          ? (source?.lengthMm ?? "")
          : lengthMm,
      name: parcelPresetSaveDialog.name,
      notes: parcelPresetSaveDialog.notes,
      weightGrams:
        target.type === "variant"
          ? (source?.weightGrams ?? "")
          : weightGrams,
      widthMm:
        target.type === "variant"
          ? (source?.widthMm ?? "")
          : widthMm,
    };

    setParcelPresetFeedback(null);
    startSaveParcelPresetTransition(() => {
      void createSellerParcelPreset(presetInput).then((result) => {
        if (!result.ok || !result.preset) {
          setParcelPresetFeedback({
            message: result.message ?? "Could not save this parcel preset.",
            tone: "error",
          });
          return;
        }

        setParcelPresets((current) => {
          const next = result.preset?.isDefault
            ? current.map((preset) => ({ ...preset, isDefault: false }))
            : current;

          return [...next, result.preset!].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        });

        if (target.type === "variant") {
          applyParcelPresetToVariant(
            target.variantId,
            result.preset.id,
          );
        } else {
          applyParcelPresetToProduct(result.preset.id);
        }

        setParcelPresetFeedback({
          message: result.message ?? "Parcel preset saved.",
          tone: "success",
        });
        setParcelPresetSaveDialog(null);
      });
    });
  }

  function openBulkValueDialog(
    field: BulkValueField,
    label: string,
    placeholder: string,
  ) {
    setBulkValueDialog({
      field,
      label,
      placeholder,
      value: "",
    });
  }

  function applyBulkValueDialog() {
    if (!bulkValueDialog) {
      return;
    }

    updateBulkVariants({
      [bulkValueDialog.field]: bulkValueDialog.value,
    } as Partial<GeneratedVariant>);
    setBulkValueDialog(null);
  }

  function applyGeneratedVariants(combinations: string[][]) {
    const existingByKey = new Map(
      generatedVariants.map((variant) => [
        getVariantKey(variant.optionValues),
        variant,
      ]),
    );

    const nextVariants = combinations.map((optionValues) => {
      const existingVariant = existingByKey.get(getVariantKey(optionValues));

      return {
        barcode: "",
        compareAtPrice,
        costPrice,
        continueSellingOutOfStock,
        exchangeAcceptedReturnBrandsInput: "",
        exchangeConfirmationText: "",
        exchangeEmptyCylinderSize: "",
        exchangeRequiresEmpty: false,
        googleFulfillmentChannel,
        googleReturnPolicyLabel: "",
        heightMm,
        id: makeId("variant"),
        imageId: selectedMediaIds[0] ?? null,
        lengthMm,
        lowStockAlert: "5",
        manufacturerMpn: "",
        notes: "",
        optionValues,
        parcelPresetId,
        price,
        sku: generateVariantSku(sku, productName, optionValues),
        status: "active" as VariantStatus,
        stock,
        weightGrams,
        widthMm,
        ...existingVariant,
      };
    });

    setGeneratedVariants(nextVariants);
    setSelectedVariantIds([]);
    setExpandedVariantId(null);
    setPendingVariantCombinations(null);
  }

  function generateVariants() {
    const combinations = createCombinations(variantOptions);

    if (combinations.length > 150) {
      setPendingVariantCombinations(combinations);
      return;
    }

    applyGeneratedVariants(combinations);
  }

  function handleGenerateDescription(kind: "long" | "short") {
    const name = productName.trim();

    if (name.length < 2) {
      setAiFeedback({
        kind,
        message: "Enter a product name before generating copy.",
        tone: "error",
      });
      return;
    }

    setAiFeedback(null);
    startDescriptionTransition(() => {
      void generateProductDescription({
        brandName: brandName.trim() || undefined,
        categoryName: selectedCategoryLabel || undefined,
        kind,
        productName: name,
        shortDescription:
          kind === "long" ? description.trim() || undefined : undefined,
      }).then((result) => {
        if (result.ok && result.description) {
          if (kind === "short") {
            setDescription(result.description.slice(0, 400));
          } else {
            setLongDescription(
              generatedProductDescriptionTextToHtml(
                result.description.slice(0, 2000),
              ),
            );
          }
          setAiFeedback({
            kind,
            message: "AI draft generated. Review before saving.",
            tone: "success",
          });
          return;
        }

        setAiFeedback({
          kind,
          message: result.message ?? "Could not generate copy.",
          tone: "error",
        });
      });
    });
  }

  function getProductDraftInput(status: ProductPublishStatus = productPublishStatus) {
    return {
      barcode,
      brandName,
      categoryId: selectedCategoryId,
      compareAtPrice,
      ...(enablePrivateCostPricing ? { costPrice } : {}),
      continueSellingOutOfStock,
      description,
      exchangeAcceptedReturnBrands: parseExchangeBrandInput(
        exchangeAcceptedReturnBrandsInput,
      ),
      exchangeConfirmationText,
      exchangeEmptyCylinderSize,
      exchangeRequiresEmpty,
      fulfillmentMode,
      ...(enableGoogleCommerceSettings
        ? {
            googleFulfillmentChannel,
            googleReturnPolicyLabel,
            manufacturerMpn,
          }
        : {}),
      hasVariants,
      heightMm,
      lengthMm,
      longDescription,
      mediaIds: selectedMediaIds,
      optionSchema: hasVariants
        ? usableVariantOptions.map((option) => ({
            name: option.name,
            values: option.values,
          }))
        : [],
      parcelPresetId,
      price,
      productId: draftProductId,
      productName,
      singleVariantId: hasVariants
        ? null
        : singleVariantId ?? generatedVariants[0]?.persistedVariantId ?? null,
      sku,
      status,
      stock,
      variants: hasVariants
        ? generatedVariants.map((variant) => ({
            barcode: variant.barcode,
            compareAtPrice: variant.compareAtPrice,
            ...(enablePrivateCostPricing
              ? { costPrice: variant.costPrice }
              : {}),
            continueSellingOutOfStock: variant.continueSellingOutOfStock,
            exchangeAcceptedReturnBrands: parseExchangeBrandInput(
              variant.exchangeAcceptedReturnBrandsInput,
            ),
            exchangeConfirmationText: variant.exchangeConfirmationText,
            exchangeEmptyCylinderSize: variant.exchangeEmptyCylinderSize,
            exchangeRequiresEmpty: variant.exchangeRequiresEmpty,
            ...(enableGoogleCommerceSettings
              ? {
                  googleFulfillmentChannel:
                    variant.googleFulfillmentChannel,
                  googleReturnPolicyLabel:
                    variant.googleReturnPolicyLabel,
                  manufacturerMpn: variant.manufacturerMpn,
                }
              : {}),
            heightMm: variant.heightMm,
            imageId: variant.imageId,
            lengthMm: variant.lengthMm,
            lowStockAlert: variant.lowStockAlert,
            notes: variant.notes,
            optionValues: variant.optionValues,
            parcelPresetId: variant.parcelPresetId,
            persistedVariantId: variant.persistedVariantId,
            price: variant.price,
            sku: variant.sku,
            status: variant.status,
            stock: variant.stock,
            weightGrams: variant.weightGrams,
            widthMm: variant.widthMm,
          }))
        : [],
      weightGrams,
      widthMm,
    };
  }

  function handleSaveProduct(status: ProductPublishStatus) {
    if (!canFullyEditProduct) {
      setDraftSaveFeedback({
        message: "This product status is locked from full editing.",
        tone: "error",
      });
      return;
    }

    setDraftSaveFeedback(null);
    startSaveDraftTransition(() => {
      void saveProductDraft(getProductDraftInput(status)).then((result) => {
        if (result.ok) {
          setDraftProductId(result.productId ?? draftProductId);
          setProductPublishStatus(status);
          if (hasVariants) {
            setGeneratedVariants((current) =>
              current.map((variant, index) => ({
                ...variant,
                persistedVariantId:
                  result.variantIds?.[index] ?? variant.persistedVariantId,
              })),
            );
          } else {
            setSingleVariantId(result.variantIds?.[0] ?? singleVariantId);
          }
          setDraftSaveFeedback({
            message: result.message ?? "Product saved.",
            tone: "success",
          });
          return;
        }

        setDraftSaveFeedback({
          message: result.message ?? "Could not save this product.",
          tone: "error",
        });
      });
    });
  }

  async function handleScanImportLink() {
    const url = importLinkUrl.trim();

    if (!url) {
      setImportLinkSteps([
        {
          message: "Paste a product page link first.",
          step: "url",
          tone: "error",
        },
      ]);
      return;
    }

    setIsScanningImportLink(true);
    setImportedProduct(null);
    setSelectedImportedImageUrls([]);
    setImportLinkSteps([
      {
        message: "Starting product import scan...",
        step: "start",
        tone: "working",
      },
    ]);

    try {
      const response = await fetch("/admin/products/new/import-link", {
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
            | {
                message: string;
                step: string;
                type: "error" | "status";
              }
            | {
                message: string;
                product: ImportedProductScan;
                step: string;
                type: "result";
              };

          setImportLinkSteps((current) => [
            ...current,
            {
              message: event.message,
              step: event.step,
              tone:
                event.type === "error"
                  ? "error"
                  : event.type === "result"
                    ? "success"
                    : "working",
            },
          ]);

          if (event.type === "result") {
            setImportedProduct(event.product);
            setSelectedImportedImageUrls(
              event.product.images.slice(0, 10).map((image) => image.url),
            );
          }
        }
      }
    } catch (error) {
      setImportLinkSteps((current) => [
        ...current,
        {
          message:
            error instanceof Error
              ? error.message
              : "The product could not be scanned.",
          step: "error",
          tone: "error",
        },
      ]);
    } finally {
      setIsScanningImportLink(false);
    }
  }

  function toggleImportedImage(url: string) {
    setSelectedImportedImageUrls((current) =>
      current.includes(url)
        ? current.filter((item) => item !== url)
        : current.length >= 10
          ? current
          : [...current, url],
    );
  }

  function applyImportedProduct() {
    if (!importedProduct) {
      return;
    }

    setImportLinkSteps((current) => [
      ...current,
      {
        message: "Applying the imported details to your draft...",
        step: "apply-details",
        tone: "working",
      },
    ]);

    if (importedProduct.productName) {
      setProductName(toTitleCase(importedProduct.productName).slice(0, 240));
    }

    if (importedProduct.sku) {
      setSku(normalizeSkuPart(importedProduct.sku));
    } else if (importedProduct.productName && !sku.trim()) {
      setSku(generateSkuFromName(importedProduct.productName));
    }

    if (importedProduct.barcode) {
      setBarcode(importedProduct.barcode);
    }

    if (importedProduct.manufacturerMpn) {
      setManufacturerMpn(importedProduct.manufacturerMpn);
    }

    if (importedProduct.brandName) {
      setBrandName(toTitleCaseInput(importedProduct.brandName).slice(0, 120));
    }

    if (importedProduct.description) {
      setDescription(importedProduct.description.slice(0, 400));
    }

    if (importedProduct.longDescription) {
      setLongDescription(importedProduct.longDescription);
    }

    if (importedProduct.price) {
      setPrice(sanitizeDecimalNumberInput(importedProduct.price));
    }

    if (importedProduct.compareAtPrice) {
      setCompareAtPrice(sanitizeDecimalNumberInput(importedProduct.compareAtPrice));
    }

    const selectedImages = importedProduct.images.filter((image) =>
      selectedImportedImageUrls.includes(image.url),
    );

    if (selectedImages.length === 0) {
      setImportLinkSteps((current) => [
        ...current,
        {
          message: "Product details were added. No images were selected.",
          step: "complete",
          tone: "success",
        },
      ]);
      setIsImportLinkOpen(false);
      return;
    }

    startApplyImportTransition(() => {
      void importProductLinkMedia({ images: selectedImages }).then((result) => {
        if (result.ok && result.assets) {
          mergeMediaAssets(result.assets);
          setSelectedMediaIds((current) => {
            const next = [...current];

            for (const asset of result.assets ?? []) {
              if (!next.includes(asset.id) && next.length < 10) {
                next.push(asset.id);
              }
            }

            return next;
          });
          setImportLinkSteps((current) => [
            ...current,
            {
              message: result.message ?? "Imported images were added.",
              step: "import-media",
              tone: "success",
            },
          ]);
          setIsImportLinkOpen(false);
          return;
        }

        setImportLinkSteps((current) => [
          ...current,
          {
            message:
              result.message ??
              "Product details were added, but images could not be imported.",
            step: "import-media",
            tone: "error",
          },
        ]);
      });
    });
  }

  return (
    <div className="grid gap-5">
      <ListingReadinessDrawer
        completedCount={completedChecklistCount}
        isOpen={isReadinessOpen}
        items={listingChecklistItems}
        onOpenChange={setIsReadinessOpen}
      />

      <DashboardPageHeader
        breadcrumbs={[
          "Products",
          initialProduct ? "Edit product" : "New product",
        ]}
        className="mb-0"
        title={initialProduct ? "Edit product" : "Create new product"}
      />

      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <DashboardBackButton href="/products" label="Back to products" />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DashboardButton nativeButton={false} render={<Link href="/products" />}>
            Cancel
          </DashboardButton>
          <DashboardButton
            disabled={fullListingControlsDisabled || isSavingDraft}
            onClick={() => {
              setIsImportLinkOpen(true);
              setImportedProduct(null);
              setImportLinkSteps([]);
            }}
            type="button"
          >
            <LinkIcon className="size-3.5" />
            Import from product link
          </DashboardButton>
          <DashboardButton
            disabled={saveDisabled}
            onClick={() => handleSaveProduct("draft")}
            type="button"
          >
            {isSavingDraft ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <SaveIcon className="size-3.5" />
            )}
            {isSavingDraft ? "Saving..." : "Save draft"}
          </DashboardButton>
          <DashboardButton
            className="border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white"
            disabled={saveDisabled}
            onClick={() => handleSaveProduct("active")}
            type="button"
          >
            {isSavingDraft ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <SaveIcon className="size-3.5" />
            )}
            {isSavingDraft ? "Saving..." : "Save active"}
          </DashboardButton>
        </div>
      </div>
      {productIsLocked || canSaveOperationalFields ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
          {canSaveOperationalFields
            ? `This product is currently ${initialProductStatus.replaceAll("_", " ")}. Core listing fields are locked, but operational fields such as price, stock, variant availability, and parcel data can be updated.`
            : `This product is currently ${initialProductStatus.replaceAll("_", " ")}. Full listing edits are locked for this status.`}
        </div>
      ) : null}
      {draftSaveFeedback ? (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            draftSaveFeedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100",
          )}
        >
          {draftSaveFeedback.message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-4">
          <Panel title="Basic information">
            <div className="grid gap-4">
              <label className="grid gap-1.5">
                <FieldLabel info="The customer-facing product name. Each word is automatically title cased.">
                  Product name *
                </FieldLabel>
                <div className="relative">
                  <Input
                    className={cn(fieldClass, "pr-16")}
                    disabled={fullListingControlsDisabled}
                    maxLength={240}
                    onChange={(event) => setProductName(event.target.value)}
                    onBlur={() => setProductName((current) => toTitleCase(current))}
                    placeholder="Enter product name"
                    value={productName}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    {productName.length}/240
                  </span>
                </div>
              </label>

              <label className="grid gap-1.5">
                <FieldLabel info="A unique stock keeping unit. Google Merchant Center uses this as the offer ID, so changing it after publication creates a new Google offer.">
                  SKU *
                </FieldLabel>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    className={fieldClass}
                    disabled={fullListingControlsDisabled}
                    maxLength={50}
                    onChange={(event) =>
                      setSku(normalizeSkuPart(event.target.value))
                    }
                    placeholder="Enter SKU"
                    value={sku}
                  />
                  <DashboardButton
                    className="h-10"
                    disabled={fullListingControlsDisabled}
                    onClick={() => setSku(generateSkuFromName(productName))}
                    type="button"
                  >
                    <RefreshCwIcon className="size-3.5" />
                    Generate
                  </DashboardButton>
                </div>
                {skuStatus !== "idle" ? (
                  <p
                    className={cn(
                      "text-xs font-medium",
                      skuStatus === "available"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : skuStatus === "duplicate"
                          ? "text-red-600 dark:text-red-300"
                          : "text-slate-500 dark:text-zinc-400",
                    )}
                  >
                    {skuStatus === "checking"
                      ? "Checking SKU..."
                      : skuStatus === "available"
                        ? "SKU is available."
                        : skuStatus === "duplicate"
                          ? "This SKU is already in use."
                          : "Could not check SKU availability. Try again."}
                  </p>
                ) : null}
              </label>

              <label className="grid gap-1.5">
                <FieldLabel info="Optional barcode or supplier identifier for this main listing. Variants can still have their own barcode later.">
                  Barcode
                </FieldLabel>
                <Input
                  className={fieldClass}
                  disabled={fullListingControlsDisabled}
                  onChange={(event) => setBarcode(event.target.value)}
                  placeholder="Enter barcode"
                  value={barcode}
                />
              </label>

              <label className="grid gap-1.5">
                <FieldLabel info="Draft products are saved internally and hidden from the marketplace. Active products can sell when their variants are active and in stock.">
                  Product status
                </FieldLabel>
                <Select
                  disabled={fullListingControlsDisabled}
                  value={productPublishStatus}
                  onValueChange={(value) =>
                    setProductPublishStatus(value as ProductPublishStatus)
                  }
                >
                  <SelectTrigger className="h-10 border-slate-300 bg-white text-sm text-zinc-950 dark:border-white/18 dark:bg-[#151719] dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {productPublishStatusOptions.map(([status, config]) => (
                      <SelectItem
                        key={status}
                        value={status}
                        className={selectItemClass}
                      >
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                  {productPublishStatusConfig[productPublishStatus].description}
                </p>
              </label>

              <div className="grid gap-1.5">
                <FieldLabel info="Select a parent category first, then optionally choose more specific subcategories.">
                  Category *
                </FieldLabel>
                <div className="grid min-w-0 gap-2">
                  {categorySelectorLevels.map((level, index) => {
                    const canClearLevel = index > 0 && Boolean(level.value);

                    return (
                    <div key={level.label} className="grid min-w-0 gap-1.5">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                          {level.label}
                        </span>
                        {canClearLevel ? (
                          <button
                            className="text-xs font-medium text-slate-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                            disabled={fullListingControlsDisabled}
                            onClick={() => clearCategoryLevel(index)}
                            type="button"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                      <Select
                        disabled={fullListingControlsDisabled}
                        value={level.value}
                        onValueChange={(value) => {
                          if (!value) {
                            return;
                          }

                          const category = categoriesById.get(value);

                          if (category) {
                            selectCategory(category);
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 min-w-0 w-full border-slate-300 bg-white text-sm text-zinc-950 dark:border-white/18 dark:bg-[#151719] dark:text-white">
                          <SelectValue className="min-w-0 truncate">
                            <span className="block min-w-0 truncate">
                              {level.value
                                ? categoriesById.get(level.value)?.name
                                : level.placeholder}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent
                          align="start"
                          alignItemWithTrigger={false}
                          className={cn(
                            selectContentClass,
                            "max-h-[min(18rem,var(--available-height))]",
                          )}
                          collisionPadding={{
                            bottom: 16,
                            left: 16,
                            right: 16,
                            top: 88,
                          }}
                        >
                          {level.categories.map((category) => (
                            <SelectItem
                              key={category.id}
                              value={category.id}
                              className={selectItemClass}
                            >
                              <span className="block min-w-0">
                                <span className="block truncate">{category.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {index === 0 && !level.value ? (
                        <span className="text-xs text-slate-500 dark:text-zinc-400">
                          Select the main category first.
                        </span>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
                <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                  Subcategories are optional, but choosing the most specific match
                  improves product discoverability.
                </p>
                {selectedCategory && selectedCategory.depth > 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs leading-5 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
                    <span className="block font-semibold">
                      {selectedCategoryLabel}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                <FieldLabel info="Search and select an active preset brand. Add missing brands under Catalog > Brands before creating products.">
                  Brand *
                </FieldLabel>
                <div className="relative">
                  <Input
                    className={cn(fieldClass, "pr-16")}
                    disabled={fullListingControlsDisabled}
                    maxLength={120}
                    required
                    onBlur={() =>
                      window.setTimeout(() => {
                        setBrandName((current) => toTitleCase(current));
                        setIsBrandPickerOpen(false);
                      }, 120)
                    }
                    onChange={(event) => {
                      setBrandName(event.target.value);
                      setIsBrandPickerOpen(true);
                    }}
                    onFocus={() => setIsBrandPickerOpen(true)}
                    placeholder="Search preset brands"
                    value={brandName}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    {brandName.length}/120
                  </span>
                  {isBrandPickerOpen && brandMatches.length > 0 ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#151719]">
                      {brandMatches.map((brand) => (
                        <button
                          key={brand.id}
                          className="block w-full rounded-md px-3 py-2 text-left text-sm text-zinc-800 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-white/10"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setBrandName(brand.name);
                            setIsBrandPickerOpen(false);
                          }}
                          type="button"
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span>{brand.name}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {brandName.trim() ? (
                  <p
                    className={cn(
                      "text-xs leading-5",
                      selectedBrandSuggestion?.status === "active"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {selectedBrandSuggestion?.status === "active"
                      ? `Using existing brand: ${selectedBrandSuggestion.name}.`
                      : "No active preset brand matches this. Add it under Catalog > Brands first."}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <div className="min-w-0">
                    <FieldLabel info="A short customer-facing summary shown in compact product previews.">
                      Short description *
                    </FieldLabel>
                  </div>
                  <AiGenerateButton
                    disabled={fullListingControlsDisabled}
                    feedback={aiFeedback?.kind === "short" ? aiFeedback : null}
                    isPending={isGeneratingDescription}
                    onClick={() => handleGenerateDescription("short")}
                  />
                </div>
                <div className="relative">
                  <Textarea
                    className={cn(textareaClass, "pb-8")}
                    disabled={fullListingControlsDisabled}
                    maxLength={400}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Briefly describe your product"
                    value={description}
                  />
                  <span className="absolute bottom-3 right-3 text-xs text-slate-400">
                    {description.length}/400
                  </span>
                </div>
              </div>

              <div className="grid gap-1.5">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <div className="min-w-0">
                    <FieldLabel info="A longer product description for the product detail page.">
                      Full description
                    </FieldLabel>
                  </div>
                  <AiGenerateButton
                    disabled={fullListingControlsDisabled}
                    feedback={aiFeedback?.kind === "long" ? aiFeedback : null}
                    isPending={isGeneratingDescription}
                    onClick={() => handleGenerateDescription("long")}
                  />
                </div>
                <ProductRichTextEditor
                  disabled={fullListingControlsDisabled}
                  maxLength={2000}
                  onChange={setLongDescription}
                  placeholder="Describe the product in detail"
                  value={longDescription}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Inventory">
            <div className="grid gap-4 md:grid-cols-2">
              <label
                className={cn(
                  "grid gap-1.5 transition-opacity",
                  continueSellingOutOfStock && "opacity-45",
                )}
              >
                <FieldLabel info="The available stock quantity for this product.">
                  Quantity *
                </FieldLabel>
                <Input
                  className={cn(
                    fieldClass,
                    continueSellingOutOfStock &&
                      "cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-zinc-500",
                  )}
                  disabled={continueSellingOutOfStock}
                  inputMode="numeric"
                  min={0}
                  onChange={(event) => setStock(sanitizeStockInput(event.target.value))}
                  pattern="[0-9]*"
                  type="number"
                  value={stock}
                />
              </label>
              <label
                className={cn(
                  "grid gap-1.5 transition-opacity",
                  continueSellingOutOfStock && "opacity-45",
                )}
              >
                <FieldLabel info="The stock level at which this product should be flagged as low stock.">
                  Low stock alert
                </FieldLabel>
                <Input
                  className={cn(
                    fieldClass,
                    continueSellingOutOfStock &&
                      "cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-zinc-500",
                  )}
                  defaultValue={5}
                  disabled={continueSellingOutOfStock}
                  min={0}
                  type="number"
                />
              </label>
            </div>
            <label
              className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10"
            >
              <Checkbox
                checked={continueSellingOutOfStock}
                onCheckedChange={(checked) =>
                  setContinueSellingOutOfStock(Boolean(checked))
                }
                className="size-4 rounded-[4px] border-slate-300 bg-white data-checked:border-emerald-600 data-checked:bg-emerald-600 data-checked:text-white"
              />
              <span className="flex items-center gap-1.5">
                Continue selling when out of stock
                <InfoHint
                  label="Continue selling"
                  text="Allow customers to place orders even when stock reaches zero."
                />
              </span>
            </label>
          </Panel>

          <Panel
            title="Shipping"
            description="Parcel data is required before checkout can quote accurate rates. Inaccurate weight or dimensions may cause courier adjustment fees."
          >
            <div className="grid min-w-0 gap-4">
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <label className="grid gap-1.5">
                  <FieldLabel info="Choose a saved parcel preset to fill weight and dimensions. The copied values can still be edited for this product.">
                    Parcel preset
                  </FieldLabel>
                  <Select
                    onValueChange={(value) =>
                      applyParcelPresetToProduct(value === "__none" ? null : value)
                    }
                    value={parcelPresetId ?? "__none"}
                  >
                    <SelectTrigger className={fieldClass}>
                      <SelectValue placeholder="Select a saved parcel preset" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem className={selectItemClass} value="__none">
                        No preset selected
                      </SelectItem>
                      {parcelPresets.map((preset) => (
                        <SelectItem
                          key={preset.id}
                          className={selectItemClass}
                          value={preset.id}
                        >
                          {preset.name}
                          {preset.isDefault ? " · Default" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <DashboardButton
                  className="h-10"
                  onClick={() => openParcelPresetSaveDialog({ type: "product" })}
                  type="button"
                >
                  <SaveIcon className="size-3.5" />
                  Save as preset
                </DashboardButton>
              </div>
              {selectedParcelPreset ? (
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {isParcelPresetModified
                    ? `Modified from ${selectedParcelPreset.name}.`
                    : `Using ${selectedParcelPreset.name}.`}
                </p>
              ) : parcelPresets.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Save commonly used package sizes once, then reuse them across
                  products and variants.
                </p>
              ) : null}
              {parcelPresetFeedback ? (
                <p
                  className={cn(
                    "text-xs",
                    parcelPresetFeedback.tone === "success"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-red-600 dark:text-red-300",
                  )}
                >
                  {parcelPresetFeedback.message}
                </p>
              ) : null}
              <div className="grid min-w-0 gap-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="grid gap-1.5">
                    <FieldLabel info="The packed product weight in grams. Required for accurate courier rates.">
                      Weight (g) *
                    </FieldLabel>
                    <Input
                      className={fieldClass}
                      inputMode="decimal"
                      min={1}
                      onChange={(event) =>
                        setWeightGrams(sanitizeShippingMetricInput(event.target.value))
                      }
                      pattern="[0-9]*[.]?[0-9]*"
                      step="any"
                      type="number"
                      value={weightGrams}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <FieldLabel info="The packed product length in millimetres. Required for accurate courier rates.">
                      Length (mm) *
                    </FieldLabel>
                    <Input
                      className={fieldClass}
                      inputMode="decimal"
                      min={1}
                      onChange={(event) =>
                        setLengthMm(sanitizeShippingMetricInput(event.target.value))
                      }
                      pattern="[0-9]*[.]?[0-9]*"
                      step="any"
                      type="number"
                      value={lengthMm}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <FieldLabel info="The packed product width in millimetres. Required for accurate courier rates.">
                      Width (mm) *
                    </FieldLabel>
                    <Input
                      className={fieldClass}
                      inputMode="decimal"
                      min={1}
                      onChange={(event) =>
                        setWidthMm(sanitizeShippingMetricInput(event.target.value))
                      }
                      pattern="[0-9]*[.]?[0-9]*"
                      step="any"
                      type="number"
                      value={widthMm}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <FieldLabel info="The packed product height in millimetres. Required for accurate courier rates.">
                      Height (mm) *
                    </FieldLabel>
                    <Input
                      className={fieldClass}
                      inputMode="decimal"
                      min={1}
                      onChange={(event) =>
                        setHeightMm(sanitizeShippingMetricInput(event.target.value))
                      }
                      pattern="[0-9]*[.]?[0-9]*"
                      step="any"
                      type="number"
                      value={heightMm}
                    />
                  </label>
                </div>
              </div>
              <PackageSizePreview
                heightMm={heightMm}
                lengthMm={lengthMm}
                widthMm={widthMm}
              />
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          <Panel
            title="Product media"
            description="Add images and videos through the shared media manager."
          >
            <button
              className="grid min-h-40 w-full place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-emerald-500 hover:bg-emerald-50/70 dark:border-white/15 dark:bg-white/[0.03] dark:hover:border-emerald-500 dark:hover:bg-emerald-500/10"
              disabled={fullListingControlsDisabled}
              onClick={openProductMediaManager}
              type="button"
            >
              <span>
                <ImagePlusIcon className="mx-auto size-8 text-emerald-600" />
                <span className="mt-3 block text-sm font-semibold text-zinc-950 dark:text-white">
                  Select or upload media
                </span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-zinc-400">
                  Images and videos are supported.
                </span>
              </span>
            </button>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {selectedMedia.map((asset, index) => (
                <MediaTile
                  key={asset.id}
                  asset={asset}
                  index={index}
                  isCover={index === 0}
                  isDragging={draggingMediaId === asset.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={() => setDraggingMediaId(asset.id)}
                  onDrop={() => {
                    if (draggingMediaId) {
                      moveSelectedMedia(draggingMediaId, asset.id);
                    }
                    setDraggingMediaId(null);
                  }}
                  onPlay={() => setPreviewVideoAsset(asset)}
                  onRemove={() => {
                    if (!fullListingControlsDisabled) {
                      setSelectedMediaIds((current) =>
                        current.filter((id) => id !== asset.id),
                      );
                    }
                  }}
                />
              ))}
              {!fullListingControlsDisabled ? (
                <button
                  className="grid aspect-square place-items-center rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-emerald-500 hover:text-emerald-700 dark:border-white/15 dark:text-zinc-400 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
                  onClick={openProductMediaManager}
                  type="button"
                >
                  <PlusIcon className="size-5" />
                </button>
              ) : null}
            </div>
          </Panel>

          <Panel
            title={hasVariants ? "Variant price defaults" : "Pricing"}
            description={
              hasVariants
                ? enablePrivateCostPricing
                  ? "Optional defaults used to prefill newly generated variants. The storefront uses variant prices, while private costs remain internal."
                  : "Optional defaults used to prefill newly generated variants. The storefront uses variant prices, starting from the lowest active variant."
                : enablePrivateCostPricing
                  ? "Set the final customer-facing VAT-inclusive price and, optionally, its private VAT-inclusive cost."
                  : "Set the final customer-facing VAT-inclusive price for this product."
            }
          >
            <div
              className={cn(
                "grid gap-4 md:grid-cols-2",
                enablePrivateCostPricing && "xl:grid-cols-3",
              )}
            >
              <label className="grid gap-1.5">
                <FieldLabel
                  info={
                    hasVariants
                      ? "Optional default used to prefill generated variants. Each variant still needs its own VAT-inclusive price."
                      : "The final customer-facing selling price, including VAT. Do not enter an ex-VAT amount."
                  }
                >
                  {hasVariants
                    ? "Default variant price (VAT incl.)"
                    : "Price (VAT incl.) *"}
                </FieldLabel>
                <Input
                  className={fieldClass}
                  inputMode="decimal"
                  min={0}
                  onChange={(event) =>
                    setPrice(sanitizeDecimalNumberInput(event.target.value))
                  }
                  pattern="[0-9]*[.]?[0-9]*"
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={price}
                />
              </label>
              <label className="grid gap-1.5">
                <FieldLabel
                  info={
                    hasVariants
                      ? "Optional default compare-at price used to prefill generated variants."
                      : "Optional original VAT-inclusive price used to show a markdown or discount. This must be higher than the selling price."
                  }
                >
                  {hasVariants
                    ? "Default compare-at price (VAT incl.)"
                    : "Compare-at price (VAT incl.)"}
                </FieldLabel>
                <Input
                  className={fieldClass}
                  inputMode="decimal"
                  min={0}
                  onChange={(event) =>
                    setCompareAtPrice(
                      sanitizeDecimalNumberInput(event.target.value),
                    )
                  }
                  pattern="[0-9]*[.]?[0-9]*"
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={compareAtPrice}
                />
              </label>
              {enablePrivateCostPricing ? (
                <label className="grid gap-1.5">
                  <FieldLabel info="Optional private acquisition cost, including VAT. It is used only for internal margin reporting and is never shown to customers.">
                    {hasVariants
                      ? "Default private cost (VAT incl.)"
                      : "Cost price (VAT incl., private)"}
                  </FieldLabel>
                  <Input
                    className={fieldClass}
                    inputMode="decimal"
                    min={0}
                    onChange={(event) =>
                      setCostPrice(
                        sanitizeDecimalNumberInput(event.target.value),
                      )
                    }
                    pattern="[0-9]*[.]?[0-9]*"
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                    value={costPrice}
                  />
                  <span className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                    Optional, VAT inclusive, and private. Customers never see
                    this value.
                  </span>
                  <span className="text-xs leading-5">
                    <ProfitabilityEstimate
                      costPrice={costPrice}
                      price={price}
                    />
                  </span>
                </label>
              ) : null}
            </div>
            <div
              className={cn(
                "mt-4 rounded-lg border px-3 py-2 text-xs leading-5",
                !hasVariants &&
                  pricingBreakdown.tone === "success" &&
                  "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100",
                !hasVariants &&
                  pricingBreakdown.tone === "warning" &&
                  "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100",
                (hasVariants || pricingBreakdown.tone === "neutral") &&
                  "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300",
              )}
            >
              <div className="font-semibold text-zinc-950 dark:text-white">
                {hasVariants ? "Variant prices drive the storefront" : pricingBreakdown.title}
              </div>
              <div>
                {hasVariants
                  ? "You do not need a separate product price when variants exist. These values only prefill new variant rows; customers see and buy the selected variant price."
                  : pricingBreakdown.message}
              </div>
            </div>
          </Panel>

          <Panel
            title="Delivery method"
            description="Choose how this product should be delivered to customers at checkout."
          >
            <div className="grid gap-3">
              <button
                className={cn(
                  "rounded-lg border p-4 text-left transition",
                  fulfillmentMode === "seller_fulfilled"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-100"
                    : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#151719]",
                )}
                onClick={() => setFulfillmentMode("seller_fulfilled")}
                disabled={fullListingControlsDisabled}
                type="button"
              >
                <span className="font-semibold">Bob Go courier</span>
                <span className="mt-1 block text-sm text-slate-600 dark:text-zinc-300">
                  Pack the order and use Bob Go to quote and book the courier.
                  Customers see courier rates at checkout.
                </span>
              </button>
              <button
                className={cn(
                  "rounded-lg border p-4 text-left transition",
                  isJurgensDelivery
                    ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-100"
                    : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#151719]",
                )}
                disabled={fullListingControlsDisabled}
                onClick={() => {
                  if (!fullListingControlsDisabled) {
                    setFulfillmentMode("piessang_fulfilled");
                  }
                }}
                type="button"
              >
                <span className="font-semibold">Jurgens Energy delivery</span>
                <span className="mt-1 block text-sm text-slate-600 dark:text-zinc-300">
                  Deliver this product through Jurgens Energy&apos;s own local
                  delivery route instead of quoting a Bob Go courier rate.
                </span>
              </button>
            </div>
          </Panel>

          {enableGoogleCommerceSettings ? (
            <Panel
              title="Google Commerce"
              description={
                hasVariants
                  ? "Google settings are offer-level. Open each generated variant to classify its fulfilment and optional identifiers."
                  : "Configure the internal Google listing data for this single sellable offer."
              }
            >
              {hasVariants ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm leading-6 text-blue-950 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100">
                  Use the pencil action on each generated variant, then edit its{" "}
                  <span className="font-semibold">Google Commerce</span>
                  {" "}settings. You can also bulk-set the fulfilment channel
                  below. Offer-level controls avoid applying one delivery claim
                  or manufacturer identifier to every variant.
                </div>
              ) : (
                <GoogleCommerceFields
                  disabled={fullListingControlsDisabled}
                  fulfillmentChannel={googleFulfillmentChannel}
                  manufacturerMpn={manufacturerMpn}
                  onFulfillmentChannelChange={setGoogleFulfillmentChannel}
                  onManufacturerMpnChange={setManufacturerMpn}
                  onReturnPolicyLabelChange={setGoogleReturnPolicyLabel}
                  returnPolicyLabel={googleReturnPolicyLabel}
                />
              )}
            </Panel>
          ) : null}
        </div>
      </div>

      <Panel
        title="Variants"
        description="Optional. Turn this on only when the product has options like size, color, material, or style."
      >
        <label className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
          <Checkbox
            checked={hasVariants}
            disabled={fullListingControlsDisabled}
            onCheckedChange={(checked) => {
              const nextHasVariants = Boolean(checked);

              if (!nextHasVariants) {
                setSingleVariantId(
                  generatedVariants[0]?.persistedVariantId ?? singleVariantId,
                );
              }

              setHasVariants(nextHasVariants);
              setExpandedVariantId(null);
            }}
            className="size-4 rounded-[4px] border-slate-300 bg-white data-checked:border-emerald-600 data-checked:bg-emerald-600 data-checked:text-white"
          />
          This product has multiple options
        </label>

        {hasVariants ? (
          <div className="grid min-w-0 gap-5">
            <div className="rounded-lg border border-slate-200 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3 dark:border-white/10">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950 dark:text-white">
                    1. Build your options
                    <InfoHint
                      label="Build your options"
                      text="Add option types like color, size, or material. Values become purchasable variant combinations."
                    />
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    Add every option that affects the purchasable item. We will
                    generate every possible combination, then you can remove
                    combinations you do not sell.
                  </p>
                </div>
                <DashboardButton
                  disabled={fullListingControlsDisabled}
                  onClick={() =>
                    setVariantOptions((current) => [
                      ...current,
                      { id: makeId("option"), name: "", values: [] },
                    ])
                  }
                  type="button"
                >
                  <PlusIcon className="size-3.5" />
                  Add option
                </DashboardButton>
              </div>
              <div className="grid gap-2 p-3">
                {variantOptions.map((option) => (
                  <div
                    key={option.id}
                    className="grid min-w-0 gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10 lg:grid-cols-[220px_minmax(0,1fr)_auto]"
                  >
                    <label className="grid min-w-0 gap-1.5">
                      <FieldLabel info="The option type, for example size, color, material, or style.">
                        Option name
                      </FieldLabel>
                      <Input
                        className={fieldClass}
                        disabled={fullListingControlsDisabled}
                        onBlur={(event) =>
                          updateVariantOption(option.id, {
                            name: toTitleCase(event.target.value.trim()),
                          })
                        }
                        onChange={(event) =>
                          updateVariantOption(option.id, {
                            name: toTitleCaseInput(event.target.value),
                          })
                        }
                        placeholder="Color"
                        value={option.name}
                      />
                    </label>
                    <div className="grid min-w-0 gap-1.5">
                      <FieldLabel info="Add option values as chips. Each value combines with the other option values.">
                        Option values
                      </FieldLabel>
                      <div className="flex min-h-10 min-w-0 flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-white/18 dark:bg-[#151719]">
                        {option.values.map((value) => (
                          <span
                            key={value}
                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200"
                          >
                            <span className="truncate">{value}</span>
                            <button
                              aria-label={`Remove ${value}`}
                              className="grid size-4 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-white hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
                              disabled={fullListingControlsDisabled}
                              onClick={() => removeVariantOptionValue(option.id, value)}
                              type="button"
                            >
                              <XIcon className="size-3" />
                            </button>
                          </span>
                        ))}
                        <Input
                          aria-label={`${option.name || "Option"} value`}
                          className="h-7 min-w-28 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                          disabled={fullListingControlsDisabled}
                          onChange={(event) =>
                            setOptionValueInputs((current) => ({
                              ...current,
                              [option.id]: toTitleCaseInput(event.target.value),
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === ",") {
                              event.preventDefault();
                              addVariantOptionValues(
                                option.id,
                                optionValueInputs[option.id] ?? "",
                              );
                            }

                            if (
                              event.key === "Backspace" &&
                              !(optionValueInputs[option.id] ?? "") &&
                              option.values.length > 0
                            ) {
                              event.preventDefault();
                              removeVariantOptionValue(
                                option.id,
                                option.values[option.values.length - 1],
                              );
                            }
                          }}
                          placeholder="Add value"
                          value={optionValueInputs[option.id] ?? ""}
                        />
                        <Button
                          className="h-7 shrink-0 rounded-md px-2 text-xs"
                          disabled={fullListingControlsDisabled}
                          onClick={() =>
                            addVariantOptionValues(
                              option.id,
                              optionValueInputs[option.id] ?? "",
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          <PlusIcon className="size-3" />
                          Add
                        </Button>
                      </div>
                    </div>
                    <Button
                      aria-label={`Remove ${option.name || "option"}`}
                      className="self-end text-slate-600 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-300"
                      disabled={variantOptions.length === 1 || fullListingControlsDisabled}
                      onClick={() =>
                        setVariantOptions((current) =>
                          current.filter(
                            (currentOption) => currentOption.id !== option.id,
                          ),
                        )
                      }
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                ))}
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm",
                    variantCombinationTone === "danger"
                      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200"
                      : variantCombinationTone === "warning"
                        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100"
                        : "border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100",
                  )}
                >
                  <span className="flex min-w-0 items-start gap-2">
                    {variantCombinationTone !== "normal" ? (
                      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                    ) : null}
                    <span>
                      {usableVariantOptions.length} option
                      {usableVariantOptions.length === 1 ? "" : "s"} with{" "}
                      {usableVariantOptions.reduce(
                        (total, option) => total + option.values.length,
                        0,
                      )}{" "}
                      value
                      {usableVariantOptions.reduce(
                        (total, option) => total + option.values.length,
                        0,
                      ) === 1
                        ? ""
                        : "s"}{" "}
                      will generate {variantCombinationCount} variant
                      {variantCombinationCount === 1 ? "" : "s"}. Remove
                      combinations you do not sell after generating.
                    </span>
                  </span>
                  <DashboardButton
                    className="border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white"
                    disabled={variantCombinationCount === 0 || fullListingControlsDisabled}
                    onClick={generateVariants}
                    type="button"
                  >
                    <SparklesIcon className="size-3.5" />
                    Generate variants
                  </DashboardButton>
                </div>
              </div>
            </div>

            {generatedVariants.length > 0 ? (
              <div className="grid gap-3">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950 dark:text-white">
                    2. Manage variants
                    <InfoHint
                      label="Manage variants"
                      text="Each generated row is a real purchasable variant with its own stock, price, shipping data, and status."
                    />
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    Edit each variant or use bulk actions to update multiple.
                    Open a specific variant to enable cylinder exchange rules
                    only for that sellable option.
                  </p>
                </div>
                <div className={cn(dashboardPanelClass, "overflow-hidden")}>
                  {selectedVariantCount > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <span className="mr-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                        {selectedVariantCount} selected
                      </span>
                      <DashboardRowActionMenu
                        ariaLabel="Bulk variant actions"
                        className="w-72"
                        triggerClassName={cn(
                          "ml-auto h-8 w-auto rounded-md border border-slate-300 bg-white px-3 text-[14px] font-normal leading-none text-zinc-950 shadow-none hover:bg-slate-50 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10",
                        )}
                        trigger={
                          <span className="inline-flex items-center gap-1.5">
                            Bulk actions
                          </span>
                        }
                      >
                        <button
                          className="flex w-full items-center px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/10"
                          onClick={() =>
                            updateBulkVariants({ status: "unavailable" })
                          }
                          type="button"
                        >
                          Mark unavailable
                        </button>
                        <button
                          className="flex w-full items-center px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/10"
                          onClick={() =>
                            openBulkValueDialog(
                              "price",
                              "Set VAT-inclusive price",
                              "Price incl. VAT",
                            )
                          }
                          type="button"
                        >
                          Set price
                        </button>
                        {enablePrivateCostPricing ? (
                          <button
                            className="flex w-full items-center px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/10"
                            onClick={() =>
                              openBulkValueDialog(
                                "costPrice",
                                "Set private VAT-inclusive cost",
                                "Private cost incl. VAT",
                              )
                            }
                            type="button"
                          >
                            Set private cost
                          </button>
                        ) : null}
                        <button
                          className="flex w-full items-center px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/10"
                          onClick={() =>
                            openBulkValueDialog(
                              "compareAtPrice",
                              "Set VAT-inclusive compare-at price",
                              "Compare-at price incl. VAT",
                            )
                          }
                          type="button"
                        >
                          Set compare-at price
                        </button>
                        <button
                          className="flex w-full items-center px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/10"
                          onClick={() =>
                            openBulkValueDialog(
                              "stock",
                              "Set stock",
                              "Stock",
                            )
                          }
                          type="button"
                        >
                          Set stock
                        </button>
                        <button
                          className="flex w-full items-center px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/10"
                          onClick={openBulkVariantMediaManager}
                          type="button"
                        >
                          Set image
                        </button>
                        {parcelPresets.length > 0 ? (
                          <div className="border-t border-slate-200 py-1 dark:border-white/10">
                            {parcelPresets.map((preset) => (
                              <button
                                key={preset.id}
                                className="flex w-full items-center px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/10"
                                onClick={() =>
                                  applyParcelPresetToSelectedVariants(preset.id)
                                }
                                type="button"
                              >
                                Set parcel preset: {preset.name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {enableGoogleCommerceSettings ? (
                          <div className="border-t border-slate-200 py-1 dark:border-white/10">
                            {googleFulfillmentChannelOptions.map(
                              ([channel, config]) => (
                                <button
                                  key={channel}
                                  className="flex w-full items-center px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/10"
                                  onClick={() =>
                                    updateBulkVariants({
                                      googleFulfillmentChannel: channel,
                                    })
                                  }
                                  type="button"
                                >
                                  Set Google: {config.label}
                                </button>
                              ),
                            )}
                          </div>
                        ) : null}
                        <div className="border-t border-slate-200 py-1 dark:border-white/10">
                          {Object.entries(variantStatusConfig).map(
                            ([status, config]) => (
                              <button
                                key={status}
                                className="flex w-full items-center px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/10"
                                onClick={() =>
                                  updateBulkVariants({
                                    status: status as VariantStatus,
                                  })
                                }
                                type="button"
                              >
                                Set status: {config.label}
                              </button>
                            ),
                          )}
                        </div>
                        <button
                          className="flex w-full items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                          onClick={() => removeGeneratedVariants(selectedVariantIds)}
                          type="button"
                        >
                          Remove selected combinations
                        </button>
                      </DashboardRowActionMenu>
                    </div>
                  ) : null}

                  <div className={dashboardTableContainerClass}>
                    <Table className={dashboardTableClass}>
                      <TableHeader>
                        <TableRow className={dashboardTableHeaderRowClass}>
                          <TableHead className="hidden w-10 px-4 md:table-cell">
                            <Checkbox
                              checked={allGeneratedVariantsSelected}
                              onCheckedChange={(checked) =>
                                setSelectedVariantIds(
                                  checked
                                    ? generatedVariants.map((variant) => variant.id)
                                    : [],
                                )
                              }
                              className="size-4 rounded-[4px] border-slate-300 bg-white data-checked:border-emerald-600 data-checked:bg-emerald-600 data-checked:text-white"
                            />
                          </TableHead>
                          <TableHead className={dashboardTableHeadClass}>
                            <ColumnInfoTitle info="The generated option combination customers can buy.">
                              Variant
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="A globally unique stock keeping unit for this variant. It is also the stable Google Merchant offer ID.">
                              SKU
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="The final customer-facing selling price for this variant, including VAT.">
                              Price (VAT incl.)
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="Optional original VAT-inclusive price used to show a markdown discount. It must be higher than the selling price.">
                              Compare at (VAT incl.)
                            </ColumnInfoTitle>
                          </TableHead>
                          {enablePrivateCostPricing ? (
                            <>
                              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                                <ColumnInfoTitle info="Optional private acquisition cost for this variant, including VAT. Customers never see this value.">
                                  Cost (VAT incl., private)
                                </ColumnInfoTitle>
                              </TableHead>
                              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                                <ColumnInfoTitle info="Live estimate calculated from the VAT-inclusive selling and private cost prices.">
                                  Profit / margin
                                </ColumnInfoTitle>
                              </TableHead>
                            </>
                          ) : null}
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="The available stock quantity for this variant.">
                              Stock
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="The stock level where this variant should be flagged as low stock.">
                              Low stock
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="Optional packed weight override in grams for this variant. Decimals are allowed.">
                              Weight (g)
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="Optional packed length override in millimetres. Decimals are allowed.">
                              Length (mm)
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="Optional packed width override in millimetres. Decimals are allowed.">
                              Width (mm)
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="Optional packed height override in millimetres. Decimals are allowed.">
                              Height (mm)
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="Optional barcode or supplier identifier.">
                              Barcode
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="Internal notes for this specific variant.">
                              Notes
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="Whether this variant can keep selling when stock reaches zero.">
                              Oversell
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="Controls whether this variant is available, draft, sold out, or unavailable.">
                              Status
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                            <ColumnInfoTitle info="The image shown for this exact variant combination.">
                              Image
                            </ColumnInfoTitle>
                          </TableHead>
                          <TableHead className={dashboardTableActionHeadClass}>
                            <ColumnInfoTitle info="Row actions for editing or removing this variant.">
                              Actions
                            </ColumnInfoTitle>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {generatedVariants.map((variant) => {
                          const image = variant.imageId
                            ? mediaById.get(variant.imageId)
                            : null;
                          const variantSkuStatus =
                            variantSkuStatuses[variant.id] ?? "idle";

                          return (
                            <TableRow
                              key={variant.id}
                              className={dashboardTableRowClass}
                            >
                              <TableCell className="hidden w-10 px-4 md:table-cell">
                                <Checkbox
                                  checked={selectedVariantIds.includes(variant.id)}
                                  onCheckedChange={() => toggleVariantSelection(variant.id)}
                                  className="size-4 rounded-[4px] border-slate-300 bg-white data-checked:border-emerald-600 data-checked:bg-emerald-600 data-checked:text-white"
                                />
                              </TableCell>
                              <TableCell className={dashboardTableCellClass}>
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="size-2 rounded-full bg-emerald-500" />
                                  <span className={dashboardTablePrimaryTextClass}>
                                    {variant.optionValues.join(" / ")}
                                  </span>
                                  {variant.exchangeRequiresEmpty ? (
                                    <Badge className="rounded-md bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-200">
                                      Exchange
                                      {variant.exchangeEmptyCylinderSize
                                        ? ` ${variant.exchangeEmptyCylinderSize}`
                                        : ""}
                                    </Badge>
                                  ) : null}
                                  {enableGoogleCommerceSettings ? (
                                    <Badge
                                      className={cn(
                                        "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                                        googleFulfillmentChannelBadgeClass[
                                          variant.googleFulfillmentChannel
                                        ],
                                      )}
                                    >
                                      Google: {googleFulfillmentChannelConfig[
                                        variant.googleFulfillmentChannel
                                      ].label}
                                    </Badge>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <div className="relative w-32">
                                  <Input
                                    aria-label="Variant SKU"
                                    className={cn(
                                      "h-8 w-full border-slate-300 text-xs",
                                      getSkuStatusClass(variantSkuStatus),
                                    )}
                                    maxLength={50}
                                    onChange={(event) =>
                                      updateGeneratedVariant(variant.id, {
                                        sku: event.target.value,
                                      })
                                    }
                                    title={
                                      variantSkuStatus === "available"
                                        ? "SKU is available"
                                        : variantSkuStatus === "duplicate"
                                          ? "SKU is already used or duplicated in this product"
                                          : variantSkuStatus === "checking"
                                            ? "Checking SKU availability"
                                            : variantSkuStatus === "error"
                                              ? "Could not check SKU availability"
                                              : "Enter a unique SKU"
                                    }
                                    value={variant.sku}
                                  />
                                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                                    <SkuStatusIcon status={variantSkuStatus} />
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <Input
                                  aria-label="Variant VAT-inclusive price"
                                  className="h-8 w-24 border-slate-300 text-xs"
                                  onChange={(event) =>
                                    updateGeneratedVariant(variant.id, {
                                      price: sanitizeDecimalNumberInput(
                                        event.target.value,
                                      ),
                                    })
                                  }
                                  inputMode="decimal"
                                  min={0}
                                  pattern="[0-9]*[.]?[0-9]*"
                                  step="0.01"
                                  type="number"
                                  value={variant.price}
                                />
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <div className="flex items-center gap-2">
                                  <Input
                                    aria-label="Variant VAT-inclusive compare-at price"
                                    className="h-8 w-24 border-slate-300 text-xs"
                                    onChange={(event) =>
                                      updateGeneratedVariant(variant.id, {
                                        compareAtPrice:
                                          sanitizeDecimalNumberInput(
                                            event.target.value,
                                          ),
                                      })
                                    }
                                    inputMode="decimal"
                                    min={0}
                                    pattern="[0-9]*[.]?[0-9]*"
                                    step="0.01"
                                    type="number"
                                    value={variant.compareAtPrice}
                                  />
                                  {getDiscountPercent(
                                    variant.price,
                                    variant.compareAtPrice,
                                  ) ? (
                                    <span className="text-xs font-semibold text-red-600 dark:text-red-300">
                                      -
                                      {getDiscountPercent(
                                        variant.price,
                                        variant.compareAtPrice,
                                      )}
                                      %
                                    </span>
                                  ) : null}
                                </div>
                              </TableCell>
                              {enablePrivateCostPricing ? (
                                <>
                                  <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                    <Input
                                      aria-label="Variant private VAT-inclusive cost price"
                                      className="h-8 w-24 border-slate-300 text-xs"
                                      inputMode="decimal"
                                      min={0}
                                      onChange={(event) =>
                                        updateGeneratedVariant(variant.id, {
                                          costPrice: sanitizeDecimalNumberInput(
                                            event.target.value,
                                          ),
                                        })
                                      }
                                      pattern="[0-9]*[.]?[0-9]*"
                                      placeholder="Optional"
                                      step="0.01"
                                      type="number"
                                      value={variant.costPrice}
                                    />
                                  </TableCell>
                                  <TableCell className={cn(dashboardTableCellClass, "hidden min-w-52 md:table-cell")}>
                                    <span className="text-xs leading-5">
                                      <ProfitabilityEstimate
                                        costPrice={variant.costPrice}
                                        price={variant.price}
                                      />
                                    </span>
                                  </TableCell>
                                </>
                              ) : null}
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <Input
                                  aria-label="Variant stock"
                                  className={cn(
                                    "h-8 w-20 border-slate-300 text-xs",
                                    variant.continueSellingOutOfStock &&
                                      "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-500",
                                  )}
                                  disabled={variant.continueSellingOutOfStock}
                                  inputMode="numeric"
                                  min={0}
                                  onChange={(event) =>
                                    updateGeneratedVariant(variant.id, {
                                      stock: sanitizeStockInput(event.target.value),
                                    })
                                  }
                                  pattern="[0-9]*"
                                  type="number"
                                  value={variant.stock}
                                />
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <Input
                                  aria-label="Variant low stock alert"
                                  className={cn(
                                    "h-8 w-24 border-slate-300 text-xs",
                                    variant.continueSellingOutOfStock &&
                                      "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-500",
                                  )}
                                  disabled={variant.continueSellingOutOfStock}
                                  inputMode="numeric"
                                  min={0}
                                  onChange={(event) =>
                                    updateGeneratedVariant(variant.id, {
                                      lowStockAlert: sanitizeStockInput(
                                        event.target.value,
                                      ),
                                    })
                                  }
                                  pattern="[0-9]*"
                                  type="number"
                                  value={variant.lowStockAlert}
                                />
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <Input
                                  aria-label="Variant weight override"
                                  className="h-8 w-24 border-slate-300 text-xs"
                                  inputMode="decimal"
                                  min={1}
                                  onChange={(event) =>
                                    updateGeneratedVariant(variant.id, {
                                      weightGrams: sanitizeShippingMetricInput(
                                        event.target.value,
                                      ),
                                    })
                                  }
                                  pattern="[0-9]*[.]?[0-9]*"
                                  placeholder="g"
                                  step="any"
                                  type="number"
                                  value={variant.weightGrams}
                                />
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <Input
                                  aria-label="Variant length override"
                                  className="h-8 w-24 border-slate-300 text-xs"
                                  inputMode="decimal"
                                  min={1}
                                  onChange={(event) =>
                                    updateGeneratedVariant(variant.id, {
                                      lengthMm: sanitizeShippingMetricInput(
                                        event.target.value,
                                      ),
                                    })
                                  }
                                  pattern="[0-9]*[.]?[0-9]*"
                                  placeholder="mm"
                                  step="any"
                                  type="number"
                                  value={variant.lengthMm}
                                />
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <Input
                                  aria-label="Variant width override"
                                  className="h-8 w-24 border-slate-300 text-xs"
                                  inputMode="decimal"
                                  min={1}
                                  onChange={(event) =>
                                    updateGeneratedVariant(variant.id, {
                                      widthMm: sanitizeShippingMetricInput(
                                        event.target.value,
                                      ),
                                    })
                                  }
                                  pattern="[0-9]*[.]?[0-9]*"
                                  placeholder="mm"
                                  step="any"
                                  type="number"
                                  value={variant.widthMm}
                                />
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <Input
                                  aria-label="Variant height override"
                                  className="h-8 w-24 border-slate-300 text-xs"
                                  inputMode="decimal"
                                  min={1}
                                  onChange={(event) =>
                                    updateGeneratedVariant(variant.id, {
                                      heightMm: sanitizeShippingMetricInput(
                                        event.target.value,
                                      ),
                                    })
                                  }
                                  pattern="[0-9]*[.]?[0-9]*"
                                  placeholder="mm"
                                  step="any"
                                  type="number"
                                  value={variant.heightMm}
                                />
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <Input
                                  aria-label="Variant barcode"
                                  className="h-8 w-32 border-slate-300 text-xs"
                                  onChange={(event) =>
                                    updateGeneratedVariant(variant.id, {
                                      barcode: event.target.value,
                                    })
                                  }
                                  value={variant.barcode}
                                />
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <Input
                                  aria-label="Variant notes"
                                  className="h-8 w-40 border-slate-300 text-xs"
                                  onChange={(event) =>
                                    updateGeneratedVariant(variant.id, {
                                      notes: event.target.value,
                                    })
                                  }
                                  value={variant.notes}
                                />
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <Checkbox
                                  aria-label="Continue selling this variant when out of stock"
                                  checked={variant.continueSellingOutOfStock}
                                  onCheckedChange={(checked) =>
                                    updateGeneratedVariant(variant.id, {
                                      continueSellingOutOfStock: Boolean(checked),
                                    })
                                  }
                                  className="size-4 rounded-[4px] border-slate-300 bg-white data-checked:border-emerald-600 data-checked:bg-emerald-600 data-checked:text-white"
                                />
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <Select
                                  onValueChange={(value) =>
                                    updateGeneratedVariant(variant.id, {
                                      status: value as VariantStatus,
                                    })
                                  }
                                  value={variant.status}
                                >
                                  <SelectTrigger
                                    className={getVariantStatusSelectClass(variant.status)}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className={selectContentClass}>
                                    {Object.entries(variantStatusConfig).map(
                                      ([status, config]) => (
                                        <SelectItem
                                          key={status}
                                          className={selectItemClass}
                                          value={status}
                                        >
                                          {config.label}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                                <button
                                  aria-label="Select variant image"
                                  className="relative size-8 overflow-hidden rounded-md border border-slate-200 bg-slate-50 transition hover:border-emerald-500 hover:text-emerald-700 dark:border-white/10 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
                                  onClick={() => openVariantMediaManager(variant.id)}
                                  type="button"
                                >
                                  {image?.thumbnailUrl || image?.publicUrl ? (
                                    <Image
                                      src={image.thumbnailUrl ?? image.publicUrl}
                                      alt=""
                                      fill
                                      sizes="32px"
                                      className="object-cover"
                                    />
                                  ) : (
                                    <ImagePlusIcon className="m-2 size-4 text-slate-400" />
                                  )}
                                </button>
                              </TableCell>
                              <TableCell className={dashboardTableActionCellClass}>
                                <div className="flex justify-end gap-1">
                                  <Button
                                    aria-label="Edit variant details"
                                    className="text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
                                    onClick={() => setExpandedVariantId(variant.id)}
                                    size="icon-sm"
                                    type="button"
                                    variant="ghost"
                                  >
                                    <PencilIcon
                                      className="size-4"
                                    />
                                  </Button>
                                  <DashboardRowActionMenu ariaLabel="Variant actions">
                                    <button
                                      className="flex w-full items-center px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/10"
                                      onClick={() => setExpandedVariantId(variant.id)}
                                      type="button"
                                    >
                                      Edit details
                                    </button>
                                    <button
                                      className="flex w-full items-center px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/10"
                                      onClick={() =>
                                        updateGeneratedVariant(variant.id, {
                                          sku: generateVariantSku(
                                            sku,
                                            productName,
                                            variant.optionValues,
                                          ),
                                        })
                                      }
                                      type="button"
                                    >
                                      Generate SKU
                                    </button>
                                    <button
                                      className="flex w-full items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                                      onClick={() =>
                                        updateGeneratedVariant(variant.id, {
                                          status: "unavailable",
                                        })
                                      }
                                      type="button"
                                    >
                                      Mark unavailable
                                    </button>
                                    <button
                                      className="flex w-full items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                                      onClick={() => removeGeneratedVariant(variant.id)}
                                      type="button"
                                    >
                                      Remove combination
                                    </button>
                                  </DashboardRowActionMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-zinc-400">
                    Showing {generatedVariants.length} variant
                    {generatedVariants.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-sm text-slate-600 dark:text-zinc-300">
              This product will be created as a single variant. Configure
              exchange rules here only if this sellable option is an exchange.
            </p>
            <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Single variant exchange rules
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                  When enabled, customers see the required empty-cylinder size
                  and accepted return brands for this variant.
                </p>
              </div>
              <ExchangeRulesFields
                acceptedBrandsInput={exchangeAcceptedReturnBrandsInput}
                confirmationText={exchangeConfirmationText}
                disabled={fullListingControlsDisabled}
                emptyCylinderSize={exchangeEmptyCylinderSize}
                enabled={exchangeRequiresEmpty}
                onAcceptedBrandsInputChange={setExchangeAcceptedReturnBrandsInput}
                onConfirmationTextChange={setExchangeConfirmationText}
                onEmptyCylinderSizeChange={setExchangeEmptyCylinderSize}
                onEnabledChange={setExchangeRequiresEmpty}
              />
            </div>
          </div>
        )}
      </Panel>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 py-4 dark:border-white/10 dark:bg-[#0f1114]/95 sm:flex-row sm:justify-end">
        <DashboardButton nativeButton={false} render={<Link href="/products" />}>
          Cancel
        </DashboardButton>
        <DashboardButton
          disabled={saveDisabled}
          onClick={() => handleSaveProduct("draft")}
          type="button"
        >
          {isSavingDraft ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <SaveIcon className="size-3.5" />
          )}
          {isSavingDraft ? "Saving..." : "Save draft"}
        </DashboardButton>
        <DashboardButton
          className="border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white"
          disabled={saveDisabled}
          onClick={() => handleSaveProduct("active")}
          type="button"
        >
          {isSavingDraft ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <SaveIcon className="size-3.5" />
          )}
          {isSavingDraft ? "Saving..." : "Save active"}
        </DashboardButton>
      </div>

      <Dialog
        open={Boolean(activeExpandedVariant)}
        onOpenChange={(open) => {
          if (!open) {
            setExpandedVariantId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {activeExpandedVariant?.optionValues.join(" / ") ?? "Edit variant"}
            </DialogTitle>
            <DialogDescription>
              Edit the sellable details for this specific variant combination.
            </DialogDescription>
          </DialogHeader>
          {activeExpandedVariant ? (
            <DialogBody>
              <div className="grid gap-5">
                <section className="grid gap-3">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950 dark:text-white">
                    Variant image
                    <InfoHint
                      label="Variant image"
                      text="The image shown for this exact variant combination."
                    />
                  </h3>
                  <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        aria-label="Select variant image"
                        className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition hover:border-emerald-500 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-emerald-500 dark:hover:text-emerald-300"
                        onClick={() =>
                          openVariantMediaManager(activeExpandedVariant.id)
                        }
                        type="button"
                      >
                        {activeExpandedVariantImage?.thumbnailUrl ||
                        activeExpandedVariantImage?.publicUrl ? (
                          <Image
                            src={
                              activeExpandedVariantImage.thumbnailUrl ??
                              activeExpandedVariantImage.publicUrl
                            }
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <ImagePlusIcon className="size-5" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                          {activeExpandedVariantImage
                            ? activeExpandedVariantImage.originalFileName ??
                              "Selected media asset"
                            : "No variant image selected"}
                        </p>
                        <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                          Select a saved image from the media library for this
                          variant.
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <DashboardButton
                        onClick={() =>
                          openVariantMediaManager(activeExpandedVariant.id)
                        }
                        type="button"
                      >
                        <PencilIcon className="size-3.5" />
                        {activeExpandedVariantImage ? "Change" : "Select"}
                      </DashboardButton>
                      <DashboardButton
                        className="text-red-600 hover:text-red-700 disabled:text-slate-400 dark:text-red-300"
                        disabled={!activeExpandedVariantImage}
                        onClick={() =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            imageId: null,
                          })
                        }
                        type="button"
                      >
                        <Trash2Icon className="size-3.5" />
                        Remove
                      </DashboardButton>
                    </div>
                  </div>
                </section>

                <section className="grid gap-3">
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                    Identity
                  </h3>
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="grid gap-1.5">
                      <FieldLabel info="Globally unique SKU and stable Google Merchant offer ID for this variant. Avoid changing it after publication.">
                        SKU
                      </FieldLabel>
                      <Input
                        className={cn(
                          fieldClass,
                          getSkuStatusClass(
                            variantSkuStatuses[activeExpandedVariant.id] ?? "idle",
                          ),
                        )}
                        maxLength={50}
                        onChange={(event) =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            sku: event.target.value,
                          })
                        }
                        value={activeExpandedVariant.sku}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <FieldLabel info="Controls whether this variant can be sold.">
                        Status
                      </FieldLabel>
                      <Select
                        onValueChange={(value) =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            status: value as VariantStatus,
                          })
                        }
                        value={activeExpandedVariant.status}
                      >
                        <SelectTrigger
                          className={getVariantStatusSelectClass(
                            activeExpandedVariant.status,
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          {Object.entries(variantStatusConfig).map(
                            ([status, config]) => (
                              <SelectItem
                                key={status}
                                className={selectItemClass}
                                value={status}
                              >
                                {config.label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                </section>

                <section className="grid gap-3">
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                    Pricing and stock
                  </h3>
                  <div
                    className={cn(
                      "grid gap-4 md:grid-cols-3",
                      enablePrivateCostPricing && "xl:grid-cols-4",
                    )}
                  >
                    <label className="grid gap-1.5">
                      <FieldLabel info="Final customer-facing variant price, including VAT. Do not enter an ex-VAT amount.">
                        Price (VAT incl.)
                      </FieldLabel>
                      <Input
                        className={fieldClass}
                        inputMode="decimal"
                        min={0}
                        onChange={(event) =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            price: sanitizeDecimalNumberInput(event.target.value),
                          })
                        }
                        pattern="[0-9]*[.]?[0-9]*"
                        step="0.01"
                        type="number"
                        value={activeExpandedVariant.price}
                      />
                    </label>
                    {enablePrivateCostPricing ? (
                      <label className="grid gap-1.5">
                        <FieldLabel info="Optional private acquisition cost for this variant, including VAT. It is never shown to customers.">
                          Cost price (VAT incl., private)
                        </FieldLabel>
                        <Input
                          className={fieldClass}
                          inputMode="decimal"
                          min={0}
                          onChange={(event) =>
                            updateGeneratedVariant(activeExpandedVariant.id, {
                              costPrice: sanitizeDecimalNumberInput(
                                event.target.value,
                              ),
                            })
                          }
                          pattern="[0-9]*[.]?[0-9]*"
                          placeholder="Optional"
                          step="0.01"
                          type="number"
                          value={activeExpandedVariant.costPrice}
                        />
                        <span className="text-xs leading-5">
                          <ProfitabilityEstimate
                            costPrice={activeExpandedVariant.costPrice}
                            price={activeExpandedVariant.price}
                          />
                        </span>
                      </label>
                    ) : null}
                    <label className="grid gap-1.5">
                      <FieldLabel info="Optional original VAT-inclusive price for markdown display. It must be higher than the selling price.">
                        Compare-at price (VAT incl.)
                      </FieldLabel>
                      <Input
                        className={fieldClass}
                        inputMode="decimal"
                        min={0}
                        onChange={(event) =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            compareAtPrice: sanitizeDecimalNumberInput(
                              event.target.value,
                            ),
                          })
                        }
                        pattern="[0-9]*[.]?[0-9]*"
                        step="0.01"
                        type="number"
                        value={activeExpandedVariant.compareAtPrice}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <FieldLabel info="Available stock for this variant.">
                        Stock
                      </FieldLabel>
                      <Input
                        className={cn(
                          fieldClass,
                          activeExpandedVariant.continueSellingOutOfStock &&
                            "border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-500",
                        )}
                        disabled={activeExpandedVariant.continueSellingOutOfStock}
                        inputMode="numeric"
                        min={0}
                        onChange={(event) =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            stock: sanitizeStockInput(event.target.value),
                          })
                        }
                        pattern="[0-9]*"
                        type="number"
                        value={activeExpandedVariant.stock}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <FieldLabel info="The stock level at which this variant should be flagged as low stock.">
                        Low stock alert
                      </FieldLabel>
                      <Input
                        className={cn(
                          fieldClass,
                          activeExpandedVariant.continueSellingOutOfStock &&
                            "border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-500",
                        )}
                        disabled={activeExpandedVariant.continueSellingOutOfStock}
                        inputMode="numeric"
                        min={0}
                        onChange={(event) =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            lowStockAlert: sanitizeStockInput(event.target.value),
                          })
                        }
                        pattern="[0-9]*"
                        type="number"
                        value={activeExpandedVariant.lowStockAlert}
                      />
                    </label>
                  </div>
                  {activeExpandedPricingBreakdown ? (
                    <div
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs leading-5",
                        activeExpandedPricingBreakdown.tone === "success" &&
                          "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100",
                        activeExpandedPricingBreakdown.tone === "warning" &&
                          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100",
                        activeExpandedPricingBreakdown.tone === "neutral" &&
                          "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300",
                      )}
                    >
                      <div className="font-semibold text-zinc-950 dark:text-white">
                        {activeExpandedPricingBreakdown.title}
                      </div>
                      <div>{activeExpandedPricingBreakdown.message}</div>
                    </div>
                  ) : null}
                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
                    <Checkbox
                      checked={activeExpandedVariant.continueSellingOutOfStock}
                      onCheckedChange={(checked) =>
                        updateGeneratedVariant(activeExpandedVariant.id, {
                          continueSellingOutOfStock: Boolean(checked),
                        })
                      }
                      className="size-4 rounded-[4px] border-slate-300 bg-white data-checked:border-emerald-600 data-checked:bg-emerald-600 data-checked:text-white"
                    />
                    <span className="flex items-center gap-1.5">
                      Continue selling this variant when out of stock
                      <InfoHint
                        label="Continue selling this variant"
                        text="Allow this variant to keep accepting orders when stock reaches zero."
                      />
                    </span>
                  </label>
                </section>

                <section className="grid gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                      Shipping overrides
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                      Use grams for weight and millimetres for dimensions.
                      Decimal values are allowed.
                    </p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <label className="grid gap-1.5">
                      <FieldLabel info="Choose a saved parcel preset to fill this variant's weight and dimensions.">
                        Parcel preset
                      </FieldLabel>
                      <Select
                        onValueChange={(value) =>
                          applyParcelPresetToVariant(
                            activeExpandedVariant.id,
                            value === "__none" ? null : value,
                          )
                        }
                        value={activeExpandedVariant.parcelPresetId ?? "__none"}
                      >
                        <SelectTrigger className={fieldClass}>
                          <SelectValue placeholder="Select a saved parcel preset" />
                        </SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          <SelectItem className={selectItemClass} value="__none">
                            No preset selected
                          </SelectItem>
                          {parcelPresets.map((preset) => (
                            <SelectItem
                              key={preset.id}
                              className={selectItemClass}
                              value={preset.id}
                            >
                              {preset.name}
                              {preset.isDefault ? " · Default" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <DashboardButton
                      className="h-10"
                      onClick={() =>
                        openParcelPresetSaveDialog({
                          type: "variant",
                          variantId: activeExpandedVariant.id,
                        })
                      }
                      type="button"
                    >
                      <SaveIcon className="size-3.5" />
                      Save as preset
                    </DashboardButton>
                  </div>
                  {activeExpandedVariantParcelPreset ? (
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {isActiveExpandedVariantParcelPresetModified
                        ? `Modified from ${activeExpandedVariantParcelPreset.name}.`
                        : `Using ${activeExpandedVariantParcelPreset.name}.`}
                    </p>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="grid gap-1.5">
                      <FieldLabel info="Optional variant-specific packed weight in grams. Decimals are allowed.">
                        Weight override (g)
                      </FieldLabel>
                      <Input
                        className={fieldClass}
                        inputMode="decimal"
                        min={1}
                        onChange={(event) =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            weightGrams: sanitizeShippingMetricInput(
                              event.target.value,
                            ),
                          })
                        }
                        pattern="[0-9]*[.]?[0-9]*"
                        placeholder="g"
                        step="any"
                        type="number"
                        value={activeExpandedVariant.weightGrams}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <FieldLabel info="Optional variant-specific packed length in millimetres. Decimals are allowed.">
                        Length override (mm)
                      </FieldLabel>
                      <Input
                        className={fieldClass}
                        inputMode="decimal"
                        min={1}
                        onChange={(event) =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            lengthMm: sanitizeShippingMetricInput(
                              event.target.value,
                            ),
                          })
                        }
                        pattern="[0-9]*[.]?[0-9]*"
                        placeholder="mm"
                        step="any"
                        type="number"
                        value={activeExpandedVariant.lengthMm}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <FieldLabel info="Optional variant-specific packed width in millimetres. Decimals are allowed.">
                        Width override (mm)
                      </FieldLabel>
                      <Input
                        className={fieldClass}
                        inputMode="decimal"
                        min={1}
                        onChange={(event) =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            widthMm: sanitizeShippingMetricInput(
                              event.target.value,
                            ),
                          })
                        }
                        pattern="[0-9]*[.]?[0-9]*"
                        placeholder="mm"
                        step="any"
                        type="number"
                        value={activeExpandedVariant.widthMm}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <FieldLabel info="Optional variant-specific packed height in millimetres. Decimals are allowed.">
                        Height override (mm)
                      </FieldLabel>
                      <Input
                        className={fieldClass}
                        inputMode="decimal"
                        min={1}
                        onChange={(event) =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            heightMm: sanitizeShippingMetricInput(
                              event.target.value,
                            ),
                          })
                        }
                        pattern="[0-9]*[.]?[0-9]*"
                        placeholder="mm"
                        step="any"
                        type="number"
                        value={activeExpandedVariant.heightMm}
                      />
                    </label>
                  </div>
                </section>

                <section className="grid gap-3">
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                    Operations
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="grid gap-1.5">
                      <FieldLabel info="Optional barcode or supplier identifier for this variant.">
                        Barcode
                      </FieldLabel>
                      <Input
                        className={fieldClass}
                        onChange={(event) =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            barcode: event.target.value,
                          })
                        }
                        value={activeExpandedVariant.barcode}
                      />
                    </label>
                    <label className="grid gap-1.5 md:col-span-3">
                      <FieldLabel info="Internal notes for this specific variant.">
                        Notes
                      </FieldLabel>
                      <Input
                        className={fieldClass}
                        onChange={(event) =>
                          updateGeneratedVariant(activeExpandedVariant.id, {
                            notes: event.target.value,
                          })
                        }
                        value={activeExpandedVariant.notes}
                      />
                    </label>
                  </div>
                </section>

                {enableGoogleCommerceSettings ? (
                  <section className="grid gap-3">
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                      Google Commerce
                    </h3>
                    <GoogleCommerceFields
                      disabled={fullListingControlsDisabled}
                      fulfillmentChannel={
                        activeExpandedVariant.googleFulfillmentChannel
                      }
                      manufacturerMpn={activeExpandedVariant.manufacturerMpn}
                      onFulfillmentChannelChange={(value) =>
                        updateGeneratedVariant(activeExpandedVariant.id, {
                          googleFulfillmentChannel: value,
                        })
                      }
                      onManufacturerMpnChange={(value) =>
                        updateGeneratedVariant(activeExpandedVariant.id, {
                          manufacturerMpn: value,
                        })
                      }
                      onReturnPolicyLabelChange={(value) =>
                        updateGeneratedVariant(activeExpandedVariant.id, {
                          googleReturnPolicyLabel: value,
                        })
                      }
                      returnPolicyLabel={
                        activeExpandedVariant.googleReturnPolicyLabel
                      }
                    />
                  </section>
                ) : null}

                <section className="grid gap-3">
                  <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                    Cylinder exchange
                  </h3>
                  <ExchangeRulesFields
                    acceptedBrandsInput={
                      activeExpandedVariant.exchangeAcceptedReturnBrandsInput
                    }
                    confirmationText={activeExpandedVariant.exchangeConfirmationText}
                    disabled={fullListingControlsDisabled}
                    emptyCylinderSize={activeExpandedVariant.exchangeEmptyCylinderSize}
                    enabled={activeExpandedVariant.exchangeRequiresEmpty}
                    onAcceptedBrandsInputChange={(value) =>
                      updateGeneratedVariant(activeExpandedVariant.id, {
                        exchangeAcceptedReturnBrandsInput: value,
                      })
                    }
                    onConfirmationTextChange={(value) =>
                      updateGeneratedVariant(activeExpandedVariant.id, {
                        exchangeConfirmationText: value,
                      })
                    }
                    onEmptyCylinderSizeChange={(value) =>
                      updateGeneratedVariant(activeExpandedVariant.id, {
                        exchangeEmptyCylinderSize: value,
                      })
                    }
                    onEnabledChange={(value) =>
                      updateGeneratedVariant(activeExpandedVariant.id, {
                        exchangeRequiresEmpty: value,
                      })
                    }
                  />
                </section>
              </div>
            </DialogBody>
          ) : null}
          <DialogFooter>
            <Button
              className="h-8 rounded-md px-3 text-[14px] font-normal"
              onClick={() => setExpandedVariantId(null)}
              type="button"
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(bulkValueDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setBulkValueDialog(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bulkValueDialog?.label ?? "Bulk update"}</DialogTitle>
            <DialogDescription>
              Apply this value to {selectedVariantCount} selected variant
              {selectedVariantCount === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <label className="grid gap-1.5">
              <FieldLabel info="This value will be applied to every selected variant.">
                Value
              </FieldLabel>
              <Input
                autoFocus
                className={fieldClass}
                onChange={(event) =>
                  setBulkValueDialog((current) =>
                    current
                      ? {
                          ...current,
                          value:
                            current.field === "stock"
                              ? sanitizeStockInput(event.target.value)
                              : sanitizeDecimalNumberInput(event.target.value),
                        }
                      : current,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyBulkValueDialog();
                  }
                }}
                inputMode={bulkValueDialog?.field === "stock" ? "numeric" : "decimal"}
                pattern={
                  bulkValueDialog?.field === "stock"
                    ? "[0-9]*"
                    : "[0-9]*[.]?[0-9]*"
                }
                placeholder={bulkValueDialog?.placeholder}
                step={bulkValueDialog?.field === "stock" ? "1" : "0.01"}
                value={bulkValueDialog?.value ?? ""}
              />
            </label>
          </DialogBody>
          <DialogFooter>
            <Button
              className="h-8 rounded-md border-emerald-700 bg-emerald-700 px-3 text-[14px] font-normal text-white hover:bg-emerald-800"
              onClick={applyBulkValueDialog}
              type="button"
            >
              Apply
            </Button>
            <Button
              className="h-8 rounded-md px-3 text-[14px] font-normal"
              onClick={() => setBulkValueDialog(null)}
              type="button"
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(parcelPresetSaveDialog)}
        onOpenChange={(open) => {
          if (!open && !isSavingParcelPreset) {
            setParcelPresetSaveDialog(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save parcel preset</DialogTitle>
            <DialogDescription>
              Reuse these parcel metrics across products and variants.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <label className="grid gap-1.5">
              <FieldLabel info="A short reusable package name, such as Small parcel or Paper bag.">
                Preset name *
              </FieldLabel>
              <Input
                autoFocus
                className={fieldClass}
                maxLength={120}
                onChange={(event) =>
                  setParcelPresetSaveDialog((current) =>
                    current
                      ? { ...current, name: toTitleCaseInput(event.target.value) }
                      : current,
                  )
                }
                placeholder="Small parcel"
                value={parcelPresetSaveDialog?.name ?? ""}
              />
            </label>
            <label className="grid gap-1.5">
              <FieldLabel info="Optional internal reminder for when this preset should be used.">
                Notes
              </FieldLabel>
              <Textarea
                className={cn(fieldClass, "min-h-20")}
                maxLength={500}
                onChange={(event) =>
                  setParcelPresetSaveDialog((current) =>
                    current ? { ...current, notes: event.target.value } : current,
                  )
                }
                placeholder="Example: Fits one folded hoodie or a small boxed item."
                value={parcelPresetSaveDialog?.notes ?? ""}
              />
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
              <Checkbox
                checked={parcelPresetSaveDialog?.isDefault ?? false}
                onCheckedChange={(checked) =>
                  setParcelPresetSaveDialog((current) =>
                    current
                      ? { ...current, isDefault: Boolean(checked) }
                      : current,
                  )
                }
                className="size-4 rounded-[4px] border-slate-300 bg-white data-checked:border-emerald-600 data-checked:bg-emerald-600 data-checked:text-white"
              />
              <span>Use as my default parcel preset</span>
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400">
              Preset values are copied into the product. Future changes to the
              preset will not silently change existing product shipping metrics.
            </div>
            {parcelPresetFeedback ? (
              <p
                className={cn(
                  "text-xs",
                  parcelPresetFeedback.tone === "success"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-red-600 dark:text-red-300",
                )}
              >
                {parcelPresetFeedback.message}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              className="h-8 rounded-md border-emerald-700 bg-emerald-700 px-3 text-[14px] font-normal text-white hover:bg-emerald-800"
              disabled={isSavingParcelPreset}
              onClick={saveParcelPresetFromDialog}
              type="button"
            >
              {isSavingParcelPreset ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <SaveIcon className="size-3.5" />
              )}
              Save preset
            </Button>
            <Button
              className="h-8 rounded-md px-3 text-[14px] font-normal"
              disabled={isSavingParcelPreset}
              onClick={() => setParcelPresetSaveDialog(null)}
              type="button"
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingVariantCombinations)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingVariantCombinations(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate many variants?</DialogTitle>
            <DialogDescription>
              This will generate {pendingVariantCombinations?.length ?? 0} variant
              combinations. You can remove combinations you do not sell after
              generating.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
              Large variant sets take longer to inspect. Continue
              only if each option value is needed for this product.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              className="h-8 rounded-md border-emerald-700 bg-emerald-700 px-3 text-[14px] font-normal text-white hover:bg-emerald-800"
              onClick={() => {
                if (pendingVariantCombinations) {
                  applyGeneratedVariants(pendingVariantCombinations);
                }
              }}
              type="button"
            >
              Generate
            </Button>
            <Button
              className="h-8 rounded-md px-3 text-[14px] font-normal"
              onClick={() => setPendingVariantCombinations(null)}
              type="button"
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewVideoAsset)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewVideoAsset(null);
          }
        }}
      >
        {previewVideoAsset ? (
          <DialogContent className="w-[min(48rem,calc(100vw-2rem))] max-w-none border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
            <DialogHeader>
              <DialogTitle>Video preview</DialogTitle>
            </DialogHeader>
            <DialogBody className="p-0">
              <video
                className="aspect-video w-full bg-black"
                controls
                src={previewVideoAsset.publicUrl}
              >
                <track kind="captions" />
              </video>
            </DialogBody>
            <DialogFooter showCloseButton />
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={isImportLinkOpen}
        onOpenChange={(open) => {
          if (!open && !isScanningImportLink && !isApplyingImport) {
            setIsImportLinkOpen(false);
          }
        }}
      >
        <DialogContent className="w-[min(52rem,calc(100vw-2rem))] max-w-none border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader>
            <div className="mx-auto mb-2 grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
              <LinkIcon className="size-7" />
            </div>
            <DialogTitle className="text-center">Import product from link</DialogTitle>
            <DialogDescription className="text-center">
              Paste a product page link. Jurgens Energy will scan it, show what was
              found, and only apply the details after you confirm.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="grid gap-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="relative min-w-0">
                  <LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className={cn(fieldClass, "pl-9 pr-9")}
                    disabled={isScanningImportLink || isApplyingImport}
                    onChange={(event) => setImportLinkUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleScanImportLink();
                      }
                    }}
                    placeholder="Paste product link here"
                    type="url"
                    value={importLinkUrl}
                  />
                  {importLinkUrl ? (
                    <button
                      aria-label="Clear product link"
                      className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                      disabled={isScanningImportLink || isApplyingImport}
                      onClick={() => setImportLinkUrl("")}
                      type="button"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  ) : null}
                </div>
                <DashboardButton
                  className="h-10 border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white"
                  disabled={isScanningImportLink || isApplyingImport}
                  onClick={() => void handleScanImportLink()}
                  type="button"
                >
                  {isScanningImportLink ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <SearchIcon className="size-3.5" />
                  )}
                  {isScanningImportLink ? "Scanning" : "Scan"}
                </DashboardButton>
              </div>

              {!importedProduct && displayedImportLinkSteps.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-emerald-50/40 p-3 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-emerald-500/5 dark:text-zinc-400">
                  <p className="font-semibold text-zinc-950 dark:text-white">
                    Jurgens Energy will scan for:
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    <li>Product media you can choose before importing.</li>
                    <li>Title, brand, SKU, descriptions, and VAT-inclusive pricing.</li>
                    <li>A preview you can review before anything is applied.</li>
                  </ul>
                </div>
              ) : null}
            </div>

            {displayedImportLinkSteps.length > 0 ? (
              <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
                  Import progress
                </p>
                <div className="grid gap-2">
                  {displayedImportLinkSteps.map((step, index) => (
                    <div
                      key={`${step.step}-${index}`}
                      className="flex min-w-0 items-start gap-2 text-sm"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                          step.tone === "success" &&
                            "bg-emerald-100 text-emerald-700",
                          step.tone === "error" && "bg-red-100 text-red-700",
                          step.tone === "working" &&
                            "bg-amber-100 text-amber-700",
                        )}
                      >
                        {step.tone === "working" ? (
                          <Loader2Icon className="size-3 animate-spin" />
                        ) : step.tone === "success" ? (
                          <CheckCircleIcon className="size-3" />
                        ) : (
                          <XCircleIcon className="size-3" />
                        )}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1",
                          step.tone === "error"
                            ? "text-red-700 dark:text-red-300"
                            : "text-slate-700 dark:text-zinc-300",
                        )}
                      >
                        {step.message}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {importedProduct ? (
              <section className="grid gap-4 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Product name
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {importedProduct.productName || "Not found"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Brand
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {importedProduct.brandName || "Not found"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      SKU
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {importedProduct.sku || "Will be generated if missing"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Manufacturer MPN
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {importedProduct.manufacturerMpn || "Not found"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      VAT-inclusive price
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {importedProduct.price || "Not found"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Description
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm text-slate-600 dark:text-zinc-400">
                    {importedProduct.description || "No description was found."}
                  </p>
                </div>
                <div className="grid gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Images to import
                  </p>
                  {importedProduct.images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {importedProduct.images.map((image, index) => {
                        const isSelected = selectedImportedImageUrls.includes(
                          image.url,
                        );

                        return (
                          <button
                            key={image.url}
                            className={cn(
                              "relative aspect-square overflow-hidden rounded-lg border bg-slate-50 text-left transition dark:bg-white/[0.04]",
                              isSelected
                                ? "border-emerald-500 ring-2 ring-emerald-500/20"
                                : "border-slate-200 dark:border-white/10",
                            )}
                            onClick={() => toggleImportedImage(image.url)}
                            type="button"
                          >
                            <span
                              aria-hidden
                              className="absolute inset-0 bg-cover bg-center"
                              style={{ backgroundImage: `url("${image.url}")` }}
                            />
                            <span className="absolute left-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white/95 text-[11px] font-bold text-zinc-950 shadow-sm">
                              {index + 1}
                            </span>
                            {isSelected ? (
                              <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-emerald-700 text-white shadow-sm">
                                <CheckCircleIcon className="size-3.5" />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      No importable images were found. You can still apply the
                      text details and add media manually.
                    </p>
                  )}
                </div>
              </section>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              className="h-8 rounded-md px-3 text-[14px] font-normal"
              disabled={isScanningImportLink || isApplyingImport}
              onClick={() => setIsImportLinkOpen(false)}
              type="button"
              variant="outline"
            >
              Close
            </Button>
            {importedProduct ? (
              <Button
                className="h-8 rounded-md border-emerald-700 bg-emerald-700 px-3 text-[14px] font-normal text-white hover:bg-emerald-800"
                disabled={isScanningImportLink || isApplyingImport}
                onClick={applyImportedProduct}
                type="button"
              >
                {isApplyingImport ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircleIcon className="size-3.5" />
                )}
                {isApplyingImport ? "Importing..." : "Import now"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaManagerDialog
        acceptedMediaTypes={["image", "video"]}
        allowMultipleSelection={mediaSelectionTarget.type === "product"}
        applySelectionOnClose={mediaSelectionTarget.type === "product"}
        assets={mediaLibraryAssets}
        folders={data.mediaLibrary.folders}
        onOpenChange={setIsMediaOpen}
        onSelect={handleMediaSelect}
        onSelectMany={handleMediaSelectMany}
        open={isMediaOpen}
        selectedAssetId={mediaDialogSelectedAssetId}
        selectedAssetIds={mediaDialogSelectedAssetIds}
        storage={data.mediaLibrary.storage}
        surface="admin"
        title="Product media"
        usedStorageBytes={data.mediaLibrary.usedStorageBytes}
      />
    </div>
  );
}
