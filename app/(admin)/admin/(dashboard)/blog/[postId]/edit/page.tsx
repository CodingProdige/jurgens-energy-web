import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { BlogPostEditor } from "@/app/(admin)/admin/(dashboard)/blog/blog-post-editor";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminBlogPostById } from "@/src/modules/blog";
import { getAdminMediaLibrary } from "@/src/modules/media/admin";

export const metadata: Metadata = {
  title: "Edit Blog Post",
  description: "Edit a Jurgens Energy blog post.",
  robots: {
    follow: false,
    index: false,
  },
};

const postIdSchema = z.string().uuid();

export default async function EditAdminBlogPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const access = await requireAdminCapability("admin.marketing.manage");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const parsedPostId = postIdSchema.safeParse((await params).postId);

  if (!parsedPostId.success) {
    notFound();
  }

  const [mediaLibrary, post] = await Promise.all([
    getAdminMediaLibrary(access.session.user.id),
    getAdminBlogPostById(parsedPostId.data),
  ]);

  if (!post) {
    notFound();
  }

  return <BlogPostEditor mediaLibrary={mediaLibrary} post={post} />;
}
