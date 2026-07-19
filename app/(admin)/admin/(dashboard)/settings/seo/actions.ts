"use server";

import { revalidatePath } from "next/cache";

import type {
  SeoActionResult,
  SeoAdminPageView,
  SeoRevisionView,
  SeoSuggestionView,
} from "@/app/(admin)/admin/(dashboard)/settings/seo/seo-types";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { createMarketplaceCanonicalUrl } from "@/src/modules/marketplace/seo";
import {
  generateStaticSeoSuggestion,
  getStaticSeoAdminPages,
  getStaticSeoPageRegistryEntry,
  isStaticSeoPageKey,
  listStaticPageSeoRevisions,
  restoreStaticPageSeoRevision,
  staticPageSeoUpdateSchema,
  updateStaticPageSeo,
  type StaticSeoAdminPage,
  type StaticSeoPageKey,
} from "@/src/modules/marketplace/static-page-seo";

function serializeAdminPage(page: StaticSeoAdminPage): SeoAdminPageView {
  return {
    canonicalUrl: createMarketplaceCanonicalUrl(page.path),
    description: page.description,
    key: page.pageKey,
    label: page.label,
    lastScannedAt: page.lastScannedAt?.toISOString() ?? null,
    issues: page.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      severity: issue.severity,
    })),
    path: page.path,
    source: page.source,
    title: page.title,
    updatedAt: page.updatedAt?.toISOString() ?? null,
  };
}

async function requireSeoViewAccess() {
  const access = await requireAdminCapability("admin.marketing.view");

  if (!access.ok) {
    throw new Error("You do not have permission to view SEO metadata.");
  }

  return access;
}

async function requireSeoManageAccess() {
  const access = await requireAdminCapability("admin.marketing.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to manage SEO metadata.");
  }

  return access;
}

function parsePageKey(value: string): StaticSeoPageKey | null {
  return isStaticSeoPageKey(value) ? value : null;
}

async function refreshedAdminPage(pageKey: StaticSeoPageKey) {
  const pages = await getStaticSeoAdminPages();
  const page = pages.find((candidate) => candidate.pageKey === pageKey);

  if (!page) {
    throw new Error("The registered SEO page could not be loaded.");
  }

  return serializeAdminPage(page);
}

function actionErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  if (
    [
      "StaticSeoGenerationError",
      "StaticSeoPageScanError",
      "StaticSeoServiceError",
    ].includes(error.name) ||
    error.message.startsWith("You do not have permission")
  ) {
    return error.message;
  }

  return fallback;
}

function revalidateSeoPage(pageKey: StaticSeoPageKey) {
  const page = getStaticSeoPageRegistryEntry(pageKey);

  revalidatePath(page.path);
  revalidatePath("/settings/seo");
  revalidatePath("/sitemap.xml");
}

export async function getSeoAdminPages(): Promise<SeoAdminPageView[]> {
  await requireSeoViewAccess();

  return (await getStaticSeoAdminPages()).map(serializeAdminPage);
}

export async function generateSeoSuggestionAction(
  rawPageKey: string,
): Promise<SeoActionResult<SeoSuggestionView>> {
  const pageKey = parsePageKey(rawPageKey);

  if (!pageKey) {
    return { message: "Choose a registered static page.", ok: false };
  }

  try {
    const access = await requireSeoManageAccess();
    const result = await generateStaticSeoSuggestion(
      pageKey,
      access.session.user.id,
    );

    revalidatePath("/settings/seo");

    return {
      data: {
        contentGaps: result.suggestion.contentGaps,
        description: result.suggestion.description,
        issues: result.issues.map((issue) => ({
          code: issue.code,
          message: issue.message,
          severity: issue.severity,
        })),
        primaryTopic: result.suggestion.primaryTopic,
        reasoning: result.suggestion.reasoning,
        scannedAt: result.scan.scannedAt.toISOString(),
        supportingTerms: result.suggestion.supportingSearchTerms,
        title: result.suggestion.title,
        unsupportedClaims: result.suggestion.unsupportedClaims,
      },
      message: `Scanned ${result.scan.wordCount.toLocaleString()} visible words and prepared a reviewable suggestion. Nothing has been published.`,
      ok: true,
    };
  } catch (error) {
    return {
      message: actionErrorMessage(
        error,
        "The page could not be scanned or analysed right now.",
      ),
      ok: false,
    };
  }
}

export async function saveSeoMetadataAction(input: {
  description: string;
  pageKey: string;
  source: "ai" | "manual";
  title: string;
}): Promise<SeoActionResult<SeoAdminPageView>> {
  const parsed = staticPageSeoUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message:
        parsed.error.issues[0]?.message ??
        "Review the SEO title and description.",
      ok: false,
    };
  }

  try {
    const access = await requireSeoManageAccess();

    await updateStaticPageSeo(parsed.data, access.session.user.id);
    revalidateSeoPage(parsed.data.pageKey);

    return {
      data: await refreshedAdminPage(parsed.data.pageKey),
      message: "SEO metadata saved and the public page cache was refreshed.",
      ok: true,
    };
  } catch (error) {
    return {
      message: actionErrorMessage(error, "The SEO metadata could not be saved."),
      ok: false,
    };
  }
}

export async function getSeoRevisionHistoryAction(
  rawPageKey: string,
): Promise<SeoActionResult<SeoRevisionView[]>> {
  const pageKey = parsePageKey(rawPageKey);

  if (!pageKey) {
    return { message: "Choose a registered static page.", ok: false };
  }

  try {
    await requireSeoViewAccess();
    const revisions = await listStaticPageSeoRevisions(pageKey);

    return {
      data: revisions.map((revision) => ({
        actorLabel:
          revision.actorName ??
          revision.actorEmail ??
          (revision.source === "default" ? "System default" : "Unknown admin"),
        createdAt: revision.createdAt.toISOString(),
        description: revision.description,
        id: revision.id,
        source: revision.source,
        title: revision.title,
      })),
      message: "SEO metadata history loaded.",
      ok: true,
    };
  } catch (error) {
    return {
      message: actionErrorMessage(
        error,
        "The SEO metadata history could not be loaded.",
      ),
      ok: false,
    };
  }
}

export async function restoreSeoRevisionAction(
  revisionId: string,
): Promise<SeoActionResult<SeoAdminPageView>> {
  try {
    const access = await requireSeoManageAccess();
    const restored = await restoreStaticPageSeoRevision(
      revisionId,
      access.session.user.id,
    );

    revalidateSeoPage(restored.pageKey);

    return {
      data: await refreshedAdminPage(restored.pageKey),
      message: "The selected metadata revision was restored.",
      ok: true,
    };
  } catch (error) {
    return {
      message: actionErrorMessage(
        error,
        "The SEO metadata revision could not be restored.",
      ),
      ok: false,
    };
  }
}
