const maxDisplayNameLength = 80;
const maxFirstNameLength = 40;
const honorifics = new Set(["dr", "miss", "mr", "mrs", "ms", "prof"]);
const controlCharacterPattern =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;
const phoneLikePattern = /^\+?[\d().\-\s]{7,}$/u;
const promptInjectionPatterns = [
  /\b(?:ignore|disregard|forget|override)\b.{0,40}\b(?:instruction|message|prompt|rule)s?\b/iu,
  /\b(?:assistant|developer|system|user)\s*(?::\s*|(?:message|prompt|instruction)\b)/iu,
  /\bdo\s+not\s+follow\b.{0,40}\b(?:instruction|message|prompt|rule)s?\b/iu,
  /\b(?:act|pretend)\s+as\b/iu,
  /\b(?:jailbreak|prompt\s+injection)\b/iu,
] as const;

function sliceUnicode(value: string, maximumLength: number) {
  return Array.from(value).slice(0, maximumLength).join("");
}

export function sanitizeWhatsappDisplayName(
  input: string | null | undefined,
): string | null {
  if (typeof input !== "string" || !input.trim()) {
    return null;
  }

  if (controlCharacterPattern.test(input)) {
    return null;
  }

  const normalized = sliceUnicode(
    input.normalize("NFKC").replace(/\s+/gu, " ").trim(),
    maxDisplayNameLength,
  );

  if (
    !normalized ||
    !/\p{L}/u.test(normalized) ||
    phoneLikePattern.test(normalized) ||
    /(?:https?:\/\/|www\.|\S+@\S+\.\S+)/iu.test(normalized) ||
    promptInjectionPatterns.some((pattern) => pattern.test(normalized))
  ) {
    return null;
  }

  return normalized;
}

export function getWhatsappFirstName(
  input: string | null | undefined,
): string | null {
  const displayName = sanitizeWhatsappDisplayName(input);

  if (!displayName) {
    return null;
  }

  const nameParts = displayName
    .split(/\s+/u)
    .map((part) => part.match(/[\p{L}\p{M}]+(?:['’.-][\p{L}\p{M}]+)*/u)?.[0])
    .filter((part): part is string => Boolean(part));
  const firstName =
    nameParts.find((part, index) => {
      return index === nameParts.length - 1 || !honorifics.has(part.toLowerCase());
    }) ?? null;

  return firstName ? sliceUnicode(firstName, maxFirstNameLength) : null;
}
