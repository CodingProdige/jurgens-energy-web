import { and, asc, count, desc, eq, isNull, lte, or } from "drizzle-orm";

import { db } from "@/src/db";
import {
  blogPosts,
  media,
  users,
  type BlogPostStatus,
} from "@/src/db/schema";
import { getMediaPublicUrl } from "@/src/modules/media/paths";
import { getBlogContentText } from "@/src/modules/blog/content";

export type AdminBlogPost = {
  authorName: string | null;
  content: string;
  coverImageUrl: string | null;
  coverMediaId: string | null;
  createdAt: Date;
  excerpt: string | null;
  id: string;
  publishedAt: Date | null;
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string;
  status: BlogPostStatus;
  title: string;
  updatedAt: Date;
};

export type PublicBlogPostSummary = {
  authorName: string | null;
  coverImageUrl: string | null;
  excerpt: string | null;
  id: string;
  publishedAt: Date | null;
  slug: string;
  title: string;
};

export type PublicBlogPostDetail = PublicBlogPostSummary & {
  content: string;
  seoDescription: string | null;
  seoTitle: string | null;
  updatedAt: Date;
};

function toMediaUrl(
  relativePath: string | null,
  thumbnailRelativePath: string | null,
) {
  const path = thumbnailRelativePath ?? relativePath;

  return path ? getMediaPublicUrl(path) : null;
}

function publicBlogPostCondition(now = new Date()) {
  return or(
    and(
      eq(blogPosts.status, "published"),
      or(isNull(blogPosts.publishedAt), lte(blogPosts.publishedAt, now)),
    ),
    and(eq(blogPosts.status, "scheduled"), lte(blogPosts.publishedAt, now)),
  );
}

export function slugifyBlogPost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

export function estimateBlogReadingMinutes(content: string) {
  const words = getBlogContentText(content).split(/\s+/).filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 220));
}

async function getBlogPostRows({
  publicOnly = false,
  limit,
}: {
  limit?: number;
  publicOnly?: boolean;
} = {}) {
  const query = db
    .select({
      authorName: users.name,
      content: blogPosts.content,
      coverMediaId: blogPosts.coverMediaId,
      coverRelativePath: media.relativePath,
      coverThumbnailRelativePath: media.thumbnailRelativePath,
      createdAt: blogPosts.createdAt,
      excerpt: blogPosts.excerpt,
      id: blogPosts.id,
      publishedAt: blogPosts.publishedAt,
      seoDescription: blogPosts.seoDescription,
      seoTitle: blogPosts.seoTitle,
      slug: blogPosts.slug,
      status: blogPosts.status,
      title: blogPosts.title,
      updatedAt: blogPosts.updatedAt,
    })
    .from(blogPosts)
    .leftJoin(media, eq(media.id, blogPosts.coverMediaId))
    .leftJoin(users, eq(users.id, blogPosts.authorUserId))
    .where(publicOnly ? publicBlogPostCondition() : undefined)
    .orderBy(
      desc(blogPosts.publishedAt),
      desc(blogPosts.updatedAt),
      asc(blogPosts.title),
    );

  return typeof limit === "number" ? query.limit(limit) : query;
}

function toAdminBlogPost(
  row: Awaited<ReturnType<typeof getBlogPostRows>>[number],
): AdminBlogPost {
  return {
    authorName: row.authorName,
    content: row.content,
    coverImageUrl: toMediaUrl(
      row.coverRelativePath,
      row.coverThumbnailRelativePath,
    ),
    coverMediaId: row.coverMediaId,
    createdAt: row.createdAt,
    excerpt: row.excerpt,
    id: row.id,
    publishedAt: row.publishedAt,
    seoDescription: row.seoDescription,
    seoTitle: row.seoTitle,
    slug: row.slug,
    status: row.status,
    title: row.title,
    updatedAt: row.updatedAt,
  };
}

function toPublicBlogPostSummary(
  row: Awaited<ReturnType<typeof getBlogPostRows>>[number],
): PublicBlogPostSummary {
  return {
    authorName: row.authorName,
    coverImageUrl: toMediaUrl(
      row.coverRelativePath,
      row.coverThumbnailRelativePath,
    ),
    excerpt: row.excerpt,
    id: row.id,
    publishedAt: row.publishedAt,
    slug: row.slug,
    title: row.title,
  };
}

