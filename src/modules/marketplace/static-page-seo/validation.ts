import { z } from "zod";

import { STATIC_SEO_PAGE_KEYS } from "./registry.ts";

export const staticSeoPageKeySchema = z.enum(STATIC_SEO_PAGE_KEYS);

export const staticPageSeoSourceSchema = z.enum(["ai", "manual", "restore"]);

export const staticPageSeoUpdateSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(50, "Write a meta description of at least 50 characters.")
      .max(320, "Keep the meta description under 320 characters."),
    pageKey: staticSeoPageKeySchema,
    source: z.enum(["ai", "manual"]).default("manual"),
    title: z
      .string()
      .trim()
      .min(8, "Write an SEO title of at least 8 characters.")
      .max(120, "Keep the SEO title under 120 characters."),
  })
  .strict();

export type StaticPageSeoUpdateInput = z.input<typeof staticPageSeoUpdateSchema>;
export type ValidatedStaticPageSeoUpdate = z.output<
  typeof staticPageSeoUpdateSchema
>;

export const staticSeoSuggestionSchema = z
  .object({
    contentGaps: z.array(z.string().trim().min(1).max(240)).max(6),
    description: z.string().trim().min(50).max(220),
    primaryTopic: z.string().trim().min(2).max(100),
    reasoning: z.string().trim().min(10).max(800),
    supportingSearchTerms: z
      .array(z.string().trim().min(2).max(80))
      .max(8),
    title: z.string().trim().min(8).max(90),
    unsupportedClaims: z.array(z.string().trim().min(1).max(240)).max(6),
  })
  .strict();

export type StaticSeoSuggestion = z.infer<typeof staticSeoSuggestionSchema>;

export type StaticSeoCopyIssueCode =
  | "brand_suffix_duplicate"
  | "description_long"
  | "description_short"
  | "duplicate_description"
  | "duplicate_title"
  | "keyword_repetition"
  | "title_long"
  | "unsupported_claim";

export type StaticSeoCopyIssue = {
  code: StaticSeoCopyIssueCode;
  field: "description" | "page" | "title";
  message: string;
  severity: "error" | "warning";
};

const ignoredRepetitionWords = new Set([
  "and",
  "for",
  "from",
  "jurgens",
  "energy",
  "the",
  "this",
  "with",
  "your",
]);

const unsupportedClaimRules = [
  { label: "free delivery", pattern: /\bfree\s+delivery\b/i },
  { label: "same-day delivery", pattern: /\bsame[ -]?day\b/i },
  { label: "next-day delivery", pattern: /\bnext[ -]?day\b/i },
  { label: "nationwide delivery", pattern: /\bnationwide\b/i },
  { label: "24/7 service", pattern: /\b24\s*\/\s*7\b/i },
  { label: "a guarantee", pattern: /\bguaranteed?\b/i },
  { label: "a lowest-price claim", pattern: /\b(lowest|cheapest)\b/i },
  { label: "a best or number-one claim", pattern: /(?:\bbest\b|#\s*1|\bnumber\s+one\b)/i },
] as const;

export function normalizeSeoWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function repeatedKeyword(value: string, threshold: number) {
  const words = value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const counts = new Map<string, number>();

  for (const word of words) {
    if (word.length < 3 || ignoredRepetitionWords.has(word)) {
      continue;
    }

    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()].find(([, count]) => count >= threshold)?.[0] ?? null;
}

export function findUnsupportedSeoClaims({
  description,
  scannedContent,
  title,
}: {
  description: string;
  scannedContent: string;
  title: string;
}) {
  const proposed = `${title}\n${description}`;

  return unsupportedClaimRules
    .filter(
      ({ pattern }) => pattern.test(proposed) && !pattern.test(scannedContent),
    )
    .map(({ label }) => label);
}

export function analyzeStaticSeoCopy({
  description,
  duplicateDescription = false,
  duplicateTitle = false,
  scannedContent,
  title,
}: {
  description: string;
  duplicateDescription?: boolean;
  duplicateTitle?: boolean;
  scannedContent?: string;
  title: string;
}): StaticSeoCopyIssue[] {
  const normalizedTitle = normalizeSeoWhitespace(title);
  const normalizedDescription = normalizeSeoWhitespace(description);
  const issues: StaticSeoCopyIssue[] = [];
  const completeTitleLength = normalizedTitle.length + " | Jurgens Energy".length;

  if (/\bjurgens\s+energy\b/i.test(normalizedTitle)) {
    issues.push({
      code: "brand_suffix_duplicate",
      field: "title",
      message:
        "Remove Jurgens Energy from the page title. The root title template adds the brand automatically.",
      severity: "error",
    });
  }

  if (completeTitleLength > 60) {
    issues.push({
      code: "title_long",
      field: "title",
      message: `The rendered title is about ${completeTitleLength} characters and may be truncated in search results.`,
      severity: "warning",
    });
  }

  if (normalizedDescription.length < 120) {
    issues.push({
      code: "description_short",
      field: "description",
      message:
        "The description is valid but shorter than the usual 120–160 character search-snippet target.",
      severity: "warning",
    });
  } else if (normalizedDescription.length > 160) {
    issues.push({
      code: "description_long",
      field: "description",
      message:
        "The description is longer than 160 characters and may be shortened by search engines.",
      severity: "warning",
    });
  }

  const repeatedTitleWord = repeatedKeyword(normalizedTitle, 3);
  const repeatedDescriptionWord = repeatedKeyword(normalizedDescription, 5);

  if (repeatedTitleWord || repeatedDescriptionWord) {
    issues.push({
      code: "keyword_repetition",
      field: repeatedTitleWord ? "title" : "description",
      message: `“${repeatedTitleWord ?? repeatedDescriptionWord}” is repeated unusually often. Keep the copy natural rather than keyword-stuffed.`,
      severity: "warning",
    });
  }

  if (duplicateTitle) {
    issues.push({
      code: "duplicate_title",
      field: "page",
      message: "Another static page currently uses this SEO title.",
      severity: "warning",
    });
  }

  if (duplicateDescription) {
    issues.push({
      code: "duplicate_description",
      field: "page",
      message: "Another static page currently uses this meta description.",
      severity: "warning",
    });
  }

  if (scannedContent) {
    for (const claim of findUnsupportedSeoClaims({
      description: normalizedDescription,
      scannedContent,
      title: normalizedTitle,
    })) {
      issues.push({
        code: "unsupported_claim",
        field: "page",
        message: `The suggestion introduces ${claim}, but that claim was not found in the scanned page.`,
        severity: "error",
      });
    }
  }

  return issues;
}

export function validateGeneratedStaticSeoSuggestion({
  scannedContent,
  suggestion,
}: {
  scannedContent: string;
  suggestion: StaticSeoSuggestion;
}) {
  const issues = analyzeStaticSeoCopy({
    description: suggestion.description,
    scannedContent,
    title: suggestion.title,
  });

  return {
    issues,
    safe: !issues.some((issue) => issue.severity === "error"),
  };
}
