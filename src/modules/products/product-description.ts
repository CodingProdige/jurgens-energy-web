export type ProductDescriptionGenerationKind = "long" | "short";

export type ProductDescriptionBlock =
  | { level: 2 | 3; text: string; type: "heading" }
  | { items: string[]; type: "ordered-list" }
  | { items: string[]; type: "unordered-list" }
  | { text: string; type: "blockquote" }
  | { text: string; type: "paragraph" };

type ProductDescriptionGenerationContext = {
  brandName?: string;
  categoryName?: string;
  kind: ProductDescriptionGenerationKind;
  productName: string;
  shortDescription?: string;
};

const neutralCopyGuard =
  "Keep it neutral, buyer-friendly, specific enough to be useful, and do not invent certifications, stock availability, delivery promises, discounts, warranties, dimensions, ingredients, or other product facts that were not supplied.";

export function buildProductDescriptionGenerationPrompt(
  context: ProductDescriptionGenerationContext,
) {
  const isShort = context.kind === "short";
  const productContext = [
    `Product name: ${context.productName}`,
    context.brandName ? `Brand: ${context.brandName}` : null,
    context.categoryName ? `Category: ${context.categoryName}` : null,
    !isShort && context.shortDescription
      ? `Existing short description: ${context.shortDescription}`
      : null,
  ].filter((line): line is string => Boolean(line));

  if (isShort) {
    return {
      input: [
        ...productContext,
        "Write one direct marketplace product-card short description in one sentence under 240 characters.",
        neutralCopyGuard,
      ].join("\n"),
      instructions:
        "You write concise marketplace product copy for catalog listings. Return only the product description text.",
      maxOutputTokens: 240,
    };
  }

  return {
    input: [
      ...productContext,
      "Write a structured marketplace long description under 2000 characters.",
      "Use one concise opening paragraph followed by a ## Key features heading and 3 to 6 useful bullet points, each beginning with '- '.",
      "You may add one more short ## section only when the supplied product details support it.",
      "Use only paragraphs, headings beginning with '## ', and '- ' bullet lines. Do not use HTML, tables, code fences, bold markers, or a heading that repeats the product name.",
      neutralCopyGuard,
    ].join("\n"),
    instructions:
      "You write concise marketplace product copy for catalog listings. Return only the requested lightweight Markdown description, with no commentary before or after it.",
    maxOutputTokens: 900,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&#(\d+);/g, (entity, codePoint: string) => {
      const value = Number(codePoint);

      return Number.isSafeInteger(value) && value > 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : entity;
    })
    .replace(/&#x([0-9a-f]+);/gi, (entity, codePoint: string) => {
      const value = Number.parseInt(codePoint, 16);

      return Number.isSafeInteger(value) && value > 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : entity;
    });
}

function stripHtmlToText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(
        /<(script|style|template|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
        "",
      )
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p\s*>|<\/div\s*>|<\/li\s*>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function parseStructuredDescriptionText(value: string) {
  const blocks: ProductDescriptionBlock[] = [];
  let listItems: string[] = [];
  let listType: "ordered-list" | "unordered-list" | null = null;
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    const text = paragraphLines.join(" ").replace(/\s+/g, " ").trim();

    if (text) {
      blocks.push({ text, type: "paragraph" });
    }

    paragraphLines = [];
  };
  const flushList = () => {
    if (listType && listItems.length > 0) {
      blocks.push({ items: listItems, type: listType });
    }

    listItems = [];
    listType = null;
  };

  for (const rawLine of value.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^#{2,3}\s+(.+)$/);

    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        level: line.startsWith("### ") ? 3 : 2,
        text: headingMatch[1].trim(),
        type: "heading",
      });
      continue;
    }

    const unorderedListMatch = line.match(/^(?:[-*•])\s+(.+)$/);
    const orderedListMatch = line.match(/^\d+[.)]\s+(.+)$/);

    if (unorderedListMatch || orderedListMatch) {
      flushParagraph();
      const nextListType = unorderedListMatch
        ? "unordered-list"
        : "ordered-list";

      if (listType && listType !== nextListType) {
        flushList();
      }

      listType = nextListType;
      listItems.push((unorderedListMatch?.[1] ?? orderedListMatch?.[1] ?? "").trim());
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

export function generatedProductDescriptionTextToHtml(value: string) {
  return parseStructuredDescriptionText(value)
    .map((block) => {
      if (block.type === "heading") {
        return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
      }

      if (block.type === "ordered-list" || block.type === "unordered-list") {
        const tag = block.type === "ordered-list" ? "ol" : "ul";

        return `<${tag}>${block.items
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}</${tag}>`;
      }

      return `<p>${escapeHtml(block.text)}</p>`;
    })
    .join("");
}

export function parseProductDescription(value: string | null | undefined) {
  if (!value?.trim()) {
    return [];
  }

  if (!/<[a-z][\s\S]*>/i.test(value)) {
    return parseStructuredDescriptionText(decodeHtmlEntities(value));
  }

  const blocks: ProductDescriptionBlock[] = [];
  const blockPattern =
    /<(h2|h3|p|div|blockquote|ul|ol)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  let cursor = 0;

  const appendText = (fragment: string) => {
    const text = stripHtmlToText(fragment);

    if (text) {
      blocks.push(...parseStructuredDescriptionText(text));
    }
  };

  for (const match of value.matchAll(blockPattern)) {
    const index = match.index ?? 0;
    appendText(value.slice(cursor, index));

    const tag = match[1].toLowerCase();
    const content = match[2];

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(
        content.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi),
        (item) => stripHtmlToText(item[1]),
      ).filter(Boolean);

      if (items.length > 0) {
        blocks.push({
          items,
          type: tag === "ol" ? "ordered-list" : "unordered-list",
        });
      } else {
        appendText(content);
      }
    } else {
      const text = stripHtmlToText(content);

      if (text) {
        blocks.push(
          tag === "h2" || tag === "h3"
            ? {
                level: tag === "h3" ? 3 : 2,
                text,
                type: "heading",
              }
            : {
                text,
                type: tag === "blockquote" ? "blockquote" : "paragraph",
              },
        );
      }
    }

    cursor = index + match[0].length;
  }

  appendText(value.slice(cursor));

  return blocks.length > 0
    ? blocks
    : parseStructuredDescriptionText(stripHtmlToText(value));
}
