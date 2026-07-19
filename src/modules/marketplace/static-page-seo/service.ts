import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { z } from "zod";

import { db } from "@/src/db";
import {
  auditLogs,
  staticPageSeo,
  staticPageSeoRevisions,
  users,
} from "@/src/db/schema";
import { requestStaticSeoSuggestion } from "@/src/modules/marketplace/static-page-seo/ai";
import { createMarketplacePageMetadata } from "@/src/modules/marketplace/static-page-seo/metadata";
import {
  STATIC_SEO_PAGE_KEYS,
  STATIC_SEO_PAGE_REGISTRY,
  getStaticSeoPageRegistryEntry,
  isStaticSeoPageKey,
  type StaticSeoPageKey,
} from "@/src/modules/marketplace/static-page-seo/registry";
import {
  scanStaticSeoPage,
  type StaticSeoPageScan,
} from "@/src/modules/marketplace/static-page-seo/scanner";
import {
  analyzeStaticSeoCopy,
  normalizeSeoWhitespace,
  staticPageSeoUpdateSchema,
  staticSeoPageKeySchema,
  validateGeneratedStaticSeoSuggestion,
  type StaticPageSeoUpdateInput,
  type StaticSeoCopyIssue,
  type StaticSeoSuggestion,
} from "@/src/modules/marketplace/static-page-seo/validation";

const actorUserIdSchema = z.string().uuid();
const revisionIdSchema = z.string().uuid();

export type StaticPageSeoValue = {
  description: string;
  isCustomized: boolean;
  lastScannedAt: Date | null;
  pageKey: StaticSeoPageKey;
  source: "ai" | "default" | "manual" | "restore";
  title: string;
  updatedAt: Date | null;
  updatedByUserId: string | null;
};

export type StaticSeoAdminPage = StaticPageSeoValue & {
  defaultDescription: string;
  defaultTitle: string;
  issues: StaticSeoCopyIssue[];
  label: string;
  path: string;
  updatedByEmail: string | null;
  updatedByName: string | null;
};

export type StaticSeoRevision = {
  actorEmail: string | null;
  actorName: string | null;
  actorUserId: string | null;
  createdAt: Date;
  description: string;
  id: string;
  pageKey: StaticSeoPageKey;
  restoredFromRevisionId: string | null;
  source: "ai" | "default" | "manual" | "restore";
  title: string;
};

export type StaticSeoSuggestionResult = {
  issues: StaticSeoCopyIssue[];
  pageKey: StaticSeoPageKey;
  scan: Omit<StaticSeoPageScan, "text"> & { excerpt: string };
  suggestion: StaticSeoSuggestion;
};

export class StaticSeoServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaticSeoServiceError";
  }
}

function asStaticSeoPersistenceError(error: unknown) {
  if (error instanceof StaticSeoServiceError) {
    return error;
  }

  const databaseError = error as
    | { cause?: { cause?: { code?: unknown }; code?: unknown }; code?: unknown }
    | null;
  const databaseCode =
    databaseError?.code ??
    databaseError?.cause?.code ??
    databaseError?.cause?.cause?.code;

  if (databaseCode === "42P01" || databaseCode === "42703") {
    return new StaticSeoServiceError(
      "SEO metadata storage is not ready. Run the latest database migration, then try again.",
    );
  }

  return new StaticSeoServiceError(
    "SEO metadata could not be saved right now. No changes were applied.",
  );
}

function fallbackStaticPageSeo(pageKey: StaticSeoPageKey): StaticPageSeoValue {
  const entry = getStaticSeoPageRegistryEntry(pageKey);

  return {
    description: entry.defaultDescription,
    isCustomized: false,
    lastScannedAt: null,
    pageKey,
    source: "default",
    title: entry.defaultTitle,
    updatedAt: null,
    updatedByUserId: null,
  };
}

function mapStaticPageSeoRow(
  pageKey: StaticSeoPageKey,
  row:
    | {
        description: string;
        isCustomized: boolean;
        lastScannedAt: Date | null;
        source: "ai" | "manual" | "restore";
        title: string;
        updatedAt: Date;
        updatedByUserId: string | null;
      }
    | undefined,
): StaticPageSeoValue {
  if (!row) {
    return fallbackStaticPageSeo(pageKey);
  }

  if (!row.isCustomized) {
    return {
      ...fallbackStaticPageSeo(pageKey),
      lastScannedAt: row.lastScannedAt,
    };
  }

  return {
    description: row.description,
    isCustomized: true,
    lastScannedAt: row.lastScannedAt,
    pageKey,
    source: row.source,
    title: row.title,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
  };
}

