"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { blogPosts, blogPostStatuses } from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getUniqueBlogSlug } from "@/src/modules/blog";
import {
  getBlogContentText,
  parseBlogRichTextDocument,
} from "@/src/modules/blog/content";

export type BlogMutationState = {
  message?: string;
  ok?: boolean;
};

const blogContentSchema = z
  .string()
  .trim()
  .max(200_000, "Blog content is too long.")
  .superRefine((value, context) => {
    const text = getBlogContentText(value);

    if (!text) {
      context.addIssue({ code: "custom", message: "Add blog content." });
    }

    if (text.length > 30_000) {
      context.addIssue({ code: "custom", message: "Blog content is too long." });
    }

    if (value.startsWith("{") && !parseBlogRichTextDocument(value)) {
      context.addIssue({ code: "custom", message: "Blog formatting is invalid." });
    }
  });

const blogPostSchema = z.object({
  content: blogContentSchema,
  coverMediaId: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .pipe(z.string().uuid().optional()),
  excerpt: z
    .string()
    .trim()
    .max(500, "Excerpt must be 500 characters or less.")
    .optional(),
  id: z.string().uuid().optional(),
  publishedAt: z.date().optional(),
  seoDescription: z
    .string()
    .trim()
    .max(300, "SEO description must be 300 characters or less.")
    .optional(),
  seoTitle: z
    .string()
    .trim()
    .max(180, "SEO title must be 180 characters or less.")
    .optional(),
  slug: z.string().trim().max(180).optional(),
  status: z.enum(blogPostStatuses).default("draft"),
  title: z.string().trim().min(3, "Add a blog title.").max(180),
});

const deleteBlogPostSchema = z.object({
  id: z.string().uuid(),
});

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();

  return stringValue || undefined;
}

function optionalDate(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();

  if (!stringValue) {
    return undefined;
  }

  const date = new Date(stringValue);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function requireBlogManageAccess() {
  const access = await requireAdminCapability("admin.marketing.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to manage blog posts.");
  }

  return access.session;
}

function normalizePublishFields(
  status: (typeof blogPostStatuses)[number],
  publishedAt: Date | undefined,
) {
  if (status === "published") {
    return publishedAt ?? new Date();
  }

  if (status === "scheduled") {
    return publishedAt;
  }

  return publishedAt;
}

function revalidateBlogSurfaces(slug?: string) {
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/admin/blog");

  if (slug) {
    revalidatePath(`/blog/${slug}`);
  }
}

function getBlogPostInput(formData: FormData) {
  return {
    content: formData.get("content") ?? "",
    coverMediaId: optionalString(formData.get("coverMediaId")),
    excerpt: optionalString(formData.get("excerpt")),
    id: optionalString(formData.get("id")),
    publishedAt: optionalDate(formData.get("publishedAt")),
    seoDescription: optionalString(formData.get("seoDescription")),
    seoTitle: optionalString(formData.get("seoTitle")),
    slug: optionalString(formData.get("slug")),
    status: formData.get("status") || "draft",
    title: formData.get("title"),
  };
}

export async function createBlogPost(
  _state: BlogMutationState,
  formData: FormData,
): Promise<BlogMutationState> {
  const session = await requireBlogManageAccess();
  const parsed = blogPostSchema.safeParse(getBlogPostInput(formData));

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the blog fields.",
    };
  }

  if (parsed.data.status === "scheduled" && !parsed.data.publishedAt) {
    return {
      ok: false,
      message: "Scheduled posts need a publish date.",
    };
  }

  const slug = await getUniqueBlogSlug({
    preferredSlug: parsed.data.slug,
    title: parsed.data.title,
  });

  if (!slug) {
    return {
      ok: false,
      message: "Use a title or slug with letters or numbers.",
    };
  }

  const publishedAt = normalizePublishFields(
    parsed.data.status,
    parsed.data.publishedAt,
  );

  try {
    await db.insert(blogPosts).values({
      authorUserId: session.user.id,
      content: parsed.data.content,
      coverMediaId: parsed.data.coverMediaId,
      excerpt: parsed.data.excerpt,
      publishedAt,
      seoDescription: parsed.data.seoDescription,
      seoTitle: parsed.data.seoTitle,
      slug,
      status: parsed.data.status,
      title: parsed.data.title,
      updatedAt: new Date(),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: "A blog post with that slug already exists." };
    }

    throw error;
  }

  revalidateBlogSurfaces(slug);

  return { ok: true, message: "Blog post created." };
}

export async function updateBlogPost(
  _state: BlogMutationState,
  formData: FormData,
): Promise<BlogMutationState> {
  await requireBlogManageAccess();
  const parsed = blogPostSchema.safeParse(getBlogPostInput(formData));

  if (!parsed.success || !parsed.data.id) {
    return {
      ok: false,
      message: parsed.success
        ? "Blog post was not found."
        : (parsed.error.issues[0]?.message ?? "Check the blog fields."),
    };
  }

  if (parsed.data.status === "scheduled" && !parsed.data.publishedAt) {
    return {
      ok: false,
      message: "Scheduled posts need a publish date.",
    };
  }

  const existing = await db.query.blogPosts.findFirst({
    where: (post, { eq }) => eq(post.id, parsed.data.id!),
  });

  if (!existing) {
    return { ok: false, message: "Blog post was not found." };
  }

  const slug = await getUniqueBlogSlug({
    currentPostId: parsed.data.id,
    preferredSlug: parsed.data.slug,
    title: parsed.data.title,
  });

  if (!slug) {
    return {
      ok: false,
      message: "Use a title or slug with letters or numbers.",
    };
  }

  const publishedAt = normalizePublishFields(
    parsed.data.status,
    parsed.data.publishedAt,
  );

  try {
    await db
      .update(blogPosts)
      .set({
        content: parsed.data.content,
        coverMediaId: parsed.data.coverMediaId ?? null,
        excerpt: parsed.data.excerpt ?? null,
        publishedAt,
        seoDescription: parsed.data.seoDescription ?? null,
        seoTitle: parsed.data.seoTitle ?? null,
        slug,
        status: parsed.data.status,
        title: parsed.data.title,
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, parsed.data.id));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: "A blog post with that slug already exists." };
    }

    throw error;
  }

  revalidateBlogSurfaces(slug);
  revalidateBlogSurfaces(existing.slug);

  return { ok: true, message: "Blog post updated." };
}

export async function deleteBlogPost(
  _state: BlogMutationState,
  formData: FormData,
): Promise<BlogMutationState> {
  await requireBlogManageAccess();
  const parsed = deleteBlogPostSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Blog post was not found." };
  }

  const existing = await db.query.blogPosts.findFirst({
    where: (post, { eq }) => eq(post.id, parsed.data.id),
  });

  if (!existing) {
    return { ok: false, message: "Blog post was already removed." };
  }

  await db.delete(blogPosts).where(eq(blogPosts.id, parsed.data.id));

  revalidateBlogSurfaces(existing.slug);

  return { ok: true, message: "Blog post deleted." };
}
