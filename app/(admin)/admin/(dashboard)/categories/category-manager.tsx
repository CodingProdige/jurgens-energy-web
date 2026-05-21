"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderPlusIcon,
  DownloadIcon,
  Edit3Icon,
  FilterIcon,
  LockIcon,
  MoreVerticalIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  SettingsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import {
  DashboardButton,
  DashboardInput,
  DashboardMetricStrip,
  DashboardPageHeader,
  dashboardControlClass,
  dashboardPanelClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderRowClass,
  dashboardTableMutedTextClass,
  dashboardTablePrimaryTextClass,
  dashboardTableRowClass,
} from "@/components/dashboard/dashboard-controls";
import {
  checkCategoryNameAvailability,
  createCategory,
  deleteCategory,
  moveCategory,
  toggleCategoryLock,
  updateCategory,
  type CategoryMutationState,
} from "@/app/(admin)/admin/(dashboard)/categories/actions";
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
import type {
  AdminCategory,
  AdminCategoryOption,
} from "@/src/modules/catalog/admin";

type CategoryDashboardProps = {
  options: AdminCategoryOption[];
  rootCategoryCount: number;
  subcategoryCount: number;
  totalProducts: number;
  tree: AdminCategory[];
};

type FlatCategory = AdminCategory & {
  ancestorHasNext: boolean[];
  hasChildren: boolean;
  isLastChild: boolean;
  lineNumber: string;
  siblingCount: number;
  siblingPosition: number;
};

const initialState: CategoryMutationState = {};

type CategoryFilters = {
  createdFrom: string;
  createdTo: string;
  depth: "all" | "level-1" | "level-2" | "level-3-plus";
  fee: "all" | "has-fee" | "no-fee";
  locked: "all" | "locked" | "editable";
  products: "all" | "has-products" | "no-products";
  status: "all" | "active" | "hidden" | "archived";
  type: "all" | "root" | "subcategory";
};

const defaultFilters: CategoryFilters = {
  createdFrom: "",
  createdTo: "",
  depth: "all",
  fee: "all",
  locked: "all",
  products: "all",
  status: "all",
  type: "all",
};

const modalLabelClass = "text-sm font-semibold text-zinc-900";
const modalFieldClass =
  "h-10 border-slate-200 bg-white text-zinc-950 placeholder:text-slate-400 focus-visible:border-[#c4982d] focus-visible:ring-[#c4982d]/20 disabled:bg-slate-50 disabled:text-slate-500 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500 dark:disabled:bg-white/[0.04] dark:disabled:text-zinc-500";