async function findStaticPageSeoRow(pageKey: StaticSeoPageKey) {
  const [row] = await db
    .select({
      description: staticPageSeo.description,
      isCustomized: staticPageSeo.isCustomized,
      lastScannedAt: staticPageSeo.lastScannedAt,
      source: staticPageSeo.source,
      title: staticPageSeo.title,
      updatedAt: staticPageSeo.updatedAt,
      updatedByUserId: staticPageSeo.updatedByUserId,
    })
    .from(staticPageSeo)
    .where(eq(staticPageSeo.pageKey, pageKey))
    .limit(1);

  return row;
}

export async function getStaticPageSeoValue(
  pageKey: StaticSeoPageKey,
): Promise<StaticPageSeoValue> {
  try {
    return mapStaticPageSeoRow(pageKey, await findStaticPageSeoRow(pageKey));
  } catch {
    // Metadata must continue to render during a rolling deploy before the new
    // table exists, or during a temporary database outage. Admin writes still
    // fail loudly and never pretend to have persisted.
    return fallbackStaticPageSeo(pageKey);
  }
}

export async function getStaticPageMetadata(
  pageKey: StaticSeoPageKey,
): Promise<Metadata> {
  const entry = getStaticSeoPageRegistryEntry(pageKey);
  const value = await getStaticPageSeoValue(pageKey);

  return createMarketplacePageMetadata({
    description: value.description,
    path: entry.path,
    title: value.title,
  });
}

export async function getStaticPageSeoUpdatedAtMap(): Promise<
  Partial<Record<StaticSeoPageKey, Date>>
> {
  try {
    const rows = await db
      .select({
        isCustomized: staticPageSeo.isCustomized,
        pageKey: staticPageSeo.pageKey,
        updatedAt: staticPageSeo.updatedAt,
      })
      .from(staticPageSeo)
      .where(inArray(staticPageSeo.pageKey, [...STATIC_SEO_PAGE_KEYS]));
    const result: Partial<Record<StaticSeoPageKey, Date>> = {};

    for (const row of rows) {
      if (row.isCustomized && isStaticSeoPageKey(row.pageKey)) {
        result[row.pageKey] = row.updatedAt;
      }
    }

    return result;
  } catch {
    return {};
  }
}

export async function getStaticSeoAdminPages(): Promise<StaticSeoAdminPage[]> {
  let rows: Array<{
    description: string;
    isCustomized: boolean;
    lastScannedAt: Date | null;
    pageKey: string;
    source: "ai" | "manual" | "restore";
    title: string;
    updatedAt: Date;
    updatedByEmail: string | null;
    updatedByName: string | null;
    updatedByUserId: string | null;
  }> = [];

  try {
    rows = await db
      .select({
        description: staticPageSeo.description,
        isCustomized: staticPageSeo.isCustomized,
        lastScannedAt: staticPageSeo.lastScannedAt,
        pageKey: staticPageSeo.pageKey,
        source: staticPageSeo.source,
        title: staticPageSeo.title,
        updatedAt: staticPageSeo.updatedAt,
        updatedByEmail: users.email,
        updatedByName: users.name,
        updatedByUserId: staticPageSeo.updatedByUserId,
      })
      .from(staticPageSeo)
      .leftJoin(users, eq(users.id, staticPageSeo.updatedByUserId))
      .where(inArray(staticPageSeo.pageKey, [...STATIC_SEO_PAGE_KEYS]));
  } catch {
    rows = [];
  }

  const rowByKey = new Map(rows.map((row) => [row.pageKey, row]));
  const effectivePages = STATIC_SEO_PAGE_KEYS.map((pageKey) => {
    const row = rowByKey.get(pageKey);
    const value = mapStaticPageSeoRow(
      pageKey,
      row && isStaticSeoPageKey(row.pageKey) ? row : undefined,
    );

    return { pageKey, row, value };
  });
  const titleCounts = new Map<string, number>();
  const descriptionCounts = new Map<string, number>();

  for (const { value } of effectivePages) {
    const title = normalizeSeoWhitespace(value.title).toLowerCase();
    const description = normalizeSeoWhitespace(value.description).toLowerCase();
    titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
    descriptionCounts.set(
      description,
      (descriptionCounts.get(description) ?? 0) + 1,
    );
  }

  return effectivePages.map(({ pageKey, row, value }) => {
    const entry = STATIC_SEO_PAGE_REGISTRY[pageKey];
    const normalizedTitle = normalizeSeoWhitespace(value.title).toLowerCase();
    const normalizedDescription = normalizeSeoWhitespace(
      value.description,
    ).toLowerCase();

    return {
      ...value,
      defaultDescription: entry.defaultDescription,
      defaultTitle: entry.defaultTitle,
      issues: analyzeStaticSeoCopy({
        description: value.description,
        duplicateDescription:
          (descriptionCounts.get(normalizedDescription) ?? 0) > 1,
        duplicateTitle: (titleCounts.get(normalizedTitle) ?? 0) > 1,
        title: value.title,
      }),
      label: entry.label,
      path: entry.path,
      updatedByEmail: value.isCustomized ? row?.updatedByEmail ?? null : null,
      updatedByName: value.isCustomized ? row?.updatedByName ?? null : null,
    };
  });
}

