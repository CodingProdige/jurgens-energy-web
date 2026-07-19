import type { Metadata } from "next";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-controls";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getSeoAdminPages } from "@/app/(admin)/admin/(dashboard)/settings/seo/actions";
import { SeoManager } from "@/app/(admin)/admin/(dashboard)/settings/seo/seo-manager";

export const metadata: Metadata = {
  title: "SEO Metadata",
  description:
    "Review and manage static-page search titles and descriptions for Jurgens Energy.",
  robots: { follow: false, index: false },
};

export default async function SeoSettingsPage() {
  const access = await requireAdminCapability("admin.marketing.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const [manageAccess, pages] = await Promise.all([
    requireAdminCapability("admin.marketing.manage"),
    getSeoAdminPages(),
  ]);

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={["Settings", "SEO metadata"]}
        title="SEO metadata"
      />
      <p className="-mt-2 mb-5 max-w-3xl text-sm leading-6 text-slate-600 dark:text-zinc-300">
        Control the titles and descriptions shown to search engines for
        registered static pages. AI suggestions are drafts until you review,
        apply, and save them.
      </p>
      <SeoManager canManage={manageAccess.ok} pages={pages} />
    </>
  );
}
