"use client";

import Image from "next/image";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon } from "lucide-react";

import {
  createBlogPost,
  updateBlogPost,
  type BlogMutationState,
} from "@/app/(admin)/admin/(dashboard)/blog/actions";
import { BlogRichTextEditor } from "@/components/admin/blog-rich-text-editor";
import {
  DashboardBackButton,
  DashboardInput,
  DashboardPageHeader,
  dashboardControlClass,
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import { MediaManagerDialog } from "@/components/media/media-manager-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BlogPostStatus } from "@/src/db/schema";
import type { AdminBlogPost } from "@/src/modules/blog";
import { normalizeBlogRichTextContent } from "@/src/modules/blog/content";
import type {
  AdminMediaAsset,
  AdminMediaFolder,
  MediaStorageSettings,
} from "@/src/modules/media/admin";

export type BlogEditorMediaLibrary = {
  assets: AdminMediaAsset[];
  folders: AdminMediaFolder[];
  storage: MediaStorageSettings;
  usedStorageBytes: number;
};

const initialState: BlogMutationState = {};
const statusOptions: Array<{ label: string; value: BlogPostStatus }> = [
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Archived", value: "archived" },
];

function toDateTimeLocalValue(date: Date | null) {
  if (!date) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function slugifyPreview(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function BlogMutationMessage({ state }: { state: BlogMutationState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={cn(
        "rounded-lg border p-3 text-sm",
        state.ok
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
      )}
    >
      {state.message}
    </p>
  );
}

export function BlogPostEditor({
  mediaLibrary,
  post = null,
}: {
  mediaLibrary: BlogEditorMediaLibrary;
  post?: AdminBlogPost | null;
}) {
  const router = useRouter();
  const action = post ? updateBlogPost : createBlogPost;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [content, setContent] = useState(() =>
    normalizeBlogRichTextContent(post?.content ?? ""),
  );
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(Boolean(post));
  const [coverMediaId, setCoverMediaId] = useState<string | null>(
    post?.coverMediaId ?? null,
  );
  const [coverAsset, setCoverAsset] = useState<AdminMediaAsset | null>(() =>
    post?.coverMediaId
      ? (mediaLibrary.assets.find((asset) => asset.id === post.coverMediaId) ??
        null)
      : null,
  );
  const [isMediaManagerOpen, setIsMediaManagerOpen] = useState(false);

  useEffect(() => {
    if (state.ok) {
      router.push("/blog");
    }
  }, [router, state.ok]);

  const slugPreview = slug.trim() || slugifyPreview(title);
  const coverImageUrl =
    coverAsset?.thumbnailUrl ??
    coverAsset?.publicUrl ??
    (coverMediaId === post?.coverMediaId ? post?.coverImageUrl : null);
  const pageTitle = post ? "Edit Blog Post" : "New Blog Post";

  return (
    <div className="grid min-w-0 gap-5">
      <DashboardPageHeader
        breadcrumbs={["Marketing", "Blog", post ? "Edit" : "New"]}
        title={pageTitle}
      />

      <div>
        <DashboardBackButton
          className="mb-0"
          href="/blog"
          label="Back to Blog"
        />
      </div>

      <form action={formAction} className="grid min-w-0 gap-5">
        <input name="id" type="hidden" value={post?.id ?? ""} />
        <input name="coverMediaId" type="hidden" value={coverMediaId ?? ""} />
        <input name="content" type="hidden" value={content} />
        <BlogMutationMessage state={state} />

        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className={cn(dashboardPanelClass, "grid min-w-0 gap-5 p-5 sm:p-6")}>
            <Field label="Title" required>
              <DashboardInput
                name="title"
                onChange={(event) => {
                  const nextTitle = event.currentTarget.value;

                  setTitle(nextTitle);
                  if (!post && !isSlugManuallyEdited) {
                    setSlug(slugifyPreview(nextTitle));
                  }
                }}
                required
                value={title}
              />
            </Field>
            <Field
              help={slugPreview ? `Public URL: /blog/${slugPreview}` : undefined}
              label="Slug"
            >
              <DashboardInput
                name="slug"
                onChange={(event) => {
                  setIsSlugManuallyEdited(true);
                  setSlug(event.currentTarget.value);
                }}
                placeholder="auto-generated-from-title"
                value={slug}
              />
            </Field>
            <Field label="Excerpt">
              <Textarea
                className={cn("min-h-28 rounded-lg text-sm", dashboardControlClass)}
                defaultValue={post?.excerpt ?? ""}
                name="excerpt"
                placeholder="Short summary for cards, search results, and social previews."
              />
            </Field>
            <Field label="Content" required>
              <BlogRichTextEditor
                initialContent={content}
                onChange={setContent}
                placeholder="Write the post content..."
              />
            </Field>
          </section>

          <aside className={cn(dashboardPanelClass, "grid min-w-0 content-start gap-5 p-5")}>
            <Field label="Cover image">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="relative aspect-square bg-white dark:bg-[#101010]">
                  {coverImageUrl ? (
                    <Image
                      alt=""
                      className="object-cover"
                      fill
                      sizes="320px"
                      src={coverImageUrl}
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-slate-400 dark:text-zinc-500">
                      <ImageIcon className="size-8" />
                    </div>
                  )}
                </div>
                <div className="grid gap-2 border-t border-slate-200 p-3 dark:border-white/10">
                  <Button
                    className="h-9 justify-center rounded-md border-slate-300 bg-white text-sm font-semibold text-zinc-950 shadow-none hover:bg-slate-50 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10"
                    onClick={() => setIsMediaManagerOpen(true)}
                    type="button"
                    variant="outline"
                  >
                    <ImageIcon className="size-4" />
                    Choose Image
                  </Button>
                  {coverMediaId ? (
                    <Button
                      className="h-9 justify-center rounded-md text-sm"
                      onClick={() => {
                        setCoverAsset(null);
                        setCoverMediaId(null);
                      }}
                      type="button"
                      variant="ghost"
                    >
                      Remove Image
                    </Button>
                  ) : null}
                </div>
              </div>
            </Field>
            <Field label="Status">
              <select
                className={cn(
                  "h-10 w-full rounded-lg border px-3 text-sm outline-none",
                  dashboardControlClass,
                )}
                defaultValue={post?.status ?? "draft"}
                name="status"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              help="Used immediately for published posts, or as the scheduled publish time."
              label="Publish date"
            >
              <DashboardInput
                defaultValue={toDateTimeLocalValue(post?.publishedAt ?? null)}
                name="publishedAt"
                type="datetime-local"
              />
            </Field>
            <Field label="SEO title">
              <DashboardInput
                defaultValue={post?.seoTitle ?? ""}
                name="seoTitle"
                placeholder="Defaults to post title"
              />
            </Field>
            <Field label="SEO description">
              <Textarea
                className={cn("min-h-24 rounded-lg text-sm", dashboardControlClass)}
                defaultValue={post?.seoDescription ?? ""}
                name="seoDescription"
                placeholder="Defaults to excerpt"
              />
            </Field>
          </aside>
        </div>

        <div
          className={cn(
            dashboardPanelClass,
            "flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end",
          )}
        >
          <Button
            className="h-9 rounded-md"
            disabled={isPending}
            onClick={() => router.push("/blog")}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="h-9 rounded-md bg-[#ff5a1f] text-white hover:bg-[#e84c15]"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Saving..." : post ? "Update Post" : "Create Post"}
          </Button>
        </div>
      </form>

      <MediaManagerDialog
        acceptedMediaTypes={["image"]}
        assets={mediaLibrary.assets}
        folders={mediaLibrary.folders}
        onOpenChange={setIsMediaManagerOpen}
        onSelect={(asset) => {
          setCoverAsset(asset);
          setCoverMediaId(asset.id);
          setIsMediaManagerOpen(false);
        }}
        open={isMediaManagerOpen}
        selectedAssetId={coverMediaId ?? undefined}
        storage={mediaLibrary.storage}
        surface="admin"
        title="Select blog cover image"
        usedStorageBytes={mediaLibrary.usedStorageBytes}
      />
    </div>
  );
}

function Field({
  children,
  help,
  label,
  required = false,
}: {
  children: ReactNode;
  help?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600 dark:text-zinc-400">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </Label>
      {children}
      {help ? <p className="text-xs text-slate-500 dark:text-zinc-400">{help}</p> : null}
    </div>
  );
}
