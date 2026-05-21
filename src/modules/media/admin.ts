import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { and, desc, eq, inArray, like, ne, sql } from "drizzle-orm";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

import { env } from "@/src/config/env";
import { db } from "@/src/db";
import {
  media,
  mediaFolderAssignments,
  mediaFolders,
  marketplaceSettings,
  brands,
} from "@/src/db/schema";
import {
  createMediaRelativePath,
  getMediaPublicUrl,
  normalizeRelativeMediaPath,
} from "@/src/modules/media/paths";

const acceptedImageTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const acceptedVideoTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const acceptedDocumentTypes = new Set([
  "application/pdf",
]);

export type AdminMediaAsset = {
  altText: string | null;
  byteSize: number;
  createdAt: Date;
  height: number | null;
  folderId: string | null;
  folderIds: string[];
  id: string;
  mimeType: string;
  originalByteSize: number | null;
  originalFileName: string | null;
  publicUrl: string;
  tags: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
  usageCount: number;
  width: number | null;
};

export type AdminMediaFolder = {
  id: string;
  name: string;
  slug: string;
};

export type MediaStorageSettings = {
  freeStorageQuotaMb: number;
  imageCompressionQuality: number;
  maxImageWidth: number;
  maxUploadFileMb: number;
  maxVideoUploadFileMb: number;
  maxVideoWidth: number;
  premiumStorageQuotaMb: number;
  videoCompressionCrf: number;
};

export type MediaLibraryScope =
  | {
      ownerUserId: string;
      surface: "admin" | "marketplace" | "seller";
      sellerId?: string;
    };

export type MediaStorageQuotaDetails = {
  excessBytes: number;
  fileCount: number;
  quotaBytes: number;
  uploadBytes: number;
  usedBytes: number;
};

export class MediaStorageQuotaError extends Error {
  code = "storage_full" as const;
  details: MediaStorageQuotaDetails;

  constructor(details: MediaStorageQuotaDetails) {
    super("Not enough storage. Free up space or unlock Premium to keep uploading.");
    this.name = "MediaStorageQuotaError";
    this.details = details;
  }
}

export async function getMediaStorageSettings(): Promise<MediaStorageSettings> {
  const [settings] = await db
    .select({
      freeStorageQuotaMb: marketplaceSettings.freeStorageQuotaMb,
      imageCompressionQuality: marketplaceSettings.imageCompressionQuality,
      maxImageWidth: marketplaceSettings.maxImageWidth,
      maxUploadFileMb: marketplaceSettings.maxUploadFileMb,
      maxVideoUploadFileMb: marketplaceSettings.maxVideoUploadFileMb,
      maxVideoWidth: marketplaceSettings.maxVideoWidth,
      premiumStorageQuotaMb: marketplaceSettings.premiumStorageQuotaMb,
      videoCompressionCrf: marketplaceSettings.videoCompressionCrf,
    })
    .from(marketplaceSettings)
    .where(eq(marketplaceSettings.id, 1))
    .limit(1);

  return {
    freeStorageQuotaMb: settings?.freeStorageQuotaMb ?? 512,
    imageCompressionQuality: settings?.imageCompressionQuality ?? 78,
    maxImageWidth: settings?.maxImageWidth ?? 2000,
    maxUploadFileMb: settings?.maxUploadFileMb ?? 10,
    maxVideoUploadFileMb: settings?.maxVideoUploadFileMb ?? 100,
    maxVideoWidth: settings?.maxVideoWidth ?? 1280,
    premiumStorageQuotaMb: settings?.premiumStorageQuotaMb ?? 5120,
    videoCompressionCrf: settings?.videoCompressionCrf ?? 28,
  };
}

