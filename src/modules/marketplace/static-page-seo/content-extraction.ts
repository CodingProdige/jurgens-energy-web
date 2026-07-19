import * as cheerio from "cheerio";

import {
  getStaticSeoPageRegistryEntry,
  type StaticSeoPageKey,
} from "./registry.ts";
import { normalizeSeoWhitespace } from "./validation.ts";

const maximumHtmlCharacters = 1_500_000;
const maximumExtractedCharacters = 16_000;

export type StaticSeoExtractedPage = {
  headings: string[];
  htmlTitle: string | null;
  pageKey: StaticSeoPageKey;
  path: string;
  text: string;
  wordCount: number;
};

export class StaticSeoPageScanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaticSeoPageScanError";
  }
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map(normalizeSeoWhitespace).filter(Boolean))];
}

export function extractStaticSeoPageContent({
  html,
  pageKey,
}: {
  html: string;
  pageKey: StaticSeoPageKey;
}): StaticSeoExtractedPage {
  const entry = getStaticSeoPageRegistryEntry(pageKey);

  if (html.length > maximumHtmlCharacters) {
    throw new StaticSeoPageScanError(
      "The rendered page is too large to scan safely.",
    );
  }

  const $ = cheerio.load(html);
  const contentRoot = $("main").first().length ? $("main").first() : $("body");
  const htmlTitle = normalizeSeoWhitespace($("title").first().text()) || null;

  contentRoot
    .find(
      "script, style, noscript, svg, header, nav, aside, footer, form, dialog, [aria-hidden='true'], [hidden]",
    )
    .remove();

  const headings = uniqueNonEmpty(
    contentRoot
      .find("h1, h2, h3")
      .toArray()
      .map((heading) => $(heading).text()),
  ).slice(0, 40);

  const text = normalizeSeoWhitespace(contentRoot.text()).slice(
    0,
    maximumExtractedCharacters,
  );

  if (text.length < 80) {
    throw new StaticSeoPageScanError(
      "The page did not expose enough visible content for a grounded SEO suggestion.",
    );
  }

  return {
    headings,
    htmlTitle,
    pageKey,
    path: entry.path,
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}
