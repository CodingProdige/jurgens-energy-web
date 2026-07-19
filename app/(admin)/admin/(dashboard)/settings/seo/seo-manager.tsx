"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  FileTextIcon,
  HistoryIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  SaveIcon,
  ScanSearchIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  generateSeoSuggestionAction,
  getSeoRevisionHistoryAction,
  restoreSeoRevisionAction,
  saveSeoMetadataAction,
} from "@/app/(admin)/admin/(dashboard)/settings/seo/actions";
import type {
  SeoAdminPageView,
  SeoRevisionView,
  SeoSuggestionView,
} from "@/app/(admin)/admin/(dashboard)/settings/seo/seo-types";
import {
  DashboardButton,
  DashboardInput,
  dashboardControlClass,
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const TITLE_SOFT_MIN = 30;
const TITLE_SOFT_MAX = 60;
const DESCRIPTION_SOFT_MIN = 110;
const DESCRIPTION_SOFT_MAX = 160;
const SITE_NAME = "Jurgens Energy";

type StatusMessage = {
  message: string;
  ok: boolean;
} | null;

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function fullRenderedTitle(title: string) {
  const normalizedTitle = title.trim();

  if (!normalizedTitle || normalizedTitle === SITE_NAME) {
    return SITE_NAME;
  }

  return `${normalizedTitle} | ${SITE_NAME}`;
}

function googlePreviewUrl(canonicalUrl: string, path: string) {
  try {
    const parsedUrl = new URL(canonicalUrl);
    const crumbs = parsedUrl.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part).replaceAll("-", " "));

    return [parsedUrl.hostname, ...crumbs].join(" › ");
  } catch {
    const crumbs = path
      .split("/")
      .filter(Boolean)
      .map((part) => part.replaceAll("-", " "));

    return ["jurgensenergy.com", ...crumbs].join(" › ");
  }
}

function metadataWarnings({
  description,
  pages,
  pageKey,
  title,
}: {
  description: string;
  pages: SeoAdminPageView[];
  pageKey: string;
  title: string;
}) {
  const warnings: string[] = [];
  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();

  const renderedTitleLength = fullRenderedTitle(normalizedTitle).length;

  if (renderedTitleLength < TITLE_SOFT_MIN) {
    warnings.push(
      `The title is shorter than the usual ${TITLE_SOFT_MIN}–${TITLE_SOFT_MAX} character working range.`,
    );
  } else if (renderedTitleLength > TITLE_SOFT_MAX) {
    warnings.push(
      `The title is longer than the usual ${TITLE_SOFT_MIN}–${TITLE_SOFT_MAX} character working range and may be truncated.`,
    );
  }

  if (normalizedDescription.length < DESCRIPTION_SOFT_MIN) {
    warnings.push(
      `The description is shorter than the usual ${DESCRIPTION_SOFT_MIN}–${DESCRIPTION_SOFT_MAX} character working range.`,
    );
  } else if (normalizedDescription.length > DESCRIPTION_SOFT_MAX) {
    warnings.push(
      `The description is longer than the usual ${DESCRIPTION_SOFT_MIN}–${DESCRIPTION_SOFT_MAX} character working range and may be shortened.`,
    );
  }

  if (/\bjurgens energy\b/i.test(normalizedTitle)) {
    warnings.push(
      "Remove “Jurgens Energy” from the page title. The site title template adds the brand automatically.",
    );
  }

  const duplicateTitle = pages.some(
    (page) =>
      page.key !== pageKey &&
      page.title.trim().toLocaleLowerCase() ===
        normalizedTitle.toLocaleLowerCase(),
  );
  const duplicateDescription = pages.some(
    (page) =>
      page.key !== pageKey &&
      page.description.trim().toLocaleLowerCase() ===
        normalizedDescription.toLocaleLowerCase(),
  );

  if (normalizedTitle && duplicateTitle) {
    warnings.push("Another static page currently uses this SEO title.");
  }

  if (normalizedDescription && duplicateDescription) {
    warnings.push("Another static page currently uses this meta description.");
  }

  return warnings;
}

