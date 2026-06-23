"use server";

import { rm } from "node:fs/promises";
import path from "node:path";

import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { env } from "@/src/config/env";
import { db } from "@/src/db";
import { media } from "@/src/db/schema";
import { getMediaUsageCount } from "@/src/modules/media/admin";
import { normalizeRelativeMediaPath } from "@/src/modules/media/paths";

export type OwnerMediaDeleteState = {
  deletedId?: string;
  message?: string;
  ok?: boolean;
};

export async function deleteOwnerMediaAsset(
  id: string,
): Promise<OwnerMediaDeleteState> {
  const session = await auth();

  if (!session?.user) {
    return { ok: false, message: "Sign in before managing media." };
  }

  const [asset] = await db
    .select({
      id: media.id,
      relativePath: media.relativePath,
      thumbnailRelativePath: media.thumbnailRelativePath,
    })
    .from(media)
    .where(and(eq(media.id, id), eq(media.ownerUserId, session.user.id)))
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
    await db.delete(media).where(eq(media.id, asset.id));
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
      .map((relativePath) => removeOwnerMediaFile(relativePath)),
  );

  return {
    deletedId: asset.id,
    ok: true,
    message: "Media asset deleted.",
  };
}

async function removeOwnerMediaFile(relativePath: string) {
  const normalizedPath = normalizeRelativeMediaPath(relativePath);
  const mediaRoot = path.resolve(env.MEDIA_ROOT);
  const absolutePath = path.resolve(mediaRoot, normalizedPath);

  if (!absolutePath.startsWith(mediaRoot)) {
    return;
  }

  await rm(absolutePath, { force: true });
}
