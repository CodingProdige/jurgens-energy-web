"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import {
  CheckIcon,
  DownloadIcon,
  Edit3Icon,
  ImageIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";

import {
  checkBrandNameAvailability,
  createBrand,
  deleteBrand,
  generateBrandDescription,
  updateBrand,
  type BrandMutationState,
} from "@/app/(admin)/admin/(dashboard)/catalog/brands/actions";
import {
  DashboardButton,
  DashboardInput,
  DashboardPageHeader,
  DashboardTablePagination,
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
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import {
  DashboardCompactMetrics,
  type DashboardMetricDefinition,
} from "@/components/dashboard/dashboard-compact-metrics";
import { DashboardRowActionMenu } from "@/components/dashboard/dashboard-row-action-menu";
import { MediaManagerDialog } from "@/components/media/media-manager-dialog";
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
import type { AdminBrand } from "@/src/modules/catalog/admin";
import type {
  AdminMediaAsset,
  AdminMediaFolder,
  MediaStorageSettings,
} from "@/src/modules/media/admin";

type BrandManagerProps = {
  activeBrandCount: number;
  brands: AdminBrand[];
  mediaLibrary: {
    assets: AdminMediaAsset[];
    folders: AdminMediaFolder[];
    storage: MediaStorageSettings;
    usedStorageBytes: number;
  };
  totalBrandCount: number;
  totalProducts: number;
};

type BrandFilter = "all" | "active" | "hidden" | "archived";

const initialState: BrandMutationState = {};
const brandDescriptionMaxLength = 500;
const adminPrimaryClass =
  "bg-admin-primary text-white shadow-admin-primary/20 hover:bg-[#d94514]";
const modalLabelClass = "text-sm font-semibold text-zinc-900 dark:text-white";
const modalFieldClass =
  "h-10 border-slate-300 bg-white text-zinc-950 placeholder:text-slate-400 focus-visible:border-admin-primary focus-visible:ring-admin-primary/20 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500";
const modalTextareaClass =
  "min-h-24 border-slate-300 bg-white text-zinc-950 placeholder:text-slate-400 focus-visible:border-admin-primary focus-visible:ring-admin-primary/20 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500";
const modalSelectClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-admin-primary focus:ring-4 focus:ring-admin-primary/10 dark:border-white/18 dark:bg-[#151719] dark:text-white";
const modalSelectContentClass =
  "border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white";
const modalSelectItemClass =
  "cursor-pointer px-2 py-2 text-zinc-800 focus:bg-slate-100 focus:text-zinc-950 dark:text-zinc-200 dark:focus:bg-white/10 dark:focus:text-white";
const modalContentClass =
  "max-w-xl border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white";

function formatDate(date: Date) {
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

function BrandMessage({ state }: { state: BrandMutationState }) {
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
  const isActive = status === "active";

  return (
    <Badge
      className={cn(
        "h-6 rounded-md border-0 px-2 text-xs font-semibold",
        isActive
          ? "bg-emerald-100 text-emerald-700"
          : "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
      )}
    >
      {status[0]?.toUpperCase()}
      {status.slice(1)}
    </Badge>
  );
}

function BrandForm({
  brand,
  mediaLibrary,
}: {
  brand?: AdminBrand;
  mediaLibrary: BrandManagerProps["mediaLibrary"];
}) {
  const action = brand ? updateBrand : createBrand;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [brandName, setBrandName] = useState(brand?.name ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(brand?.websiteUrl ?? "");
  const [description, setDescription] = useState(brand?.description ?? "");
  const [descriptionMessage, setDescriptionMessage] = useState("");
  const [saveFeedback, setSaveFeedback] = useState<BrandMutationState>({});
  const [showSavedState, setShowSavedState] = useState(false);
  const [isMediaManagerOpen, setIsMediaManagerOpen] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<AdminMediaAsset | null>(
    brand?.logoMediaId
      ? (mediaLibrary.assets.find((asset) => asset.id === brand.logoMediaId) ??
          (brand.logoUrl
            ? {
                altText: `${brand.name} logo`,
                byteSize: 0,
                createdAt: brand.createdAt,
                durationMs: null,
                folderId: null,
                folderIds: [],
                height: null,
                id: brand.logoMediaId,
                mimeType: "image/webp",
                originalByteSize: null,
                originalFileName: `${brand.name} logo`,
                publicUrl: brand.logoUrl,
                tags: null,
                thumbnailUrl: brand.logoUrl,
                usageCount: 1,
                width: null,
              }
            : null))
      : null,
  );
  const [availability, setAvailability] = useState<{
    available: boolean;
    message: string;
  } | null>(null);
  const [isCheckingAvailability, startAvailabilityTransition] = useTransition();
  const [isGeneratingDescription, startDescriptionTransition] = useTransition();

  useEffect(() => {
    if (!state.message) {
      return;
    }

    setSaveFeedback(state);

    if (!state.ok) {
      setShowSavedState(false);
      return;
    }

    setShowSavedState(true);
    const timeout = window.setTimeout(() => setShowSavedState(false), 1600);

    return () => window.clearTimeout(timeout);
  }, [state]);

  useEffect(() => {
    const trimmedName = brandName.trim();

    if (trimmedName.length < 2) {
      setAvailability(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      startAvailabilityTransition(() => {
        void checkBrandNameAvailability({
          currentBrandId: brand?.id,
          name: trimmedName,
        }).then(setAvailability);
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [brand?.id, brandName]);

  const isBrandNameBlocked = availability?.available === false;

  function handleGenerateDescription() {
    const name = brandName.trim();

    if (name.length < 2) {
      setDescriptionMessage("Enter a brand name before generating copy.");
      return;
    }

    setDescriptionMessage("");
    startDescriptionTransition(() => {
      void generateBrandDescription({
        name,
        websiteUrl,
      }).then((result) => {
        if (result.ok && result.description) {
          setDescription(result.description);
          setDescriptionMessage("Generated a draft description. Review before saving.");
          return;
        }

        setDescriptionMessage(result.message ?? "Could not generate a description.");
      });
    });
  }

  return (
    <form action={formAction} className="contents">
      {brand ? <input type="hidden" name="id" value={brand.id} /> : null}
      <input type="hidden" name="logoMediaId" value={selectedLogo?.id ?? ""} />

      <DialogBody className="grid gap-4">
        <div className="grid gap-2">
          <Label className={modalLabelClass}>Brand image</Label>
          <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-slate-300 bg-white p-3 dark:border-white/18 dark:bg-[#151719] sm:flex-nowrap">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]">
              {selectedLogo ? (
                <img
                  alt={selectedLogo.altText ?? selectedLogo.originalFileName ?? ""}
                  className="h-full w-full object-cover"
                  src={selectedLogo.thumbnailUrl ?? selectedLogo.publicUrl}
                />
              ) : (
                <ImageIcon className="size-6 text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {selectedLogo?.originalFileName ?? "No brand image selected"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Upload new media or select a saved image from the library.
              </p>
            </div>
            <DashboardButton
              className="w-full sm:w-auto"
              onClick={() => setIsMediaManagerOpen(true)}
              type="button"
            >
              Select
            </DashboardButton>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={brand ? `name-${brand.id}` : "name"} className={modalLabelClass}>
            Brand name
          </Label>
          <Input
            id={brand ? `name-${brand.id}` : "name"}
            name="name"
            required
            minLength={2}
            defaultValue={brand?.name}
            onChange={(event) => {
              setBrandName(event.target.value);
              setSaveFeedback({});
            }}
            className={modalFieldClass}
          />
          {brandName.trim().length >= 2 ? (
            <p
              className={cn(
                "text-xs leading-5",
                isBrandNameBlocked
                  ? "text-red-600 dark:text-red-300"
                  : "text-emerald-700 dark:text-emerald-300",
              )}
            >
              {isCheckingAvailability ? "Checking brand name..." : availability?.message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={brand ? `status-${brand.id}` : "status"} className={modalLabelClass}>
            Status
          </Label>
          <Select name="status" defaultValue={brand?.status ?? "active"}>
            <SelectTrigger
              id={brand ? `status-${brand.id}` : "status"}
              className={cn("w-full", modalSelectClass)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={modalSelectContentClass}>
              <SelectItem value="active" className={modalSelectItemClass}>
                Active
              </SelectItem>
              <SelectItem value="hidden" className={modalSelectItemClass}>
                Hidden
              </SelectItem>
              <SelectItem value="archived" className={modalSelectItemClass}>
                Archived
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label
            htmlFor={brand ? `website-${brand.id}` : "websiteUrl"}
            className={modalLabelClass}
          >
            Website URL
          </Label>
          <Input
            id={brand ? `website-${brand.id}` : "websiteUrl"}
            name="websiteUrl"
            type="url"
            value={websiteUrl}
            onChange={(event) => {
              setWebsiteUrl(event.target.value);
              setSaveFeedback({});
            }}
            placeholder="https://example.com"
            className={modalFieldClass}
          />
        </div>

        <div className="grid gap-2">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label
              htmlFor={brand ? `description-${brand.id}` : "description"}
              className={modalLabelClass}
            >
              Description
            </Label>
            <DashboardButton
              className="h-8 w-full rounded-md px-2 text-xs sm:w-auto"
              disabled={isGeneratingDescription}
              onClick={handleGenerateDescription}
              type="button"
            >
              <SparklesIcon className="size-3.5" />
              {isGeneratingDescription ? "Generating..." : "Generate"}
            </DashboardButton>
          </div>
          <Textarea
            id={brand ? `description-${brand.id}` : "description"}
            name="description"
            maxLength={brandDescriptionMaxLength}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setSaveFeedback({});
            }}
            className={modalTextareaClass}
          />
          <div className="flex items-start justify-between gap-3 text-xs leading-5">
            <p
              className={cn(
                descriptionMessage.includes("Generated")
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-slate-500 dark:text-zinc-400",
              )}
            >
              {descriptionMessage || "Use generated copy as a draft and review it before saving."}
            </p>
            <p className="shrink-0 text-slate-500 dark:text-zinc-400">
              {description.length}/{brandDescriptionMaxLength}
            </p>
          </div>
        </div>
      </DialogBody>

      <DialogFooter className="flex-col-reverse border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#101214]/95 sm:flex-col">
        {saveFeedback.ok === false ? <BrandMessage state={saveFeedback} /> : null}
        <Button
          type="submit"
          disabled={isPending || isCheckingAvailability || isBrandNameBlocked}
          className={cn("h-10 w-full justify-center gap-2 rounded-lg", adminPrimaryClass)}
        >
          {showSavedState ? (
            <CheckIcon className="size-4" />
          ) : brand ? (
            <SaveIcon className="size-4" />
          ) : (
            <PlusIcon className="size-4" />
          )}
          {isPending
            ? brand
              ? "Saving..."
              : "Creating..."
            : showSavedState
              ? brand
                ? "Brand saved"
                : "Brand created"
            : brand
              ? "Save brand"
              : "Add brand"}
        </Button>
      </DialogFooter>

      <MediaManagerDialog
        acceptedMediaTypes={["image"]}
        assets={mediaLibrary.assets}
        folders={mediaLibrary.folders}
        onOpenChange={setIsMediaManagerOpen}
        onSelect={setSelectedLogo}
        open={isMediaManagerOpen}
        selectedAssetId={selectedLogo?.id}
        storage={mediaLibrary.storage}
        surface="admin"
        usedStorageBytes={mediaLibrary.usedStorageBytes}
      />
    </form>
  );
}

function DeleteBrandForm({ brand, onDone }: { brand: AdminBrand; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(deleteBrand, initialState);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="id" value={brand.id} />
      <DialogBody className="grid gap-4">
        <BrandMessage state={state} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
          This will permanently delete <strong>{brand.name}</strong>. Deletion
          is blocked if products already use this brand.
        </div>
      </DialogBody>
      <DialogFooter className="border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#101214]/95">
        <DashboardButton className="h-10 rounded-lg px-4 text-sm" onClick={onDone} type="button">
          Cancel
        </DashboardButton>
        <Button
          className="h-10 rounded-lg bg-red-600 px-4 text-white hover:bg-red-700"
          disabled={isPending}
          type="submit"
        >
          <Trash2Icon className="size-4" />
          {isPending ? "Deleting..." : "Delete brand"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function BrandDashboard({
  activeBrandCount,
  brands,
  mediaLibrary,
  totalBrandCount,
  totalProducts,
}: BrandManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<BrandFilter>("all");
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<AdminBrand | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const brandMetrics = useMemo<DashboardMetricDefinition[]>(
    () => [
      {
        color: "blue",
        description: "All brands in the marketplace catalog.",
        id: "brands",
        label: "Brands",
        value: totalBrandCount,
      },
      {
        color: "emerald",
        description: "Brands currently marked active.",
        id: "active",
        label: "Active",
        value: activeBrandCount,
      },
      {
        color: "amber",
        description: "Products assigned to catalog brands.",
        id: "products",
        label: "Products",
        value: totalProducts,
      },
      {
        color: "slate",
        description: "Brands currently hidden from the marketplace catalog.",
        id: "hidden",
        label: "Hidden",
        value: brands.filter((brand) => brand.status === "hidden").length,
      },
      {
        color: "red",
        description: "Brands archived from normal catalog workflows.",
        id: "archived",
        label: "Archived",
        value: brands.filter((brand) => brand.status === "archived").length,
      },
    ],
    [activeBrandCount, brands, totalBrandCount, totalProducts],
  );

  const filteredBrands = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return brands.filter((brand) => {
      const matchesSearch =
        !normalizedTerm ||
        brand.name.toLowerCase().includes(normalizedTerm) ||
        brand.slug.toLowerCase().includes(normalizedTerm) ||
        brand.status.toLowerCase().includes(normalizedTerm);
      const matchesStatus = statusFilter === "all" || brand.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [brands, searchTerm, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const pageBrands = filteredBrands.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );

  function exportBrandsCsv() {
    const headers = [
      "Name",
      "Slug",
      "Status",
      "Products",
      "Website URL",
      "Logo URL",
      "Description",
      "Created At",
    ];
    const rows = filteredBrands.map((brand) => [
      brand.name,
      brand.slug,
      brand.status,
      brand.productCount,
      brand.websiteUrl,
      brand.logoUrl,
      brand.description,
      formatDate(brand.createdAt),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `jurgens-energy-brands-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <DashboardPageHeader title="Brands" breadcrumbs={["Catalog", "Brands"]} />

      <div className="grid gap-4">
        <DashboardCompactMetrics
          metrics={brandMetrics}
          storageKey="jurgens:admin:catalog-brand-metrics"
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
              placeholder="Search brands..."
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 md:flex md:items-center">
            <Select
              value={statusFilter}
              onValueChange={(value: string | null) => {
                setCurrentPage(1);
                setStatusFilter(value as BrandFilter);
              }}
            >
              <SelectTrigger className="h-8 rounded-md border-slate-300 bg-white text-xs dark:border-white/18 dark:bg-[#151719] dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={modalSelectContentClass}>
                <SelectItem value="all" className={modalSelectItemClass}>
                  All statuses
                </SelectItem>
                <SelectItem value="active" className={modalSelectItemClass}>
                  Active
                </SelectItem>
                <SelectItem value="hidden" className={modalSelectItemClass}>
                  Hidden
                </SelectItem>
                <SelectItem value="archived" className={modalSelectItemClass}>
                  Archived
                </SelectItem>
              </SelectContent>
            </Select>
            <DashboardButton onClick={exportBrandsCsv} type="button">
              <DownloadIcon className="size-3.5" />
              Export
            </DashboardButton>
            <Button
              className={cn("h-8 rounded-md px-3 text-xs", adminPrimaryClass)}
              onClick={() => setIsAddOpen(true)}
              type="button"
            >
              <PlusIcon className="size-3.5" />
              Add Brand
            </Button>
          </div>
        </div>

        <section className={cn(dashboardPanelClass, dashboardTableContainerClass, "overflow-visible")}>
          <Table className={dashboardTableClass}>
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>
                  Brand Name
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden sm:table-cell")}>
                  Slug
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                  Products
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                  Status
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden lg:table-cell")}>
                  Created At
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, dashboardTableActionHeadClass)}>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageBrands.map((brand) => (
                <TableRow
                  key={brand.id}
                  className={dashboardTableRowClass}
                >
                  <TableCell className={cn("min-w-0", dashboardTableCellClass)}>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]">
                        {brand.logoUrl ? (
                          <img
                            alt={`${brand.name} logo`}
                            className="h-full w-full object-cover"
                            src={brand.logoUrl}
                          />
                        ) : (
                          <ImageIcon className="size-4 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={cn("truncate", dashboardTablePrimaryTextClass)}>
                          {brand.name}
                        </p>
                        {brand.websiteUrl ? (
                          <p className={cn("truncate", dashboardTableSecondaryTextClass)}>
                            {brand.websiteUrl}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={cn("hidden max-w-[180px] truncate sm:table-cell", dashboardTableCellClass, dashboardTableMutedTextClass)}>
                    {brand.slug}
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass, dashboardTablePrimaryTextClass)}>
                    {brand.productCount}
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <StatusBadge status={brand.status} />
                  </TableCell>
                  <TableCell className={cn("hidden lg:table-cell", dashboardTableCellClass, dashboardTableMutedTextClass)}>
                    {formatDate(brand.createdAt)}
                  </TableCell>
                  <TableCell className={dashboardTableActionCellClass}>
                    <div className="inline-flex items-center gap-1">
                      <Button
                        aria-label={`Edit ${brand.name}`}
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
                        onClick={() => setEditingBrand(brand)}
                        type="button"
                      >
                        <Edit3Icon className="size-4" />
                      </Button>
                      <DashboardRowActionMenu
                        ariaLabel={`Open actions for ${brand.name}`}
                        className="w-56"
                      >
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-zinc-800 transition hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-white/10"
                              onClick={() => setEditingBrand(brand)}
                            >
                              <Edit3Icon className="size-4" />
                              Settings
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 border-t border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                              onClick={() => setDeletingBrand(brand)}
                            >
                              <Trash2Icon className="size-4" />
                              Delete
                            </button>
                      </DashboardRowActionMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <DashboardTablePagination
            currentPage={activePage}
            itemLabel="brands"
            pageSize={pageSize}
            totalItems={filteredBrands.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setCurrentPage(1);
              setPageSize(nextPageSize);
            }}
          />
        </section>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className={modalContentClass}>
          <DialogHeader>
            <DialogTitle>Add brand</DialogTitle>
            <DialogDescription>
              Create a brand that can be selected for catalog products.
            </DialogDescription>
          </DialogHeader>
          <BrandForm mediaLibrary={mediaLibrary} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingBrand)}
        onOpenChange={(open) => {
          if (!open) setEditingBrand(null);
        }}
      >
        <DialogContent className={modalContentClass}>
          <DialogHeader>
            <DialogTitle>Brand settings</DialogTitle>
            <DialogDescription>
              Update brand display details and visibility.
            </DialogDescription>
          </DialogHeader>
          {editingBrand ? (
            <BrandForm brand={editingBrand} mediaLibrary={mediaLibrary} />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingBrand)}
        onOpenChange={(open) => {
          if (!open) setDeletingBrand(null);
        }}
      >
        <DialogContent className={modalContentClass}>
          <DialogHeader>
            <DialogTitle>Delete brand</DialogTitle>
            <DialogDescription>
              This is permanent and only allowed when no products use the brand.
            </DialogDescription>
          </DialogHeader>
          {deletingBrand ? (
            <DeleteBrandForm
              brand={deletingBrand}
              onDone={() => setDeletingBrand(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