export async function getScopedMediaLibrary(scope: MediaLibraryScope) {
  const mediaScope =
    scope.surface === "admin"
      ? "admin-media"
      : scope.surface === "seller"
        ? "seller-media"
        : "marketplace-media";
  const whereClause = scope.sellerId
    ? and(
        eq(media.ownerUserId, scope.ownerUserId),
        eq(media.sellerId, scope.sellerId),
        like(media.relativePath, `${mediaScope}/%`),
      )
    : and(
        eq(media.ownerUserId, scope.ownerUserId),
        like(media.relativePath, `${mediaScope}/%`),
      );
  const rows = await db
    .select({
      altText: media.altText,
      byteSize: media.byteSize,
      createdAt: media.createdAt,
      height: media.height,
      id: media.id,
      folderId: media.folderId,
      durationMs: media.durationMs,
      mimeType: media.mimeType,
      originalByteSize: media.originalByteSize,
      originalFileName: media.originalFileName,
      relativePath: media.relativePath,
      tags: media.tags,
      thumbnailRelativePath: media.thumbnailRelativePath,
      width: media.width,
    })
    .from(media)
    .where(whereClause)
    .orderBy(desc(media.createdAt))
    .limit(120);

  const [{ totalByteSize }] = await db
    .select({ totalByteSize: sql<number>`coalesce(sum(${media.byteSize}), 0)` })
    .from(media)
    .where(whereClause);

  const assetIds = rows.map((row) => row.id);
  const folderIdsByAssetId = await getFolderIdsByAssetId(assetIds);
  const usageCountByAssetId = await getMediaUsageCounts(assetIds);

  return {
    assets: rows.map((row) =>
      toAdminMediaAsset({
        ...row,
        folderIds: folderIdsByAssetId.get(row.id) ?? legacyFolderIds(row.folderId),
        usageCount: usageCountByAssetId.get(row.id) ?? 0,
      }),
    ),
    folders: await getScopedMediaFolders(scope),
    storage: await getMediaStorageSettings(),
    usedStorageBytes: Number(totalByteSize ?? 0),
  };
}

export async function getAdminMediaLibrary(ownerUserId: string) {
  return getScopedMediaLibrary({
    ownerUserId,
    surface: "admin",
  });
}

async function getScopedMediaFolders(
  scope: MediaLibraryScope,
): Promise<AdminMediaFolder[]> {
  const whereClause = scope.sellerId
    ? and(
        eq(mediaFolders.ownerUserId, scope.ownerUserId),
        eq(mediaFolders.sellerId, scope.sellerId),
      )
    : and(eq(mediaFolders.ownerUserId, scope.ownerUserId));

  return db
    .select({
      id: mediaFolders.id,
      name: mediaFolders.name,
      slug: mediaFolders.slug,
    })
    .from(mediaFolders)
    .where(whereClause)
    .orderBy(mediaFolders.createdAt);
}

