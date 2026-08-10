"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangleIcon,
  BadgePercentIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  FilterIcon,
  ImageOffIcon,
  Layers3Icon,
  Loader2Icon,
  PackageSearchIcon,
  PaletteIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import {
  DashboardButton,
  DashboardInput,
  DashboardTablePagination,
  dashboardControlClass,
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
  AdminSaleCampaign,
  AdminSaleProduct,
  AdminSaleVariant,
  AdminSalesData,
  SaleActionResult,
} from "@/src/modules/admin/sales";
import {
  buildSalesMetrics,
  countHiddenSelected,
  filterSaleProducts,
  getFilteredEligibleVariantIds,
  getProductSelectionState,
  paginateSaleProducts,
  updateSelectedVariantIds,
  type SaleEligibilityFilter,
  type SaleStockFilter,
} from "@/src/modules/admin/sales-presentation";

import {
  createSaleCampaignAction,
  deleteSaleCampaignAction,
  endSaleCampaignAction,
  updateSaleCampaignAppearanceAction,
} from "./actions";
import {
  CampaignAppearanceEditor,
  defaultCampaignAppearance,
  getCampaignTextColor,
  isCampaignHexColor,
  type CampaignAppearanceValue,
} from "./campaign-appearance-editor";
import { CampaignDynamicIcon } from "./campaign-icon-picker";

const saleSelectionLimit = 200;
const defaultPageSize = 10;
const selectContentClass =
  "border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white";
const selectItemClass =
  "cursor-pointer px-2 py-2 text-zinc-800 focus:bg-slate-100 focus:text-zinc-950 dark:text-zinc-200 dark:focus:bg-white/10 dark:focus:text-white";

function formatMoney(value: number | string | null) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    style: "currency",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date)
    : "Unknown date";
}

function humanizeStatus(status: string) {
  return status
    .split("_")
    .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getSalePrice(price: string, discountPercent: number) {
  const amount = Number(price);

  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(discountPercent) ||
    discountPercent < 1 ||
    discountPercent > 95
  ) {
    return null;
  }

  return Math.max(
    0.01,
    Math.round(amount * 100 * (1 - discountPercent / 100)) / 100,
  );
}

function getPriceRange(variants: AdminSaleVariant[]) {
  const prices = variants
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price));

  if (prices.length === 0) {
    return "No price";
  }

  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);

  return Math.abs(maximum - minimum) < 0.005
    ? formatMoney(minimum)
    : `${formatMoney(minimum)} – ${formatMoney(maximum)}`;
}

function ProductImage({
  alt,
  className,
  src,
}: {
  alt: string;
  className?: string;
  src: string | null;
}) {
  return (
    <div
      className={cn(
        "relative aspect-square shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]",
        className,
      )}
    >
      {src ? (
        <Image
          alt={alt}
          className="object-cover"
          fill
          sizes="72px"
          src={src}
        />
      ) : (
        <span className="grid size-full place-items-center text-slate-400 dark:text-zinc-500">
          <ImageOffIcon className="size-5" />
          <span className="sr-only">No product image</span>
        </span>
      )}
    </div>
  );
}

function StatusMessage({ result }: { result: SaleActionResult | null }) {
  if (!result?.message) {
    return null;
  }

  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        result.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100",
      )}
      role={result.ok ? "status" : "alert"}
    >
      {result.message}
    </p>
  );
}