function CharacterGuidance({
  current,
  maximum,
  minimum,
}: {
  current: number;
  maximum: number;
  minimum: number;
}) {
  const outsideWorkingRange = current < minimum || current > maximum;

  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        outsideWorkingRange
          ? "text-amber-700 dark:text-amber-300"
          : "text-emerald-700 dark:text-emerald-300",
      )}
    >
      {current} characters · suggested {minimum}–{maximum}
    </span>
  );
}

function sourceLabel(source: SeoRevisionView["source"]) {
  if (source === "ai") {
    return "AI assisted";
  }

  if (source === "restore") {
    return "Restored";
  }

  if (source === "default") {
    return "Default";
  }

  return "Manual";
}

function ActionStatus({ status }: { status: StatusMessage }) {
  if (!status) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={cn(
        "text-sm",
        status.ok
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-red-700 dark:text-red-300",
      )}
      role="status"
    >
      {status.message}
    </p>
  );
}

function RevisionHistoryDialog({
  canManage,
  errorMessage,
  history,
  loading,
  onOpenChange,
  onRestore,
  open,
  restoringRevisionId,
}: {
  canManage: boolean;
  errorMessage: string | null;
  history: SeoRevisionView[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (revision: SeoRevisionView) => void;
  open: boolean;
  restoringRevisionId: string | null;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Metadata history</DialogTitle>
          <DialogDescription>
            Review previous saved values. Restoring a revision is an explicit
            live change and is recorded in the admin audit trail.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-3">
          {loading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
              <LoaderCircleIcon className="size-4 animate-spin" />
              Loading history…
            </div>
          ) : errorMessage ? (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>History unavailable</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : history.length > 0 ? (
            history.map((revision) => (
              <article
                className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]"
                key={revision.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                      <span>{formatDate(revision.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{revision.actorLabel}</span>
                      <Badge variant="outline">{sourceLabel(revision.source)}</Badge>
                    </div>
                    <h3 className="mt-2 break-words text-sm font-semibold text-zinc-950 dark:text-white">
                      {revision.title}
                    </h3>
                    <p className="mt-1 break-words text-sm leading-6 text-slate-600 dark:text-zinc-300">
                      {revision.description}
                    </p>
                  </div>
                  <DashboardButton
                    className="shrink-0"
                    disabled={!canManage || restoringRevisionId !== null}
                    onClick={() => onRestore(revision)}
                    type="button"
                  >
                    {restoringRevisionId === revision.id ? (
                      <LoaderCircleIcon className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcwIcon className="size-3.5" />
                    )}
                    Restore
                  </DashboardButton>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/15 dark:text-zinc-400">
              No earlier saved revisions are available for this page yet.
            </div>
          )}
        </DialogBody>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

export function SeoManager({
  canManage,
  pages,
}: {
  canManage: boolean;
  pages: SeoAdminPageView[];
}) {
  const router = useRouter();
  const [localPages, setLocalPages] = useState(pages);
  const [selectedKey, setSelectedKey] = useState(pages[0]?.key ?? "");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState(pages[0]?.title ?? "");
  const [description, setDescription] = useState(
    pages[0]?.description ?? "",
  );
  const [suggestion, setSuggestion] = useState<SeoSuggestionView | null>(null);
  const [draftSource, setDraftSource] = useState<"ai" | "manual">("manual");
  const [scanTimes, setScanTimes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<StatusMessage>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SeoRevisionView[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [restoringRevisionId, setRestoringRevisionId] = useState<
    string | null
  >(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isLoadingHistory, startLoadingHistory] = useTransition();
  const [isRestoring, startRestoring] = useTransition();

  useEffect(() => {
    setLocalPages(pages);
  }, [pages]);

  const selectedPage =
    localPages.find((page) => page.key === selectedKey) ?? localPages[0] ?? null;

  useEffect(() => {
    if (!selectedPage) {
      return;
    }

    setTitle(selectedPage.title);
    setDescription(selectedPage.description);
    setSuggestion(null);
    setDraftSource("manual");
  }, [selectedPage]);

  const filteredPages = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    if (!normalizedSearch) {
      return localPages;
    }

    return localPages.filter((page) =>
      [page.label, page.path, page.title].some((value) =>
        value.toLocaleLowerCase().includes(normalizedSearch),
      ),
    );
  }, [localPages, search]);

  const isDirty = Boolean(
    selectedPage &&
      (title !== selectedPage.title || description !== selectedPage.description),
  );

  const warnings = useMemo(() => {
    if (!selectedPage) {
      return [];
    }

    if (!isDirty) {
      return selectedPage.issues.map((issue) => issue.message);
    }

    return metadataWarnings({
      description,
      pages: localPages,
      pageKey: selectedPage.key,
      title,
    });
  }, [description, isDirty, localPages, selectedPage, title]);

  function selectPage(page: SeoAdminPageView) {
    setSelectedKey(page.key);
    setTitle(page.title);
    setDescription(page.description);
    setSuggestion(null);
    setDraftSource("manual");
    setStatus(null);
    setHistory([]);
    setHistoryError(null);
  }

  function replacePage(nextPage: SeoAdminPageView) {
    setLocalPages((currentPages) =>
      currentPages.map((page) =>
        page.key === nextPage.key ? nextPage : page,
      ),
    );
    setTitle(nextPage.title);
    setDescription(nextPage.description);
  }

  function generateSuggestion() {
    if (!selectedPage || !canManage) {
      return;
    }

    setStatus(null);
    startGenerating(async () => {
      const result = await generateSeoSuggestionAction(selectedPage.key);

      if (result.ok && result.data) {
        setSuggestion(result.data);
        setScanTimes((current) => ({
          ...current,
          [selectedPage.key]: result.data!.scannedAt,
        }));
      }

      setStatus({ message: result.message, ok: result.ok });
    });
  }

  function applySuggestion() {
    if (!suggestion) {
      return;
    }

    setTitle(suggestion.title);
    setDescription(suggestion.description);
    setDraftSource("ai");
    setStatus({
      message:
        "Suggestion applied to the editor only. Review it, then save when ready.",
      ok: true,
    });
  }

  function saveMetadata() {
    if (!selectedPage || !canManage) {
      return;
    }

    setStatus(null);
    startSaving(async () => {
      const result = await saveSeoMetadataAction({
        description,
        pageKey: selectedPage.key,
        source: draftSource,
        title,
      });

      if (result.ok && result.data) {
        replacePage(result.data);
        setSuggestion(null);
        router.refresh();
      }

      setStatus({ message: result.message, ok: result.ok });
    });
  }

  function openHistory() {
    if (!selectedPage) {
      return;
    }

    setHistoryOpen(true);
    setHistory([]);
    setHistoryError(null);
    startLoadingHistory(async () => {
      const result = await getSeoRevisionHistoryAction(selectedPage.key);

      if (result.ok && result.data) {
        setHistory(result.data);
      } else {
        setHistoryError(result.message);
        setStatus({ message: result.message, ok: false });
      }
    });
  }

  function restoreRevision(revision: SeoRevisionView) {
    if (!selectedPage || !canManage) {
      return;
    }

    setRestoringRevisionId(revision.id);
    startRestoring(async () => {
      const result = await restoreSeoRevisionAction(revision.id);

      if (result.ok && result.data) {
        replacePage(result.data);
        setSuggestion(null);
        setHistoryOpen(false);
        router.refresh();
      }

      setStatus({ message: result.message, ok: result.ok });
      setRestoringRevisionId(null);
    });
  }

  if (!selectedPage) {
    return (
      <section className={cn(dashboardPanelClass, "p-6 text-sm text-slate-600 dark:text-zinc-300")}>
        No static pages are registered for SEO management yet.
      </section>
    );
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
      <aside
        className={cn(
          dashboardPanelClass,
          "min-w-0 self-start overflow-hidden xl:sticky xl:top-5",
        )}
      >
        <div className="border-b border-slate-200 p-4 dark:border-white/10">
          <Label className="sr-only" htmlFor="seo-page-search">
            Search static pages
          </Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <DashboardInput
              className="pl-9"
              id="seo-page-search"
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Search pages"
              value={search}
            />
          </div>
        </div>
        <div className="max-h-[34rem] overflow-y-auto overscroll-contain p-2">
          {filteredPages.length > 0 ? (
            filteredPages.map((page) => {
              const active = page.key === selectedPage.key;
              const pageWarningCount = page.issues.length;

              return (
                <button
                  className={cn(
                    "flex w-full min-w-0 items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                    active
                      ? "border-[#ff5a1f]/50 bg-[#ff5a1f]/8"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-white/10 dark:hover:bg-white/[0.04]",
                  )}
                  key={page.key}
                  onClick={() => selectPage(page)}
                  type="button"
                >
                  <FileTextIcon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      active ? "text-[#ff5a1f]" : "text-slate-400",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-white">
                      {page.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-zinc-400">
                      {page.path}
                    </span>
                  </span>
                  {pageWarningCount > 0 ? (
                    <span
                      aria-label={`${pageWarningCount} metadata warnings`}
                      className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200"
                    >
                      {pageWarningCount}
                    </span>
                  ) : (
                    <CheckCircle2Icon
                      aria-label="Metadata guidance checks passed"
                      className="mt-0.5 size-4 shrink-0 text-emerald-600"
                    />
                  )}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
              No matching pages.
            </p>
          )}
        </div>
      </aside>

      <section className="grid min-w-0 gap-5">
        <div className={cn(dashboardPanelClass, "min-w-0 overflow-hidden")}>
          <div className="flex min-w-0 flex-col gap-4 border-b border-slate-200 p-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between sm:p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-lg font-bold text-zinc-950 dark:text-white">
                  {selectedPage.label}
                </h2>
                <Badge
                  className={cn(
                    selectedPage.source !== "default"
                      ? "border-[#ff5a1f]/30 bg-[#ff5a1f]/10 text-[#d8410d] dark:text-[#ff8a61]"
                      : "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300",
                  )}
                  variant="outline"
                >
                  {selectedPage.source === "default"
                    ? "Default"
                    : selectedPage.source === "ai"
                      ? "AI assisted"
                      : selectedPage.source === "restore"
                        ? "Restored"
                        : "Manual"}
                </Badge>
              </div>
              <p className="mt-1 break-all text-sm text-slate-500 dark:text-zinc-400">
                {selectedPage.path}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                Updated {formatDate(selectedPage.updatedAt)} · Last scanned{" "}
                {formatDate(
                  scanTimes[selectedPage.key] ?? selectedPage.lastScannedAt,
                )}
              </p>
            </div>
            <Link
              className={cn(
                "inline-flex h-8 w-fit shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-[14px] font-normal leading-none",
                dashboardControlClass,
              )}
              href={selectedPage.canonicalUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLinkIcon className="size-3.5" />
              View page
            </Link>
          </div>

          <div className="grid min-w-0 gap-5 p-4 sm:p-5">
            {!canManage ? (
              <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
                <AlertTriangleIcon />
                <AlertTitle>Read-only access</AlertTitle>
                <AlertDescription className="text-amber-900/80 dark:text-amber-100/75">
                  You can review SEO metadata, but an administrator with
                  marketing-management access must generate or save changes.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Label htmlFor="seo-title">SEO title</Label>
                <CharacterGuidance
                  current={fullRenderedTitle(title).length}
                  maximum={TITLE_SOFT_MAX}
                  minimum={TITLE_SOFT_MIN}
                />
              </div>
              <DashboardInput
                disabled={!canManage || isSaving || isRestoring}
                id="seo-title"
                maxLength={120}
                onChange={(event) => setTitle(event.currentTarget.value)}
                placeholder="Describe this page clearly and specifically"
                value={title}
              />
              <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Store the page title only. The site adds “| Jurgens Energy”
                automatically where appropriate.
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Label htmlFor="seo-description">Meta description</Label>
                <CharacterGuidance
                  current={description.trim().length}
                  maximum={DESCRIPTION_SOFT_MAX}
                  minimum={DESCRIPTION_SOFT_MIN}
                />
              </div>
              <Textarea
                className={cn(
                  "min-h-28 resize-y rounded-lg text-sm",
                  dashboardControlClass,
                )}
                disabled={!canManage || isSaving || isRestoring}
                id="seo-description"
                maxLength={320}
                onChange={(event) =>
                  setDescription(event.currentTarget.value)
                }
                placeholder="Summarise the page accurately for searchers"
                value={description}
              />
              <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Length ranges are guidance, not ranking rules. Accurate,
                page-specific copy matters more than filling every character.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Canonical URL</Label>
              <div className="min-w-0 break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300">
                {selectedPage.canonicalUrl}
              </div>
              <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Canonical URLs are system-managed to protect indexing and
                cannot be edited here.
              </p>
            </div>

            {warnings.length > 0 ? (
              <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
                <AlertTriangleIcon />
                <AlertTitle>Review before saving</AlertTitle>
                <AlertDescription className="text-amber-900/80 dark:text-amber-100/75">
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-100">
                <CheckCircle2Icon />
                <AlertTitle>Guidance checks passed</AlertTitle>
                <AlertDescription className="text-emerald-900/80 dark:text-emerald-100/75">
                  No duplicate or common length issues were detected. Google
                  may still present different text for a particular search.
                </AlertDescription>
              </Alert>
            )}

            <ActionStatus status={status} />

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 dark:border-white/10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <DashboardButton
                disabled={isLoadingHistory || isRestoring}
                onClick={openHistory}
                type="button"
              >
                {isLoadingHistory ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                ) : (
                  <HistoryIcon className="size-3.5" />
                )}
                View history
              </DashboardButton>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <DashboardButton
                  disabled={!canManage || isGenerating || isSaving || isRestoring}
                  onClick={generateSuggestion}
                  type="button"
                >
                  {isGenerating ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin" />
                  ) : (
                    <ScanSearchIcon className="size-3.5" />
                  )}
                  {isGenerating ? "Scanning…" : "Scan page & generate"}
                </DashboardButton>
                <Button
                  className="h-8 gap-1.5 rounded-md bg-[#ff5a1f] px-3 text-[14px] font-normal leading-none text-white hover:bg-[#e84c15]"
                  disabled={
                    !canManage ||
                    !isDirty ||
                    !title.trim() ||
                    !description.trim() ||
                    isSaving ||
                    isGenerating ||
                    isRestoring
                  }
                  onClick={saveMetadata}
                  type="button"
                >
                  {isSaving ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin" />
                  ) : (
                    <SaveIcon className="size-3.5" />
                  )}
                  {isSaving ? "Saving…" : "Save metadata"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className={cn(dashboardPanelClass, "min-w-0 overflow-hidden")}>
          <div className="border-b border-slate-200 p-4 dark:border-white/10 sm:p-5">
            <h2 className="text-base font-bold text-zinc-950 dark:text-white">
              Possible Google search preview
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-zinc-400">
              This is a visual guide only. Google can rewrite the title or
              snippet to better match a person’s search.
            </p>
          </div>
          <div className="min-w-0 bg-white p-5 dark:bg-[#151719] sm:p-6">
            <div className="max-w-[42rem] min-w-0 font-sans">
              <p className="truncate text-sm text-[#202124] dark:text-zinc-300">
                {googlePreviewUrl(
                  selectedPage.canonicalUrl,
                  selectedPage.path,
                )}
              </p>
              <p className="mt-1 break-words text-xl leading-7 text-[#1a0dab] dark:text-[#8ab4f8]">
                {fullRenderedTitle(title)}
              </p>
              <p className="mt-1 break-words text-sm leading-6 text-[#4d5156] dark:text-zinc-400">
                {description || "Add a page-specific meta description."}
              </p>
            </div>
          </div>
        </div>

        {suggestion ? (
          <div
            className={cn(
              dashboardPanelClass,
              "min-w-0 overflow-hidden border-[#ff5a1f]/30",
            )}
          >
            <div className="flex min-w-0 flex-col gap-3 border-b border-slate-200 p-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between sm:p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="size-4 text-[#ff5a1f]" />
                  <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                    AI-assisted suggestion
                  </h2>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-zinc-400">
                  Generated from verified page content. It has not been applied
                  or published automatically.
                </p>
              </div>
              <DashboardButton
                className="shrink-0 border-[#ff5a1f]/40 text-[#d8410d] dark:text-[#ff8a61]"
                disabled={!canManage || isSaving || isRestoring}
                onClick={applySuggestion}
                type="button"
              >
                <SparklesIcon className="size-3.5" />
                Apply to editor
              </DashboardButton>
            </div>
            <div className="grid min-w-0 gap-5 p-4 sm:p-5">
              <div className="grid gap-1">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
                  Suggested title
                </p>
                <p className="break-words text-sm font-semibold text-zinc-950 dark:text-white">
                  {suggestion.title}
                </p>
              </div>
              <div className="grid gap-1">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
                  Suggested description
                </p>
                <p className="break-words text-sm leading-6 text-slate-700 dark:text-zinc-300">
                  {suggestion.description}
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
                    Primary topic
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-zinc-950 dark:text-white">
                    {suggestion.primaryTopic}
                  </p>
                  {suggestion.supportingTerms.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {suggestion.supportingTerms.map((term) => (
                        <Badge key={term} variant="outline">
                          {term}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
                    Why this direction
                  </p>
                  <p className="mt-2 break-words text-sm leading-6 text-slate-600 dark:text-zinc-300">
                    {suggestion.reasoning}
                  </p>
                </div>
              </div>
              {suggestion.contentGaps.length > 0 ? (
                <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
                  <AlertTriangleIcon />
                  <AlertTitle>Content opportunities</AlertTitle>
                  <AlertDescription className="text-amber-900/80 dark:text-amber-100/75">
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {suggestion.contentGaps.map((gap) => (
                        <li key={gap}>{gap}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
              {suggestion.issues.length > 0 ? (
                <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
                  <AlertTriangleIcon />
                  <AlertTitle>Suggestion checks to review</AlertTitle>
                  <AlertDescription className="text-amber-900/80 dark:text-amber-100/75">
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {suggestion.issues.map((issue) => (
                        <li key={`${issue.code}-${issue.message}`}>
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
              {suggestion.unsupportedClaims.length > 0 ? (
                <Alert className="border-slate-300 bg-slate-50 text-slate-950 dark:border-white/15 dark:bg-white/[0.04] dark:text-white">
                  <CheckCircle2Icon />
                  <AlertTitle>Claims deliberately excluded</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {suggestion.unsupportedClaims.map((claim) => (
                        <li key={claim}>{claim}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <RevisionHistoryDialog
        canManage={canManage}
        errorMessage={historyError}
        history={history}
        loading={isLoadingHistory}
        onOpenChange={setHistoryOpen}
        onRestore={restoreRevision}
        open={historyOpen}
        restoringRevisionId={restoringRevisionId}
      />
    </div>
  );
}
