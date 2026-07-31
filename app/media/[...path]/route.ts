import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { env } from "@/src/config/env";
import { resolveMediaByteRange } from "@/src/modules/media/http-range";
import { normalizeRelativeMediaPath } from "@/src/modules/media/paths";

const contentTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".webp": "image/webp",
};

const immutableMediaCacheControl = "public, max-age=31536000, immutable";

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return serveMedia(request, context, false);
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return serveMedia(request, context, true);
}

async function serveMedia(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
  headOnly: boolean,
) {
  try {
    const params = await context.params;
    const relativePath = normalizeRelativeMediaPath(params.path.join("/"));
    const mediaRoot = await realpath(path.resolve(env.MEDIA_ROOT));
    const requestedPath = path.resolve(mediaRoot, relativePath);
    const absolutePath = await realpath(requestedPath);
    const pathFromMediaRoot = path.relative(mediaRoot, absolutePath);

    if (
      pathFromMediaRoot === "" ||
      pathFromMediaRoot.startsWith(`..${path.sep}`) ||
      pathFromMediaRoot === ".." ||
      path.isAbsolute(pathFromMediaRoot)
    ) {
      return createNotFoundResponse(headOnly);
    }

    const file = await stat(absolutePath);

    if (!file.isFile()) {
      return createNotFoundResponse(headOnly);
    }

    const contentType =
      contentTypes[path.extname(absolutePath).toLowerCase()] ??
      "application/octet-stream";
    const range = resolveMediaByteRange(request.headers.get("range"), file.size);
    const sharedHeaders = {
      "Accept-Ranges": "bytes",
      "Cache-Control": immutableMediaCacheControl,
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    };

    if (range.kind === "unsatisfiable") {
      return new Response(null, {
        headers: {
          ...sharedHeaders,
          "Content-Length": "0",
          "Content-Range": `bytes */${file.size}`,
        },
        status: 416,
      });
    }

    if (range.kind === "partial") {
      return new Response(
        headOnly
          ? null
          : toWebStream(
              createReadStream(absolutePath, {
                end: range.end,
                start: range.start,
              }),
            ),
        {
          headers: {
            ...sharedHeaders,
            "Content-Length": range.length.toString(),
            "Content-Range": `bytes ${range.start}-${range.end}/${file.size}`,
          },
          status: 206,
        },
      );
    }

    return new Response(
      headOnly ? null : toWebStream(createReadStream(absolutePath)),
      {
        headers: {
          ...sharedHeaders,
          "Content-Length": file.size.toString(),
        },
      },
    );
  } catch {
    return createNotFoundResponse(headOnly);
  }
}

function createNotFoundResponse(headOnly: boolean) {
  return new Response(headOnly ? null : "Not found", { status: 404 });
}

function toWebStream(stream: Readable) {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}
