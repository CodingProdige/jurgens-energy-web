export type ResolvedMediaByteRange =
  | { kind: "full" }
  | {
      end: number;
      kind: "partial";
      length: number;
      start: number;
    }
  | { kind: "unsatisfiable" };

const singleByteRangePattern = /^bytes=(\d*)-(\d*)$/i;

export function resolveMediaByteRange(
  rangeHeader: string | null,
  fileSize: number,
): ResolvedMediaByteRange {
  if (!rangeHeader) {
    return { kind: "full" };
  }

  if (!Number.isSafeInteger(fileSize) || fileSize < 0) {
    return { kind: "unsatisfiable" };
  }

  const match = singleByteRangePattern.exec(rangeHeader.trim());

  if (!match || fileSize === 0) {
    return { kind: "unsatisfiable" };
  }

  const [, startValue, endValue] = match;

  if (!startValue && !endValue) {
    return { kind: "unsatisfiable" };
  }

  if (!startValue) {
    const suffixLength = Number(endValue);

    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return { kind: "unsatisfiable" };
    }

    const start = Math.max(fileSize - suffixLength, 0);
    const end = fileSize - 1;

    return {
      end,
      kind: "partial",
      length: end - start + 1,
      start,
    };
  }

  const start = Number(startValue);

  if (!Number.isSafeInteger(start) || start < 0 || start >= fileSize) {
    return { kind: "unsatisfiable" };
  }

  const requestedEnd = endValue ? Number(endValue) : fileSize - 1;

  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) {
    return { kind: "unsatisfiable" };
  }

  const end = Math.min(requestedEnd, fileSize - 1);

  return {
    end,
    kind: "partial",
    length: end - start + 1,
    start,
  };
}