function toPublicBlogPostDetail(
  row: Awaited<ReturnType<typeof getBlogPostRows>>[number],
): PublicBlogPostDetail {
  return {
    ...toPublicBlogPostSummary(row),
    content: row.content,
    seoDescription: row.seoDescription,
    seoTitle: row.seoTitle,
    updatedAt: row.updatedAt,
  };
}

export async function getAdminBlogPosts() {
  const rows = await getBlogPostRows();
  const posts = rows.map(toAdminBlogPost);
  const [totalRow] = await db.select({ value: count() }).from(blogPosts);

  return {
    archivedCount: posts.filter((post) => post.status === "archived").length,
    draftCount: posts.filter((post) => post.status === "draft").length,
    posts,
    publishedCount: posts.filter((post) => post.status === "published").length,
    scheduledCount: posts.filter((post) => post.status === "scheduled").length,
    totalCount: totalRow?.value ?? posts.length,
  };
}

export async function getAdminBlogPostById(id: string) {
  const row = await db
    .select({
      authorName: users.name,
      content: blogPosts.content,
      coverMediaId: blogPosts.coverMediaId,
      coverRelativePath: media.relativePath,
      coverThumbnailRelativePath: media.thumbnailRelativePath,
      createdAt: blogPosts.createdAt,
      excerpt: blogPosts.excerpt,
      id: blogPosts.id,
      publishedAt: blogPosts.publishedAt,
      seoDescription: blogPosts.seoDescription,
      seoTitle: blogPosts.seoTitle,
      slug: blogPosts.slug,
      status: blogPosts.status,
      title: blogPosts.title,
      updatedAt: blogPosts.updatedAt,
    })
    .from(blogPosts)
    .leftJoin(media, eq(media.id, blogPosts.coverMediaId))
    .leftJoin(users, eq(users.id, blogPosts.authorUserId))
    .where(eq(blogPosts.id, id))
    .limit(1);

  return row[0] ? toAdminBlogPost(row[0]) : null;
}

export async function getPublishedBlogPosts(limit?: number) {
  const rows = await getBlogPostRows({ limit, publicOnly: true });

  return rows.map(toPublicBlogPostSummary);
}

export async function getPublishedBlogPostBySlug(slug: string) {
  const rows = await db
    .select({
      authorName: users.name,
      content: blogPosts.content,
      coverMediaId: blogPosts.coverMediaId,
      coverRelativePath: media.relativePath,
      coverThumbnailRelativePath: media.thumbnailRelativePath,
      createdAt: blogPosts.createdAt,
      excerpt: blogPosts.excerpt,
      id: blogPosts.id,
      publishedAt: blogPosts.publishedAt,
      seoDescription: blogPosts.seoDescription,
      seoTitle: blogPosts.seoTitle,
      slug: blogPosts.slug,
      status: blogPosts.status,
      title: blogPosts.title,
      updatedAt: blogPosts.updatedAt,
    })
    .from(blogPosts)
    .leftJoin(media, eq(media.id, blogPosts.coverMediaId))
    .leftJoin(users, eq(users.id, blogPosts.authorUserId))
    .where(and(eq(blogPosts.slug, slug), publicBlogPostCondition()))
    .limit(1);

  return rows[0] ? toPublicBlogPostDetail(rows[0]) : null;
}

export async function getUniqueBlogSlug({
  currentPostId,
  preferredSlug,
  title,
}: {
  currentPostId?: string;
  preferredSlug?: string | null;
  title: string;
}) {
  const baseSlug = slugifyBlogPost(preferredSlug || title);

  if (!baseSlug) {
    return null;
  }

  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await db.query.blogPosts.findFirst({
      where: (post, { eq }) => eq(post.slug, slug),
    });

    if (!existing || existing.id === currentPostId) {
      return slug;
    }

    slug = `${baseSlug.slice(0, 172)}-${suffix}`;
    suffix += 1;
  }
}
