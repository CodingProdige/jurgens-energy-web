"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  BoldIcon,
  CircleHelpIcon,
  Heading2Icon,
  Heading3Icon,
  ImagePlusIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PackageCheckIcon,
  PlusIcon,
  PilcrowIcon,
  QuoteIcon,
  RefreshCwIcon,
  SaveIcon,
  SparklesIcon,
  Trash2Icon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import {
  DashboardButton,
  DashboardPageHeader,
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import { MediaManagerDialog } from "@/components/media/media-manager-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RequiredIndicator } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { generateProductDescription } from "@/app/(seller)/seller/(dashboard)/products/new/actions";
import type { AdminMediaAsset } from "@/src/modules/media/admin";
import type {
  SellerCreateProductData,
  SellerProductCategory,
} from "@/src/modules/sellers/product-create";

type VariantOption = {
  id: string;
  name: string;
  values: string[];
};
type GeneratedVariant = {
  id: string;
  imageId: string | null;
  optionValues: string[];
  price: string;
  sku: string;
  stock: string;
  weightGrams: string;
};
type SkuStatus = "available" | "checking" | "duplicate" | "idle";
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
function formatFee(commissionRateBps: number | null) {
  if (!commissionRateBps) {
    return "No fee set";
  }

  return `${(commissionRateBps / 100).toFixed(2).replace(/\.00$/, "")}% success fee`;
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

function getCategoryFeeBps(
  category: SellerProductCategory,
  categoriesByPath: Map<string, SellerProductCategory>,
) {
  if (category.commissionRateBps !== null) {
    return category.commissionRateBps;
  }

  const topLevelSlug = category.path.split("/")[0];

  return topLevelSlug
    ? (categoriesByPath.get(topLevelSlug)?.commissionRateBps ?? null)
    : null;
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

function normalizeSkuPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function parsePositiveNumber(value: string) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function getPackagePreview(lengthMm: string, widthMm: string, heightMm: string) {
  const length = parsePositiveNumber(lengthMm);
  const width = parsePositiveNumber(widthMm);
  const height = parsePositiveNumber(heightMm);
  const hasDimensions = Boolean(length && width && height);
  const previewLength = length ?? 220;
  const previewWidth = width ?? 160;
  const previewHeight = height ?? 160;
  const millimetresPerHuman = 1800;
  const humanPreviewHeight = 118;
  const scale = humanPreviewHeight / millimetresPerHuman;

  return {
    depthPx: Math.max(34, Math.min(110, previewWidth * scale)),
    hasDimensions,
    heightPx: Math.max(34, Math.min(128, previewHeight * scale)),
    label: hasDimensions
      ? `${length} x ${width} x ${height} mm`
      : "Enter dimensions to shape the preview",
    widthPx: Math.max(58, Math.min(156, previewLength * scale)),
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

function normalizeLookupValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generatedTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
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

function AiGenerateButton({
  feedback,
  isPending,
  onClick,
}: {
  feedback: AiFeedback;
  isPending: boolean;
  onClick: () => void;
}) {
  return (
    <span className="relative inline-flex max-w-full shrink-0">
      <DashboardButton
        className="max-w-full px-2 text-xs sm:px-3 sm:text-[14px]"
        disabled={isPending}
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
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  maxLength: number;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const textLength = getEditorTextLength(value);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor || editor.innerHTML === value) {
      return;
    }

    editor.innerHTML = value;
  }, [value]);

  function runCommand(command: EditorCommand, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function handleInput() {
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
    const href = window.prompt("Enter link URL");

    if (!href || !URL.canParse(href)) {
      return;
    }

    runCommand("createLink", href);
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
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 dark:border-white/18 dark:bg-[#151719]">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50/70 p-2 dark:border-white/10 dark:bg-white/[0.04]">
        {tools.map((tool) => {
          const Icon = tool.icon;

          return (
            <Button
              key={tool.label}
              aria-label={tool.label}
              className="size-8 rounded-md border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
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
        contentEditable
        data-placeholder={placeholder}
        onInput={handleInput}
        role="textbox"
        suppressContentEditableWarning
      />
      <div className="flex items-center justify-end border-t border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-white/10">
        {textLength}/{maxLength}
      </div>
    </div>
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
          text="A visual guide based on length, width, and height. Courier rates still use the exact values entered."
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
          <span>2 m scale</span>
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
  isCover,
  onRemove,
}: {
  asset: AdminMediaAsset;
  isCover: boolean;
  onRemove: () => void;
}) {
  const isVideo = asset.mimeType.startsWith("video/");
  const src = asset.thumbnailUrl ?? asset.publicUrl;

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]">
      {isVideo ? (
        <div className="grid size-full place-items-center text-emerald-700 dark:text-emerald-300">
          <VideoIcon className="size-8" />
        </div>
      ) : (
        <Image src={src} alt="" fill sizes="96px" className="object-cover" />
      )}
      {isCover ? (
        <Badge className="absolute bottom-1 left-1 bg-emerald-700 text-white">
          Cover
        </Badge>
      ) : null}
      <button
        aria-label="Remove media"
        className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow-sm transition group-hover:opacity-100 dark:bg-[#101214]/90 dark:text-zinc-200"
        onClick={onRemove}
        type="button"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}

export function ProductCreateWizard({
  data,
}: {
  data: SellerCreateProductData;
}) {
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [skuStatus, setSkuStatus] = useState<SkuStatus>("idle");
  const [description, setDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [aiFeedback, setAiFeedback] = useState<AiFeedback>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [isBrandPickerOpen, setIsBrandPickerOpen] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [continueSellingOutOfStock, setContinueSellingOutOfStock] =
    useState(false);
  const [hasVariants, setHasVariants] = useState(false);
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([
    { id: makeId("option"), name: "Size", values: ["Small", "Medium", "Large"] },
  ]);
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedVariant[]>([]);
  const [weightGrams, setWeightGrams] = useState("");
  const [lengthMm, setLengthMm] = useState("");
  const [widthMm, setWidthMm] = useState("");
  const [heightMm, setHeightMm] = useState("");
  const [fulfillmentMode, setFulfillmentMode] = useState<
    "seller_fulfilled" | "piessang_fulfilled"
  >("seller_fulfilled");
  const [isGeneratingDescription, startDescriptionTransition] =
    useTransition();

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
    .map((id) => data.mediaLibrary.assets.find((asset) => asset.id === id))
    .filter((asset): asset is AdminMediaAsset => Boolean(asset));
  const mediaById = new Map(data.mediaLibrary.assets.map((asset) => [asset.id, asset]));

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
          `/products/new/check-sku?sku=${encodeURIComponent(normalizedSku)}`,
          { signal: controller.signal },
        );
        const result = (await response.json()) as {
          available?: boolean;
          ok?: boolean;
        };

        setSkuStatus(result.ok && result.available ? "available" : "duplicate");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSkuStatus("idle");
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [sku]);

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

  function addMedia(asset: AdminMediaAsset) {
    setSelectedMediaIds((current) =>
      current.includes(asset.id) || current.length >= 10
        ? current
        : [...current, asset.id],
    );
  }

  function updateVariantOption(optionId: string, patch: Partial<VariantOption>) {
    setVariantOptions((current) =>
      current.map((option) =>
        option.id === optionId ? { ...option, ...patch } : option,
      ),
    );
  }

  function generateVariants() {
    const combinations = createCombinations(variantOptions);

    setGeneratedVariants(
      combinations.map((optionValues, index) => ({
        id: makeId("variant"),
        imageId: selectedMediaIds[0] ?? null,
        optionValues,
        price,
        sku: sku ? `${sku}-${index + 1}` : "",
        stock,
        weightGrams,
      })),
    );
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
      void generateProductDescription({ kind, productName: name }).then((result) => {
        if (result.ok && result.description) {
          if (kind === "short") {
            setDescription(result.description.slice(0, 400));
          } else {
            setLongDescription(
              generatedTextToHtml(result.description.slice(0, 2000)),
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

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <DashboardPageHeader
          breadcrumbs={["Seller", "Products", "New product"]}
          className="mb-0"
          title="Create new product"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <DashboardButton nativeButton={false} render={<Link href="/products" />}>
            Cancel
          </DashboardButton>
          <DashboardButton
            className="border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white"
            type="button"
          >
            <SaveIcon className="size-3.5" />
            Save draft
          </DashboardButton>
        </div>
      </div>

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
                <FieldLabel info="A unique stock keeping unit. SKUs must be unique across all sellers and products.">
                  SKU *
                </FieldLabel>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    className={fieldClass}
                    onChange={(event) =>
                      setSku(normalizeSkuPart(event.target.value))
                    }
                    placeholder="Enter SKU"
                    value={sku}
                  />
                  <DashboardButton
                    className="h-10"
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
                        : "This SKU is already in use."}
                  </p>
                ) : null}
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
                            onClick={() => clearCategoryLevel(index)}
                            type="button"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                      <Select
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
                                {index === 0 ? (
                                  <span className="block text-xs text-slate-500 dark:text-zinc-400">
                                    {formatFee(
                                      getCategoryFeeBps(
                                        category,
                                        categoriesByPath,
                                      ),
                                    )}
                                  </span>
                                ) : null}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {index === 0 && level.value ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs leading-5 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
                          <span className="block font-semibold">
                            {categoriesById.get(level.value)?.name}
                          </span>
                          <span>
                            {formatFee(
                              getCategoryFeeBps(
                                categoriesById.get(level.value)!,
                                categoriesByPath,
                              ),
                            )}
                          </span>
                        </div>
                      ) : index === 0 ? (
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
                <FieldLabel info="Start typing a brand name. Existing brands can be selected; unknown brands will be submitted as a brand request when the product is saved.">
                  Brand *
                </FieldLabel>
                <div className="relative">
                  <Input
                    className={cn(fieldClass, "pr-16")}
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
                    placeholder="Type or select a brand"
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
                            {brand.status === "pending" ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
                                Under review
                              </span>
                            ) : null}
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
                        : selectedBrandSuggestion?.status === "pending"
                          ? "text-amber-700 dark:text-amber-300"
                        : "text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {selectedBrandSuggestion?.status === "active"
                      ? `Using existing brand: ${selectedBrandSuggestion.name}.`
                      : selectedBrandSuggestion?.status === "pending"
                        ? `${selectedBrandSuggestion.name} is already under review. You can keep using it while the brand request is pending.`
                      : "This brand does not exist yet. Saving this product will submit a brand request for review."}
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
                    feedback={aiFeedback?.kind === "short" ? aiFeedback : null}
                    isPending={isGeneratingDescription}
                    onClick={() => handleGenerateDescription("short")}
                  />
                </div>
                <div className="relative">
                  <Textarea
                    className={cn(textareaClass, "pb-8")}
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
                    feedback={aiFeedback?.kind === "long" ? aiFeedback : null}
                    isPending={isGeneratingDescription}
                    onClick={() => handleGenerateDescription("long")}
                  />
                </div>
                <ProductRichTextEditor
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
                  min={0}
                  onChange={(event) => setStock(event.target.value)}
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
                <FieldLabel info="The stock level at which Piessang should flag this product as low stock.">
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
            <label className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
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
            description="Parcel data is required before checkout can quote accurate rates. Inaccurate weight or dimensions may cause courier adjustment fees, and those extra costs may be charged back to the seller."
          >
            <div className="grid min-w-0 gap-4">
              <div className="grid min-w-0 gap-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="grid gap-1.5">
                    <FieldLabel info="The packed product weight in grams. Required for accurate courier rates.">
                      Weight (g) *
                    </FieldLabel>
                    <Input
                      className={fieldClass}
                      min={1}
                      onChange={(event) => setWeightGrams(event.target.value)}
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
                      min={1}
                      onChange={(event) => setLengthMm(event.target.value)}
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
                      min={1}
                      onChange={(event) => setWidthMm(event.target.value)}
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
                      min={1}
                      onChange={(event) => setHeightMm(event.target.value)}
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
              onClick={() => setIsMediaOpen(true)}
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

            <div className="mt-4 grid grid-cols-5 gap-2">
              {selectedMedia.map((asset, index) => (
                <MediaTile
                  key={asset.id}
                  asset={asset}
                  isCover={index === 0}
                  onRemove={() =>
                    setSelectedMediaIds((current) =>
                      current.filter((id) => id !== asset.id),
                    )
                  }
                />
              ))}
              <button
                className="grid aspect-square place-items-center rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-emerald-500 hover:text-emerald-700 dark:border-white/15 dark:text-zinc-400 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
                onClick={() => setIsMediaOpen(true)}
                type="button"
              >
                <PlusIcon className="size-5" />
              </button>
            </div>
          </Panel>

          <Panel title="Pricing">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <FieldLabel info="The customer-facing selling price.">
                  Price *
                </FieldLabel>
                <Input
                  className={fieldClass}
                  min={0}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="0.00"
                  type="number"
                  value={price}
                />
              </label>
              <label className="grid gap-1.5">
                <FieldLabel info="Optional original price used to show a markdown or discount.">
                  Compare-at price
                </FieldLabel>
                <Input
                  className={fieldClass}
                  min={0}
                  onChange={(event) => setCompareAtPrice(event.target.value)}
                  placeholder="0.00"
                  type="number"
                  value={compareAtPrice}
                />
              </label>
            </div>
          </Panel>

          <Panel
            title="Fulfillment"
            description="Choose who physically stores, packs, and hands off this product."
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
                type="button"
              >
                <span className="font-semibold">Seller ships this product</span>
                <span className="mt-1 block text-sm text-slate-600 dark:text-zinc-300">
                  You pack the order and print the Piessang waybill.
                </span>
              </button>
              <button
                className={cn(
                  "rounded-lg border p-4 text-left transition",
                  fulfillmentMode === "piessang_fulfilled"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-100"
                    : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#151719]",
                )}
                onClick={() => setFulfillmentMode("piessang_fulfilled")}
                type="button"
              >
                <span className="font-semibold">Fulfilled by Piessang</span>
                <span className="mt-1 block text-sm text-slate-600 dark:text-zinc-300">
                  Available only for approved products and local stock.
                </span>
              </button>
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        title="Variants"
        description="Optional. Turn this on only when the product has options like size, color, material, or style."
      >
        <label className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
          <Checkbox
            checked={hasVariants}
            onCheckedChange={(checked) => setHasVariants(Boolean(checked))}
            className="size-4 rounded-[4px] border-slate-300 bg-white data-checked:border-emerald-600 data-checked:bg-emerald-600 data-checked:text-white"
          />
          This product has multiple options
        </label>

        {hasVariants ? (
          <div className="grid gap-4">
            {variantOptions.map((option) => (
              <div
                key={option.id}
                className="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/10"
              >
                <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
                  <label className="grid gap-1.5">
                    <FieldLabel info="The option type, for example size, color, material, or style.">
                      Option name
                    </FieldLabel>
                    <Input
                      className={fieldClass}
                      onChange={(event) =>
                        updateVariantOption(option.id, {
                          name: event.target.value,
                        })
                      }
                      placeholder="Option name"
                      value={option.name}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <FieldLabel info="Comma-separated values for this option. These become variant combinations.">
                      Option values
                    </FieldLabel>
                    <Input
                      className={fieldClass}
                      onChange={(event) =>
                        updateVariantOption(option.id, {
                          values: event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Small, Medium, Large"
                      value={option.values.join(", ")}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setVariantOptions((current) =>
                        current.filter((currentOption) => currentOption.id !== option.id),
                      )
                    }
                    type="button"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <DashboardButton
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
              <DashboardButton
                className="border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white"
                onClick={generateVariants}
                type="button"
              >
                <SparklesIcon className="size-3.5" />
                Generate variants
              </DashboardButton>
            </div>

            {generatedVariants.length > 0 ? (
              <div className="grid gap-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950 dark:text-white">
                  Generated variants ({generatedVariants.length})
                  <InfoHint
                    label="Generated variants"
                    text="The generated purchasable combinations based on the selected product options."
                  />
                </h3>
                <div className="grid gap-2">
                  {generatedVariants.slice(0, 8).map((variant) => {
                    const image = variant.imageId ? mediaById.get(variant.imageId) : null;

                    return (
                      <div
                        key={variant.id}
                        className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10 md:grid-cols-[1fr_140px_110px_120px]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative size-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10">
                            {image?.thumbnailUrl || image?.publicUrl ? (
                              <Image
                                src={image.thumbnailUrl ?? image.publicUrl}
                                alt=""
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {variant.optionValues.join(" / ")}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {variant.sku || "SKU pending"}
                            </p>
                          </div>
                        </div>
                        <Input className={fieldClass} defaultValue={variant.price} placeholder="Price" />
                        <Input
                          aria-label="Variant stock"
                          className={fieldClass}
                          defaultValue={variant.stock}
                          placeholder="Stock"
                        />
                        <Input
                          aria-label="Variant weight grams"
                          className={fieldClass}
                          defaultValue={variant.weightGrams}
                          placeholder="Weight g"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-zinc-300">
            This product will be created as a single variant. You can always add variants later.
          </p>
        )}
      </Panel>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 py-4 dark:border-white/10 dark:bg-[#0f1114]/95 sm:flex-row sm:justify-end">
        <DashboardButton nativeButton={false} render={<Link href="/products" />}>
          Cancel
        </DashboardButton>
        <DashboardButton
          className="border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white"
          type="button"
        >
          <PackageCheckIcon className="size-3.5" />
          Save draft
        </DashboardButton>
      </div>

      <MediaManagerDialog
        acceptedMediaTypes={["image", "video"]}
        assets={data.mediaLibrary.assets}
        folders={data.mediaLibrary.folders}
        onOpenChange={setIsMediaOpen}
        onSelect={addMedia}
        open={isMediaOpen}
        selectedAssetId={selectedMediaIds[0] ?? null}
        storage={data.mediaLibrary.storage}
        surface="seller"
        title="Product media"
        usedStorageBytes={data.mediaLibrary.usedStorageBytes}
      />
    </div>
  );
}
