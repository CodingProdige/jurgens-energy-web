"use server";

import { rm } from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";

import { env } from "@/src/config/env";
import { db } from "@/src/db";
import { media, mediaFolderAssignments, mediaFolders } from "@/src/db/schema";
import { requireAdminAccess } from "@/src/modules/auth/permissions";
import {
  getMediaUsageCount,
  processAndStoreMediaUpload,
} from "@/src/modules/media/admin";
import { normalizeRelativeMediaPath } from "@/src/modules/media/paths";

export type MediaUploadState = {
  asset?: Awaited<ReturnType<typeof processAndStoreMediaUpload>>;
  assets?: Awaited<ReturnType<typeof processAndStoreMediaUpload>>[];
  message?: string;
  ok?: boolean;
};

export type MediaMetadataState = {
  message?: string;
  ok?: boolean;
};

export type MediaDeleteState = {
  deletedId?: string;
  message?: string;
  ok?: boolean;
};

export type MediaFolderState = {
  folder?: {
    id: string;
    name: string;
    slug: string;
  };
  message?: string;
  ok?: boolean;
};

export type MediaMoveState = {
  folderId?: string | null;
  folderIds?: string[];
  id?: string;
  message?: string;
  ok?: boolean;
};

const uploadSchema = z.object({
  altText: z.string().trim().max(240).optional(),
  acceptedMediaTypes: z
    .array(z.enum(["document", "image", "video"]))
    .min(1)
    .default(["image", "video"]),
  scope: z.string().trim().regex(/^[a-z0-9][a-z0-9-]*$/),
});

