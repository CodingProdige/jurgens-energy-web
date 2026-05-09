import type { Metadata } from "next";
import { GlobeLockIcon } from "lucide-react";

import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireAdminAccess } from "@/src/modules/auth/permissions";
import { adminNavItems } from "@/src/modules/admin/navigation";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import {
  SettingsForm,
  SocialLinksForm,
} from "@/app/(admin)/admin/settings/settings-form";

export const metadata: Metadata = {
  title: "Admin Settings",
  description: "Manage protected Piessang platform settings.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminSettingsPage() {
  const session = await requireAdminAccess();
  const settings = await getMarketplaceSettings();

  return (
    <DashboardShell
      activeHref="/settings"
      badge="Admin"
      description="Control public marketplace availability without touching the seller or admin dashboards."
      eyebrow="Platform controls"
      navItems={adminNavItems}
      surfaceHref="/"
      surfaceLabel="Admin"
      title="Settings"
      userLabel={`${session.user.email} (admin)`}
    >
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardPanel
          title="Marketplace coming soon"
          description="Temporarily hide public marketplace pages behind a shared preview password."
        >
          <SettingsForm
            comingSoonEnabled={settings.comingSoonEnabled}
            hasPassword={Boolean(settings.comingSoonPasswordHash)}
          />
        </DashboardPanel>

        <DashboardPanel
          title="Marketplace social links"
          description="Set the public Piessang links shown on marketplace surfaces like the coming soon page."
        >
          <SocialLinksForm
            facebookUrl={settings.facebookUrl}
            instagramUrl={settings.instagramUrl}
            twitterUrl={settings.twitterUrl}
          />
        </DashboardPanel>

        <DashboardPanel
          title="Scope"
          description="This setting only applies to the public marketplace surface."
        >
          <div className="rounded-xl border border-amber-500/20 bg-amber-600/10 p-4 dark:bg-amber-500/10">
            <GlobeLockIcon className="size-5 text-amber-600 dark:text-amber-300" />
            <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
              Admin and seller dashboards remain accessible on their own
              subdomains while the marketplace gate is active.
            </p>
          </div>
        </DashboardPanel>
      </section>
    </DashboardShell>
  );
}
