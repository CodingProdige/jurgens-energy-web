"use client";

import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowLeftIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  ImageIcon,
  MonitorIcon,
  PlusIcon,
  SaveIcon,
  SendIcon,
  SmartphoneIcon,
  Trash2Icon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  publishStorefrontDraftAction,
  saveStorefrontDraftAction,
  type StorefrontBuilderActionState,
} from "@/app/(admin)/admin/(dashboard)/marketing/actions";
import {
  DashboardButton,
  dashboardControlClass,
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import { MediaManagerDialog } from "@/components/media/media-manager-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { StorefrontAdminPage } from "@/src/modules/marketplace/storefront";
import type { getAdminMediaLibrary } from "@/src/modules/media/admin";
import type {
  MarketplaceBrandSummary,
  MarketplaceCategorySummary,
} from "@/src/modules/marketplace/catalog";
import {
  createDefaultStorefrontSection,
  storefrontActionVariants,
  storefrontCategoryImageSources,
  storefrontCategoryVisibilityOptions,
  storefrontCollectionLayouts,
  storefrontSectionCodePrefixes,
  storefrontSectionLabels,
  storefrontTitleTags,
  type StorefrontActionVariant,
  type StorefrontButtonAction,
  type StorefrontCategoryImageSource,
  type StorefrontCategoryVisibility,
  type StorefrontCollectionLayout,
  type StorefrontIconKey,
  type StorefrontProductSource,
  type StorefrontSection,
  type StorefrontSectionType,
  type StorefrontTitleTag,
} from "@/src/modules/marketplace/storefront-types";

type PreviewMode = "desktop" | "mobile";
type BuilderChrome = "dashboard" | "dedicated";
type SiteBuilderMediaLibrary = Awaited<ReturnType<typeof getAdminMediaLibrary>>;
type MultiSelectOption = {
  description?: string;
  label: string;
  meta?: string;
  value: string;
};

const productSourceOptions: Array<{
  label: string;
  value: StorefrontProductSource;
}> = [
  { label: "Full cylinders", value: "full_cylinders" },
  { label: "Exchange products", value: "exchange" },
  { label: "Accessories", value: "accessories" },
  { label: "Selected categories", value: "category" },
  { label: "Selected brands", value: "brand" },
  { label: "All products", value: "all" },
];

const collectionLayoutOptions: Array<{
  label: string;
  value: StorefrontCollectionLayout;
}> = storefrontCollectionLayouts.map((layout) => ({
  label: layout === "carousel" ? "Carousel" : "Grid",
  value: layout,
}));

const categoryVisibilityOptions: Array<{
  label: string;
  value: StorefrontCategoryVisibility;
}> = storefrontCategoryVisibilityOptions.map((visibility) => ({
  label:
    visibility === "with_products"
      ? "Only categories with products"
      : "All active categories",
  value: visibility,
}));

const categoryImageSourceOptions: Array<{
  label: string;
  value: StorefrontCategoryImageSource;
}> = storefrontCategoryImageSources.map((source) => ({
  label:
    source === "first_product"
      ? "First product image"
      : "Custom image per category",
  value: source,
}));

const iconOptions: Array<{ label: string; value: StorefrontIconKey }> = [
  { label: "Accessories", value: "accessories" },
  { label: "Certified", value: "certified" },
  { label: "Cylinder", value: "cylinder" },
  { label: "Delivery", value: "delivery" },
  { label: "Exchange", value: "exchange" },
  { label: "Flame", value: "flame" },
  { label: "Support", value: "support" },
];

const actionVariantOptions: Array<{
  label: string;
  value: StorefrontActionVariant;
}> = storefrontActionVariants.map((variant) => ({
  label: variant === "primary" ? "Primary" : "Secondary",
  value: variant,
}));

const titleTagOptions: Array<{ label: string; value: StorefrontTitleTag }> =
  storefrontTitleTags.map((tag) => ({
    label: tag.toUpperCase(),
    value: tag,
  }));

const sectionLibraryGroups: Array<{
  description: string;
  items: Array<{
    description: string;
    title: string;
    type: StorefrontSectionType;
  }>;
  title: string;
}> = [
  {
    description: "Top-of-page brand and campaign sections.",
    items: [
      {
        description: "Large intro section with title, copy, media, and CTAs.",
        title: "Hero",
        type: "hero",
      },
    ],
    title: "Hero",
  },
  {
    description: "Product browsing sections that render catalog items.",
    items: [
      {
        description: "Configurable product rail/grid filtered by product type.",
        title: "Product collection",
        type: "product_collection",
      },
      {
        description:
          "Category rail/grid with product-count filtering and category media.",
        title: "Category collection",
        type: "category_collection",
      },
      {
        description: "Brand rail/grid using logos or product imagery.",
        title: "Brand collection",
        type: "brand_collection",
      },
    ],
    title: "Products",
  },
  {
    description: "Shopping journey helpers and service explanations.",
    items: [
      {
        description: "Three-step cylinder exchange diagram with CTAs.",
        title: "Cylinder exchange",
        type: "cylinder_showcase",
      },
    ],
    title: "Commerce",
  },
  {
    description: "Fast navigation blocks for common shopper paths.",
    items: [
      {
        description: "Compact linked cards for key shopping destinations.",
        title: "Quick actions",
        type: "quick_actions",
      },
    ],
    title: "Navigation",
  },
  {
    description: "Editorial and trust-building content sections.",
    items: [
      {
        description: "Icon-backed feature or value proposition grid.",
        title: "Feature grid",
        type: "feature_grid",
      },
      {
        description: "Latest published blog posts using the canonical blog card.",
        title: "Latest blog posts",
        type: "latest_blog_posts",
      },
    ],
    title: "Content",
  },
];

function getNextSectionComponentCode(
  type: StorefrontSectionType,
  sections: StorefrontSection[],
) {
  const prefix = storefrontSectionCodePrefixes[type];
  const usedComponentCodes = new Set(
    sections.map((section) => section.componentCode),
  );
  let index = 1;
  let componentCode = `${prefix}-${String(index).padStart(2, "0")}`;

  while (usedComponentCodes.has(componentCode)) {
    index += 1;
    componentCode = `${prefix}-${String(index).padStart(2, "0")}`;
  }

  return componentCode;
}

export function StorefrontBuilder({
  brands,
  categories,
  chrome = "dashboard",
  initialPage,
  mediaLibrary,
}: {
  brands: MarketplaceBrandSummary[];
  categories: MarketplaceCategorySummary[];
  chrome?: BuilderChrome;
  initialPage: StorefrontAdminPage;
  mediaLibrary: SiteBuilderMediaLibrary;
}) {
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const [sections, setSections] = useState<StorefrontSection[]>(
    () => structuredClone(initialPage.draftSections),
  );
  const [selectedSectionId, setSelectedSectionId] = useState(
    initialPage.draftSections[0]?.id ?? "",
  );
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(
    null,
  );
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [status, setStatus] = useState<StorefrontBuilderActionState | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const isDedicated = chrome === "dedicated";
  const previewSrc = useMemo(() => {
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin/")
    ) {
      return "/admin/site-builder/preview";
    }

    return "/site-builder/preview";
  }, []);

  const selectedSection = useMemo(
    () =>
      sections.find((section) => section.id === selectedSectionId) ??
      sections[0] ??
      null,
    [sections, selectedSectionId],
  );

  function updateSection(nextSection: StorefrontSection) {
    setSections((current) =>
      current.map((section) =>
        section.id === nextSection.id ? nextSection : section,
      ),
    );
    setStatus(null);
  }

  function addSection(type: StorefrontSectionType) {
    const nextSection = createDefaultStorefrontSection(
      type,
      getNextSectionComponentCode(type, sections),
    );

    setSections((current) => [...current, nextSection]);
    setSelectedSectionId(nextSection.id);
    setIsAddSectionOpen(false);
    setStatus(null);
  }

  function removeSection(sectionId: string) {
    const index = sections.findIndex((section) => section.id === sectionId);
    const nextSections = sections.filter((section) => section.id !== sectionId);

    setSections(nextSections);
    setSelectedSectionId(
      nextSections[Math.max(0, index - 1)]?.id ?? nextSections[0]?.id ?? "",
    );
    setStatus(null);
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    const index = sections.findIndex((section) => section.id === sectionId);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= sections.length) {
      return;
    }

    const nextSections = [...sections];
    const [section] = nextSections.splice(index, 1);

    if (!section) {
      return;
    }

    nextSections.splice(nextIndex, 0, section);
    setSections(nextSections);
    setStatus(null);
  }

  function dropSection(targetSectionId: string) {
    if (!draggingSectionId || draggingSectionId === targetSectionId) {
      setDraggingSectionId(null);
      return;
    }

    const sourceIndex = sections.findIndex(
      (section) => section.id === draggingSectionId,
    );
    const targetIndex = sections.findIndex(
      (section) => section.id === targetSectionId,
    );

    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggingSectionId(null);
      return;
    }

    const nextSections = [...sections];
    const [section] = nextSections.splice(sourceIndex, 1);

    if (section) {
      nextSections.splice(targetIndex, 0, section);
      setSections(nextSections);
      setStatus(null);
    }

    setDraggingSectionId(null);
  }

  function runAction(
    action: (
      nextSections: StorefrontSection[],
    ) => Promise<StorefrontBuilderActionState>,
  ) {
    startTransition(() => {
      void action(sections).then(setStatus).catch((error: unknown) => {
        setStatus({
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "Could not save the storefront.",
        });
      });
    });
  }

  const postPreviewUpdate = useCallback(() => {
    previewFrameRef.current?.contentWindow?.postMessage(
      {
        selectedSectionId: selectedSection?.id ?? null,
        sections,
        type: "site-builder-preview:update",
      },
      window.location.origin,
    );
  }, [sections, selectedSection?.id]);

  useEffect(() => {
    postPreviewUpdate();
  }, [postPreviewUpdate, previewMode]);

  return (
    <div className={cn("min-w-0", isDedicated && "h-full")}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            {initialPage.title}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
            {initialPage.publishedAt
              ? `Last published ${initialPage.publishedAt.toLocaleString()}`
              : "No published version yet."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDedicated ? (
            <BuilderLinkButton href="/marketing">
              <ArrowLeftIcon className="size-3.5" />
              Dashboard View
            </BuilderLinkButton>
          ) : (
            <BuilderLinkButton href="/site-builder">
              <ExternalLinkIcon className="size-3.5" />
              Open Full Builder
            </BuilderLinkButton>
          )}
          <DashboardButton
            disabled={isPending}
            onClick={() => runAction(saveStorefrontDraftAction)}
            type="button"
          >
            <SaveIcon className="size-3.5" />
            Save Draft
          </DashboardButton>
          <DashboardButton
            className="border-[#ff5a1f] bg-[#ff5a1f] text-white hover:bg-[#e84c15] dark:border-[#ff5a1f] dark:bg-[#ff5a1f] dark:text-white"
            disabled={isPending}
            onClick={() => runAction(publishStorefrontDraftAction)}
            type="button"
          >
            <SendIcon className="size-3.5" />
            Publish
          </DashboardButton>
        </div>
      </div>

      {status ? (
        <div
          className={cn(
            "mb-4 rounded-lg border px-4 py-3 text-sm font-semibold",
            status.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
          )}
        >
          {status.message}
        </div>
      ) : null}

      <section
        className={cn(
          "grid min-w-0 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_22rem]",
          isDedicated
            ? "h-[calc(100dvh-8rem)] min-h-[42rem]"
            : "min-h-[calc(100vh-15rem)]",
        )}
      >
        <aside
          className={cn(
            dashboardPanelClass,
            "flex min-w-0 flex-col overflow-hidden",
          )}
        >
          <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <p className="text-sm font-bold text-zinc-950 dark:text-white">
              Home page
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              Drag or move sections to change the landing page order.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {sections.length > 0 ? (
              <div className="grid gap-2">
                {sections.map((section, index) => (
                  <SectionTreeItem
                    index={index}
                    isDragging={draggingSectionId === section.id}
                    isSelected={selectedSection?.id === section.id}
                    key={section.id}
                    onDragStart={() => setDraggingSectionId(section.id)}
                    onDrop={() => dropSection(section.id)}
                    onMoveDown={() => moveSection(section.id, 1)}
                    onMoveUp={() => moveSection(section.id, -1)}
                    onRemove={() => removeSection(section.id)}
                    onSelect={() => setSelectedSectionId(section.id)}
                    onToggle={() =>
                      updateSection({ ...section, enabled: !section.enabled })
                    }
                    section={section}
                    total={sections.length}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 dark:border-white/15 dark:bg-white/[0.03] dark:text-zinc-400">
                No sections yet.
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-3 dark:border-white/10">
            <Button
              className="h-10 w-full justify-center rounded-md border-[#ff5a1f] bg-[#ff5a1f] text-sm font-semibold text-white shadow-none hover:bg-[#e84c15] dark:border-[#ff5a1f] dark:bg-[#ff5a1f] dark:text-white"
              onClick={() => setIsAddSectionOpen(true)}
              type="button"
            >
              <PlusIcon className="size-4" />
              Add Section
            </Button>
          </div>
        </aside>

        <section className={cn(dashboardPanelClass, "min-w-0 overflow-hidden")}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <div>
              <p className="text-sm font-bold text-zinc-950 dark:text-white">
                Preview
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                The same renderer used by the live marketplace home page.
              </p>
            </div>
            <div className="flex rounded-lg border border-slate-300 bg-white p-1 dark:border-white/18 dark:bg-[#101112]">
              <PreviewModeButton
                active={previewMode === "desktop"}
                icon={<MonitorIcon className="size-4" />}
                label="Desktop"
                onClick={() => setPreviewMode("desktop")}
              />
              <PreviewModeButton
                active={previewMode === "mobile"}
                icon={<SmartphoneIcon className="size-4" />}
                label="Mobile"
                onClick={() => setPreviewMode("mobile")}
              />
            </div>
          </div>

          <div
            className={cn(
              "overflow-auto bg-[#edede7] p-3 dark:bg-[#0f1114] sm:p-4",
              isDedicated
                ? "h-[calc(100dvh-13rem)] min-h-[36rem]"
                : "h-[calc(100vh-20rem)] min-h-[36rem]",
            )}
          >
            <div
              className={cn(
                "mx-auto h-full overflow-hidden bg-white text-[#080808] shadow-[0_18px_60px_rgba(8,8,8,0.16)] dark:bg-[#101010] dark:text-[#f7f7f2]",
                previewMode === "mobile"
                  ? "w-[390px] max-w-full"
                  : "w-full max-w-[1180px]",
              )}
            >
              <iframe
                className="h-full w-full border-0 bg-white dark:bg-[#101010]"
                onLoad={postPreviewUpdate}
                ref={previewFrameRef}
                sandbox="allow-same-origin allow-scripts"
                src={previewSrc}
                title="Site builder preview"
              />
            </div>
          </div>
        </section>

        <aside className={cn(dashboardPanelClass, "min-w-0 overflow-hidden")}>
          <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <p className="text-sm font-bold text-zinc-950 dark:text-white">
              Section settings
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {selectedSection
                ? `${storefrontSectionLabels[selectedSection.type]} · ${selectedSection.componentCode}`
                : "Select a section"}
            </p>
          </div>
          <div
            className={cn(
              "overflow-y-auto p-4",
              isDedicated
                ? "h-[calc(100dvh-12rem)] min-h-[36rem]"
                : "h-[calc(100vh-19rem)] min-h-[35rem]",
            )}
          >
            {selectedSection ? (
              <SectionSettingsEditor
                brands={brands}
                categories={categories}
                mediaLibrary={mediaLibrary}
                onChange={updateSection}
                section={selectedSection}
              />
            ) : (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Select a section to edit it.
              </p>
            )}
          </div>
        </aside>
      </section>

      <AddSectionDialog
        onAddSection={addSection}
        onOpenChange={setIsAddSectionOpen}
        open={isAddSectionOpen}
        sections={sections}
      />
    </div>
  );
}

function AddSectionDialog({
  onAddSection,
  onOpenChange,
  open,
  sections,
}: {
  onAddSection: (type: StorefrontSectionType) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sections: StorefrontSection[];
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="h-[min(46rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-[52rem] lg:max-w-[64rem]">
        <DialogHeader className="px-5 pb-4 pt-5 sm:px-6">
          <DialogTitle>Add Section</DialogTitle>
          <DialogDescription>
            Choose a reusable storefront component to add to the home page.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid content-start gap-6 px-5 py-5 sm:px-6">
          {sectionLibraryGroups.map((group) => (
            <section className="grid gap-3" key={group.title}>
              <div className="grid min-w-0 gap-1 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-5">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-950 dark:text-white">
                  {group.title}
                </p>
                <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                  {group.description}
                </p>
              </div>
              <div className="grid gap-3">
                {group.items.map((item) => {
                  const nextComponentCode = getNextSectionComponentCode(
                    item.type,
                    sections,
                  );

                  return (
                    <button
                      className="group grid min-h-[6.75rem] w-full grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-[#ff5a1f] hover:bg-orange-50 dark:border-white/10 dark:bg-[#151719] dark:hover:border-[#ff5a1f] dark:hover:bg-orange-500/10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-5"
                      key={item.type}
                      onClick={() => onAddSection(item.type)}
                      type="button"
                    >
                      <span className="grid min-w-0 gap-2">
                        <span className="min-w-0 text-base font-bold text-zinc-950 dark:text-white">
                          {item.title}
                        </span>
                        <span className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-zinc-400">
                          {item.description}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-3 sm:justify-end">
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] font-bold uppercase text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300">
                          {nextComponentCode}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#ff5a1f] px-3 py-2 text-xs font-bold uppercase text-white shadow-sm transition group-hover:bg-[#e84c15]">
                          <PlusIcon className="size-3.5" />
                          Add component
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function SectionTreeItem({
  index,
  isDragging,
  isSelected,
  onDragStart,
  onDrop,
  onMoveDown,
  onMoveUp,
  onRemove,
  onSelect,
  onToggle,
  section,
  total,
}: {
  index: number;
  isDragging: boolean;
  isSelected: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  onSelect: () => void;
  onToggle: () => void;
  section: StorefrontSection;
  total: number;
}) {
  return (
    <article
      className={cn(
        "group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border p-2 transition",
        isSelected
          ? "border-[#ff5a1f] bg-orange-50 text-[#080808] dark:bg-orange-500/10 dark:text-white"
          : "border-slate-200 bg-white text-zinc-950 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:border-white/20",
        isDragging && "opacity-50",
      )}
      draggable
      onDragOver={(event) => event.preventDefault()}
      onDragStart={onDragStart}
      onDrop={onDrop}
    >
      <button
        aria-label="Select section"
        className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-white/10"
        onClick={onSelect}
        type="button"
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <div className="min-w-0">
        <button
          className="block w-full min-w-0 text-left"
          onClick={onSelect}
          type="button"
        >
          <span className="block truncate text-sm font-bold">
            {getSectionTitle(section)}
          </span>
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-none text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300">
              {section.componentCode}
            </span>
            <span className="truncate">
              {storefrontSectionLabels[section.type]}
            </span>
          </span>
        </button>

        <div className="mt-2 flex flex-wrap gap-1">
          <IconButton
            disabled={index === 0}
            label="Move section up"
            onClick={onMoveUp}
          >
            <ArrowUpIcon className="size-3.5" />
          </IconButton>
          <IconButton
            disabled={index === total - 1}
            label="Move section down"
            onClick={onMoveDown}
          >
            <ArrowDownIcon className="size-3.5" />
          </IconButton>
          <IconButton
            label={section.enabled ? "Hide section" : "Show section"}
            onClick={onToggle}
          >
            {section.enabled ? (
              <EyeIcon className="size-3.5" />
            ) : (
              <EyeOffIcon className="size-3.5" />
            )}
          </IconButton>
          <IconButton
            label="Delete section"
            onClick={onRemove}
          >
            <Trash2Icon className="size-3.5" />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

function IconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="grid size-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] disabled:pointer-events-none disabled:opacity-40 dark:border-white/10 dark:bg-[#151719] dark:text-zinc-300"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function PreviewModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold transition",
        active
          ? "bg-[#ff5a1f] text-white"
          : "text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10",
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function BuilderLinkButton({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <Link
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-[14px] font-normal leading-none",
        dashboardControlClass,
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

function SectionSettingsEditor({
  brands,
  categories,
  mediaLibrary,
  onChange,
  section,
}: {
  brands: MarketplaceBrandSummary[];
  categories: MarketplaceCategorySummary[];
  mediaLibrary: SiteBuilderMediaLibrary;
  onChange: (section: StorefrontSection) => void;
  section: StorefrontSection;
}) {
  function patch(nextSettings: StorefrontSection["settings"]) {
    onChange({
      ...section,
      settings: nextSettings,
    } as StorefrontSection);
  }

  return (
    <div className="grid gap-4">
      <Field label="Section status">
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-semibold text-zinc-950 dark:border-white/10 dark:text-white">
          <input
            checked={section.enabled}
            className="size-4 accent-[#ff5a1f]"
            onChange={(event) =>
              onChange({ ...section, enabled: event.currentTarget.checked })
            }
            type="checkbox"
          />
          Visible on storefront
        </label>
      </Field>

      {section.type === "hero" ? (
        <HeroSettings
          mediaLibrary={mediaLibrary}
          section={section}
          updateSettings={patch}
        />
      ) : null}
      {section.type === "quick_actions" ? (
        <QuickActionSettings section={section} updateSettings={patch} />
      ) : null}
      {section.type === "cylinder_showcase" ? (
        <CylinderShowcaseSettings section={section} updateSettings={patch} />
      ) : null}
      {section.type === "product_collection" ? (
        <ProductCollectionSettings
          brands={brands}
          categories={categories}
          section={section}
          updateSettings={patch}
        />
      ) : null}
      {section.type === "category_collection" ? (
        <CategoryCollectionSettings
          categories={categories}
          mediaLibrary={mediaLibrary}
          section={section}
          updateSettings={patch}
        />
      ) : null}
      {section.type === "brand_collection" ? (
        <BrandCollectionSettings
          brands={brands}
          section={section}
          updateSettings={patch}
        />
      ) : null}
      {section.type === "latest_blog_posts" ? (
        <LatestBlogPostsSettings section={section} updateSettings={patch} />
      ) : null}
      {section.type === "feature_grid" ? (
        <FeatureGridSettings section={section} updateSettings={patch} />
      ) : null}
    </div>
  );
}

function HeroSettings({
  mediaLibrary,
  section,
  updateSettings,
}: {
  mediaLibrary: SiteBuilderMediaLibrary;
  section: Extract<StorefrontSection, { type: "hero" }>;
  updateSettings: (settings: StorefrontSection["settings"]) => void;
}) {
  const settings = section.settings;

  return (
    <>
      <TextField
        label="Heading"
        onChange={(heading) => updateSettings({ ...settings, heading })}
        value={settings.heading}
      />
      <TextField
        help="Separate highlighted words with a pipe, for example full|exchange."
        label="Accent words"
        onChange={(accentText) => updateSettings({ ...settings, accentText })}
        value={settings.accentText}
      />
      <TitleStyleFields
        label="Heading"
        onChange={({ size, tag }) =>
          updateSettings({
            ...settings,
            headingSize: size,
            headingTag: tag,
          })
        }
        size={settings.headingSize}
        tag={settings.headingTag}
      />
      <TextareaField
        label="Supporting copy"
        onChange={(copy) => updateSettings({ ...settings, copy })}
        value={settings.copy}
      />
      <ButtonActionSettings
        actions={settings.actions}
        addHref="#products"
        addLabel="New Action"
        description="Add, remove, and order hero buttons."
        onChange={(actions) => updateSettings({ ...settings, actions })}
        title="Actions"
      />
      <MediaImageField
        altValue={settings.imageAlt}
        imageUrl={settings.imageUrl}
        label="Hero image"
        mediaLibrary={mediaLibrary}
        onImageChange={(imageUrl, imageAlt) =>
          updateSettings({
            ...settings,
            imageAlt: imageAlt ?? settings.imageAlt,
            imageUrl,
          })
        }
      />
      <TextField
        label="Hero image alt text"
        onChange={(imageAlt) => updateSettings({ ...settings, imageAlt })}
        value={settings.imageAlt}
      />
    </>
  );
}

function ButtonActionSettings({
  addHref,
  addLabel,
  actions,
  description,
  onChange,
  title,
}: {
  actions: StorefrontButtonAction[];
  addHref: string;
  addLabel: string;
  description: string;
  onChange: (actions: StorefrontButtonAction[]) => void;
  title: string;
}) {
  function updateAction(index: number, nextAction: StorefrontButtonAction) {
    onChange(
      actions.map((action, actionIndex) =>
        actionIndex === index ? nextAction : action,
      ),
    );
  }

  function addAction() {
    onChange([
      ...actions,
      {
        href: addHref,
        label: addLabel,
        variant: actions.length === 0 ? "primary" : "secondary",
      },
    ]);
  }

  function removeAction(index: number) {
    onChange(actions.filter((_, actionIndex) => actionIndex !== index));
  }

  function moveAction(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= actions.length) {
      return;
    }

    const nextActions = [...actions];
    const [action] = nextActions.splice(index, 1);

    if (!action) {
      return;
    }

    nextActions.splice(nextIndex, 0, action);
    onChange(nextActions);
  }

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-950 dark:text-white">
            {title}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
        <Button
          className="h-8 shrink-0 rounded-md border-slate-300 bg-white px-2.5 text-xs font-semibold text-zinc-950 shadow-none hover:bg-slate-50 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10"
          disabled={actions.length >= 6}
          onClick={addAction}
          type="button"
          variant="outline"
        >
          <PlusIcon className="size-3.5" />
          Add Action
        </Button>
      </div>

      {actions.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500 dark:border-white/15 dark:bg-[#151719] dark:text-zinc-400">
          No actions.
        </p>
      ) : null}

      {actions.map((action, index) => (
        <NestedEditorGroup
          headerAction={
            <div className="flex shrink-0 gap-1">
              <IconButton
                disabled={index === 0}
                label="Move action up"
                onClick={() => moveAction(index, -1)}
              >
                <ArrowUpIcon className="size-3.5" />
              </IconButton>
              <IconButton
                disabled={index === actions.length - 1}
                label="Move action down"
                onClick={() => moveAction(index, 1)}
              >
                <ArrowDownIcon className="size-3.5" />
              </IconButton>
              <IconButton
                label="Remove action"
                onClick={() => removeAction(index)}
              >
                <Trash2Icon className="size-3.5" />
              </IconButton>
            </div>
          }
          key={`${action.label}-${action.href}-${index}`}
          title={`Action ${index + 1}`}
        >
          <TextField
            label="Label"
            onChange={(label) => updateAction(index, { ...action, label })}
            value={action.label}
          />
          <LinkDestinationField
            onChange={(href) => updateAction(index, { ...action, href })}
            value={action.href}
          />
          <SelectField
            label="Style"
            onChange={(variant) =>
              updateAction(index, {
                ...action,
                variant: variant as StorefrontActionVariant,
              })
            }
            options={actionVariantOptions}
            value={action.variant}
          />
        </NestedEditorGroup>
      ))}
    </section>
  );
}

function QuickActionSettings({
  section,
  updateSettings,
}: {
  section: Extract<StorefrontSection, { type: "quick_actions" }>;
  updateSettings: (settings: StorefrontSection["settings"]) => void;
}) {
  const settings = section.settings;

  function updateAction(
    index: number,
    nextAction: (typeof settings.actions)[number],
  ) {
    updateSettings({
      ...settings,
      actions: settings.actions.map((action, actionIndex) =>
        actionIndex === index ? nextAction : action,
      ),
    });
  }

  function addAction() {
    updateSettings({
      ...settings,
      actions: [
        ...settings.actions,
        {
          description: "Describe this action.",
          href: "#products",
          icon: "cylinder",
          title: "New Action",
        },
      ],
    });
  }

  function removeAction(index: number) {
    updateSettings({
      ...settings,
      actions: settings.actions.filter(
        (_, actionIndex) => actionIndex !== index,
      ),
    });
  }

  function moveAction(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= settings.actions.length) {
      return;
    }

    const nextActions = [...settings.actions];
    const [action] = nextActions.splice(index, 1);

    if (!action) {
      return;
    }

    nextActions.splice(nextIndex, 0, action);
    updateSettings({ ...settings, actions: nextActions });
  }

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-950 dark:text-white">
            Cards
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Add, remove, and order quick action cards.
          </p>
        </div>
        <Button
          className="h-8 shrink-0 rounded-md border-slate-300 bg-white px-2.5 text-xs font-semibold text-zinc-950 shadow-none hover:bg-slate-50 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10"
          disabled={settings.actions.length >= 6}
          onClick={addAction}
          type="button"
          variant="outline"
        >
          <PlusIcon className="size-3.5" />
          Add Card
        </Button>
      </div>

      {settings.actions.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500 dark:border-white/15 dark:bg-[#151719] dark:text-zinc-400">
          No cards.
        </p>
      ) : null}

      {settings.actions.map((action, index) => (
        <NestedEditorGroup
          headerAction={
            <div className="flex shrink-0 gap-1">
              <IconButton
                disabled={index === 0}
                label="Move card up"
                onClick={() => moveAction(index, -1)}
              >
                <ArrowUpIcon className="size-3.5" />
              </IconButton>
              <IconButton
                disabled={index === settings.actions.length - 1}
                label="Move card down"
                onClick={() => moveAction(index, 1)}
              >
                <ArrowDownIcon className="size-3.5" />
              </IconButton>
              <IconButton
                label="Remove card"
                onClick={() => removeAction(index)}
              >
                <Trash2Icon className="size-3.5" />
              </IconButton>
            </div>
          }
          key={`${action.title}-${index}`}
          title={`Card ${index + 1}`}
        >
          <TextField
            label="Title"
            onChange={(title) => updateAction(index, { ...action, title })}
            value={action.title}
          />
          <TextareaField
            label="Description"
            onChange={(description) =>
              updateAction(index, { ...action, description })
            }
            value={action.description}
          />
          <LinkDestinationField
            onChange={(href) => updateAction(index, { ...action, href })}
            value={action.href}
          />
          <SelectField
            label="Icon"
            onChange={(icon) =>
              updateAction(index, {
                ...action,
                icon: icon as StorefrontIconKey,
              })
            }
            options={iconOptions}
            value={action.icon}
          />
        </NestedEditorGroup>
      ))}
    </section>
  );
}

function CylinderShowcaseSettings({
  section,
  updateSettings,
}: {
  section: Extract<StorefrontSection, { type: "cylinder_showcase" }>;
  updateSettings: (settings: StorefrontSection["settings"]) => void;
}) {
  const settings = section.settings;

  function updateStep(index: number, nextStep: (typeof settings.steps)[number]) {
    updateSettings({
      ...settings,
      steps: settings.steps.map((step, stepIndex) =>
        stepIndex === index ? nextStep : step,
      ),
    });
  }

  return (
    <>
      <TextField
        label="Exchange title"
        onChange={(exchangeTitle) =>
          updateSettings({ ...settings, exchangeTitle })
        }
        value={settings.exchangeTitle}
      />
      <TitleStyleFields
        label="Exchange title"
        max={44}
        min={16}
        onChange={({ size, tag }) =>
          updateSettings({
            ...settings,
            exchangeTitleSize: size,
            exchangeTitleTag: tag,
          })
        }
        size={settings.exchangeTitleSize}
        tag={settings.exchangeTitleTag}
      />
      <ButtonActionSettings
        actions={settings.actions}
        addHref="#exchange"
        addLabel="Exchange My Empty"
        description="Add, remove, and order exchange buttons."
        onChange={(actions) => updateSettings({ ...settings, actions })}
        title="Exchange actions"
      />
      <div className="grid gap-3">
        {settings.steps.map((step, index) => (
          <NestedEditorGroup key={`${step.title}-${index}`} title={`Step ${index + 1}`}>
            <TextField
              label="Title"
              onChange={(title) => updateStep(index, { ...step, title })}
              value={step.title}
            />
            <TextareaField
              label="Description"
              onChange={(description) =>
                updateStep(index, { ...step, description })
              }
              value={step.description}
            />
            <SelectField
              label="Icon"
              onChange={(icon) =>
                updateStep(index, { ...step, icon: icon as StorefrontIconKey })
              }
              options={iconOptions}
              value={step.icon}
            />
          </NestedEditorGroup>
        ))}
      </div>
    </>
  );
}

function ProductCollectionSettings({
  brands,
  categories,
  section,
  updateSettings,
}: {
  brands: MarketplaceBrandSummary[];
  categories: MarketplaceCategorySummary[];
  section: Extract<StorefrontSection, { type: "product_collection" }>;
  updateSettings: (settings: StorefrontSection["settings"]) => void;
}) {
  const settings = section.settings;
  const categoryOptions = categories.map(toCategorySelectOption);
  const brandOptions = brands.map(toBrandSelectOption);
  const updateSettingsWithAutoAction = (
    nextSettings: typeof settings,
  ) => {
    updateSettings(
      applyProductCollectionAutoAction({
        brands,
        categories,
        fallbackSectionId: section.id,
        settings: nextSettings,
      }),
    );
  };

  return (
    <>
      <TextField
        label="Eyebrow"
        onChange={(eyebrow) => updateSettings({ ...settings, eyebrow })}
        value={settings.eyebrow}
      />
      <TextField
        label="Title"
        onChange={(title) => updateSettings({ ...settings, title })}
        value={settings.title}
      />
      <TitleStyleFields
        label="Title"
        max={48}
        min={18}
        onChange={({ size, tag }) =>
          updateSettings({
            ...settings,
            titleSize: size,
            titleTag: tag,
          })
        }
        size={settings.titleSize}
        tag={settings.titleTag}
      />
      <SelectField
        label="Layout"
        onChange={(layout) =>
          updateSettings({
            ...settings,
            layout: layout as StorefrontCollectionLayout,
          })
        }
        options={collectionLayoutOptions}
        value={settings.layout}
      />
      <SelectField
        label="Product source"
        onChange={(productSource) =>
          updateSettingsWithAutoAction({
            ...settings,
            productSource: productSource as StorefrontProductSource,
          })
        }
        options={productSourceOptions}
        value={settings.productSource}
      />
      {settings.productSource === "category" ? (
        <MultiSelectField
          emptyLabel="No active categories found."
          help="Leave empty to include every product with a category."
          label="Categories"
          onChange={(selectedCategoryIds) =>
            updateSettingsWithAutoAction({ ...settings, selectedCategoryIds })
          }
          options={categoryOptions}
          selectedValues={settings.selectedCategoryIds}
        />
      ) : null}
      {settings.productSource === "brand" ? (
        <MultiSelectField
          emptyLabel="No active brands found."
          help="Leave empty to include every product with a brand."
          label="Brands"
          onChange={(selectedBrandIds) =>
            updateSettingsWithAutoAction({ ...settings, selectedBrandIds })
          }
          options={brandOptions}
          selectedValues={settings.selectedBrandIds}
        />
      ) : null}
      <NumberField
        label="Product limit"
        max={12}
        min={1}
        onChange={(productLimit) =>
          updateSettings({ ...settings, productLimit })
        }
        value={settings.productLimit}
      />
      <ButtonActionSettings
        actions={settings.actions}
        addHref={`#${section.id}`}
        addLabel="View All"
        description="Add, remove, and order collection buttons."
        onChange={(actions) => updateSettings({ ...settings, actions })}
        title="Collection actions"
      />
    </>
  );
}

function applyProductCollectionAutoAction({
  brands,
  categories,
  fallbackSectionId,
  settings,
}: {
  brands: MarketplaceBrandSummary[];
  categories: MarketplaceCategorySummary[];
  fallbackSectionId: string;
  settings: Extract<
    StorefrontSection,
    { type: "product_collection" }
  >["settings"];
}) {
  const autoAction = getProductCollectionAutoAction({
    brands,
    categories,
    fallbackSectionId,
    settings,
  });
  const [currentAction, ...restActions] = settings.actions;

  return {
    ...settings,
    actions: [
      {
        href: autoAction.href,
        label: autoAction.label,
        variant: currentAction?.variant ?? "secondary",
      },
      ...restActions,
    ],
  };
}

function getProductCollectionAutoAction({
  brands,
  categories,
  fallbackSectionId,
  settings,
}: {
  brands: MarketplaceBrandSummary[];
  categories: MarketplaceCategorySummary[];
  fallbackSectionId: string;
  settings: Extract<
    StorefrontSection,
    { type: "product_collection" }
  >["settings"];
}): Pick<StorefrontButtonAction, "href" | "label"> {
  if (settings.productSource === "accessories") {
    return {
      href: "#accessories",
      label: "View All Accessories",
    };
  }

  if (settings.productSource === "exchange") {
    return {
      href: "#exchange",
      label: "View Exchange Products",
    };
  }

  if (settings.productSource === "full_cylinders") {
    return {
      href: "#products",
      label: "View Full Cylinders",
    };
  }

  if (settings.productSource === "category") {
    const [selectedCategoryId] = settings.selectedCategoryIds;
    const selectedCategory =
      settings.selectedCategoryIds.length === 1
        ? categories.find((category) => category.id === selectedCategoryId)
        : null;

    if (selectedCategory) {
      return {
        href: `/categories/${selectedCategory.slug}`,
        label: `View All ${selectedCategory.name}`,
      };
    }

    return {
      href: `#${fallbackSectionId}`,
      label: "View Category Products",
    };
  }

  if (settings.productSource === "brand") {
    const [selectedBrandId] = settings.selectedBrandIds;
    const selectedBrand =
      settings.selectedBrandIds.length === 1
        ? brands.find((brand) => brand.id === selectedBrandId)
        : null;

    if (selectedBrand) {
      return {
        href: `/?brand=${selectedBrand.slug}#products`,
        label: `View All ${selectedBrand.name}`,
      };
    }

    return {
      href: `#${fallbackSectionId}`,
      label: "View Brand Products",
    };
  }

  return {
    href: "#products",
    label: "View All Products",
  };
}

function CategoryCollectionSettings({
  categories,
  mediaLibrary,
  section,
  updateSettings,
}: {
  categories: MarketplaceCategorySummary[];
  mediaLibrary: SiteBuilderMediaLibrary;
  section: Extract<StorefrontSection, { type: "category_collection" }>;
  updateSettings: (settings: StorefrontSection["settings"]) => void;
}) {
  const settings = section.settings;
  const categoryOptions = categories.map(toCategorySelectOption);
  const visibleCategories = getVisibleCategoryOptionsForImageOverrides({
    categories,
    categoryLimit: settings.categoryLimit,
    categoryVisibility: settings.categoryVisibility,
    selectedCategoryIds: settings.selectedCategoryIds,
  });

  return (
    <>
      <TextField
        label="Eyebrow"
        onChange={(eyebrow) => updateSettings({ ...settings, eyebrow })}
        value={settings.eyebrow}
      />
      <TextField
        label="Title"
        onChange={(title) => updateSettings({ ...settings, title })}
        value={settings.title}
      />
      <TitleStyleFields
        label="Title"
        max={48}
        min={18}
        onChange={({ size, tag }) =>
          updateSettings({
            ...settings,
            titleSize: size,
            titleTag: tag,
          })
        }
        size={settings.titleSize}
        tag={settings.titleTag}
      />
      <SelectField
        label="Layout"
        onChange={(layout) =>
          updateSettings({
            ...settings,
            layout: layout as StorefrontCollectionLayout,
          })
        }
        options={collectionLayoutOptions}
        value={settings.layout}
      />
      <SelectField
        label="Category visibility"
        onChange={(categoryVisibility) =>
          updateSettings({
            ...settings,
            categoryVisibility:
              categoryVisibility as StorefrontCategoryVisibility,
          })
        }
        options={categoryVisibilityOptions}
        value={settings.categoryVisibility}
      />
      <MultiSelectField
        emptyLabel="No active categories found."
        help="Leave empty to use all categories matching the visibility setting."
        label="Categories"
        onChange={(selectedCategoryIds) =>
          updateSettings({ ...settings, selectedCategoryIds })
        }
        options={categoryOptions}
        selectedValues={settings.selectedCategoryIds}
      />
      <NumberField
        label="Category limit"
        max={24}
        min={1}
        onChange={(categoryLimit) =>
          updateSettings({ ...settings, categoryLimit })
        }
        value={settings.categoryLimit}
      />
      <SelectField
        label="Image source"
        onChange={(imageSource) =>
          updateSettings({
            ...settings,
            imageSource: imageSource as StorefrontCategoryImageSource,
          })
        }
        options={categoryImageSourceOptions}
        value={settings.imageSource}
      />
      {settings.imageSource === "custom" ? (
        <CategoryImageOverrideSettings
          categories={visibleCategories}
          categoryImages={settings.categoryImages}
          mediaLibrary={mediaLibrary}
          onChange={(categoryImages) =>
            updateSettings({ ...settings, categoryImages })
          }
        />
      ) : null}
      <ButtonActionSettings
        actions={settings.actions}
        addHref={`#${section.id}`}
        addLabel="View All Categories"
        description="Add, remove, and order category collection buttons."
        onChange={(actions) => updateSettings({ ...settings, actions })}
        title="Collection actions"
      />
    </>
  );
}

function BrandCollectionSettings({
  brands,
  section,
  updateSettings,
}: {
  brands: MarketplaceBrandSummary[];
  section: Extract<StorefrontSection, { type: "brand_collection" }>;
  updateSettings: (settings: StorefrontSection["settings"]) => void;
}) {
  const settings = section.settings;
  const brandOptions = brands.map(toBrandSelectOption);

  return (
    <>
      <TextField
        label="Eyebrow"
        onChange={(eyebrow) => updateSettings({ ...settings, eyebrow })}
        value={settings.eyebrow}
      />
      <TextField
        label="Title"
        onChange={(title) => updateSettings({ ...settings, title })}
        value={settings.title}
      />
      <TitleStyleFields
        label="Title"
        max={48}
        min={18}
        onChange={({ size, tag }) =>
          updateSettings({
            ...settings,
            titleSize: size,
            titleTag: tag,
          })
        }
        size={settings.titleSize}
        tag={settings.titleTag}
      />
      <SelectField
        label="Layout"
        onChange={(layout) =>
          updateSettings({
            ...settings,
            layout: layout as StorefrontCollectionLayout,
          })
        }
        options={collectionLayoutOptions}
        value={settings.layout}
      />
      <MultiSelectField
        emptyLabel="No active brands found."
        help="Leave empty to show all active brands."
        label="Brands"
        onChange={(selectedBrandIds) =>
          updateSettings({ ...settings, selectedBrandIds })
        }
        options={brandOptions}
        selectedValues={settings.selectedBrandIds}
      />
      <NumberField
        label="Brand limit"
        max={24}
        min={1}
        onChange={(brandLimit) => updateSettings({ ...settings, brandLimit })}
        value={settings.brandLimit}
      />
      <ButtonActionSettings
        actions={settings.actions}
        addHref={`#${section.id}`}
        addLabel="View All Brands"
        description="Add, remove, and order brand collection buttons."
        onChange={(actions) => updateSettings({ ...settings, actions })}
        title="Collection actions"
      />
    </>
  );
}

function LatestBlogPostsSettings({
  section,
  updateSettings,
}: {
  section: Extract<StorefrontSection, { type: "latest_blog_posts" }>;
  updateSettings: (settings: StorefrontSection["settings"]) => void;
}) {
  const settings = section.settings;

  return (
    <>
      <TextField
        label="Eyebrow"
        onChange={(eyebrow) => updateSettings({ ...settings, eyebrow })}
        value={settings.eyebrow}
      />
      <TextField
        label="Title"
        onChange={(title) => updateSettings({ ...settings, title })}
        value={settings.title}
      />
      <TitleStyleFields
        label="Title"
        max={48}
        min={18}
        onChange={({ size, tag }) =>
          updateSettings({
            ...settings,
            titleSize: size,
            titleTag: tag,
          })
        }
        size={settings.titleSize}
        tag={settings.titleTag}
      />
      <SelectField
        label="Layout"
        onChange={(layout) =>
          updateSettings({
            ...settings,
            layout: layout as StorefrontCollectionLayout,
          })
        }
        options={collectionLayoutOptions}
        value={settings.layout}
      />
      <NumberField
        label="Post limit"
        max={12}
        min={1}
        onChange={(postLimit) => updateSettings({ ...settings, postLimit })}
        value={settings.postLimit}
      />
      <ButtonActionSettings
        actions={settings.actions}
        addHref="/blog"
        addLabel="View All Posts"
        description="Add, remove, and order blog section links."
        onChange={(actions) => updateSettings({ ...settings, actions })}
        title="Blog actions"
      />
    </>
  );
}

function toCategorySelectOption(
  category: MarketplaceCategorySummary,
): MultiSelectOption {
  return {
    description: category.path,
    label: category.name,
    meta: `${category.productCount} products`,
    value: category.id,
  };
}

function toBrandSelectOption(brand: MarketplaceBrandSummary): MultiSelectOption {
  return {
    label: brand.name,
    meta: `${brand.productCount} products`,
    value: brand.id,
  };
}

function getVisibleCategoryOptionsForImageOverrides({
  categories,
  categoryLimit,
  categoryVisibility,
  selectedCategoryIds,
}: {
  categories: MarketplaceCategorySummary[];
  categoryLimit: number;
  categoryVisibility: StorefrontCategoryVisibility;
  selectedCategoryIds: string[];
}) {
  const selectedCategoryIdSet = new Set(selectedCategoryIds);

  return categories
    .filter(
      (category) =>
        selectedCategoryIdSet.size === 0 ||
        selectedCategoryIdSet.has(category.id),
    )
    .filter(
      (category) =>
        categoryVisibility === "all" || category.productCount > 0,
    )
    .slice(0, categoryLimit);
}

function CategoryImageOverrideSettings({
  categories,
  categoryImages,
  mediaLibrary,
  onChange,
}: {
  categories: MarketplaceCategorySummary[];
  categoryImages: Extract<
    StorefrontSection,
    { type: "category_collection" }
  >["settings"]["categoryImages"];
  mediaLibrary: SiteBuilderMediaLibrary;
  onChange: (
    categoryImages: Extract<
      StorefrontSection,
      { type: "category_collection" }
    >["settings"]["categoryImages"],
  ) => void;
}) {
  const imageByCategoryId = new Map(
    categoryImages.map((image) => [image.categoryId, image]),
  );

  function updateCategoryImage({
    category,
    imageAlt,
    imageUrl,
  }: {
    category: MarketplaceCategorySummary;
    imageAlt?: string;
    imageUrl: string;
  }) {
    const trimmedImageUrl = imageUrl.trim();
    const currentImage = imageByCategoryId.get(category.id);

    if (!trimmedImageUrl) {
      onChange(
        categoryImages.filter((image) => image.categoryId !== category.id),
      );
      return;
    }

    const nextImage = {
      categoryId: category.id,
      imageAlt:
        imageAlt ?? currentImage?.imageAlt ?? `${category.name} category`,
      imageUrl: trimmedImageUrl,
    };

    onChange(
      currentImage
        ? categoryImages.map((image) =>
            image.categoryId === category.id ? nextImage : image,
          )
        : [...categoryImages, nextImage],
    );
  }

  return (
    <NestedEditorGroup title="Category images">
      {categories.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500 dark:border-white/15 dark:bg-[#151719] dark:text-zinc-400">
          No categories match the current section rules.
        </p>
      ) : null}
      {categories.map((category) => {
        const currentImage = imageByCategoryId.get(category.id);

        return (
          <MediaImageField
            altValue={currentImage?.imageAlt ?? `${category.name} category`}
            imageUrl={currentImage?.imageUrl ?? category.firstProductImageUrl ?? ""}
            key={category.id}
            label={category.name}
            mediaLibrary={mediaLibrary}
            onImageChange={(imageUrl, imageAlt) =>
              updateCategoryImage({ category, imageAlt, imageUrl })
            }
          />
        );
      })}
    </NestedEditorGroup>
  );
}

function FeatureGridSettings({
  section,
  updateSettings,
}: {
  section: Extract<StorefrontSection, { type: "feature_grid" }>;
  updateSettings: (settings: StorefrontSection["settings"]) => void;
}) {
  const settings = section.settings;

  function updateFeature(
    index: number,
    nextFeature: (typeof settings.features)[number],
  ) {
    updateSettings({
      ...settings,
      features: settings.features.map((feature, featureIndex) =>
        featureIndex === index ? nextFeature : feature,
      ),
    });
  }

  return (
    <>
      <TextField
        label="Eyebrow"
        onChange={(eyebrow) => updateSettings({ ...settings, eyebrow })}
        value={settings.eyebrow}
      />
      <TextareaField
        label="Title"
        onChange={(title) => updateSettings({ ...settings, title })}
        value={settings.title}
      />
      <TitleStyleFields
        label="Title"
        max={56}
        min={20}
        onChange={({ size, tag }) =>
          updateSettings({
            ...settings,
            titleSize: size,
            titleTag: tag,
          })
        }
        size={settings.titleSize}
        tag={settings.titleTag}
      />
      <div className="grid gap-3">
        {settings.features.map((feature, index) => (
          <NestedEditorGroup
            key={`${feature.title}-${index}`}
            title={`Feature ${index + 1}`}
          >
            <TextField
              label="Title"
              onChange={(title) => updateFeature(index, { ...feature, title })}
              value={feature.title}
            />
            <TextareaField
              label="Text"
              onChange={(text) => updateFeature(index, { ...feature, text })}
              value={feature.text}
            />
            <SelectField
              label="Icon"
              onChange={(icon) =>
                updateFeature(index, {
                  ...feature,
                  icon: icon as StorefrontIconKey,
                })
              }
              options={iconOptions}
              value={feature.icon}
            />
          </NestedEditorGroup>
        ))}
      </div>
    </>
  );
}

function TitleStyleFields({
  label,
  max = 72,
  min = 28,
  onChange,
  size,
  tag,
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: { size: number; tag: StorefrontTitleTag }) => void;
  size: number;
  tag: StorefrontTitleTag;
}) {
  return (
    <NestedEditorGroup title={`${label} style`}>
      <SelectField
        label="Element tag"
        onChange={(nextTag) =>
          onChange({ size, tag: nextTag as StorefrontTitleTag })
        }
        options={titleTagOptions}
        value={tag}
      />
      <RangeField
        label="Font size"
        max={max}
        min={min}
        onChange={(nextSize) => onChange({ size: nextSize, tag })}
        value={size}
      />
    </NestedEditorGroup>
  );
}

function RangeField({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <Field label={label}>
      <div className="flex min-w-0 items-center gap-3">
        <input
          className="min-w-0 flex-1 accent-[#ff5a1f]"
          max={max}
          min={min}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          type="range"
          value={value}
        />
        <span className="w-12 shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs font-bold text-zinc-950 dark:border-white/10 dark:bg-[#151719] dark:text-white">
          {value}px
        </span>
      </div>
    </Field>
  );
}

function Field({
  children,
  help,
  label,
}: {
  children: ReactNode;
  help?: string;
  label: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600 dark:text-zinc-400">
        {label}
      </Label>
      {children}
      {help ? <p className="text-xs text-slate-500 dark:text-zinc-400">{help}</p> : null}
    </div>
  );
}

function MultiSelectField({
  emptyLabel,
  help,
  label,
  onChange,
  options,
  selectedValues,
}: {
  emptyLabel: string;
  help?: string;
  label: string;
  onChange: (selectedValues: string[]) => void;
  options: MultiSelectOption[];
  selectedValues: string[];
}) {
  const selectedValueSet = new Set(selectedValues);

  function toggleValue(value: string, checked: boolean) {
    onChange(
      checked
        ? [...selectedValues, value]
        : selectedValues.filter((selectedValue) => selectedValue !== value),
    );
  }

  return (
    <Field help={help} label={label}>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-[#151719]">
        {options.length === 0 ? (
          <p className="p-3 text-sm text-slate-500 dark:text-zinc-400">
            {emptyLabel}
          </p>
        ) : (
          <div className="grid max-h-64 overflow-y-auto">
            {options.map((option) => (
              <label
                className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-slate-100 p-3 text-sm last:border-b-0 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.04]"
                key={option.value}
              >
                <input
                  checked={selectedValueSet.has(option.value)}
                  className="mt-0.5 size-4 accent-[#ff5a1f]"
                  onChange={(event) =>
                    toggleValue(option.value, event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span className="grid min-w-0 gap-1">
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate font-semibold text-zinc-950 dark:text-white">
                      {option.label}
                    </span>
                    {option.meta ? (
                      <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-white/10 dark:text-zinc-300">
                        {option.meta}
                      </span>
                    ) : null}
                  </span>
                  {option.description ? (
                    <span className="truncate text-xs text-slate-500 dark:text-zinc-400">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        )}
        {selectedValues.length > 0 ? (
          <div className="border-t border-slate-200 p-2 dark:border-white/10">
            <Button
              className="h-8 rounded-md border-slate-300 bg-white px-2.5 text-xs font-semibold text-zinc-950 shadow-none hover:bg-slate-50 dark:border-white/18 dark:bg-[#101112] dark:text-white dark:hover:bg-white/10"
              onClick={() => onChange([])}
              type="button"
              variant="outline"
            >
              Clear selection
            </Button>
          </div>
        ) : null}
      </div>
    </Field>
  );
}

function TextField({
  help,
  label,
  onChange,
  value,
}: {
  help?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Field help={help} label={label}>
      <Input
        className={cn("h-10 rounded-lg text-sm", dashboardControlClass)}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      />
    </Field>
  );
}

function LinkDestinationField({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <TextField
      help="Use #section, /relative-path, ?query=value, https://example.com, mailto:, or tel:."
      label="Link destination"
      onChange={onChange}
      value={value}
    />
  );
}

function MediaImageField({
  altValue,
  imageUrl,
  label,
  mediaLibrary,
  onImageChange,
}: {
  altValue: string;
  imageUrl: string;
  label: string;
  mediaLibrary: SiteBuilderMediaLibrary;
  onImageChange: (imageUrl: string, imageAlt?: string) => void;
}) {
  const [isMediaManagerOpen, setIsMediaManagerOpen] = useState(false);
  const selectedAsset =
    mediaLibrary.assets.find((asset) => asset.publicUrl === imageUrl) ?? null;

  function selectImageAsset(asset: SiteBuilderMediaLibrary["assets"][number]) {
    onImageChange(
      asset.publicUrl,
      altValue.trim()
        ? undefined
        : (asset.altText ?? asset.originalFileName ?? undefined),
    );
    setIsMediaManagerOpen(false);
  }

  return (
    <Field
      help="Choose from the canonical media manager, or enter an approved relative path/full URL manually."
      label={label}
    >
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="relative aspect-[16/9] bg-white dark:bg-[#101010]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={altValue || ""}
              className="size-full object-contain"
              src={imageUrl}
            />
          ) : (
            <div className="grid size-full place-items-center text-slate-400 dark:text-zinc-500">
              <ImageIcon className="size-8" />
            </div>
          )}
        </div>
        <div className="grid gap-2 border-t border-slate-200 p-3 dark:border-white/10">
          <Button
            className="h-9 justify-center rounded-md border-slate-300 bg-white text-sm font-semibold text-zinc-950 shadow-none hover:bg-slate-50 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10"
            onClick={() => setIsMediaManagerOpen(true)}
            type="button"
            variant="outline"
          >
            <ImageIcon className="size-4" />
            Choose From Media Manager
          </Button>
          <Input
            className={cn("h-10 rounded-lg text-sm", dashboardControlClass)}
            onChange={(event) => onImageChange(event.currentTarget.value)}
            placeholder="/media/admin-media/..."
            value={imageUrl}
          />
        </div>
      </div>

      <MediaManagerDialog
        acceptedMediaTypes={["image"]}
        assets={mediaLibrary.assets}
        folders={mediaLibrary.folders}
        onOpenChange={setIsMediaManagerOpen}
        onSelect={selectImageAsset}
        open={isMediaManagerOpen}
        selectedAssetId={selectedAsset?.id}
        storage={mediaLibrary.storage}
        surface="admin"
        title={`Select ${label.toLowerCase()}`}
        usedStorageBytes={mediaLibrary.usedStorageBytes}
      />
    </Field>
  );
}

function TextareaField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Field label={label}>
      <Textarea
        className={cn("min-h-24 rounded-lg text-sm", dashboardControlClass)}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      />
    </Field>
  );
}

function NumberField({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <Field label={label}>
      <Input
        className={cn("h-10 rounded-lg text-sm", dashboardControlClass)}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.currentTarget.value) || min)}
        type="number"
        value={value}
      />
    </Field>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <Field label={label}>
      <select
        className={cn(
          "h-10 w-full rounded-lg border px-3 text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/20",
          dashboardControlClass,
        )}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function NestedEditorGroup({
  children,
  headerAction,
  title,
}: {
  children: ReactNode;
  headerAction?: ReactNode;
  title: string;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 text-xs font-bold uppercase tracking-[0.08em] text-zinc-950 dark:text-white">
          {title}
        </p>
        {headerAction}
      </div>
      {children}
    </section>
  );
}

function getSectionTitle(section: StorefrontSection) {
  if (section.type === "hero") {
    return section.settings.heading;
  }

  if (section.type === "quick_actions") {
    return "Quick action cards";
  }

  if (section.type === "cylinder_showcase") {
    return section.settings.exchangeTitle;
  }

  if (section.type === "product_collection") {
    return section.settings.title;
  }

  return section.settings.title;
}
