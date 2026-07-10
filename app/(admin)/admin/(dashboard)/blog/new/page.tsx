import type { Metadata } from "next";

import { BlogPostEditor } from "@/app/(admin)/admin/(dashboard)/blog/blog-post-editor";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminMediaLibrary } from "@/src/modules/media/admin";

export const metadata: Metadata = {
  title: "New Blog Post",
  description: "Create a Jurgens Energy blog post.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function NewAdminBlogPostPage() {
  const access = await requireAdminCapability("admin.marketing.manage");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const mediaLibrary = await getAdminMediaLibrary(access.session.user.id);

  return <BlogPostEditor mediaLibrary={mediaLibrary} />;
}