export async function generateStaticSeoSuggestion(
  rawPageKey: StaticSeoPageKey,
  rawActorUserId: string,
): Promise<StaticSeoSuggestionResult> {
  const pageKey = staticSeoPageKeySchema.parse(rawPageKey);
  const actorUserId = actorUserIdSchema.parse(rawActorUserId);
  const current = await getStaticPageSeoValue(pageKey);
  const scan = await scanStaticSeoPage(pageKey);
  const suggestion = await requestStaticSeoSuggestion({
    currentDescription: current.description,
    currentTitle: current.title,
    pageKey,
    scan,
  });
  const validation = validateGeneratedStaticSeoSuggestion({
    scannedContent: scan.text,
    suggestion,
  });

  try {
    await db.transaction(async (tx) => {
      const entry = getStaticSeoPageRegistryEntry(pageKey);

      await tx
        .insert(staticPageSeo)
        .values({
          description: entry.defaultDescription,
          isCustomized: false,
          lastScannedAt: scan.scannedAt,
          pageKey,
          source: "manual",
          title: entry.defaultTitle,
        })
        .onConflictDoUpdate({
          target: staticPageSeo.pageKey,
          set: { lastScannedAt: scan.scannedAt },
        });

      await tx.insert(auditLogs).values({
        action: "static_page_seo.suggestion_generated",
        actorUserId,
        entityType: "static_page_seo",
        metadata: JSON.stringify({
          pageKey,
          path: entry.path,
          proposedDescription: suggestion.description,
          proposedTitle: suggestion.title,
          scannedAt: scan.scannedAt.toISOString(),
        }),
      });
    });
  } catch (error) {
    throw asStaticSeoPersistenceError(error);
  }

  const scanSummary: Omit<StaticSeoPageScan, "text"> = {
    headings: scan.headings,
    htmlTitle: scan.htmlTitle,
    pageKey: scan.pageKey,
    path: scan.path,
    scannedAt: scan.scannedAt,
    url: scan.url,
    wordCount: scan.wordCount,
  };

  return {
    issues: validation.issues,
    pageKey,
    scan: {
      ...scanSummary,
      excerpt: scan.text.slice(0, 500),
    },
    suggestion,
  };
}