export async function processAndStoreImageUpload(input: {
  altText?: string;
  excludeAssetId?: string;
  file: File;
  ownerUserId?: string;
  scope: string;
}) {
  const settings = await getMediaStorageSettings();
  const maxUploadBytes = settings.maxUploadFileMb * 1024 * 1024;

  if (!acceptedImageTypes.has(input.file.type)) {
    throw new Error("Upload a JPG, PNG, WebP, or AVIF image.");
  }

  if (input.file.size > maxUploadBytes) {
    throw new Error(`Keep uploads under ${settings.maxUploadFileMb} MB.`);
  }

  const sourceBuffer = Buffer.from(await input.file.arrayBuffer());
  const sourceHash = createHash("sha256").update(sourceBuffer).digest("hex");
  const image = sharp(sourceBuffer, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? null;
  const height = metadata.height ?? null;
  const outputRelativePath = createMediaRelativePath({
    mimeType: "image/webp",
    scope: input.scope,
  });
  const thumbnailRelativePath = createMediaRelativePath({
    mimeType: "image/webp",
    scope: `${input.scope}-thumbs`,
  });
  const outputBuffer = await image
    .resize({
      fit: "inside",
      width: settings.maxImageWidth,
      withoutEnlargement: true,
    })
    .webp({ effort: 5, quality: settings.imageCompressionQuality })
    .toBuffer();
  const thumbnailBuffer = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .resize({ fit: "cover", height: 360, width: 480 })
    .webp({ effort: 4, quality: 72 })
    .toBuffer();

  await writeMediaFile(outputRelativePath, outputBuffer);
  await writeMediaFile(thumbnailRelativePath, thumbnailBuffer);

  try {
    await assertStorageQuotaAfterOptimization({
      excludeAssetId: input.excludeAssetId,
      fileCount: 1,
      optimizedBytes: outputBuffer.byteLength,
      ownerUserId: input.ownerUserId,
      scope: input.scope,
      settings,
    });
  } catch (error) {
    await Promise.all([
      removeMediaFile(outputRelativePath),
      removeMediaFile(thumbnailRelativePath),
    ]);
    throw error;
  }

  const [asset] = await db
    .insert(media)
    .values({
      altText: input.altText?.trim() || null,
      byteSize: outputBuffer.byteLength,
      contentHash: sourceHash,
      height,
      isPublic: true,
      mimeType: "image/webp",
      originalByteSize: input.file.size,
      originalFileName: sanitizeFileName(input.file.name),
      originalMimeType: input.file.type,
      ownerUserId: input.ownerUserId,
      relativePath: outputRelativePath,
      thumbnailRelativePath,
      updatedAt: new Date(),
      width,
    })
    .returning({
      altText: media.altText,
      byteSize: media.byteSize,
      createdAt: media.createdAt,
      durationMs: media.durationMs,
      height: media.height,
      id: media.id,
      folderId: media.folderId,
      mimeType: media.mimeType,
      originalByteSize: media.originalByteSize,
      originalFileName: media.originalFileName,
      relativePath: media.relativePath,
      tags: media.tags,
      thumbnailRelativePath: media.thumbnailRelativePath,
      width: media.width,
    });

  return toAdminMediaAsset(asset);
}

export async function processAndStoreMediaUpload(input: {
  altText?: string;
  excludeAssetId?: string;
  file: File;
  ownerUserId?: string;
  scope: string;
}) {
  if (acceptedImageTypes.has(input.file.type)) {
    return processAndStoreImageUpload(input);
  }

  if (acceptedVideoTypes.has(input.file.type)) {
    return processAndStoreVideoUpload(input);
  }

  if (acceptedDocumentTypes.has(input.file.type)) {
    return processAndStoreDocumentUpload(input);
  }

  throw new Error("Upload an image, MP4/MOV/WebM video, or PDF document.");
}

export async function processAndStoreDocumentUpload(input: {
  altText?: string;
  excludeAssetId?: string;
  file: File;
  ownerUserId?: string;
  scope: string;
}) {
  const settings = await getMediaStorageSettings();
  const maxUploadBytes = settings.maxUploadFileMb * 1024 * 1024;

  if (!acceptedDocumentTypes.has(input.file.type)) {
    throw new Error("Upload a PDF document.");
  }

  if (input.file.size > maxUploadBytes) {
    throw new Error(`Keep document uploads under ${settings.maxUploadFileMb} MB.`);
  }

  const sourceBuffer = Buffer.from(await input.file.arrayBuffer());
  const sourceHash = createHash("sha256").update(sourceBuffer).digest("hex");
  const outputRelativePath = createMediaRelativePath({
    mimeType: input.file.type,
    scope: input.scope,
  });

  await writeMediaFile(outputRelativePath, sourceBuffer);

  try {
    await assertStorageQuotaAfterOptimization({
      excludeAssetId: input.excludeAssetId,
      fileCount: 1,
      optimizedBytes: sourceBuffer.byteLength,
      ownerUserId: input.ownerUserId,
      scope: input.scope,
      settings,
    });
  } catch (error) {
    await removeMediaFile(outputRelativePath);
    throw error;
  }

  const [asset] = await db
    .insert(media)
    .values({
      altText: input.altText?.trim() || null,
      byteSize: sourceBuffer.byteLength,
      contentHash: sourceHash,
      isPublic: true,
      mimeType: input.file.type,
      originalByteSize: input.file.size,
      originalFileName: sanitizeFileName(input.file.name),
      originalMimeType: input.file.type,
      ownerUserId: input.ownerUserId,
      relativePath: outputRelativePath,
      updatedAt: new Date(),
    })
    .returning({
      altText: media.altText,
      byteSize: media.byteSize,
      createdAt: media.createdAt,
      durationMs: media.durationMs,
      height: media.height,
      id: media.id,
      folderId: media.folderId,
      mimeType: media.mimeType,
      originalByteSize: media.originalByteSize,
      originalFileName: media.originalFileName,
      relativePath: media.relativePath,
      tags: media.tags,
      thumbnailRelativePath: media.thumbnailRelativePath,
      width: media.width,
    });

  return toAdminMediaAsset(asset);
}

export async function processAndStoreVideoUpload(input: {
  altText?: string;
  excludeAssetId?: string;
  file: File;
  ownerUserId?: string;
  scope: string;
}) {
  const settings = await getMediaStorageSettings();
  const maxUploadBytes = settings.maxVideoUploadFileMb * 1024 * 1024;

  if (!ffmpegPath) {
    throw new Error("FFmpeg is not available for video processing.");
  }

  if (!acceptedVideoTypes.has(input.file.type)) {
    throw new Error("Upload an MP4, MOV, or WebM video.");
  }

  if (input.file.size > maxUploadBytes) {
    throw new Error(
      `Keep video uploads under ${settings.maxVideoUploadFileMb} MB.`,
    );
  }

  const sourceBuffer = Buffer.from(await input.file.arrayBuffer());
  const sourceHash = createHash("sha256").update(sourceBuffer).digest("hex");
  const tempDir = path.join(os.tmpdir(), `piessang-media-${randomUUID()}`);
  const inputPath = path.join(tempDir, sanitizeFileName(input.file.name));
  const outputPath = path.join(tempDir, "optimized.mp4");
  const posterPath = path.join(tempDir, "poster.jpg");
  const outputRelativePath = createMediaRelativePath({
    mimeType: "video/mp4",
    scope: input.scope,
  });
  const posterRelativePath = createMediaRelativePath({
    mimeType: "image/webp",
    scope: `${input.scope}-thumbs`,
  });

  await mkdir(tempDir, { recursive: true });

  try {
    await writeFile(inputPath, sourceBuffer);
    const probe = await probeVideo(inputPath);

    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vf",
      `scale='min(${settings.maxVideoWidth},iw)':-2`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      String(settings.videoCompressionCrf),
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      outputPath,
    ]);

    await runFfmpeg([
      "-y",
      "-ss",
      probe.durationMs && probe.durationMs > 3000 ? "00:00:01" : "00:00:00",
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-vf",
      "scale='min(960,iw)':-2",
      posterPath,
    ]);

    const outputBuffer = await readFile(outputPath);
    const posterBuffer = await sharp(await readFile(posterPath), {
      failOn: "none",
    })
      .resize({ fit: "cover", height: 540, width: 960 })
      .webp({ effort: 4, quality: 76 })
      .toBuffer();

    await writeMediaFile(outputRelativePath, outputBuffer);
    await writeMediaFile(posterRelativePath, posterBuffer);

    try {
      await assertStorageQuotaAfterOptimization({
        excludeAssetId: input.excludeAssetId,
        fileCount: 1,
        optimizedBytes: outputBuffer.byteLength,
        ownerUserId: input.ownerUserId,
        scope: input.scope,
        settings,
      });
    } catch (error) {
      await Promise.all([
        removeMediaFile(outputRelativePath),
        removeMediaFile(posterRelativePath),
      ]);
      throw error;
    }

    const [asset] = await db
      .insert(media)
      .values({
        altText: input.altText?.trim() || null,
        byteSize: outputBuffer.byteLength,
        contentHash: sourceHash,
        durationMs: probe.durationMs,
        height: probe.height,
        isPublic: true,
        mimeType: "video/mp4",
        originalByteSize: input.file.size,
        originalFileName: sanitizeFileName(input.file.name),
        originalMimeType: input.file.type,
        ownerUserId: input.ownerUserId,
        relativePath: outputRelativePath,
        thumbnailRelativePath: posterRelativePath,
        updatedAt: new Date(),
        width: probe.width,
      })
      .returning({
        altText: media.altText,
        byteSize: media.byteSize,
        createdAt: media.createdAt,
        durationMs: media.durationMs,
        height: media.height,
        id: media.id,
        folderId: media.folderId,
        mimeType: media.mimeType,
        originalByteSize: media.originalByteSize,
        originalFileName: media.originalFileName,
        relativePath: media.relativePath,
        tags: media.tags,
        thumbnailRelativePath: media.thumbnailRelativePath,
        width: media.width,
      });

    return toAdminMediaAsset(asset);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function toAdminMediaAsset(row: {
  altText: string | null;
  byteSize: number;
  createdAt: Date;
    height: number | null;
  folderId: string | null;
  folderIds?: string[];
  durationMs?: number | null;
  id: string;
  mimeType: string;
  originalByteSize: number | null;
  originalFileName: string | null;
  relativePath: string;
  tags: string | null;
  thumbnailRelativePath: string | null;
  usageCount?: number;
  width: number | null;
}): AdminMediaAsset {
  return {
    altText: row.altText,
    byteSize: row.byteSize,
    createdAt: row.createdAt,
    height: row.height,
    folderId: row.folderId,
    folderIds: row.folderIds ?? legacyFolderIds(row.folderId),
    durationMs: row.durationMs ?? null,
    id: row.id,
    mimeType: row.mimeType,
    originalByteSize: row.originalByteSize,
    originalFileName: row.originalFileName,
    publicUrl: getMediaPublicUrl(row.relativePath),
    tags: row.tags,
    thumbnailUrl: row.thumbnailRelativePath
      ? getMediaPublicUrl(row.thumbnailRelativePath)
      : null,
    usageCount: row.usageCount ?? 0,
    width: row.width,
  };
}

async function getFolderIdsByAssetId(assetIds: string[]) {
  const folderIdsByAssetId = new Map<string, string[]>();

  if (assetIds.length === 0) {
    return folderIdsByAssetId;
  }

  const rows = await db
    .select({
      folderId: mediaFolderAssignments.folderId,
      mediaId: mediaFolderAssignments.mediaId,
    })
    .from(mediaFolderAssignments)
    .where(inArray(mediaFolderAssignments.mediaId, assetIds));

  rows.forEach((row) => {
    const folderIds = folderIdsByAssetId.get(row.mediaId) ?? [];
    folderIds.push(row.folderId);
    folderIdsByAssetId.set(row.mediaId, folderIds);
  });

  return folderIdsByAssetId;
}

export async function getMediaUsageCounts(assetIds: string[]) {
  const usageCountsByAssetId = new Map<string, number>();

  if (assetIds.length === 0) {
    return usageCountsByAssetId;
  }

  const brandUsageRows = await db
    .select({
      mediaId: brands.logoMediaId,
      usageCount: sql<number>`count(*)::int`,
    })
    .from(brands)
    .where(inArray(brands.logoMediaId, assetIds))
    .groupBy(brands.logoMediaId);

  brandUsageRows.forEach((row) => {
    if (!row.mediaId) {
      return;
    }

    usageCountsByAssetId.set(
      row.mediaId,
      (usageCountsByAssetId.get(row.mediaId) ?? 0) + Number(row.usageCount ?? 0),
    );
  });

  return usageCountsByAssetId;
}

export async function getMediaUsageCount(assetId: string) {
  const counts = await getMediaUsageCounts([assetId]);

  return counts.get(assetId) ?? 0;
}

function legacyFolderIds(folderId: string | null) {
  return folderId ? [folderId] : [];
}

export async function replaceStoredMediaAsset(input: {
  assetId: string;
  file: File;
  ownerUserId: string;
  scope: string;
}) {
  const [currentAsset] = await db
    .select({
      folderId: media.folderId,
      id: media.id,
      relativePath: media.relativePath,
      thumbnailRelativePath: media.thumbnailRelativePath,
    })
    .from(media)
    .where(and(eq(media.id, input.assetId), eq(media.ownerUserId, input.ownerUserId)))
    .limit(1);

  if (!currentAsset) {
    throw new Error("Media asset was not found.");
  }

  const replacement = await processAndStoreMediaUpload({
    excludeAssetId: currentAsset.id,
    file: input.file,
    ownerUserId: input.ownerUserId,
    scope: input.scope,
  });

  const [replacementRow] = await db
    .select({
      byteSize: media.byteSize,
      contentHash: media.contentHash,
      durationMs: media.durationMs,
      height: media.height,
      mimeType: media.mimeType,
      originalByteSize: media.originalByteSize,
      originalFileName: media.originalFileName,
      originalMimeType: media.originalMimeType,
      relativePath: media.relativePath,
      thumbnailRelativePath: media.thumbnailRelativePath,
      width: media.width,
    })
    .from(media)
    .where(eq(media.id, replacement.id))
    .limit(1);

  if (!replacementRow) {
    throw new Error("Could not prepare replacement media.");
  }

  await db
    .update(media)
    .set({
      byteSize: replacementRow.byteSize,
      contentHash: replacementRow.contentHash,
      durationMs: replacementRow.durationMs,
      height: replacementRow.height,
      mimeType: replacementRow.mimeType,
      originalByteSize: replacementRow.originalByteSize,
      originalFileName: replacementRow.originalFileName,
      originalMimeType: replacementRow.originalMimeType,
      relativePath: replacementRow.relativePath,
      thumbnailRelativePath: replacementRow.thumbnailRelativePath,
      updatedAt: new Date(),
      width: replacementRow.width,
    })
    .where(eq(media.id, currentAsset.id));

  await db.delete(media).where(eq(media.id, replacement.id));
  await Promise.all(
    [currentAsset.relativePath, currentAsset.thumbnailRelativePath]
      .filter((relativePath): relativePath is string => Boolean(relativePath))
      .map((relativePath) => removeMediaFile(relativePath)),
  );

  const [updatedAsset] = await db
    .select({
      altText: media.altText,
      byteSize: media.byteSize,
      createdAt: media.createdAt,
      durationMs: media.durationMs,
      folderId: media.folderId,
      height: media.height,
      id: media.id,
      mimeType: media.mimeType,
      originalByteSize: media.originalByteSize,
      originalFileName: media.originalFileName,
      relativePath: media.relativePath,
      tags: media.tags,
      thumbnailRelativePath: media.thumbnailRelativePath,
      width: media.width,
    })
    .from(media)
    .where(eq(media.id, currentAsset.id))
    .limit(1);

  return toAdminMediaAsset(updatedAsset);
}

async function assertStorageQuotaAfterOptimization(input: {
  excludeAssetId?: string;
  fileCount: number;
  optimizedBytes: number;
  ownerUserId?: string;
  scope: string;
  settings: MediaStorageSettings;
}) {
  if (!input.ownerUserId) {
    return;
  }

  const quotaBytes = input.settings.freeStorageQuotaMb * 1024 * 1024;
  const usedBytes = await getUsedStorageBytes({
    excludeAssetId: input.excludeAssetId,
    ownerUserId: input.ownerUserId,
    scope: input.scope,
  });
  const projectedBytes = usedBytes + input.optimizedBytes;

  if (projectedBytes <= quotaBytes) {
    return;
  }

  throw new MediaStorageQuotaError({
    excessBytes: projectedBytes - quotaBytes,
    fileCount: input.fileCount,
    quotaBytes,
    uploadBytes: input.optimizedBytes,
    usedBytes,
  });
}

async function getUsedStorageBytes(input: {
  excludeAssetId?: string;
  ownerUserId: string;
  scope: string;
}) {
  const whereClause = input.excludeAssetId
    ? and(
        eq(media.ownerUserId, input.ownerUserId),
        like(media.relativePath, `${input.scope}/%`),
        ne(media.id, input.excludeAssetId),
      )
    : and(
        eq(media.ownerUserId, input.ownerUserId),
        like(media.relativePath, `${input.scope}/%`),
      );

  const [{ totalByteSize }] = await db
    .select({ totalByteSize: sql<number>`coalesce(sum(${media.byteSize}), 0)` })
    .from(media)
    .where(whereClause);

  return Number(totalByteSize ?? 0);
}

async function removeMediaFile(relativePath: string) {
  const normalizedPath = normalizeRelativeMediaPath(relativePath);
  const mediaRoot = path.resolve(env.MEDIA_ROOT);
  const absolutePath = path.resolve(mediaRoot, normalizedPath);

  if (!absolutePath.startsWith(mediaRoot)) {
    return;
  }

  await rm(absolutePath, { force: true });
}

async function probeVideo(inputPath: string) {
  const result = await runFfmpeg(["-i", inputPath], { allowFailure: true });
  const output = `${result.stdout}\n${result.stderr}`;
  const durationMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const sizeMatch = output.match(
    /Video:.*?[, ](\d{2,5})x(\d{2,5})(?:[, ]|\s)/,
  );

  return {
    durationMs: durationMatch
      ? Math.round(
          (Number(durationMatch[1]) * 60 * 60 +
            Number(durationMatch[2]) * 60 +
            Number(durationMatch[3])) *
            1000,
        )
      : null,
    height: sizeMatch ? Number(sizeMatch[2]) : null,
    width: sizeMatch ? Number(sizeMatch[1]) : null,
  };
}

async function runFfmpeg(
  args: string[],
  options: { allowFailure?: boolean } = {},
) {
  if (!ffmpegPath) {
    throw new Error("FFmpeg is not available.");
  }

  const executablePath = ffmpegPath;

  return new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
    const child = spawn(executablePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      const result = {
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
      };

      if (code === 0 || options.allowFailure) {
        resolve(result);
        return;
      }

      reject(new Error("Video processing failed."));
    });
  });
}

async function writeMediaFile(relativePath: string, buffer: Buffer) {
  const normalizedPath = normalizeRelativeMediaPath(relativePath);
  const absolutePath = path.resolve(env.MEDIA_ROOT, normalizedPath);
  const mediaRoot = path.resolve(env.MEDIA_ROOT);

  if (!absolutePath.startsWith(mediaRoot)) {
    throw new Error("Media path escaped the media root.");
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
}

function sanitizeFileName(fileName: string) {
  return path.basename(fileName).replace(/[^\w.\- ]+/g, "").slice(0, 255);
}
