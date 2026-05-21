import { readFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/src/config/env";
import { normalizeRelativeMediaPath } from "@/src/modules/media/paths";

const contentTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const params = await context.params;
  const relativePath = normalizeRelativeMediaPath(params.path.join("/"));
  const mediaRoot = path.resolve(env.MEDIA_ROOT);
  const absolutePath = path.resolve(mediaRoot, relativePath);

  if (!absolutePath.startsWith(mediaRoot)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const buffer = await readFile(absolutePath);
    const contentType =
      contentTypes[path.extname(absolutePath).toLowerCase()] ??
      "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentType,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