export async function updateStaticPageSeo(
  rawInput: StaticPageSeoUpdateInput,
  rawActorUserId: string,
): Promise<StaticPageSeoValue> {
  const input = staticPageSeoUpdateSchema.parse(rawInput);
  const actorUserId = actorUserIdSchema.parse(rawActorUserId);
  const title = normalizeSeoWhitespace(input.title);
  const description = normalizeSeoWhitespace(input.description);
  const blockingIssue = analyzeStaticSeoCopy({ description, title }).find(
    (issue) => issue.severity === "error",
  );

  if (blockingIssue) {
    throw new StaticSeoServiceError(blockingIssue.message);
  }

  const now = new Date();

  try {
    const updated = await db.transaction(async (tx) => {
      const [defaultRevision] = await tx
        .select({ id: staticPageSeoRevisions.id })
        .from(staticPageSeoRevisions)
        .where(
          and(
            eq(staticPageSeoRevisions.pageKey, input.pageKey),
            eq(staticPageSeoRevisions.source, "default"),
          ),
        )
        .limit(1);
      const entry = getStaticSeoPageRegistryEntry(input.pageKey);
      const [row] = await tx
        .insert(staticPageSeo)
        .values({
          description,
          isCustomized: true,
          pageKey: input.pageKey,
          source: input.source,
          title,
          updatedAt: now,
          updatedByUserId: actorUserId,
        })
        .onConflictDoUpdate({
          target: staticPageSeo.pageKey,
          set: {
            description,
            isCustomized: true,
            source: input.source,
            title,
            updatedAt: now,
            updatedByUserId: actorUserId,
          },
        })
        .returning();

      if (!defaultRevision) {
        await tx
          .insert(staticPageSeoRevisions)
          .values({
            actorUserId: null,
            description: entry.defaultDescription,
            pageKey: input.pageKey,
            source: "default",
            title: entry.defaultTitle,
          })
          .onConflictDoNothing();
      }

      await tx.insert(staticPageSeoRevisions).values({
        actorUserId,
        description,
        pageKey: input.pageKey,
        source: input.source,
        title,
      });
      await tx.insert(auditLogs).values({
        action: "static_page_seo.updated",
        actorUserId,
        entityType: "static_page_seo",
        metadata: JSON.stringify({
          description,
          pageKey: input.pageKey,
          path: entry.path,
          source: input.source,
          title,
        }),
      });

      return row;
    });

    return mapStaticPageSeoRow(input.pageKey, updated);
  } catch (error) {
    throw asStaticSeoPersistenceError(error);
  }
}

export async function listStaticPageSeoRevisions(
  rawPageKey: StaticSeoPageKey,
): Promise<StaticSeoRevision[]> {
  const pageKey = staticSeoPageKeySchema.parse(rawPageKey);

  try {
    const rows = await db
      .select({
        actorEmail: users.email,
        actorName: users.name,
        actorUserId: staticPageSeoRevisions.actorUserId,
        createdAt: staticPageSeoRevisions.createdAt,
        description: staticPageSeoRevisions.description,
        id: staticPageSeoRevisions.id,
        pageKey: staticPageSeoRevisions.pageKey,
        restoredFromRevisionId: staticPageSeoRevisions.restoredFromRevisionId,
        source: staticPageSeoRevisions.source,
        title: staticPageSeoRevisions.title,
      })
      .from(staticPageSeoRevisions)
      .leftJoin(users, eq(users.id, staticPageSeoRevisions.actorUserId))
      .where(eq(staticPageSeoRevisions.pageKey, pageKey))
      .orderBy(desc(staticPageSeoRevisions.createdAt));

    return rows.map((row) => ({
      ...row,
      pageKey,
    }));
  } catch (error) {
    throw asStaticSeoPersistenceError(error);
  }
}

export async function restoreStaticPageSeoRevision(
  rawRevisionId: string,
  rawActorUserId: string,
): Promise<StaticPageSeoValue> {
  const revisionId = revisionIdSchema.parse(rawRevisionId);
  const actorUserId = actorUserIdSchema.parse(rawActorUserId);
  let revision;

  try {
    [revision] = await db
      .select()
      .from(staticPageSeoRevisions)
      .where(eq(staticPageSeoRevisions.id, revisionId))
      .limit(1);
  } catch (error) {
    throw asStaticSeoPersistenceError(error);
  }

  if (!revision || !isStaticSeoPageKey(revision.pageKey)) {
    throw new StaticSeoServiceError("The SEO revision was not found.");
  }

  const now = new Date();

  try {
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(staticPageSeo)
        .set({
          description: revision.description,
          isCustomized: revision.source !== "default",
          source: "restore",
          title: revision.title,
          updatedAt: now,
          updatedByUserId: actorUserId,
        })
        .where(eq(staticPageSeo.pageKey, revision.pageKey))
        .returning();

      if (!row) {
        throw new StaticSeoServiceError("The SEO page record was not found.");
      }

      await tx.insert(staticPageSeoRevisions).values({
        actorUserId,
        description: revision.description,
        pageKey: revision.pageKey,
        restoredFromRevisionId: revision.id,
        source: "restore",
        title: revision.title,
      });
      await tx.insert(auditLogs).values({
        action: "static_page_seo.revision_restored",
        actorUserId,
        entityType: "static_page_seo",
        metadata: JSON.stringify({
          pageKey: revision.pageKey,
          restoredFromRevisionId: revision.id,
        }),
      });

      return row;
    });

    return mapStaticPageSeoRow(revision.pageKey, updated);
  } catch (error) {
    throw asStaticSeoPersistenceError(error);
  }
}