const metadataSchema = z.object({
  altText: z.string().trim().max(240).optional(),
  id: z.string().uuid(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

const MEDIA_FOLDER_NAME_MAX_LENGTH = 25;

const folderSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(MEDIA_FOLDER_NAME_MAX_LENGTH),
});

const folderAssignmentsSchema = z.object({
  folderIds: z.array(z.string().uuid()).max(20),
  id: z.string().uuid(),
});

function getFileMediaType(file: File) {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  if (file.type.toLowerCase() === "application/pdf") {
    return "document";
  }

  return "unknown";
}

export async function uploadAdminMedia(
  _state: MediaUploadState,
  formData: FormData,
): Promise<MediaUploadState> {
  const session = await requireAdminAccess();
  const files = formData
    .getAll("file")
    .filter((file): file is File => file instanceof File && file.size > 0);
  const parsed = uploadSchema.safeParse({
    acceptedMediaTypes: formData.getAll("acceptedMediaTypes"),
    altText: String(formData.get("altText") ?? ""),
    scope: String(formData.get("scope") ?? "admin-media"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Check the upload details." };
  }

  if (files.length === 0) {
    return { ok: false, message: "Choose media files to upload." };
  }

  const blockedFile = files.find(
    (file) => {
      const mediaType = getFileMediaType(file);

      return (
        mediaType === "unknown" ||
        !parsed.data.acceptedMediaTypes.includes(mediaType)
      );
    },
  );

  if (blockedFile) {
    return {
      ok: false,
      message: `This picker does not accept ${getFileMediaType(blockedFile)} files.`,
    };
  }

  try {
    const assets = [];

    for (const file of files) {
      assets.push(
        await processAndStoreMediaUpload({
          altText: parsed.data.altText,
          file,
          ownerUserId: session.user.id,
          scope: "admin-media",
        }),
      );
    }

    revalidatePath("/brands");

    return {
      asset: assets[0],
      assets,
      ok: true,
      message:
        assets.length === 1
          ? "Media uploaded and optimized."
          : `${assets.length} media files uploaded and optimized.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not process the uploaded media.",
    };
  }
}

export async function updateAdminMediaMetadata(
  _state: MediaMetadataState,
  formData: FormData,
): Promise<MediaMetadataState> {
  const session = await requireAdminAccess();

  const parsed = metadataSchema.safeParse({
    altText: String(formData.get("altText") ?? ""),
    id: String(formData.get("id") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: "Check the media details." };
  }

  await db
    .update(media)
    .set({
      altText: parsed.data.altText || null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(media.id, parsed.data.id), eq(media.ownerUserId, session.user.id)),
    );

  revalidatePath("/brands");

  return { ok: true, message: "Media details saved." };
}

export async function deleteAdminMediaAsset(
  id: string,
): Promise<MediaDeleteState> {
  const session = await requireAdminAccess();

  const parsed = deleteSchema.safeParse({ id });

  if (!parsed.success) {
    return { ok: false, message: "Choose a valid media asset to delete." };
  }

  const [asset] = await db
    .select({
      id: media.id,
      relativePath: media.relativePath,
      thumbnailRelativePath: media.thumbnailRelativePath,
    })
    .from(media)
    .where(
      and(eq(media.id, parsed.data.id), eq(media.ownerUserId, session.user.id)),
    )
    .limit(1);

  if (!asset) {
    return { ok: false, message: "Media asset was not found." };
  }

  const usageCount = await getMediaUsageCount(asset.id);

  if (usageCount > 0) {
    return {
      ok: false,
      message:
        usageCount === 1
          ? "This media is currently used by 1 platform record. Remove that usage before deleting it."
          : `This media is currently used by ${usageCount} platform records. Remove those usages before deleting it.`,
    };
  }

  try {
    await db.delete(media).where(eq(media.id, parsed.data.id));
  } catch {
    return {
      ok: false,
      message:
        "This media is still in use. Remove it from the linked item before deleting it.",
    };
  }

  await Promise.all(
    [asset.relativePath, asset.thumbnailRelativePath]
      .filter((relativePath): relativePath is string => Boolean(relativePath))
      .map((relativePath) => removeMediaFile(relativePath)),
  );

  revalidatePath("/brands");

  return {
    deletedId: asset.id,
    ok: true,
    message: "Media asset deleted.",
  };
}

export async function createAdminMediaFolder(
  name: string,
): Promise<MediaFolderState> {
  const session = await requireAdminAccess();
  const parsed = folderSchema.safeParse({ name });

  if (!parsed.success) {
    return {
      ok: false,
      message: `Folder names can be up to ${MEDIA_FOLDER_NAME_MAX_LENGTH} characters.`,
    };
  }

  const [folder] = await db
    .insert(mediaFolders)
    .values({
      name: parsed.data.name,
      ownerUserId: session.user.id,
      slug: slugify(parsed.data.name),
    })
    .returning({
      id: mediaFolders.id,
      name: mediaFolders.name,
      slug: mediaFolders.slug,
    });

  revalidatePath("/brands");

  return { folder, ok: true, message: "Folder created." };
}

export async function renameAdminMediaFolder(
  id: string,
  name: string,
): Promise<MediaFolderState> {
  const session = await requireAdminAccess();
  const parsed = folderSchema.safeParse({ id, name });

  if (!parsed.success || !parsed.data.id) {
    return {
      ok: false,
      message: `Folder names can be up to ${MEDIA_FOLDER_NAME_MAX_LENGTH} characters.`,
    };
  }

  const [folder] = await db
    .update(mediaFolders)
    .set({
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
    })
    .where(
      and(
        eq(mediaFolders.id, parsed.data.id),
        eq(mediaFolders.ownerUserId, session.user.id),
      ),
    )
    .returning({
      id: mediaFolders.id,
      name: mediaFolders.name,
      slug: mediaFolders.slug,
    });

  if (!folder) {
    return { ok: false, message: "Folder was not found." };
  }

  revalidatePath("/brands");

  return { folder, ok: true, message: "Folder renamed." };
}

export async function deleteAdminMediaFolder(
  id: string,
): Promise<MediaFolderState> {
  const session = await requireAdminAccess();
  const parsed = z.string().uuid().safeParse(id);

  if (!parsed.success) {
    return { ok: false, message: "Choose a valid folder." };
  }

  const [folder] = await db
    .delete(mediaFolders)
    .where(
      and(eq(mediaFolders.id, parsed.data), eq(mediaFolders.ownerUserId, session.user.id)),
    )
    .returning({
      id: mediaFolders.id,
      name: mediaFolders.name,
      slug: mediaFolders.slug,
    });

  if (!folder) {
    return { ok: false, message: "Folder was not found." };
  }

  revalidatePath("/brands");

  return { ok: true, message: "Folder deleted." };
}

export async function moveAdminMediaAssetToFolder(input: {
  folderId: string | null;
  id: string;
}): Promise<MediaMoveState> {
  return setAdminMediaAssetFolders({
    folderIds: input.folderId ? [input.folderId] : [],
    id: input.id,
  });
}

export async function setAdminMediaAssetFolders(input: {
  folderIds: string[];
  id: string;
}): Promise<MediaMoveState> {
  const session = await requireAdminAccess();
  const parsed = folderAssignmentsSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Choose a valid media asset and folders." };
  }

  const folderIds = [...new Set(parsed.data.folderIds)];

  if (folderIds.length) {
    const ownedFolders = await db
      .select({
        id: mediaFolders.id,
      })
      .from(mediaFolders)
      .where(
        and(
          inArray(mediaFolders.id, folderIds),
          eq(mediaFolders.ownerUserId, session.user.id),
        ),
      );

    if (ownedFolders.length !== folderIds.length) {
      return { ok: false, message: "One or more folders were not found." };
    }
  }

  const [asset] = await db
    .update(media)
    .set({
      folderId: folderIds[0] ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(media.id, parsed.data.id), eq(media.ownerUserId, session.user.id)))
    .returning({
      folderId: media.folderId,
      id: media.id,
    });

  if (!asset) {
    return { ok: false, message: "Media asset was not found." };
  }

  await db
    .delete(mediaFolderAssignments)
    .where(eq(mediaFolderAssignments.mediaId, parsed.data.id));

  if (folderIds.length) {
    await db.insert(mediaFolderAssignments).values(
      folderIds.map((folderId) => ({
        folderId,
        mediaId: parsed.data.id,
      })),
    );
  }

  revalidatePath("/brands");

  return {
    folderId: folderIds[0] ?? null,
    folderIds,
    id: asset.id,
    ok: true,
    message: "Media folders updated.",
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
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