function FilterSelect({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300">
      {label}
      <Select
        onValueChange={(nextValue: string | null) => {
          if (nextValue) {
            onValueChange(nextValue);
          }
        }}
        value={value}
      >
        <SelectTrigger className={cn("h-9 w-full", dashboardControlClass)}>
          <SelectValue>
            {options.find((option) => option.value === value)?.label ?? value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className={selectContentClass} sideOffset={6}>
          {options.map((option) => (
            <SelectItem
              className={selectItemClass}
              key={option.value}
              value={option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

type FilterOption = {
  label: string;
  value: string;
};

function getNamedEntityOptions(
  products: AdminSaleProduct[],
  getEntity: (product: AdminSaleProduct) => {
    id: string | null;
    label: string | null;
  },
) {
  const optionByValue = new Map<string, FilterOption>();

  for (const product of products) {
    const entity = getEntity(product);

    if (!entity.label) {
      continue;
    }

    const value = entity.id ?? entity.label;
    optionByValue.set(value, { label: entity.label, value });
  }

  return Array.from(optionByValue.values()).sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

function SaleFilterPanel({
  brandFilter,
  brandOptions,
  categoryFilter,
  categoryOptions,
  eligibilityFilter,
  inventoryFilter,
  onChangeBrand,
  onChangeCategory,
  onChangeEligibility,
  onChangeInventory,
  onChangeStatus,
  onClear,
  onClose,
  productStatusFilter,
  statusOptions,
}: {
  brandFilter: string;
  brandOptions: FilterOption[];
  categoryFilter: string;
  categoryOptions: FilterOption[];
  eligibilityFilter: SaleEligibilityFilter;
  inventoryFilter: SaleStockFilter;
  onChangeBrand: (value: string) => void;
  onChangeCategory: (value: string) => void;
  onChangeEligibility: (value: SaleEligibilityFilter) => void;
  onChangeInventory: (value: SaleStockFilter) => void;
  onChangeStatus: (value: string) => void;
  onClear: () => void;
  onClose: () => void;
  productStatusFilter: string;
  statusOptions: string[];
}) {
  return (
    <div
      aria-label="Sales product filters"
      className="fixed inset-x-4 top-20 z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-2xl [scrollbar-width:thin] dark:border-white/10 dark:bg-[#151719] md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-[420px]"
      id="sales-product-filters"
      role="dialog"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-zinc-950 dark:text-white">
            Filter products
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Filters apply to products and their nested variants.
          </p>
        </div>
        <button
          aria-label="Close sales filters"
          className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={onClose}
          type="button"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FilterSelect
          label="Sale availability"
          onValueChange={(value) =>
            onChangeEligibility(value as SaleEligibilityFilter)
          }
          options={[
            { label: "All variants", value: "all" },
            { label: "Eligible for sale", value: "eligible" },
            { label: "Already on sale", value: "on_sale" },
            { label: "Other unavailable", value: "unavailable" },
          ]}
          value={eligibilityFilter}
        />
        <FilterSelect
          label="Inventory"
          onValueChange={(value) => onChangeInventory(value as SaleStockFilter)}
          options={[
            { label: "All inventory", value: "all" },
            { label: "In stock", value: "in_stock" },
            { label: "Out of stock", value: "out_of_stock" },
          ]}
          value={inventoryFilter}
        />
        <FilterSelect
          label="Product status"
          onValueChange={onChangeStatus}
          options={[
            { label: "All statuses", value: "all" },
            ...statusOptions.map((status) => ({
              label: humanizeStatus(status),
              value: status,
            })),
          ]}
          value={productStatusFilter}
        />
        <FilterSelect
          label="Brand"
          onValueChange={onChangeBrand}
          options={[
            { label: "All brands", value: "all" },
            { label: "No brand", value: "__none__" },
            ...brandOptions,
          ]}
          value={brandFilter}
        />
        <div className="sm:col-span-2">
          <FilterSelect
            label="Category"
            onValueChange={onChangeCategory}
            options={[
              { label: "All categories", value: "all" },
              { label: "Uncategorized", value: "__none__" },
              ...categoryOptions,
            ]}
            value={categoryFilter}
          />
        </div>
      </div>

      <button
        className="mt-4 text-xs font-semibold text-primary hover:text-[#d94514] dark:text-brand-amber"
        onClick={onClear}
        type="button"
      >
        Clear filters
      </button>
    </div>
  );
}

function VariantAvailabilityBadge({ variant }: { variant: AdminSaleVariant }) {
  if (variant.selectable) {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
        Eligible
      </Badge>
    );
  }

  if (variant.activeCampaignName) {
    return (
      <Badge className="border-primary/20 bg-primary/10 text-primary dark:text-brand-amber">
        {variant.activeCampaignName}
      </Badge>
    );
  }

  if (variant.availabilityCode === "compare_at_sale") {
    return (
      <Badge className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
        Existing markdown
      </Badge>
    );
  }

  return <Badge variant="secondary">Unavailable</Badge>;
}

function CampaignTableRows({
  campaign,
  onDelete,
  onEnd,
  onEditAppearance,
  pending,
  productBySlug,
}: {
  campaign: AdminSaleCampaign;
  onDelete: (campaign: AdminSaleCampaign) => void;
  onEnd: (campaign: AdminSaleCampaign) => void;
  onEditAppearance: (campaign: AdminSaleCampaign) => void;
  pending: boolean;
  productBySlug: ReadonlyMap<string, AdminSaleProduct>;
}) {
  const [expanded, setExpanded] = useState(false);
  const groupedVariants = Array.from(
    campaign.variants.reduce(
      (groups, variant) => {
        const variants = groups.get(variant.productSlug) ?? [];
        variants.push(variant);
        groups.set(variant.productSlug, variants);
        return groups;
      },
      new Map<string, AdminSaleCampaign["variants"]>(),
    ),
  );
  const campaignTextColor = getCampaignTextColor(campaign.badgeColor);
  const campaignHeadingId = `sale-campaign-${campaign.id}-heading`;
  const campaignDetailsId = `sale-campaign-${campaign.id}-details`;
  const menuItemClass =
    "flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06]";

  return (
    <>
      <TableRow
        aria-busy={pending}
        className={dashboardTableRowClass}
        data-state={expanded ? "selected" : undefined}
      >
        <TableCell className={cn("min-w-0", dashboardTableCellClass)}>
          <div className="min-w-0">
            <p
              className={cn("truncate", dashboardTablePrimaryTextClass)}
              id={campaignHeadingId}
            >
              {campaign.name}
            </p>
            <p className={cn("max-w-sm truncate", dashboardTableSecondaryTextClass)}>
              {campaign.publicHeadline || campaign.name} · {campaign.ctaLabel}
            </p>
          </div>
        </TableCell>
        <TableCell className={dashboardTableCellClass}>
          <div className="grid justify-items-start gap-1.5">
            <Badge
              className="gap-1 border-transparent"
              style={{
                backgroundColor: campaign.badgeColor,
                color: campaignTextColor,
              }}
            >
              <CampaignDynamicIcon
                className="size-3.5"
                iconName={campaign.badgeIcon}
              />
              {campaign.badgeText}
            </Badge>
            <span className={dashboardTableSecondaryTextClass}>
              {campaign.headerVisible
                ? `Header · priority ${campaign.headerPriority}`
                : "Header hidden"}
            </span>
          </div>
        </TableCell>
        <TableCell className={dashboardTableCellClass}>
          <p className={dashboardTablePrimaryTextClass}>
            {campaign.variants.length} variant
            {campaign.variants.length === 1 ? "" : "s"}
          </p>
          <p className={dashboardTableSecondaryTextClass}>
            {groupedVariants.length} product
            {groupedVariants.length === 1 ? "" : "s"}
          </p>
        </TableCell>
        <TableCell
          className={cn(dashboardTableCellClass, dashboardTablePrimaryTextClass)}
        >
          {Number(campaign.discountPercent)}% off
        </TableCell>
        <TableCell
          className={cn(dashboardTableCellClass, dashboardTableMutedTextClass)}
        >
          {formatDate(campaign.createdAt)}
        </TableCell>
        <TableCell
          className={cn(
            dashboardTableActionCellClass,
            "sticky right-0 z-10 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.7)] dark:bg-[#151719]",
          )}
        >
          <div className="flex justify-end">
            <DashboardRowActionMenu
              ariaLabel={`Open actions for ${campaign.name}`}
              className="w-64"
            >
              <button
                className={menuItemClass}
                disabled={pending}
                onClick={() => onEditAppearance(campaign)}
                type="button"
              >
                <PaletteIcon className="size-4" />
                Edit appearance
              </button>
              <button
                aria-controls={campaignDetailsId}
                aria-expanded={expanded}
                className={menuItemClass}
                disabled={campaign.variants.length === 0}
                onClick={() => setExpanded((current) => !current)}
                type="button"
              >
                {expanded ? (
                  <ChevronDownIcon className="size-4" />
                ) : (
                  <ChevronRightIcon className="size-4" />
                )}
                {expanded ? "Hide details" : "Show details"}
              </button>
              <button
                className={menuItemClass}
                disabled={pending}
                onClick={() => onEnd(campaign)}
                type="button"
              >
                <RotateCcwIcon className="size-4" />
                End & restore
              </button>
              <button
                className="flex h-12 w-full items-center gap-3 bg-red-50/80 px-4 text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
                disabled={pending}
                onClick={() => onDelete(campaign)}
                type="button"
              >
                <Trash2Icon className="size-4" />
                Delete
              </button>
            </DashboardRowActionMenu>
          </div>
        </TableCell>
      </TableRow>

      {expanded ? (
        <TableRow
          className="border-slate-200 bg-slate-50/70 hover:bg-slate-50/70 dark:border-white/10 dark:bg-black/10 dark:hover:bg-black/10"
          id={campaignDetailsId}
        >
          <TableCell className="whitespace-normal p-0" colSpan={6}>
            <div
              aria-labelledby={campaignHeadingId}
              className="divide-y divide-slate-200 dark:divide-white/10"
              role="region"
            >
              {groupedVariants.map(([productSlug, variants]) => {
                const product = productBySlug.get(productSlug);

                return (
                  <div
                    className="grid gap-3 p-4 md:px-5"
                    key={`${campaign.id}-${productSlug}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductImage
                        alt={
                          product?.title ?? variants[0]?.productTitle ?? "Product"
                        }
                        className="size-12"
                        src={product?.coverMediaUrl ?? null}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-zinc-950 dark:text-white">
                          {product?.title ?? variants[0]?.productTitle}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {variants.length} variant
                          {variants.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 pl-0 sm:pl-[60px]">
                      {variants.map((variant) => (
                        <div
                          className="flex flex-col gap-1 rounded-md bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/10 sm:flex-row sm:items-center sm:justify-between"
                          key={`${campaign.id}-${variant.variantId}`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-950 dark:text-white">
                              {variant.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">
                              SKU {variant.sku}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-zinc-950 dark:text-white">
                            <span className="text-slate-400 line-through">
                              {formatMoney(variant.originalPrice)}
                            </span>{" "}
                            → {formatMoney(variant.salePrice)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function AdminSaleManager({ data }: { data: AdminSalesData }) {
  const router = useRouter();
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SaleActionResult | null>(null);
  const [name, setName] = useState("");
  const [badgeText, setBadgeText] = useState("Sale");
  const [discountPercent, setDiscountPercent] = useState("10");
  const [appearance, setAppearance] = useState<CampaignAppearanceValue>(
    defaultCampaignAppearance,
  );
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [eligibilityFilter, setEligibilityFilter] =
    useState<SaleEligibilityFilter>("all");
  const [inventoryFilter, setInventoryFilter] =
    useState<SaleStockFilter>("all");
  const [productStatusFilter, setProductStatusFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(
    () => new Set(data.products.slice(0, 1).map((product) => product.id)),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [campaignToEdit, setCampaignToEdit] =
    useState<AdminSaleCampaign | null>(null);
  const [appearanceDraft, setAppearanceDraft] =
    useState<CampaignAppearanceValue>(defaultCampaignAppearance);
  const [campaignToDelete, setCampaignToDelete] =
    useState<AdminSaleCampaign | null>(null);
  const [campaignToEnd, setCampaignToEnd] =
    useState<AdminSaleCampaign | null>(null);
  const [confirmLossSaleOpen, setConfirmLossSaleOpen] = useState(false);

  const variants = useMemo(
    () => data.products.flatMap((product) => product.variants),
    [data.products],
  );
  const productBySlug = useMemo(
    () => new Map(data.products.map((product) => [product.slug, product])),
    [data.products],
  );
  const sourceProductById = useMemo(
    () => new Map(data.products.map((product) => [product.id, product])),
    [data.products],
  );
  const brandOptions = useMemo(
    () =>
      getNamedEntityOptions(data.products, (product) => ({
        id: product.brandId,
        label: product.brandName,
      })),
    [data.products],
  );
  const categoryOptions = useMemo(
    () =>
      getNamedEntityOptions(data.products, (product) => ({
        id: product.categoryId,
        label: product.categoryPath,
      })),
    [data.products],
  );
  const statusOptions = useMemo(
    () =>
      Array.from(new Set(data.products.map((product) => product.status))).sort(
        (left, right) => left.localeCompare(right),
      ),
    [data.products],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = useMemo(
    () =>
      filterSaleProducts<AdminSaleVariant, AdminSaleProduct>(data.products, {
        brand: brandFilter,
        category: categoryFilter,
        eligibility: eligibilityFilter,
        productStatus: productStatusFilter,
        query,
        stock: inventoryFilter,
      }),
    [
      brandFilter,
      categoryFilter,
      data.products,
      eligibilityFilter,
      inventoryFilter,
      productStatusFilter,
      query,
    ],
  );
  const filteredVariants = useMemo(
    () => filteredProducts.flatMap((product) => product.variants),
    [filteredProducts],
  );
  const filteredEligibleVariantIds = useMemo(
    () => getFilteredEligibleVariantIds(filteredProducts),
    [filteredProducts],
  );
  const filteredEligibleVariantIdSet = useMemo(
    () => new Set(filteredEligibleVariantIds),
    [filteredEligibleVariantIds],
  );
  const filteredEligibleVariants = useMemo(
    () =>
      filteredVariants.filter((variant) =>
        filteredEligibleVariantIdSet.has(variant.id),
      ),
    [filteredEligibleVariantIdSet, filteredVariants],
  );
  const selectedVariants = useMemo(
    () =>
      variants.filter(
        (variant) => variant.selectable && selectedVariantIds.has(variant.id),
      ),
    [selectedVariantIds, variants],
  );
  const hiddenSelectedCount = countHiddenSelected(
    filteredProducts,
    selectedVariantIds,
  );
  const filteredEligibleAreSelected =
    filteredEligibleVariantIds.length > 0 &&
    filteredEligibleVariantIds.every((variantId) =>
      selectedVariantIds.has(variantId),
    );
  const productPage = paginateSaleProducts(
    filteredProducts,
    currentPage,
    pageSize,
  );
  const activePage = productPage.currentPage;
  const pageProducts = productPage.products;
  const allPageExpanded =
    pageProducts.length > 0 &&
    pageProducts.every((product) => expandedProductIds.has(product.id));
  const numericDiscount = Number(discountPercent);
  const lossMakingSelectedVariants = selectedVariants.filter((variant) => {
    const costPrice = Number(variant.costPrice);
    const salePrice = getSalePrice(variant.price, numericDiscount);

    return (
      Number.isFinite(costPrice) &&
      costPrice > 0 &&
      salePrice !== null &&
      salePrice < costPrice
    );
  });
  const activeFilterCount = [
    brandFilter !== "all",
    categoryFilter !== "all",
    eligibilityFilter !== "all",
    inventoryFilter !== "all",
    productStatusFilter !== "all",
  ].filter(Boolean).length;
  const createDisabled =
    isPending ||
    !data.salesAvailable ||
    selectedVariants.length === 0 ||
    !name.trim() ||
    !badgeText.trim() ||
    !appearance.ctaLabel.trim() ||
    !isCampaignHexColor(appearance.badgeColor) ||
    !Number.isInteger(appearance.headerPriority) ||
    appearance.headerPriority < 0 ||
    appearance.headerPriority > 32767 ||
    !Number.isFinite(numericDiscount) ||
    numericDiscount < 1 ||
    numericDiscount > 95;
  const metricCounts = buildSalesMetrics(
    data.products,
    selectedVariantIds,
    data.activeCampaigns.length,
  );
  const metrics = useMemo<DashboardMetricDefinition[]>(
    () => [
      {
        color: "#ff5a1f",
        description: "All products with variants available to review for a sale.",
        id: "products",
        label: "Products",
        value: metricCounts.products,
      },
      {
        color: "blue",
        description: "Every variant across the product catalog.",
        id: "variants",
        label: "Variants",
        value: metricCounts.variants,
      },
      {
        color: "emerald",
        description: "Active, valid-price variants that can be added to a sale.",
        id: "eligible",
        label: "Eligible",
        value: metricCounts.eligibleVariants,
      },
      {
        color: "amber",
        description: "Variants currently selected for the sale being prepared.",
        id: "selected",
        label: "Selected",
        value: metricCounts.selectedVariants,
      },
      {
        color: "violet",
        description:
          "Variants already discounted by a campaign or compare-at markdown.",
        id: "on-sale",
        label: "On sale",
        value: metricCounts.onSaleVariants,
      },
      {
        color: "#b94718",
        description: "Sale campaigns currently changing public variant prices.",
        id: "campaigns",
        label: "Campaigns",
        value: metricCounts.activeCampaigns,
      },
      {
        color: "red",
        description: "Variants blocked by product status, variant status, or pricing.",
        id: "blocked",
        label: "Blocked",
        value: metricCounts.blockedVariants,
      },
    ],
    [
      metricCounts.activeCampaigns,
      metricCounts.blockedVariants,
      metricCounts.eligibleVariants,
      metricCounts.onSaleVariants,
      metricCounts.products,
      metricCounts.selectedVariants,
      metricCounts.variants,
    ],
  );

  useEffect(() => {
    const selectableVariantIds = new Set(
      variants
        .filter((variant) => variant.selectable)
        .map((variant) => variant.id),
    );

    setSelectedVariantIds((current) => {
      const next = new Set(
        Array.from(current).filter((variantId) =>
          selectableVariantIds.has(variantId),
        ),
      );

      return next.size === current.size ? current : next;
    });
  }, [variants]);

  useEffect(() => {
    if (!normalizedQuery) {
      return;
    }

    setExpandedProductIds((current) => {
      const next = new Set(current);
      let changed = false;

      for (const product of filteredProducts) {
        if (!next.has(product.id)) {
          next.add(product.id);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [filteredProducts, normalizedQuery]);

  function resetPage() {
    setCurrentPage(1);
  }

  function clearFilters() {
    setBrandFilter("all");
    setCategoryFilter("all");
    setEligibilityFilter("all");
    setInventoryFilter("all");
    setProductStatusFilter("all");
    resetPage();
  }

  function closeFilters() {
    setFilterOpen(false);
    requestAnimationFrame(() => filterButtonRef.current?.focus());
  }

  function setSelection(
    targetVariants: AdminSaleVariant[],
    checked: boolean,
  ) {
    const newlyEligibleIds = new Set(
      targetVariants
        .filter(
          (variant) => variant.selectable && !selectedVariantIds.has(variant.id),
        )
        .map((variant) => variant.id),
    );
    const capacity = Math.max(0, saleSelectionLimit - selectedVariantIds.size);
    const omittedCount = checked
      ? Math.max(0, newlyEligibleIds.size - capacity)
      : 0;
    const nextIds = updateSelectedVariantIds(
      selectedVariantIds,
      targetVariants,
      checked,
      saleSelectionLimit,
    );

    setSelectedVariantIds(new Set(nextIds));

    if (omittedCount > 0) {
      setResult({
        message: `A sale can include up to ${saleSelectionLimit} variants. ${omittedCount} additional variant${omittedCount === 1 ? " was" : "s were"} not selected.`,
        ok: false,
      });
    }
  }

  function toggleVariant(variant: AdminSaleVariant, checked: boolean) {
    setSelection([variant], checked);
  }

  function toggleProduct(product: AdminSaleProduct, checked: boolean) {
    setSelection(product.variants, checked);
  }

  function toggleFilteredSelection() {
    setSelection(filteredEligibleVariants, !filteredEligibleAreSelected);
  }

  function toggleExpanded(productId: string) {
    setExpandedProductIds((current) => {
      const next = new Set(current);

      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }

      return next;
    });
  }

  function createSale() {
    if (!data.salesAvailable) {
      return;
    }

    startTransition(async () => {
      const response = await createSaleCampaignAction({
        ...appearance,
        badgeText,
        discountPercent: numericDiscount,
        name,
        variantIds: selectedVariants.map((variant) => variant.id),
      });

      setResult(response);

      if (response.ok) {
        setName("");
        setBadgeText("Sale");
        setDiscountPercent("10");
        setAppearance(defaultCampaignAppearance);
        setSelectedVariantIds(new Set());
        setConfirmLossSaleOpen(false);
        router.refresh();
      }
    });
  }

  function requestCreateSale() {
    if (lossMakingSelectedVariants.length > 0) {
      setResult(null);
      setConfirmLossSaleOpen(true);
      return;
    }

    createSale();
  }

  function endSale(campaignId: string) {
    startTransition(async () => {
      const response = await endSaleCampaignAction({ campaignId });
      setResult(response);

      if (response.ok) {
        setCampaignToEnd(null);
      }

      router.refresh();
    });
  }

  function deleteSale(campaignId: string) {
    startTransition(async () => {
      const response = await deleteSaleCampaignAction({ campaignId });
      setResult(response);

      if (response.ok) {
        setCampaignToDelete(null);
      }

      router.refresh();
    });
  }

  function editCampaignAppearance(campaign: AdminSaleCampaign) {
    setResult(null);
    setCampaignToEdit(campaign);
    setAppearanceDraft({
      badgeColor: campaign.badgeColor,
      badgeIcon: campaign.badgeIcon,
      ctaLabel: campaign.ctaLabel,
      headerPriority: campaign.headerPriority,
      headerVisible: campaign.headerVisible,
      publicHeadline: campaign.publicHeadline ?? "",
    });
  }

  function saveCampaignAppearance() {
    if (!campaignToEdit) {
      return;
    }

    startTransition(async () => {
      const response = await updateSaleCampaignAppearanceAction({
        campaignId: campaignToEdit.id,
        ...appearanceDraft,
      });
      setResult(response);

      if (response.ok) {
        setCampaignToEdit(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid min-w-0 gap-4">
      <DashboardCompactMetrics
        metrics={metrics}
        storageKey="jurgens-energy:admin:product-sales-metrics"
      />

      <StatusMessage result={result} />

      {!data.salesAvailable ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Sales management is unavailable</p>
            <p className="mt-1 text-sm">
              {data.salesUnavailableMessage ??
                "The sales campaign storage could not be loaded."}
            </p>
          </div>
        </div>
      ) : null}

      <section className={cn(dashboardPanelClass, "grid min-w-0 gap-4 p-4")}>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:text-brand-amber">
            <BadgePercentIcon className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
              Create sale
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Choose products, expand their variants, and select exactly what the
              campaign should discount. Ending the sale restores every saved
              original price.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">
            <span>
              Sale name <span className="text-red-600">*</span>
            </span>
            <DashboardInput
              aria-required="true"
              maxLength={160}
              onChange={(event) => setName(event.target.value)}
              placeholder="August promo"
              required
              value={name}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            <span>
              Sale badge text <span className="text-red-600">*</span>
            </span>
            <DashboardInput
              aria-required="true"
              maxLength={80}
              onChange={(event) => setBadgeText(event.target.value)}
              placeholder="Sale"
              required
              value={badgeText}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            <span>
              Discount percentage <span className="text-red-600">*</span>
            </span>
            <DashboardInput
              aria-required="true"
              max="95"
              min="1"
              onChange={(event) => setDiscountPercent(event.target.value)}
              required
              type="number"
              value={discountPercent}
            />
          </label>
        </div>

        <div className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              Campaign appearance
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              Control how this sale appears in product badges and the storefront
              header spotlight.
            </p>
          </div>
          <CampaignAppearanceEditor
            badgeText={badgeText}
            campaignName={name}
            disabled={isPending || !data.salesAvailable}
            onChange={setAppearance}
            value={appearance}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-xl">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <DashboardInput
              aria-label="Search sale products and variants"
              className="pl-9"
              onChange={(event) => {
                setQuery(event.target.value);
                resetPage();
              }}
              placeholder="Search products, SKUs, variants..."
              value={query}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <DashboardButton
                aria-controls="sales-product-filters"
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((current) => !current)}
                ref={filterButtonRef}
                type="button"
              >
                <FilterIcon className="size-3.5" />
                Filter
                {activeFilterCount > 0 ? (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </DashboardButton>
              {filterOpen ? (
                <>
                  <button
                    aria-label="Close sales filters"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={closeFilters}
                    tabIndex={-1}
                    type="button"
                  />
                  <SaleFilterPanel
                    brandFilter={brandFilter}
                    brandOptions={brandOptions}
                    categoryFilter={categoryFilter}
                    categoryOptions={categoryOptions}
                    eligibilityFilter={eligibilityFilter}
                    inventoryFilter={inventoryFilter}
                    onChangeBrand={(value) => {
                      setBrandFilter(value);
                      resetPage();
                    }}
                    onChangeCategory={(value) => {
                      setCategoryFilter(value);
                      resetPage();
                    }}
                    onChangeEligibility={(value) => {
                      setEligibilityFilter(value);
                      resetPage();
                    }}
                    onChangeInventory={(value) => {
                      setInventoryFilter(value);
                      resetPage();
                    }}
                    onChangeStatus={(value) => {
                      setProductStatusFilter(value);
                      resetPage();
                    }}
                    onClear={clearFilters}
                    onClose={closeFilters}
                    productStatusFilter={productStatusFilter}
                    statusOptions={statusOptions}
                  />
                </>
              ) : null}
            </div>
            <DashboardButton
              disabled={filteredEligibleVariants.length === 0 || isPending}
              onClick={toggleFilteredSelection}
              type="button"
            >
              <CheckCircle2Icon className="size-3.5" />
              {filteredEligibleAreSelected
                ? "Clear filtered"
                : `Select eligible (${filteredEligibleVariants.length})`}
            </DashboardButton>
            <DashboardButton
              disabled={pageProducts.length === 0}
              onClick={() => {
                setExpandedProductIds((current) => {
                  const next = new Set(current);
                  pageProducts.forEach((product) =>
                    allPageExpanded
                      ? next.delete(product.id)
                      : next.add(product.id),
                  );
                  return next;
                });
              }}
              type="button"
            >
              <Layers3Icon className="size-3.5" />
              {allPageExpanded ? "Collapse page" : "Expand page"}
            </DashboardButton>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-950 dark:text-white">
              {selectedVariants.length} of {saleSelectionLimit} variants selected
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {hiddenSelectedCount > 0
                ? `${hiddenSelectedCount} selected variant${hiddenSelectedCount === 1 ? " is" : "s are"} hidden by the current filters.`
                : `${filteredProducts.length} matching product${filteredProducts.length === 1 ? "" : "s"} · ${filteredVariants.length} matching variant${filteredVariants.length === 1 ? "" : "s"}.`}
            </p>
            {lossMakingSelectedVariants.length > 0 ? (
              <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-300">
                {lossMakingSelectedVariants.length} selected variant
                {lossMakingSelectedVariants.length === 1 ? " is" : "s are"}{" "}
                projected below recorded cost.
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {selectedVariants.length > 0 ? (
              <DashboardButton
                disabled={isPending}
                onClick={() => setSelectedVariantIds(new Set())}
                type="button"
              >
                Clear selection
              </DashboardButton>
            ) : null}
            <DashboardButton
              className="border-primary bg-primary text-white hover:bg-[#e84d18] dark:border-primary dark:bg-primary dark:text-white"
              disabled={createDisabled}
              onClick={requestCreateSale}
              type="button"
            >
              {isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
              Create sale
            </DashboardButton>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
          {pageProducts.length > 0 ? (
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {pageProducts.map((product) => {
                const sourceProduct = sourceProductById.get(product.id);
                const totalVariantCount =
                  sourceProduct?.variants.length ?? product.variants.length;
                const selectionState = getProductSelectionState(
                  product.variants,
                  selectedVariantIds,
                );
                const expanded = expandedProductIds.has(product.id);

                return (
                  <article key={product.id}>
                    <div className="flex min-w-0 items-start gap-2 bg-white p-3 dark:bg-[#151719] sm:items-center sm:gap-3 sm:p-4">
                      <Checkbox
                        aria-label={`Select shown eligible variants for ${product.title}`}
                        checked={selectionState.checked === true}
                        disabled={selectionState.disabled || isPending}
                        indeterminate={selectionState.checked === "indeterminate"}
                        onCheckedChange={(checked) =>
                          toggleProduct(product, checked === true)
                        }
                      />
                      <button
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Collapse" : "Expand"} ${product.title} variants`}
                        className="grid size-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
                        onClick={() => toggleExpanded(product.id)}
                        type="button"
                      >
                        {expanded ? (
                          <ChevronDownIcon className="size-4" />
                        ) : (
                          <ChevronRightIcon className="size-4" />
                        )}
                      </button>
                      <ProductImage
                        alt={product.title}
                        className="size-14 sm:size-16"
                        src={product.coverMediaUrl}
                      />
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => toggleExpanded(product.id)}
                        type="button"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 truncate text-sm font-bold text-zinc-950 dark:text-white sm:text-base">
                            {product.title}
                          </span>
                          <Badge variant="secondary">
                            {humanizeStatus(product.status)}
                          </Badge>
                        </span>
                        <span className="mt-1 block truncate text-xs text-slate-500 dark:text-zinc-400">
                          {product.brandName ?? "No brand"} ·{" "}
                          {product.categoryPath ?? "Uncategorized"}
                        </span>
                        <span className="mt-1 block text-xs text-slate-600 dark:text-zinc-300">
                          {product.variants.length === totalVariantCount
                            ? totalVariantCount
                            : `${product.variants.length} of ${totalVariantCount}`} variant
                          {totalVariantCount === 1 ? "" : "s"} shown ·{" "}
                          {selectionState.eligibleCount} eligible
                        </span>
                      </button>
                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-sm font-bold text-zinc-950 dark:text-white">
                          {getPriceRange(product.variants)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {selectionState.selectedCount > 0
                            ? `${selectionState.selectedCount} selected`
                            : "No variants selected"}
                        </p>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="divide-y divide-slate-100 border-t border-slate-200 bg-slate-50/70 dark:divide-white/10 dark:border-white/10 dark:bg-black/10">
                        {product.variants.map((variant) => {
                          const checked = selectedVariantIds.has(variant.id);
                          const salePrice = variant.selectable
                            ? getSalePrice(variant.price, numericDiscount)
                            : null;
                          const costPrice = Number(variant.costPrice);
                          const belowCost =
                            salePrice !== null &&
                            Number.isFinite(costPrice) &&
                            costPrice > 0 &&
                            salePrice < costPrice;

                          return (
                            <div
                              className={cn(
                                "grid min-w-0 grid-cols-[auto_2.5rem_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[auto_2.75rem_minmax(0,1fr)_auto] sm:items-center sm:pl-[68px]",
                                !variant.selectable && "opacity-65",
                              )}
                              key={variant.id}
                            >
                              <Checkbox
                                aria-label={`Select ${variant.title}, SKU ${variant.sku}`}
                                checked={checked}
                                disabled={!variant.selectable || isPending}
                                onCheckedChange={(value) =>
                                  toggleVariant(variant, value === true)
                                }
                              />
                              <ProductImage
                                alt={`${product.title} ${variant.title}`}
                                className="size-10 sm:size-11"
                                src={variant.imageUrl ?? product.coverMediaUrl}
                              />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="min-w-0 truncate text-sm font-semibold text-zinc-950 dark:text-white">
                                    {variant.title}
                                  </p>
                                  <VariantAvailabilityBadge variant={variant} />
                                </div>
                                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-zinc-400">
                                  SKU {variant.sku}
                                  {variant.optionValues.length > 0
                                    ? ` · ${variant.optionValues.join(" · ")}`
                                    : ""}
                                  {` · ${variant.stockOnHand} in stock`}
                                </p>
                                {variant.unavailableReason ? (
                                  <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-300">
                                    {variant.unavailableReason}
                                  </p>
                                ) : null}
                              </div>
                              <div className="col-start-3 min-w-0 text-left sm:col-start-auto sm:text-right">
                                <p className="text-sm font-bold text-zinc-950 dark:text-white">
                                  {formatMoney(variant.price)}
                                  {salePrice ? (
                                    <>
                                      <span className="mx-1 text-slate-400">→</span>
                                      <span className="text-primary dark:text-brand-amber">
                                        {formatMoney(salePrice)}
                                      </span>
                                    </>
                                  ) : null}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                  {variant.costPrice
                                    ? `Cost ${formatMoney(variant.costPrice)}`
                                    : "No cost recorded"}
                                </p>
                                {belowCost ? (
                                  <p className="text-xs font-semibold text-red-600 dark:text-red-300">
                                    Projected sale price is below cost
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid place-items-center gap-2 px-4 py-12 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-zinc-400">
                <PackageSearchIcon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-zinc-950 dark:text-white">
                  No matching sale variants
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  Change the search or clear the filters to see more products.
                </p>
              </div>
              {normalizedQuery || activeFilterCount > 0 ? (
                <DashboardButton
                  onClick={() => {
                    setQuery("");
                    clearFilters();
                  }}
                  type="button"
                >
                  Clear search and filters
                </DashboardButton>
              ) : null}
            </div>
          )}

          <DashboardTablePagination
            currentPage={activePage}
            itemLabel="products"
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setCurrentPage(1);
            }}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            totalItems={productPage.totalProducts}
          />
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                {selectedVariants.length} variant
                {selectedVariants.length === 1 ? "" : "s"} selected
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {lossMakingSelectedVariants.length > 0
                  ? `${lossMakingSelectedVariants.length} projected below cost; confirmation will be required.`
                  : "Selections remain active while you filter or change pages."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedVariants.length > 0 ? (
                <DashboardButton
                  disabled={isPending}
                  onClick={() => setSelectedVariantIds(new Set())}
                  type="button"
                >
                  Clear selection
                </DashboardButton>
              ) : null}
              <DashboardButton
                className="border-primary bg-primary text-white hover:bg-[#e84d18] dark:border-primary dark:bg-primary dark:text-white"
                disabled={createDisabled}
                onClick={requestCreateSale}
                type="button"
              >
                {isPending ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : null}
                Create sale
              </DashboardButton>
            </div>
          </div>
        </div>
      </section>

      <section
        className={cn(
          dashboardPanelClass,
          dashboardTableContainerClass,
          "min-w-0 overflow-hidden",
        )}
      >
        <div className="flex flex-col gap-1 border-b border-slate-200 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
              Active sale campaigns
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Public sale collection: {" "}
              <a className="font-semibold text-primary" href={data.publicSaleUrl}>
                /sale
              </a>
            </p>
          </div>
          <Badge variant="secondary">
            {data.activeCampaigns.length} active
          </Badge>
        </div>
        <Table className={cn(dashboardTableClass, "min-w-[880px] table-fixed")}>
          <TableHeader>
            <TableRow className={dashboardTableHeaderRowClass}>
              <TableHead className={cn(dashboardTableHeadClass, "w-[30%]")}>
                Campaign
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "w-[22%]")}>
                Appearance
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "w-[16%]")}>
                Scope
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "w-[12%]")}>
                Discount
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "w-[14%]")}>
                Started
              </TableHead>
              <TableHead
                className={cn(
                  dashboardTableHeadClass,
                  dashboardTableActionHeadClass,
                  "sticky right-0 z-20 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.7)] dark:bg-[#151719]",
                )}
              >
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.activeCampaigns.length > 0 ? (
              data.activeCampaigns.map((campaign) => (
                <CampaignTableRows
                  campaign={campaign}
                  key={campaign.id}
                  onDelete={(nextCampaign) => {
                    setResult(null);
                    setCampaignToDelete(nextCampaign);
                  }}
                  onEnd={(nextCampaign) => {
                    setResult(null);
                    setCampaignToEnd(nextCampaign);
                  }}
                  onEditAppearance={editCampaignAppearance}
                  pending={isPending || !data.salesAvailable}
                  productBySlug={productBySlug}
                />
              ))
            ) : (
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell className="whitespace-normal px-5 py-12" colSpan={6}>
                  <div className="mx-auto grid max-w-sm place-items-center gap-2 text-center">
                    <span className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-zinc-400">
                      <BadgePercentIcon className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-zinc-950 dark:text-white">
                        No active sale campaigns
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        Select eligible variants above to create the first one.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setCampaignToEdit(null);
          }
        }}
        open={Boolean(campaignToEdit)}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit campaign appearance</DialogTitle>
            <DialogDescription>
              Update the public headline, campaign colour, icon and header
              spotlight placement without changing prices or selected variants.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            {result && !result.ok ? <StatusMessage result={result} /> : null}
            {campaignToEdit ? (
              <CampaignAppearanceEditor
                badgeText={campaignToEdit.badgeText}
                campaignName={campaignToEdit.name}
                disabled={isPending}
                onChange={setAppearanceDraft}
                value={appearanceDraft}
              />
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DashboardButton
              disabled={isPending}
              onClick={() => setCampaignToEdit(null)}
              type="button"
            >
              Cancel
            </DashboardButton>
            <DashboardButton
              className="border-primary bg-primary text-white hover:bg-[#e84d18] dark:border-primary dark:bg-primary dark:text-white"
              disabled={
                isPending ||
                !campaignToEdit ||
                !isCampaignHexColor(appearanceDraft.badgeColor) ||
                !appearanceDraft.ctaLabel.trim() ||
                !Number.isInteger(appearanceDraft.headerPriority) ||
                appearanceDraft.headerPriority < 0 ||
                appearanceDraft.headerPriority > 32767
              }
              onClick={saveCampaignAppearance}
              type="button"
            >
              {isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
              Save appearance
            </DashboardButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setCampaignToDelete(null);
          }
        }}
        open={Boolean(campaignToDelete)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete sale campaign?</DialogTitle>
            <DialogDescription>
              This permanently removes the campaign after restoring its original
              variant prices.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {result && !result.ok ? <StatusMessage result={result} /> : null}
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
              <p className="font-bold">{campaignToDelete?.name}</p>
              <p className="mt-1">
                {campaignToDelete?.variants.length ?? 0} variant
                {(campaignToDelete?.variants.length ?? 0) === 1 ? "" : "s"} will
                have their original prices restored first.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <DashboardButton
              disabled={isPending}
              onClick={() => setCampaignToDelete(null)}
              type="button"
            >
              Cancel
            </DashboardButton>
            <DashboardButton
              className="border-red-600 bg-red-600 text-white hover:bg-red-700 dark:border-red-500 dark:bg-red-600 dark:text-white"
              disabled={isPending || !campaignToDelete}
              onClick={() => {
                if (campaignToDelete) {
                  deleteSale(campaignToDelete.id);
                }
              }}
              type="button"
            >
              {isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
              Delete and restore prices
            </DashboardButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setCampaignToEnd(null);
          }
        }}
        open={Boolean(campaignToEnd)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>End this sale?</DialogTitle>
            <DialogDescription>
              The campaign remains in history, but every active variant is restored
              to its saved original price immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            {result && !result.ok ? <StatusMessage result={result} /> : null}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="font-bold">{campaignToEnd?.name}</p>
              <p className="mt-1">
                {campaignToEnd?.variants.length ?? 0} variant
                {(campaignToEnd?.variants.length ?? 0) === 1 ? "" : "s"} will
                stop showing campaign prices.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <DashboardButton
              disabled={isPending}
              onClick={() => setCampaignToEnd(null)}
              type="button"
            >
              Keep sale active
            </DashboardButton>
            <DashboardButton
              className="border-primary bg-primary text-white hover:bg-[#e84d18] dark:border-primary dark:bg-primary dark:text-white"
              disabled={isPending || !campaignToEnd}
              onClick={() => {
                if (campaignToEnd) {
                  endSale(campaignToEnd.id);
                }
              }}
              type="button"
            >
              {isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
              End and restore prices
            </DashboardButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setConfirmLossSaleOpen(false);
          }
        }}
        open={confirmLossSaleOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Some sale prices are below cost</DialogTitle>
            <DialogDescription>
              Continue only if this below-cost promotion is deliberate.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            {result && !result.ok ? <StatusMessage result={result} /> : null}
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
              <p className="font-bold">
                {lossMakingSelectedVariants.length} selected variant
                {lossMakingSelectedVariants.length === 1 ? " is" : "s are"}{" "}
                projected below recorded cost.
              </p>
              <div className="mt-2 grid gap-1">
                {lossMakingSelectedVariants.slice(0, 5).map((variant) => (
                  <p className="text-xs" key={variant.id}>
                    {variant.productTitle} · {variant.title} · sale{" "}
                    {formatMoney(getSalePrice(variant.price, numericDiscount))} / cost{" "}
                    {formatMoney(variant.costPrice)}
                  </p>
                ))}
                {lossMakingSelectedVariants.length > 5 ? (
                  <p className="text-xs font-semibold">
                    +{lossMakingSelectedVariants.length - 5} more variants
                  </p>
                ) : null}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DashboardButton
              disabled={isPending}
              onClick={() => setConfirmLossSaleOpen(false)}
              type="button"
            >
              Review selection
            </DashboardButton>
            <DashboardButton
              className="border-red-600 bg-red-600 text-white hover:bg-red-700 dark:border-red-500 dark:bg-red-600 dark:text-white"
              disabled={createDisabled}
              onClick={createSale}
              type="button"
            >
              {isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
              Create below-cost sale
            </DashboardButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
