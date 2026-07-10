import { Fragment, type ReactNode } from "react";

import {
  isSafeBlogLinkHref,
  parseBlogRichTextDocument,
  type BlogRichTextMark,
  type BlogRichTextNode,
} from "@/src/modules/blog/content";

function isListBlock(block: string) {
  const lines = block.split("\n").filter((line) => line.trim());

  return lines.length > 1 && lines.every((line) => /^[-*]\s+/.test(line.trim()));
}

function renderParagraphLines(block: string) {
  const lines = block.split("\n");

  return lines.map((line, index) => (
    <span key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {line}
    </span>
  ));
}

function renderPlainTextBlock(block: string, index: number): ReactNode {
  if (isListBlock(block)) {
    return (
      <ul className="grid list-disc gap-2 pl-5" key={`list-${index}`}>
        {block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, lineIndex) => (
            <li key={`${line}-${lineIndex}`}>{line.replace(/^[-*]\s+/, "")}</li>
          ))}
      </ul>
    );
  }

  return <p key={`paragraph-${index}`}>{renderParagraphLines(block)}</p>;
}

function renderTextMarks(text: string, marks: BlogRichTextMark[] | undefined) {
  let content: ReactNode = text;

  for (const [index, mark] of (marks ?? []).entries()) {
    if (mark.type === "bold") {
      content = <strong key={`bold-${index}`}>{content}</strong>;
    } else if (mark.type === "italic") {
      content = <em key={`italic-${index}`}>{content}</em>;
    } else if (mark.type === "underline") {
      content = <u key={`underline-${index}`}>{content}</u>;
    } else if (mark.type === "strike") {
      content = <s key={`strike-${index}`}>{content}</s>;
    } else if (mark.type === "code") {
      content = (
        <code
          className="rounded bg-[#f1f1ec] px-1.5 py-0.5 font-mono text-[0.9em] text-[#080808] dark:bg-white/10 dark:text-[#f7f7f2]"
          key={`code-${index}`}
        >
          {content}
        </code>
      );
    } else if (mark.type === "link") {
      const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";

      if (isSafeBlogLinkHref(href)) {
        const isExternal = href.startsWith("http://") || href.startsWith("https://");

        content = (
          <a
            className="font-medium text-[#e84c15] underline decoration-[#ff5a1f]/40 underline-offset-4 hover:text-[#ff5a1f]"
            href={href}
            key={`link-${index}`}
            rel={isExternal ? "noopener noreferrer" : undefined}
            target={isExternal ? "_blank" : undefined}
          >
            {content}
          </a>
        );
      }
    }
  }

  return content;
}

function renderRichTextNode(node: BlogRichTextNode, key: string): ReactNode {
  if (node.type === "text") {
    return (
      <Fragment key={key}>{renderTextMarks(node.text ?? "", node.marks)}</Fragment>
    );
  }

  if (node.type === "hardBreak") {
    return <br key={key} />;
  }

  if (node.type === "horizontalRule") {
    return <hr className="border-[#deded7] dark:border-white/12" key={key} />;
  }

  const children = node.content?.map((child, index) =>
    renderRichTextNode(child, `${key}-${index}`),
  );

  if (node.type === "doc") {
    return <Fragment key={key}>{children}</Fragment>;
  }

  if (node.type === "paragraph") {
    return <p key={key}>{children}</p>;
  }

  if (node.type === "heading") {
    return node.attrs?.level === 3 ? (
      <h3 className="pt-2 text-[21px] font-black leading-tight text-[#080808] dark:text-[#f7f7f2]" key={key}>
        {children}
      </h3>
    ) : (
      <h2 className="pt-3 text-[26px] font-black leading-tight text-[#080808] dark:text-[#f7f7f2]" key={key}>
        {children}
      </h2>
    );
  }

  if (node.type === "bulletList") {
    return (
      <ul className="grid list-disc gap-2 pl-6 marker:text-[#ff5a1f]" key={key}>
        {children}
      </ul>
    );
  }

  if (node.type === "orderedList") {
    const order = Number(node.attrs?.start ?? node.attrs?.order ?? 1);

    return (
      <ol
        className="grid list-decimal gap-2 pl-6 marker:font-bold marker:text-[#ff5a1f]"
        key={key}
        start={Number.isInteger(order) && order > 0 ? order : 1}
      >
        {children}
      </ol>
    );
  }

  if (node.type === "listItem") {
    return <li key={key}>{children}</li>;
  }

  if (node.type === "blockquote") {
    return (
      <blockquote
        className="border-l-4 border-[#ff5a1f] bg-orange-50/70 px-5 py-4 italic text-[#3f3f3a] dark:bg-[#ff5a1f]/8 dark:text-[#d4d4cc]"
        key={key}
      >
        {children}
      </blockquote>
    );
  }

  if (node.type === "codeBlock") {
    return (
      <pre
        className="overflow-x-auto rounded-md bg-[#1a1a1a] p-4 font-mono text-[14px] leading-6 text-[#f7f7f2]"
        key={key}
      >
        <code>{children}</code>
      </pre>
    );
  }

  return <Fragment key={key}>{children}</Fragment>;
}

export function MarketplaceBlogContent({ content }: { content: string }) {
  const richTextDocument = parseBlogRichTextDocument(content);

  if (richTextDocument) {
    return (
      <div className="grid gap-5 text-[16px] leading-8 text-[#1a1a1a] dark:text-[#deded7]">
        {renderRichTextNode(richTextDocument, "document")}
      </div>
    );
  }

  const blocks = content
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-5 text-[16px] leading-8 text-[#1a1a1a] dark:text-[#deded7]">
      {blocks.map(renderPlainTextBlock)}
    </div>
  );
}
