import { readFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";

import { env } from "@/src/config/env";
import { db } from "@/src/db";
import { media } from "@/src/db/schema";
import { normalizeRelativeMediaPath } from "@/src/modules/media/paths";

export const runtime = "nodejs";

const mediaIdSchema = z.string().uuid();
const imageExtensions = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"]);

function notFound() {
  return new Response("Not found", { status: 404 });
}

function resolveMediaPath(relativePath: string) {
  const normalizedPath = normalizeRelativeMediaPath(relativePath);
  const mediaRoot = path.resolve(env.MEDIA_ROOT);
  const absolutePath = path.resolve(mediaRoot, normalizedPath);
  const relativeToRoot = path.relative(mediaRoot, absolutePath);

  if (
    !relativeToRoot ||
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot)
  ) {
    return null;
  }

  return absolutePath;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  const { mediaId } = await params;
  const parsedMediaId = mediaIdSchema.safeParse(mediaId);

  if (!parsedMediaId.success) {
    return notFound();
  }

  const [asset] = await db
    .select({
      isPublic: media.isPublic,
      mimeType: media.mimeType,
      relativePath: media.relativePath,
      thumbnailRelativePath: media.thumbnailRelativePath,
    })
    .from(media)
    .where(eq(media.id, parsedMediaId.data))
    .limit(1);

  if (!asset?.isPublic) {
    return notFound();
  }

  const sourcePath = asset.thumbnailRelativePath ?? asset.relativePath;
  const sourceIsImage =
    Boolean(asset.thumbnailRelativePath) || asset.mimeType.startsWith("image/");

  if (
    !sourceIsImage ||
    !imageExtensions.has(path.extname(sourcePath).toLowerCase())
  ) {
    return notFound();
  }

  let absolutePath: string | null;

  try {
    absolutePath = resolveMediaPath(sourcePath);
  } catch {
    return notFound();
  }

  if (!absolutePath) {
    return notFound();
  }

  try {
    const source = await readFile(absolutePath);
    const jpeg = await sharp(source, { failOn: "error" })
      .rotate()
      .resize({
        fit: "inside",
        height: 1200,
        width: 1200,
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .toColourspace("srgb")
      .jpeg({ quality: 82 })
      .toBuffer();
    const body = Uint8Array.from(jpeg);

    return new Response(body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(body.byteLength),
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
