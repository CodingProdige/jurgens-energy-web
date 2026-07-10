"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Edit3Icon,
  ExternalLinkIcon,
  FileTextIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import {
  deleteBlogPost,
  type BlogMutationState,
} from "@/app/(admin)/admin/(dashboard)/blog/actions";
import {
  DashboardInput,
  DashboardMetricStrip,
  DashboardPageHeader,
  dashboardControlClass,
  dashboardPanelClass,
  dashboardTableActionCellClass,
  dashboardTableActionHeadClass,
  dashboardTableCellClass,
  dashboardTableClass,
  dashboardTableContainerClass,
  dashboardTableHeadClass,
  dashboardTableHeaderRowClass,
  dashboardTablePrimaryTextClass,
  dashboardTableRowClass,
  dashboardTableSecondaryTextClass,
} from "@/components/dashboard/dashboard-controls";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AdminBlogPost } from "@/src/modules/blog";
import type { BlogPostStatus } from "@/src/db/schema";

type BlogManagerProps = {
  archivedCount: number;
  draftCount: number;
  posts: AdminBlogPost[];
  publishedCount: number;
  scheduledCount: number;
  totalCount: number;
};

type BlogFilter = "all" | BlogPostStatus;

const initialState: BlogMutationState = {};

function formatDate(date: Date | null) {
  if (!date) {
    return "Not published";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function StatusBadge({ status }: { status: BlogPostStatus }) {
  const statusClass = {
    archived: "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
    draft: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300",
    published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    scheduled: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200",
  }[status];

  return (
    <Badge className={cn("h-6 rounded-md border-0 px-2 text-xs font-semibold", statusClass)}>
      {status[0]?.toUpperCase()}
      {status.slice(1)}
    </Badge>
  );
}

function BlogMessage({ state }: { state: BlogMutationState }) {
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

export function BlogManager({
  archivedCount,
  draftCount,
  posts,
  publishedCount,
  scheduledCount,
  totalCount,
}: BlogManagerProps) {
  const [filter, setFilter] = useState<BlogFilter>("all");
  const [search, setSearch] = useState("");
  const [deletingPost, setDeletingPost] = useState<AdminBlogPost | null>(null);
  const filteredPosts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return posts
      .filter((post) => filter === "all" || post.status === filter)
      .filter((post) => {
        if (!normalizedSearch) {
          return true;
        }

        return [post.title, post.slug, post.excerpt]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));
      });
  }, [filter, posts, search]);

  return (
    <div className="grid gap-5">
      <DashboardPageHeader breadcrumbs={["Marketing", "Blog"]} title="Blog" />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Link
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-8 gap-1.5 rounded-md border-[#ff5a1f] bg-[#ff5a1f] px-3 text-[14px] font-normal leading-none text-white hover:bg-[#e84c15] hover:text-white dark:border-[#ff5a1f] dark:bg-[#ff5a1f] dark:text-white dark:hover:bg-[#e84c15]",
            )}
            href="/blog/new"
          >
            <PlusIcon className="size-3.5" />
            New Post
          </Link>
          <Link
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-[14px] font-normal leading-none",
              dashboardControlClass,
            )}
            href="/blog"
            target="_blank"
          >
            <ExternalLinkIcon className="size-3.5" />
            View Blog
          </Link>
        </div>
      </div>

      <DashboardMetricStrip
        metrics={[
          { label: "Total Posts", value: totalCount },
          { label: "Published", value: publishedCount },
          { label: "Drafts", value: draftCount },
        ]}
      />

      <section className={cn(dashboardPanelClass, "overflow-hidden")}>
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-white/10 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <DashboardInput
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search posts"
            value={search}
          />
          <Select
            onValueChange={(value) => setFilter((value ?? "all") as BlogFilter)}
            value={filter}
          >
            <SelectTrigger
              className={cn("h-10 w-full rounded-lg", dashboardControlClass)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white">
              <SelectItem value="all">All posts</SelectItem>
              <SelectItem value="published">Published ({publishedCount})</SelectItem>
              <SelectItem value="scheduled">Scheduled ({scheduledCount})</SelectItem>
              <SelectItem value="draft">Drafts ({draftCount})</SelectItem>
              <SelectItem value="archived">Archived ({archivedCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={cn("overflow-x-auto", dashboardTableContainerClass)}>
          <Table className={dashboardTableClass}>
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>Post</TableHead>
                <TableHead className={dashboardTableHeadClass}>Status</TableHead>
                <TableHead className={dashboardTableHeadClass}>Published</TableHead>
                <TableHead className={dashboardTableHeadClass}>Updated</TableHead>
                <TableHead className={dashboardTableActionHeadClass}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPosts.length > 0 ? (
                filteredPosts.map((post) => (
                  <TableRow className={dashboardTableRowClass} key={post.id}>
                    <TableCell className={dashboardTableCellClass}>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/[0.04]">
                          {post.coverImageUrl ? (
                            <Image
                              alt=""
                              className="object-cover"
                              fill
                              sizes="48px"
                              src={post.coverImageUrl}
                            />
                          ) : (
                            <FileTextIcon className="size-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={cn(dashboardTablePrimaryTextClass, "truncate")}>
                            {post.title}
                          </p>
                          <p className={cn(dashboardTableSecondaryTextClass, "truncate")}>
                            /blog/{post.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <StatusBadge status={post.status} />
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTableSecondaryTextClass}>
                        {formatDate(post.publishedAt)}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTableSecondaryTextClass}>
                        {formatDate(post.updatedAt)}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableActionCellClass}>
                      <div className="flex justify-end gap-1">
                        <Link
                          aria-label={`Edit ${post.title}`}
                          className={buttonVariants({
                            className: "size-8 rounded-md",
                            size: "icon-sm",
                            variant: "ghost",
                          })}
                          href={`/blog/${post.id}/edit`}
                        >
                          <Edit3Icon className="size-4" />
                        </Link>
                        <Button
                          aria-label={`Delete ${post.title}`}
                          className="size-8 rounded-md text-red-600 hover:text-red-700 dark:text-red-300"
                          onClick={() => setDeletingPost(post)}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="h-32 text-center text-sm text-slate-500 dark:text-zinc-400"
                    colSpan={5}
                  >
                    No blog posts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {deletingPost ? (
        <DeleteBlogPostDialog
          onOpenChange={(open) => {
            if (!open) {
              setDeletingPost(null);
            }
          }}
          open={Boolean(deletingPost)}
          post={deletingPost}
        />
      ) : null}
    </div>
  );
}

function DeleteBlogPostDialog({
  onOpenChange,
  open,
  post,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  post: AdminBlogPost | null;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    deleteBlogPost,
    initialState,
  );

  useEffect(() => {
    if (!state.ok) {
      return;
    }

    router.refresh();
    onOpenChange(false);
  }, [onOpenChange, router, state.ok]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Blog Post</DialogTitle>
          <DialogDescription>
            This removes the post from the admin and public blog.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <DialogBody className="grid gap-4">
            <BlogMessage state={state} />
            <input name="id" type="hidden" value={post?.id ?? ""} />
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Delete <span className="font-semibold text-zinc-950 dark:text-white">{post?.title}</span>?
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending} type="submit" variant="destructive">
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