const modalSelectClass =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-[#c4982d] focus:ring-4 focus:ring-[#c4982d]/10 disabled:bg-slate-50 disabled:text-slate-500 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:disabled:bg-white/[0.04] dark:disabled:text-zinc-500";
const modalSelectContentClass =
  "border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white";
const modalSelectItemClass =
  "cursor-pointer px-2 py-2 text-zinc-800 focus:bg-slate-100 focus:text-zinc-950 dark:text-zinc-200 dark:focus:bg-white/10 dark:focus:text-white";
const modalTextareaClass =
  "min-h-24 border-slate-200 bg-white text-zinc-950 placeholder:text-slate-400 focus-visible:border-[#c4982d] focus-visible:ring-[#c4982d]/20 dark:border-white/12 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500";
const modalContentClass =
  "max-w-xl border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white";
const adminPrimaryClass =
  "bg-[#c4982d] text-white shadow-[#c4982d]/20 hover:bg-[#a87920]";

function buildPaginationItems(currentPage: number, totalPages: number) {
  const pageSet = new Set(
    [1, currentPage - 1, currentPage, currentPage + 1, totalPages].filter(
      (page) => page >= 1 && page <= totalPages,
    ),
  );
  const pages = Array.from(pageSet).sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];

  pages.forEach((page, index) => {
    const previousPage = pages[index - 1];

    if (previousPage && page - previousPage > 1) {
      items.push("ellipsis");
    }

    items.push(page);
  });

  return items;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatSuccessFee(rateBps: number | null) {
  if (rateBps === null) {
    return "No success fee set";
  }

  return `${(rateBps / 100).toLocaleString("en", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}% success fee`;
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

function flattenCategoriesForExport(
  categories: AdminCategory[],
  prefix = "",
  parentName = "",
) {
  const rows: Array<{
    category: AdminCategory;
    lineNumber: string;
    parentName: string;
  }> = [];

  categories.forEach((category, index) => {
    const lineNumber = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;

    rows.push({ category, lineNumber, parentName });
    rows.push(
      ...flattenCategoriesForExport(category.children, lineNumber, category.name),
    );
  });

  return rows;
}

function flattenVisibleCategories(
  categories: AdminCategory[],
  expanded: Set<string>,
  prefix = "",
  ancestorHasNext: boolean[] = [],
) {
  const rows: FlatCategory[] = [];

  categories.forEach((category, index) => {
    const lineNumber = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
    const hasChildren = category.children.length > 0;
    const hasNext = index < categories.length - 1;

    rows.push({
      ...category,
      ancestorHasNext,
      hasChildren,
      isLastChild: !hasNext,
      lineNumber,
      siblingCount: categories.length,
      siblingPosition: index + 1,
    });

    if (hasChildren && expanded.has(category.id)) {
      rows.push(
        ...flattenVisibleCategories(category.children, expanded, lineNumber, [
          ...ancestorHasNext,
          hasNext,
        ]),
      );
    }
  });

  return rows;
}

function filterCategoryTree(
  categories: AdminCategory[],
  searchTerm: string,
  filters: CategoryFilters,
): AdminCategory[] {
  const normalizedTerm = searchTerm.trim().toLowerCase();

  if (!normalizedTerm && countActiveFilters(filters) === 0) {
    return categories;
  }

  return categories
    .map((category) => {
      const children = filterCategoryTree(
        category.children,
        normalizedTerm,
        filters,
      );
      const matchesSearch =
        !normalizedTerm ||
        category.name.toLowerCase().includes(normalizedTerm) ||
          category.path.toLowerCase().includes(normalizedTerm) ||
          category.status.toLowerCase().includes(normalizedTerm);
      const matches = matchesSearch && matchesCategoryFilters(category, filters);

      if (!matches && children.length === 0) {
        return null;
      }

      return { ...category, children };
    })
    .filter(Boolean) as AdminCategory[];
}

function countActiveFilters(filters: CategoryFilters) {
  let count = 0;

  if (filters.status !== "all") count += 1;
  if (filters.type !== "all") count += 1;
  if (filters.locked !== "all") count += 1;
  if (filters.fee !== "all") count += 1;
  if (filters.products !== "all") count += 1;
  if (filters.depth !== "all") count += 1;
  if (filters.createdFrom) count += 1;
  if (filters.createdTo) count += 1;

  return count;
}

function getStartOfDay(value: string) {
  return value ? new Date(`${value}T00:00:00`) : null;
}

function getEndOfDay(value: string) {
  return value ? new Date(`${value}T23:59:59.999`) : null;
}

function matchesCategoryFilters(category: AdminCategory, filters: CategoryFilters) {
  if (filters.status !== "all" && category.status !== filters.status) {
    return false;
  }

  if (filters.type === "root" && category.depth !== 0) {
    return false;
  }

  if (filters.type === "subcategory" && category.depth === 0) {
    return false;
  }

  if (filters.locked === "locked" && !category.isLocked) {
    return false;
  }

  if (filters.locked === "editable" && category.isLocked) {
    return false;
  }

  if (filters.fee === "has-fee" && !(category.commissionRateBps && category.commissionRateBps > 0)) {
    return false;
  }

  if (filters.fee === "no-fee" && category.commissionRateBps !== null && category.commissionRateBps > 0) {
    return false;
  }

  if (filters.products === "has-products" && category.productCount <= 0) {
    return false;
  }

  if (filters.products === "no-products" && category.productCount > 0) {
    return false;
  }

  if (filters.depth === "level-1" && category.depth !== 0) {
    return false;
  }

  if (filters.depth === "level-2" && category.depth !== 1) {
    return false;
  }

  if (filters.depth === "level-3-plus" && category.depth < 2) {
    return false;
  }

  const createdFrom = getStartOfDay(filters.createdFrom);
  const createdTo = getEndOfDay(filters.createdTo);

  if (createdFrom && category.createdAt < createdFrom) {
    return false;
  }

  if (createdTo && category.createdAt > createdTo) {
    return false;
  }

  return true;
}

function CategoryMessage({ state }: { state: CategoryMutationState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={cn(
        "rounded-lg border p-3 text-sm",
        state.ok
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
          : "border-red-500/20 bg-red-500/10 text-red-700",
      )}
    >
      {state.message}
    </p>
  );
}

function CategoryForm({
  category,
  options,
  parentCategory,
}: {
  category?: AdminCategory & {
    lineNumber?: string;
    siblingCount?: number;
    siblingPosition?: number;
  };
  options: AdminCategoryOption[];
  parentCategory?: AdminCategory & { lineNumber?: string };
}) {
  const action = category ? updateCategory : createCategory;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [selectedParentId, setSelectedParentId] = useState(
    parentCategory?.id ?? "",
  );
  const [categoryName, setCategoryName] = useState(category?.name ?? "");
  const [commissionRateBps, setCommissionRateBps] = useState(
    category?.commissionRateBps?.toString() ?? "",
  );
  const [availability, setAvailability] = useState<{
    available: boolean;
    message: string;
  } | null>(null);
  const [isCheckingAvailability, startAvailabilityTransition] = useTransition();
  const isRootCategory = category ? category.depth === 0 : selectedParentId === "";
  const availabilityParentId = category
    ? category.parentId
    : (parentCategory?.id ?? selectedParentId) || null;

  useEffect(() => {
    const trimmedName = categoryName.trim();

    if (trimmedName.length < 2) {
      setAvailability(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      startAvailabilityTransition(() => {
        void checkCategoryNameAvailability({
          currentCategoryId: category?.id,
          name: trimmedName,
          parentId: availabilityParentId,
        }).then(setAvailability);
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [availabilityParentId, category?.id, categoryName]);

  const isCategoryNameBlocked = availability?.available === false;
  const formattedCommissionRate =
    commissionRateBps === ""
      ? "0.00%"
      : `${(Number(commissionRateBps) / 100).toFixed(2)}%`;

  return (
    <form action={formAction} className="contents">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      {parentCategory ? (
        <input type="hidden" name="parentId" value={parentCategory.id} />
      ) : null}

      <DialogBody className="grid gap-4">
      {!category && parentCategory ? (
        <div className="grid gap-2">
          <Label className={cn(modalLabelClass, "dark:text-white")}>
            Parent category
          </Label>
          <Input
            value={parentCategory.path}
            readOnly
            className={cn(modalFieldClass, "cursor-not-allowed")}
          />
        </div>
      ) : null}

      {!category && !parentCategory ? (
        <div className="grid gap-2">
          <Label htmlFor="parentId" className={cn(modalLabelClass, "dark:text-white")}>
            Parent category
          </Label>
          <Select
            value={selectedParentId}
            name="parentId"
            onValueChange={(value: string | null) => setSelectedParentId(value ?? "")}
          >
            <SelectTrigger
              id="parentId"
              className={cn("w-full", modalSelectClass)}
            >
              <SelectValue placeholder="Root category" />
            </SelectTrigger>
            <SelectContent
              align="start"
              sideOffset={6}
              className={modalSelectContentClass}
            >
              <SelectItem value="" className={modalSelectItemClass}>
                Root category
              </SelectItem>
            {options.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id}
                className={modalSelectItemClass}
              >
                {option.label}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label
          htmlFor={category ? `name-${category.id}` : "name"}
          className={cn(modalLabelClass, "dark:text-white")}
        >
          Category name
        </Label>
        <Input
          id={category ? `name-${category.id}` : "name"}
          name="name"
          required
          minLength={2}
          defaultValue={category?.name}
          onChange={(event) => setCategoryName(event.target.value)}
          className={modalFieldClass}
        />
        {categoryName.trim().length >= 2 ? (
          <p
            className={cn(
              "text-xs leading-5",
              isCategoryNameBlocked
                ? "text-red-600 dark:text-red-300"
                : "text-emerald-700 dark:text-emerald-300",
            )}
          >
            {isCheckingAvailability
              ? "Checking category name..."
              : availability?.message}
          </p>
        ) : null}
      </div>

      {category ? (
        <div className="grid gap-2">
          <Label htmlFor={`status-${category.id}`} className={cn(modalLabelClass, "dark:text-white")}>
            Status
          </Label>
          <Select
            name="status"
            defaultValue={category.status}
          >
            <SelectTrigger
              id={`status-${category.id}`}
              className={cn("w-full", modalSelectClass)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              align="start"
              sideOffset={6}
              className={modalSelectContentClass}
            >
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
      ) : null}

      {category?.lineNumber ? (
        <div className="grid gap-2">
          <Label className={cn(modalLabelClass, "dark:text-white")}>
            Current display order
          </Label>
          <Input
            value={category.lineNumber}
            readOnly
            className={cn(modalFieldClass, "cursor-not-allowed")}
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            This is the visible tree position. Use row actions to move the
            category up or down within its current level.
          </p>
        </div>
      ) : null}

      {isRootCategory ? (
        <div className="grid gap-2">
          <Label
            htmlFor={category ? `commission-${category.id}` : "commission"}
            className={cn(modalLabelClass, "dark:text-white")}
          >
            Root success fee
          </Label>
          <Input
            id={category ? `commission-${category.id}` : "commission"}
            name="commissionRateBps"
            type="text"
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]*"
            value={commissionRateBps}
            onChange={(event) => {
              setCommissionRateBps(
                event.target.value.replace(/\D/g, "").slice(0, 4),
              );
            }}
            placeholder="1200"
            className={modalFieldClass}
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {commissionRateBps || "0"} = {formattedCommissionRate}. Only root
            categories carry fees. Subcategories inherit from their root.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400">
          Subcategories inherit the success fee from their root category.
        </div>
      )}

      <div className="grid gap-2">
        <Label
          htmlFor={category ? `sort-${category.id}` : "sort"}
          className={cn(modalLabelClass, "dark:text-white")}
        >
          Sort order
        </Label>
        <Input
          id={category ? `sort-${category.id}` : "sort"}
          name="sortOrder"
          type="number"
          min={1}
          max={category?.siblingCount}
          step={1}
          defaultValue={category ? category.sortOrder || category.siblingPosition || 1 : 1}
          className={modalFieldClass}
        />
        {category?.siblingCount ? (
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Use a value from 1 to {category.siblingCount}. Saving repositions
            this category within the same level.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label
          htmlFor={category ? `description-${category.id}` : "description"}
          className={cn(modalLabelClass, "dark:text-white")}
        >
          Description
        </Label>
        <Textarea
          id={category ? `description-${category.id}` : "description"}
          name="description"
          maxLength={500}
          defaultValue={category?.description ?? ""}
          className={modalTextareaClass}
        />
      </div>

      <CategoryMessage state={state} />
      </DialogBody>

      <DialogFooter className="border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#101214]/95">
        <Button
          type="submit"
          disabled={isPending || isCheckingAvailability || isCategoryNameBlocked}
          className={cn("h-10 w-full justify-center gap-2 rounded-lg", adminPrimaryClass)}
        >
          {category ? <SaveIcon className="size-4" /> : <PlusIcon className="size-4" />}
          {isPending
            ? category
              ? "Saving..."
              : "Creating..."
            : category
              ? "Save category"
              : "Add category"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteCategoryForm({
  category,
  onDone,
}: {
  category: AdminCategory;
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    deleteCategory,
    initialState,
  );

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="id" value={category.id} />
      <DialogBody className="grid gap-4">
      <CategoryMessage state={state} />
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
        This will permanently delete <strong>{category.name}</strong> and any
        nested subcategories. Deletion is blocked if products use this category
        or any category in its branch.
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
          {isPending ? "Deleting..." : "Delete category"}
        </Button>
      </DialogFooter>
    </form>
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
          : "bg-zinc-100 text-zinc-600",
      )}
    >
      {status[0]?.toUpperCase()}
      {status.slice(1)}
    </Badge>
  );
}

function TypeBadge({ depth }: { depth: number }) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-md border-0 px-2 text-xs font-semibold",
        depth === 0
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-100 text-slate-700",
      )}
    >
      {depth === 0 ? "Parent" : "Subcategory"}
    </Badge>
  );
}

function CategoryNameCell({
  category,
  expanded,
  onToggle,
}: {
  category: FlatCategory;
  expanded: Set<string>;
  onToggle: (categoryId: string) => void;
}) {
  const indentSize = 25;
  const visibleDepth = Math.min(category.depth, 3);
  const connectorClass =
    "absolute bg-slate-200/70 dark:bg-white/12";

  return (
    <div className="relative min-w-0">
      {category.ancestorHasNext.slice(0, visibleDepth).map((hasNext, index) =>
        hasNext ? (
        <span
          key={index}
          aria-hidden="true"
          className={cn(connectorClass, "bottom-[-13px] top-[-13px] w-px")}
          style={{ left: index * indentSize + 10 }}
        />
        ) : null,
      )}
      {category.depth > 0 ? (
        <>
          <span
            aria-hidden="true"
            className={cn(connectorClass, "top-[-13px] w-px")}
            style={{
              height: category.isLastChild ? "calc(50% + 13px)" : "calc(100% + 26px)",
              left: (visibleDepth - 1) * indentSize + 10,
            }}
          />
          <span
            aria-hidden="true"
            className={cn(connectorClass, "top-1/2 h-px")}
            style={{
              left: (visibleDepth - 1) * indentSize + 10,
              width: 17,
            }}
          />
          <span
            aria-hidden="true"
            className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white dark:border-white/12 dark:bg-[#151719]"
            style={{ left: (visibleDepth - 1) * indentSize + 10 }}
          />
        </>
      ) : null}
      <div
        className="relative flex min-w-0 items-center gap-2"
        style={{ paddingLeft: visibleDepth * indentSize }}
      >
        <button
          type="button"
          disabled={!category.hasChildren}
          onClick={() => onToggle(category.id)}
          className="grid size-5 shrink-0 place-items-center rounded bg-white text-slate-700 transition hover:bg-slate-100 disabled:opacity-0 dark:bg-[#151719] dark:text-zinc-300 dark:hover:bg-white/10"
          aria-label={
            expanded.has(category.id) ? "Collapse category" : "Expand category"
          }
        >
          {expanded.has(category.id) ? (
            <ChevronDownIcon className="size-4" />
          ) : (
            <ChevronRightIcon className="size-4" />
          )}
        </button>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="block min-w-0 truncate text-sm font-semibold text-zinc-950 dark:text-white">
              {category.name}
            </span>
            {category.isLocked ? (
              <span
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#c4982d]/12 text-[#c4982d] dark:bg-[#c4982d]/18"
                title="Locked category"
              >
                <LockIcon className="size-3" />
              </span>
            ) : null}
          </span>
          {category.depth === 0 ? (
            <span className="mt-0.5 block truncate text-[11px] font-medium leading-4 text-slate-500 dark:text-zinc-400">
              {formatSuccessFee(category.commissionRateBps)}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function CategoryFilterPanel({
  activeFilterCount,
  filters,
  onChange,
  onClear,
  onClose,
}: {
  activeFilterCount: number;
  filters: CategoryFilters;
  onChange: (filters: Partial<CategoryFilters>) => void;
  onClose: () => void;
  onClear: () => void;
}) {
  return (
    <div className="fixed left-4 right-4 top-24 z-50 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xl [scrollbar-width:thin] dark:border-white/10 dark:bg-[#151719] md:absolute md:left-auto md:right-0 md:top-12 md:max-h-[min(32rem,calc(100dvh-8rem))] md:w-80">
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-[#151719]">
        <div>
          <p className="text-sm font-bold text-zinc-950 dark:text-white">
            Filter categories
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Narrow the current category tree.
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
            aria-label="Close category filters"
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

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Status
          </Label>
          <Select
            value={filters.status}
            onValueChange={(value: string | null) =>
              onChange({ status: value as CategoryFilters["status"] })
            }
          >
            <SelectTrigger className={cn("w-full", modalSelectClass)}>
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
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Type
            </Label>
            <Select
              value={filters.type}
              onValueChange={(value: string | null) =>
                onChange({ type: value as CategoryFilters["type"] })
              }
            >
              <SelectTrigger className={cn("w-full", modalSelectClass)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={modalSelectContentClass}>
                <SelectItem value="all" className={modalSelectItemClass}>
                  All types
                </SelectItem>
                <SelectItem value="root" className={modalSelectItemClass}>
                  Root only
                </SelectItem>
                <SelectItem value="subcategory" className={modalSelectItemClass}>
                  Subcategories
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Depth
            </Label>
            <Select
              value={filters.depth}
              onValueChange={(value: string | null) =>
                onChange({ depth: value as CategoryFilters["depth"] })
              }
            >
              <SelectTrigger className={cn("w-full", modalSelectClass)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={modalSelectContentClass}>
                <SelectItem value="all" className={modalSelectItemClass}>
                  All levels
                </SelectItem>
                <SelectItem value="level-1" className={modalSelectItemClass}>
                  Level 1
                </SelectItem>
                <SelectItem value="level-2" className={modalSelectItemClass}>
                  Level 2
                </SelectItem>
                <SelectItem value="level-3-plus" className={modalSelectItemClass}>
                  Level 3+
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Locking
            </Label>
            <Select
              value={filters.locked}
              onValueChange={(value: string | null) =>
                onChange({ locked: value as CategoryFilters["locked"] })
              }
            >
              <SelectTrigger className={cn("w-full", modalSelectClass)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={modalSelectContentClass}>
                <SelectItem value="all" className={modalSelectItemClass}>
                  All
                </SelectItem>
                <SelectItem value="locked" className={modalSelectItemClass}>
                  Locked
                </SelectItem>
                <SelectItem value="editable" className={modalSelectItemClass}>
                  Editable
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Products
            </Label>
            <Select
              value={filters.products}
              onValueChange={(value: string | null) =>
                onChange({ products: value as CategoryFilters["products"] })
              }
            >
              <SelectTrigger className={cn("w-full", modalSelectClass)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={modalSelectContentClass}>
                <SelectItem value="all" className={modalSelectItemClass}>
                  All
                </SelectItem>
                <SelectItem value="has-products" className={modalSelectItemClass}>
                  Has products
                </SelectItem>
                <SelectItem value="no-products" className={modalSelectItemClass}>
                  No products
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Success fee
          </Label>
          <Select
            value={filters.fee}
            onValueChange={(value: string | null) =>
              onChange({ fee: value as CategoryFilters["fee"] })
            }
          >
            <SelectTrigger className={cn("w-full", modalSelectClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={modalSelectContentClass}>
              <SelectItem value="all" className={modalSelectItemClass}>
                All
              </SelectItem>
              <SelectItem value="has-fee" className={modalSelectItemClass}>
                Has fee
              </SelectItem>
              <SelectItem value="no-fee" className={modalSelectItemClass}>
                No fee
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Created from
            </Label>
            <Input
              type="date"
              value={filters.createdFrom}
              onChange={(event) => onChange({ createdFrom: event.target.value })}
              className={cn("h-10 rounded-lg text-sm", modalFieldClass)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Created to
            </Label>
            <Input
              type="date"
              value={filters.createdTo}
              onChange={(event) => onChange({ createdTo: event.target.value })}
              className={cn("h-10 rounded-lg text-sm", modalFieldClass)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CategoryDashboard({
  options,
  rootCategoryCount,
  subcategoryCount,
  totalProducts,
  tree,
}: CategoryDashboardProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CategoryFilters>(defaultFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeActionCategory, setActiveActionCategory] =
    useState<FlatCategory | null>(null);
  const [activeEditCategory, setActiveEditCategory] =
    useState<FlatCategory | null>(null);
  const [activeSubcategoryParent, setActiveSubcategoryParent] =
    useState<FlatCategory | null>(null);
  const [activeDeleteCategory, setActiveDeleteCategory] =
    useState<FlatCategory | null>(null);
  const [isRowActionPending, startRowActionTransition] = useTransition();
  const activeFilterCount = countActiveFilters(filters);
  const filteredTree = useMemo(
    () => filterCategoryTree(tree, query, filters),
    [filters, query, tree],
  );
  const totalPages = Math.max(1, Math.ceil(filteredTree.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const pageTree = filteredTree.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );
  const pageRows = useMemo(
    () => flattenVisibleCategories(pageTree, expanded),
    [expanded, pageTree],
  );
  const paginationItems = useMemo(
    () => buildPaginationItems(activePage, totalPages),
    [activePage, totalPages],
  );
  const showingStart = filteredTree.length === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const showingEnd = Math.min(activePage * pageSize, filteredTree.length);

  function toggleCategory(categoryId: string) {
    setExpanded((current) => {
      const next = new Set(current);

      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }

      return next;
    });
  }

  function openCategorySettings(category: FlatCategory) {
    setActiveActionCategory(null);
    setActiveEditCategory(category);
  }

  function openSubcategoryDialog(category: FlatCategory) {
    setActiveActionCategory(null);
    setActiveSubcategoryParent(category);
  }

  function openDeleteDialog(category: FlatCategory) {
    setActiveActionCategory(null);
    setActiveDeleteCategory(category);
  }

  function toggleLock(category: FlatCategory) {
    setActiveActionCategory(null);
    startRowActionTransition(() => {
      void toggleCategoryLock(category.id).then(() => router.refresh());
    });
  }

  function moveCategoryRow(category: FlatCategory, direction: "up" | "down") {
    setActiveActionCategory(null);
    startRowActionTransition(() => {
      void moveCategory(category.id, direction).then((result) => {
        if (!result.ok && result.message) {
          window.alert(result.message);
        }

        router.refresh();
      });
    });
  }

  function updateFilters(nextFilters: Partial<CategoryFilters>) {
    setCurrentPage(1);
    setFilters((current) => ({ ...current, ...nextFilters }));
  }

  function clearFilters() {
    setCurrentPage(1);
    setFilters(defaultFilters);
  }

  function exportCategoriesCsv() {
    const rows = flattenCategoriesForExport(filteredTree);
    const csvRows = [
      [
        "Display Order",
        "Category Name",
        "Parent Category",
        "Type",
        "Status",
        "Products",
        "Success Fee",
        "Locked",
        "Slug",
        "Path",
        "Created At",
      ],
      ...rows.map(({ category, lineNumber, parentName }) => [
        lineNumber,
        category.name,
        parentName,
        category.depth === 0 ? "Parent" : "Subcategory",
        category.status,
        category.productCount,
        category.commissionRateBps === null
          ? "Inherited"
          : `${(category.commissionRateBps / 100).toFixed(2)}%`,
        category.isLocked ? "Yes" : "No",
        category.slug,
        category.path,
        formatDate(category.createdAt),
      ]),
    ].map((row) => row.map(escapeCsvValue).join(","));
    const csv = csvRows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `piessang-categories-${today}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
        <DashboardPageHeader
          title="Categories"
          breadcrumbs={["Catalog", "Categories"]}
        />

        <DashboardMetricStrip
          metrics={[
            {
              label: "Root categories",
              value: rootCategoryCount.toLocaleString(),
            },
            {
              label: "Subcategories",
              value: subcategoryCount.toLocaleString(),
            },
            {
              label: "Products",
              value: totalProducts.toLocaleString(),
            },
          ]}
        />

        <section className="mt-4 grid gap-3 md:mt-5 md:flex md:items-center md:justify-between">
          <div className="relative w-full md:max-w-[420px]">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <DashboardInput
              value={query}
              onChange={(event) => {
                setCurrentPage(1);
                setQuery(event.target.value);
              }}
              placeholder="Search categories..."
              className="pl-10"
            />
          </div>
          <div className="relative grid grid-cols-2 gap-2 md:flex md:items-center">
            <DashboardButton
              onClick={() => setIsFilterPanelOpen((isOpen) => !isOpen)}
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
            {isFilterPanelOpen ? (
              <>
                <button
                  aria-label="Close category filters"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setIsFilterPanelOpen(false)}
                  type="button"
                />
                <CategoryFilterPanel
                  activeFilterCount={activeFilterCount}
                  filters={filters}
                  onChange={updateFilters}
                  onClose={() => setIsFilterPanelOpen(false)}
                  onClear={clearFilters}
                />
              </>
            ) : null}
            <DashboardButton onClick={exportCategoriesCsv} type="button">
              <DownloadIcon className="size-3.5" />
              Export
            </DashboardButton>
          </div>
        </section>

        <section className={cn("mt-5 [&_[data-slot=table-container]]:overflow-visible", dashboardPanelClass)}>
          <Table className="table-fixed md:table-auto">
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>
                  Category Name
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                  Type
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                  Products
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                  Status
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden w-36 md:table-cell")}>
                  Sort Order
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                  Created At
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "w-[86px] pr-4 text-right md:w-auto md:pr-5")}>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((category) => (
                <TableRow
                  key={category.id}
                  className={dashboardTableRowClass}
                >
                  <TableCell className={cn("min-w-0", dashboardTableCellClass)}>
                    <CategoryNameCell
                      category={category}
                      expanded={expanded}
                      onToggle={toggleCategory}
                    />
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <TypeBadge depth={category.depth} />
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass, dashboardTablePrimaryTextClass)}>
                    {category.productCount.toLocaleString()}
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <StatusBadge status={category.status} />
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass, dashboardTablePrimaryTextClass)}>
                    <div className="flex items-center gap-1.5">
                      <span className="min-w-10 tabular-nums">{category.lineNumber}</span>
                      <div className="flex items-center rounded-md border border-slate-200/80 bg-white/70 shadow-[0_1px_2px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.03]">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-6 rounded-r-none text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white dark:disabled:text-zinc-600"
                          aria-label={`Move ${category.name} up`}
                          disabled={
                            category.isLocked ||
                            category.siblingPosition <= 1 ||
                            isRowActionPending
                          }
                          onClick={() => moveCategoryRow(category, "up")}
                          title="Move up"
                          type="button"
                        >
                          <ArrowUpIcon className="size-3" />
                        </Button>
                        <span className="h-3.5 w-px bg-slate-200 dark:bg-white/10" />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-6 rounded-l-none text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white dark:disabled:text-zinc-600"
                          aria-label={`Move ${category.name} down`}
                          disabled={
                            category.isLocked ||
                            category.siblingPosition >= category.siblingCount ||
                            isRowActionPending
                          }
                          onClick={() => moveCategoryRow(category, "down")}
                          title="Move down"
                          type="button"
                        >
                          <ArrowDownIcon className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass, dashboardTableMutedTextClass)}>
                    {formatDate(category.createdAt)}
                  </TableCell>
                  <TableCell className="w-[86px] pr-4 text-right md:w-auto md:pr-5">
                    <div className="flex justify-end gap-1 md:gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-slate-700 hover:bg-slate-100 disabled:text-slate-300 dark:text-zinc-300 dark:hover:bg-white/10 dark:disabled:text-zinc-600"
                        aria-label={
                          category.isLocked
                            ? `${category.name} is locked`
                            : `Edit ${category.name}`
                        }
                        disabled={category.isLocked}
                        onClick={() => setActiveEditCategory(category)}
                        title={category.isLocked ? "Locked category" : "Edit category"}
                        type="button"
                      >
                          {category.isLocked ? (
                            <LockIcon className="size-4 text-[#c4982d]" />
                          ) : (
                            <Edit3Icon className="size-4" />
                          )}
                      </Button>
                      <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
                        aria-label={`Open actions for ${category.name}`}
                        onClick={() => setActiveActionCategory(category)}
                        type="button"
                      >
                          <MoreVerticalIcon className="size-4" />
                      </Button>
                      {activeActionCategory?.id === category.id ? (
                        <>
                          <button
                            aria-label="Close category actions"
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={() => setActiveActionCategory(null)}
                            type="button"
                          />
                          <div className="absolute right-0 top-9 z-50 max-h-[min(22rem,calc(100dvh-8rem))] w-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white text-left text-zinc-950 shadow-2xl [scrollbar-width:thin] dark:border-white/10 dark:bg-[#151719] dark:text-white">
                            <button
                              className="flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 disabled:cursor-wait disabled:text-slate-400 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:disabled:text-zinc-500"
                              disabled={isRowActionPending}
                              onClick={() => toggleLock(category)}
                              type="button"
                            >
                              <LockIcon className="size-4" />
                              {category.isLocked ? "Unlock" : "Lock"}
                              <span className="ml-auto text-xs text-slate-400 dark:text-zinc-500">
                                {category.isLocked ? "Editable" : "Not editable"}
                              </span>
                            </button>
                            <button
                              className="flex h-12 w-full items-center gap-3 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:disabled:text-zinc-500"
                              disabled={
                                category.isLocked ||
                                category.siblingPosition <= 1 ||
                                isRowActionPending
                              }
                              onClick={() => moveCategoryRow(category, "up")}
                              type="button"
                            >
                              <ArrowUpIcon className="size-4" />
                              Move up
                            </button>
                            <button
                              className="flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:disabled:text-zinc-500"
                              disabled={
                                category.isLocked ||
                                category.siblingPosition >= category.siblingCount ||
                                isRowActionPending
                              }
                              onClick={() => moveCategoryRow(category, "down")}
                              type="button"
                            >
                              <ArrowDownIcon className="size-4" />
                              Move down
                            </button>
                            <button
                              className="flex h-12 w-full items-center gap-3 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:disabled:text-zinc-500"
                              disabled={category.isLocked}
                              onClick={() => openCategorySettings(category)}
                              type="button"
                            >
                              <SettingsIcon className="size-4" />
                              Settings
                            </button>
                            <button
                              className="flex h-12 w-full items-center gap-3 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:disabled:text-zinc-500"
                              disabled={category.isLocked}
                              onClick={() => openSubcategoryDialog(category)}
                              type="button"
                            >
                              <FolderPlusIcon className="size-4" />
                              Add subcategory
                            </button>
                            <button
                              className="flex h-12 w-full items-center gap-3 border-t border-red-100 bg-red-50/70 px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15 dark:disabled:text-red-900"
                              disabled={category.isLocked}
                              onClick={() => openDeleteDialog(category)}
                              type="button"
                            >
                              <Trash2Icon className="size-4" />
                              Delete
                            </button>
                          </div>
                        </>
                      ) : null}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Showing {showingStart} to {showingEnd} of{" "}
              {filteredTree.length.toLocaleString()} root categories
            </p>
            <div className="flex items-center gap-3">
              <Select
                value={String(pageSize)}
                onValueChange={(value: string | null) => {
                  setCurrentPage(1);
                  setPageSize(Number(value));
                }}
              >
                <SelectTrigger
                  className={cn("h-9 w-[124px] gap-2", dashboardControlClass)}
                  aria-label="Rows per page"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  sideOffset={6}
                  className={modalSelectContentClass}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <SelectItem
                      key={size}
                      value={String(size)}
                      className={modalSelectItemClass}
                    >
                      {size} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className={dashboardControlClass}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(Math.max(1, activePage - 1))}
                  aria-label="Previous categories page"
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
                {paginationItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-2 text-sm text-slate-500 dark:text-zinc-400"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={item}
                      variant="outline"
                      size="icon-sm"
                      className={cn(
                      dashboardControlClass,
                      item === activePage &&
                          "border-[#c4982d] text-[#a87920] dark:border-[#c4982d] dark:text-[#f3c96b]",
                      )}
                      onClick={() => setCurrentPage(item)}
                      aria-label={`Go to categories page ${item}`}
                      aria-current={item === activePage ? "page" : undefined}
                    >
                      {item}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="icon-sm"
                  className={dashboardControlClass}
                  disabled={activePage === totalPages}
                  onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}
                  aria-label="Next categories page"
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        <Dialog
          open={Boolean(activeEditCategory)}
          onOpenChange={(open) => {
            if (!open) {
              setActiveEditCategory(null);
            }
          }}
        >
          <DialogContent className={modalContentClass}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-zinc-950 dark:text-white">
                Category settings
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
                Update display details, status, sort order, and root-level
                success fee.
              </DialogDescription>
            </DialogHeader>
            {activeEditCategory ? (
              <CategoryForm category={activeEditCategory} options={options} />
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(activeSubcategoryParent)}
          onOpenChange={(open) => {
            if (!open) {
              setActiveSubcategoryParent(null);
            }
          }}
        >
          <DialogContent className={modalContentClass}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-zinc-950 dark:text-white">
                Add subcategory
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
                Create a nested category under the selected parent.
              </DialogDescription>
            </DialogHeader>
            {activeSubcategoryParent ? (
              <CategoryForm
                options={options}
                parentCategory={activeSubcategoryParent}
              />
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(activeDeleteCategory)}
          onOpenChange={(open) => {
            if (!open) {
              setActiveDeleteCategory(null);
            }
          }}
        >
          <DialogContent className="max-w-md border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-zinc-950 dark:text-white">
                Delete category?
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
                This is permanent and will cascade through nested categories if
                no products use the branch.
              </DialogDescription>
            </DialogHeader>
            {activeDeleteCategory ? (
              <DeleteCategoryForm
                category={activeDeleteCategory}
                onDone={() => setActiveDeleteCategory(null)}
              />
            ) : null}
          </DialogContent>
        </Dialog>
    </>
  );
}
