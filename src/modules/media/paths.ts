import { randomUUID } from "node:crypto";
import path from "node:path";

const mimeExtensions: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/csv": "csv",
};

const safeSegmentPattern = /^[a-z0-9][a-z0-9-]*$/;

export function getMediaPublicUrl(relativePath: string) {
  return `/media/${normalizeRelativeMediaPath(relativePath)}`;
}

export function createMediaRelativePath(input: {
  scope: string;
  mimeType: string;
  now?: Date;
}) {
  const scope = normalizeMediaSegment(input.scope);
  const extension = getExtensionForMimeType(input.mimeType);
  const date = input.now ?? new Date();
  const year = date.getUTCFullYear().toString();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const fileName = `${randomUUID()}.${extension}`;

  return path.posix.join(scope, year, month, fileName);
}

export function normalizeRelativeMediaPath(relativePath: string) {
  const normalized = path.posix.normalize(relativePath).replace(/^\/+/, "");

  if (
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error("Media path must be a relative path inside the media root.");
  }

  return normalized;
}

function normalizeMediaSegment(segment: string) {
  const normalized = segment.trim().toLowerCase();

  if (!safeSegmentPattern.test(normalized)) {
    throw new Error("Media scope must use lowercase letters, numbers, and hyphens.");
  }

  return normalized;
}

function getExtensionForMimeType(mimeType: string) {
  const extension = mimeExtensions[mimeType.toLowerCase()];

  if (!extension) {
    throw new Error(`Unsupported media MIME type: ${mimeType}`);
  }

  return extension;
}
