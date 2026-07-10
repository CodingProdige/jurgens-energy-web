import type { Metadata } from "next";

import { BlogManager } from "@/app/(admin)/admin/(dashboard)/blog/blog-manager";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminBlogPosts } from "@/src/modules/blog";

export const metadata: Metadata = {
  title: "Admin Blog",
  description: "Create and manage Jurgens Energy blog posts.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminBlogPage() {
  const access = await requireAdminCapability("admin.marketing.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const blogData = await getAdminBlogPosts();

  return <BlogManager {...blogData} />;
}
