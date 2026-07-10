export type BlogRichTextMark = {
  attrs?: Record<string, unknown>;
  type: string;
};

export type BlogRichTextNode = {
  attrs?: Record<string, unknown>;
  content?: BlogRichTextNode[];
  marks?: BlogRichTextMark[];
  text?: string;
  type: string;
};

const allowedNodeTypes = new Set([
  "blockquote",
  "bulletList",
  "codeBlock",
  "doc",
  "hardBreak",
  "heading",
  "horizontalRule",
  "listItem",
  "orderedList",
  "paragraph",
  "text",
]);
const allowedMarkTypes = new Set([
  "bold",
  "code",
  "italic",
  "link",
  "strike",
  "underline",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSafeBlogLinkHref(value: string) {
  const href = value.trim();

  if (!href || href.length > 2048) {
    return false;
  }

  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("?")) {
    return !href.startsWith("//");
  }

  try {
    const url = new URL(href);

    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isBlogRichTextMark(value: unknown) {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (!allowedMarkTypes.has(value.type)) {
    return false;
  }

  if (value.type !== "link") {
    return true;
  }

  return (
    isRecord(value.attrs) &&
    typeof value.attrs.href === "string" &&
    isSafeBlogLinkHref(value.attrs.href)
  );
}

function isBlogRichTextNode(value: unknown, depth = 0): value is BlogRichTextNode {
  if (depth > 24 || !isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (!allowedNodeTypes.has(value.type)) {
    return false;
  }

  if (value.type === "text") {
    return (
      typeof value.text === "string" &&
      (!value.marks ||
        (Array.isArray(value.marks) && value.marks.every(isBlogRichTextMark)))
    );
  }

  if (value.type === "heading") {
    const level = isRecord(value.attrs) ? value.attrs.level : undefined;

    if (level !== 2 && level !== 3) {
      return false;
    }
  }

  if (value.type === "orderedList" && isRecord(value.attrs)) {
    const order = value.attrs.start ?? value.attrs.order;

    if (order !== undefined && (!Number.isInteger(order) || Number(order) < 1)) {
      return false;
    }
  }

  return (
    value.content === undefined ||
    (Array.isArray(value.content) &&
      value.content.every((child) => isBlogRichTextNode(child, depth + 1)))
  );
}

export function parseBlogRichTextDocument(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("{")) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmedValue);

    return isBlogRichTextNode(parsed) && parsed.type === "doc" ? parsed : null;
  } catch {
    return null;
  }
}

function textToInlineContent(value: string) {
  const lines = value.split("\n");
  const content: BlogRichTextNode[] = [];

  lines.forEach((line, index) => {
    if (line) {
      content.push({ text: line, type: "text" });
    }

    if (index < lines.length - 1) {
      content.push({ type: "hardBreak" });
    }
  });

  return content;
}

export function createBlogRichTextDocument(value: string): BlogRichTextNode {
  const existingDocument = parseBlogRichTextDocument(value);

  if (existingDocument) {
    return existingDocument;
  }

  const blocks = value
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  return {
    content:
      blocks.length > 0
        ? blocks.map((block) => ({
            content: textToInlineContent(block),
            type: "paragraph",
          }))
        : [{ type: "paragraph" }],
    type: "doc",
  };
}

export function normalizeBlogRichTextContent(value: string) {
  return JSON.stringify(createBlogRichTextDocument(value));
}

function collectNodeText(node: BlogRichTextNode): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  if (node.type === "hardBreak") {
    return "\n";
  }

  const content = node.content?.map(collectNodeText).join("") ?? "";

  return ["paragraph", "heading", "listItem", "blockquote", "codeBlock"].includes(
    node.type,
  )
    ? `${content}\n`
    : content;
}

export function getBlogContentText(value: string) {
  const document = parseBlogRichTextDocument(value);

  return document ? collectNodeText(document).trim() : value.trim();
}
