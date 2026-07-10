"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  Code2Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PilcrowIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
  UnlinkIcon,
} from "lucide-react";
import { useState, type ComponentType } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createBlogRichTextDocument,
  isSafeBlogLinkHref,
} from "@/src/modules/blog/content";

type ToolbarItem = {
  active?: boolean;
  disabled?: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
};

function normalizeLinkHref(value: string) {
  const href = value.trim();

  if (isSafeBlogLinkHref(href)) {
    return href;
  }

  const withProtocol = `https://${href}`;

  return isSafeBlogLinkHref(withProtocol) ? withProtocol : null;
}

export function BlogRichTextEditor({
  initialContent,
  onChange,
  placeholder,
}: {
  initialContent: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkHref, setLinkHref] = useState("");
  const editor = useEditor({
    content: createBlogRichTextDocument(initialContent),
    editorProps: {
      attributes: {
        "aria-label": "Blog content editor",
        class:
          "min-h-[34rem] px-4 py-4 text-sm leading-7 text-zinc-950 outline-none dark:text-white sm:px-5",
      },
    },
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
        link: {
          autolink: true,
          defaultProtocol: "https",
          openOnClick: false,
        },
      }),
    ],
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(JSON.stringify(currentEditor.getJSON()));
    },
  });
  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive("bold") ?? false,
      bulletList: currentEditor?.isActive("bulletList") ?? false,
      canRedo: currentEditor?.can().chain().focus().redo().run() ?? false,
      canUndo: currentEditor?.can().chain().focus().undo().run() ?? false,
      code: currentEditor?.isActive("code") ?? false,
      heading2: currentEditor?.isActive("heading", { level: 2 }) ?? false,
      heading3: currentEditor?.isActive("heading", { level: 3 }) ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      link: currentEditor?.isActive("link") ?? false,
      orderedList: currentEditor?.isActive("orderedList") ?? false,
      paragraph: currentEditor?.isActive("paragraph") ?? false,
      quote: currentEditor?.isActive("blockquote") ?? false,
      strike: currentEditor?.isActive("strike") ?? false,
      textLength: currentEditor?.getText().length ?? 0,
      underline: currentEditor?.isActive("underline") ?? false,
    }),
  });

  function openLinkDialog() {
    if (!editor) {
      return;
    }

    setLinkError(null);
    setLinkHref(String(editor.getAttributes("link").href ?? ""));
    setIsLinkDialogOpen(true);
  }

  function applyLink() {
    if (!editor) {
      return;
    }

    const href = normalizeLinkHref(linkHref);

    if (!href) {
      setLinkError("Enter a relative path or a valid http, https, mailto, or tel link.");
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setIsLinkDialogOpen(false);
    setLinkError(null);
  }

  const toolbarItems: ToolbarItem[] = editor
    ? [
        {
          active: editorState?.paragraph,
          icon: PilcrowIcon,
          label: "Paragraph",
          onClick: () => editor.chain().focus().setParagraph().run(),
        },
        {
          active: editorState?.heading2,
          icon: Heading2Icon,
          label: "Heading 2",
          onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          active: editorState?.heading3,
          icon: Heading3Icon,
          label: "Heading 3",
          onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          active: editorState?.bold,
          icon: BoldIcon,
          label: "Bold",
          onClick: () => editor.chain().focus().toggleBold().run(),
        },
        {
          active: editorState?.italic,
          icon: ItalicIcon,
          label: "Italic",
          onClick: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          active: editorState?.underline,
          icon: UnderlineIcon,
          label: "Underline",
          onClick: () => editor.chain().focus().toggleUnderline().run(),
        },
        {
          active: editorState?.strike,
          icon: StrikethroughIcon,
          label: "Strikethrough",
          onClick: () => editor.chain().focus().toggleStrike().run(),
        },
        {
          active: editorState?.bulletList,
          icon: ListIcon,
          label: "Bullet list",
          onClick: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          active: editorState?.orderedList,
          icon: ListOrderedIcon,
          label: "Numbered list",
          onClick: () => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          active: editorState?.quote,
          icon: QuoteIcon,
          label: "Quote",
          onClick: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          active: editorState?.code,
          icon: Code2Icon,
          label: "Inline code",
          onClick: () => editor.chain().focus().toggleCode().run(),
        },
        {
          active: editorState?.link,
          icon: LinkIcon,
          label: "Add or edit link",
          onClick: openLinkDialog,
        },
        {
          disabled: !editorState?.link,
          icon: UnlinkIcon,
          label: "Remove link",
          onClick: () => editor.chain().focus().unsetLink().run(),
        },
        {
          disabled: !editorState?.canUndo,
          icon: Undo2Icon,
          label: "Undo",
          onClick: () => editor.chain().focus().undo().run(),
        },
        {
          disabled: !editorState?.canRedo,
          icon: Redo2Icon,
          label: "Redo",
          onClick: () => editor.chain().focus().redo().run(),
        },
      ]
    : [];

  return (
    <>
      <div className="min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-[#ff5a1f] focus-within:ring-4 focus-within:ring-[#ff5a1f]/10 dark:border-white/18 dark:bg-[#151719]">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50/80 p-2 dark:border-white/10 dark:bg-white/[0.04]">
          {toolbarItems.map((item) => {
            const Icon = item.icon;

            return (
              <Button
                aria-label={item.label}
                className={cn(
                  "size-8 rounded-md border-slate-200 bg-white text-slate-600 shadow-none hover:border-[#ff5a1f]/40 hover:bg-orange-50 hover:text-[#ff5a1f] dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:bg-[#ff5a1f]/10 dark:hover:text-[#ff7a4b]",
                  item.active &&
                    "border-[#ff5a1f]/45 bg-orange-50 text-[#ff5a1f] dark:bg-[#ff5a1f]/10 dark:text-[#ff7a4b]",
                )}
                disabled={item.disabled}
                key={item.label}
                onClick={item.onClick}
                onMouseDown={(event) => event.preventDefault()}
                size="icon-sm"
                title={item.label}
                type="button"
                variant="outline"
              >
                <Icon className="size-4" />
              </Button>
            );
          })}
        </div>
        <div className="blog-rich-text-editor relative">
          {!editor || editor.isEmpty ? (
            <span className="pointer-events-none absolute left-4 top-4 text-sm text-slate-400 dark:text-zinc-500 sm:left-5">
              {placeholder}
            </span>
          ) : null}
          <EditorContent editor={editor} />
        </div>
        <div className="flex items-center justify-end border-t border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-white/10 dark:text-zinc-500">
          {editorState?.textLength ?? 0} characters
        </div>
      </div>

      <Dialog onOpenChange={setIsLinkDialogOpen} open={isLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Link</DialogTitle>
            <DialogDescription>
              Link the selected text to a storefront path or external destination.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-2">
            <Input
              autoFocus
              className="h-10 rounded-lg border-slate-300 bg-white text-zinc-950 dark:border-white/18 dark:bg-[#151719] dark:text-white"
              onChange={(event) => {
                setLinkError(null);
                setLinkHref(event.currentTarget.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }
              }}
              placeholder="/products or https://example.com"
              value={linkHref}
            />
            {linkError ? <p className="text-xs text-red-600">{linkError}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setIsLinkDialogOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className="bg-[#ff5a1f] text-white hover:bg-[#e84c15]"
              onClick={applyLink}
              type="button"
            >
              Apply Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
