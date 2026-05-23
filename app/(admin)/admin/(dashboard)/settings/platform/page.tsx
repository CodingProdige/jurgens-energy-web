import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  CrownIcon,
  FolderUpIcon,
  GlobeIcon,
  GlobeLockIcon,
  LayersIcon,
  MailIcon,
  Share2Icon,
} from "lucide-react";

import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import {
  SettingsForm,
  MediaStorageSettingsForm,
  NotificationSettingsForm,
  PremiumPlansSettingsForm,
  SocialLinksForm,
  StripeSettingsForm,
} from "@/app/(admin)/admin/(dashboard)/settings/platform/settings-form";
import { getAdminPremiumPlans } from "@/src/modules/billing/premium-plans";
import { getAdminMediaLibrary } from "@/src/modules/media/admin";
import { getAdminNotificationSettings } from "@/src/modules/notifications/templates";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "Admin Settings",
  description: "Manage protected Piessang platform settings.",
  robots: {
    index: false,
    follow: false,
  },
};

const settingSections = [
  {
    key: "premium-plans",
    title: "Premium subscription plans",
    description:
      "Create customer and seller premium packages without manually copying Stripe product or price IDs.",
    icon: CrownIcon,
  },
  {
    key: "stripe-payments",
    title: "Stripe payments",
    description:
      "Switch payment mode and manage live or sandbox Stripe credentials.",
    icon: CreditCardIcon,
  },
  {
    key: "marketplace-gate",
    title: "Marketplace coming soon",
    description:
      "Temporarily hide public marketplace pages behind a shared preview password.",
    icon: GlobeLockIcon,
  },
  {
    key: "notifications",
    title: "Notifications",
    description:
      "Manage email and in-app notification templates, delivery history, and shared variables.",
    icon: MailIcon,
  },
  {
    key: "social-links",
    title: "Marketplace social links",
    description:
      "Set the public Piessang links shown across marketplace surfaces.",
    icon: Share2Icon,
  },
  {
    key: "media-storage",
    title: "Media and premium storage",
    description:
      "Control upload limits, compression defaults, and storage allocations.",
    icon: FolderUpIcon,
  },
  {
    key: "scope",
    title: "Settings scope",
    description:
      "See which settings are platform-wide and which only affect the marketplace.",
    icon: LayersIcon,
  },
] as const;

type SettingSectionKey = (typeof settingSections)[number]["key"];

type AdminSettingsPageProps = {
  searchParams: Promise<{
    notification?: string | string[];
    section?: string | string[];
  }>;
};

function getSection(value: string | string[] | undefined) {
  const section = Array.isArray(value) ? value[0] : value;

  if (settingSections.some((item) => item.key === section)) {
    return section as SettingSectionKey;
  }

  return null;
}

function getSectionConfig(section: SettingSectionKey | null) {
  return settingSections.find((item) => item.key === section) ?? null;
}

export default async function AdminSettingsPage({
  searchParams,
}: AdminSettingsPageProps) {
  const access = await requireAdminCapability("admin.settings.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const session = access.session;
  const resolvedSearchParams = await searchParams;
  const selectedSection = getSection(resolvedSearchParams.section);
  const selectedNotificationItem = Array.isArray(
    resolvedSearchParams.notification,
  )
    ? resolvedSearchParams.notification[0]
    : resolvedSearchParams.notification;
  const selectedConfig = getSectionConfig(selectedSection);
  const settings = await getMarketplaceSettings();
  const premiumPlans =
    selectedSection === "premium-plans" ? await getAdminPremiumPlans() : [];
  const notificationSettings =
    selectedSection === "notifications"
      ? await getAdminNotificationSettings()
      : { deliveries: [], globalVariables: [], inAppTemplates: [], templates: [] };
  const notificationMediaLibrary =
    selectedSection === "notifications"
      ? await getAdminMediaLibrary(session.user.id)
      : null;

  return (
    <>
      <div className="mb-7 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
          <span>Admin</span>
          <span>/</span>
          <span>Settings</span>
          {selectedConfig ? (
            <>
              <span>/</span>
              <span>{selectedConfig.title}</span>
            </>
          ) : null}
        </div>
        {selectedConfig ? (
          <Link
            href="/settings/platform"
            className={buttonVariants({
              className: "mb-2 h-8 w-fit gap-2 rounded-lg px-3 text-sm",
              variant: "outline",
            })}
          >
            <ArrowLeftIcon className="size-3.5" />
            Back to settings
          </Link>
        ) : null}
        <h1 className="text-[28px] font-bold tracking-normal text-zinc-950 dark:text-white">
          {selectedConfig?.title ?? "Settings"}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-zinc-300">
          {selectedConfig?.description ??
            "Choose which platform setting you want to manage. Each area stays focused so this page does not become one long scrolling control panel."}
        </p>
      </div>

      {selectedSection ? (
        <section className="w-full">
          <SettingsSection
            notificationMediaLibrary={notificationMediaLibrary}
            selectedNotificationItem={selectedNotificationItem ?? null}
            notificationSettings={notificationSettings}
            premiumPlans={premiumPlans}
            section={selectedSection}
            settings={settings}
          />
        </section>
      ) : (
        <SettingsMenu />
      )}
    </>
  );
}

function SettingsMenu() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {settingSections.map((item) => {
        const Icon = item.icon;

        return (
          <Link key={item.key} href={`/settings/platform?section=${item.key}`}>
            <Card className="h-full rounded-2xl border-slate-200/90 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-admin-primary/45 hover:shadow-lg dark:border-white/10 dark:bg-[#171718]/88 dark:hover:border-admin-primary/50">
              <CardContent className="flex h-full gap-4 p-5">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-admin-primary/10 text-admin-primary">
                  <Icon className="size-5" />
                </span>
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="text-base font-bold text-zinc-950 dark:text-white">
                    {item.title}
                  </span>
                  <span className="text-sm leading-6 text-slate-600 dark:text-zinc-300">
                    {item.description}
                  </span>
                </span>
                <ChevronRightIcon className="mt-1 size-5 shrink-0 text-slate-400" />
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </section>
  );
}

function SettingsSection({
  notificationMediaLibrary,
  notificationSettings,
  premiumPlans,
  selectedNotificationItem,
  section,
  settings,
}: {
  notificationMediaLibrary: Awaited<ReturnType<typeof getAdminMediaLibrary>> | null;
  notificationSettings: Awaited<ReturnType<typeof getAdminNotificationSettings>>;
  premiumPlans: Awaited<ReturnType<typeof getAdminPremiumPlans>>;
  selectedNotificationItem: string | null;
  section: SettingSectionKey;
  settings: Awaited<ReturnType<typeof getMarketplaceSettings>>;
}) {
  if (section === "premium-plans") {
    return (
      <DashboardPanel
        title="Premium subscription plans"
        description="Create customer and seller premium packages without manually copying Stripe product or price IDs."
      >
        <PremiumPlansSettingsForm
          plans={premiumPlans}
          stripeMode={settings.stripeMode}
        />
      </DashboardPanel>
    );
  }

  if (section === "stripe-payments") {
    return (
      <DashboardPanel
        title="Stripe payments"
        description="Switch the integrated payment credentials between live and sandbox mode. Secret keys are encrypted before storage."
      >
        <StripeSettingsForm
          hasStripeLiveSecretKey={settings.hasStripeLiveSecretKey}
          hasStripeLiveWebhookSecret={settings.hasStripeLiveWebhookSecret}
          hasStripeSandboxSecretKey={settings.hasStripeSandboxSecretKey}
          hasStripeSandboxWebhookSecret={settings.hasStripeSandboxWebhookSecret}
          stripeLivePublishableKey={settings.stripeLivePublishableKey}
          stripeMode={settings.stripeMode}
          stripeSandboxPublishableKey={settings.stripeSandboxPublishableKey}
        />
      </DashboardPanel>
    );
  }

  if (section === "marketplace-gate") {
    return (
      <DashboardPanel
        title="Marketplace coming soon"
        description="Temporarily hide public marketplace pages behind a shared preview password."
      >
        <SettingsForm
          comingSoonEnabled={settings.comingSoonEnabled}
          hasPassword={Boolean(settings.comingSoonPasswordHash)}
        />
      </DashboardPanel>
    );
  }

  if (section === "notifications") {
    return (
      <DashboardPanel
        title="Notifications"
        description="Manage email and in-app notification templates, delivery history, and shared variables."
      >
        <NotificationSettingsForm
          deliveries={notificationSettings.deliveries}
          globalVariables={notificationSettings.globalVariables}
          initialSelectedItem={selectedNotificationItem}
          inAppTemplates={notificationSettings.inAppTemplates}
          mediaLibrary={notificationMediaLibrary}
          templates={notificationSettings.templates}
        />
      </DashboardPanel>
    );
  }

  if (section === "social-links") {
    return (
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
    );
  }

  if (section === "media-storage") {
    return (
      <DashboardPanel
        title="Media and premium storage"
        description="Control upload limits, compression defaults, and the storage allocation shown in premium prompts."
      >
        <MediaStorageSettingsForm
          freeStorageQuotaMb={settings.freeStorageQuotaMb}
          imageCompressionQuality={settings.imageCompressionQuality}
          maxImageWidth={settings.maxImageWidth}
          maxUploadFileMb={settings.maxUploadFileMb}
          maxVideoUploadFileMb={settings.maxVideoUploadFileMb}
          maxVideoWidth={settings.maxVideoWidth}
          premiumStorageQuotaMb={settings.premiumStorageQuotaMb}
          videoCompressionCrf={settings.videoCompressionCrf}
        />
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel
      title="Settings scope"
      description="Some settings are global, while the coming soon gate is marketplace-only."
    >
      <div className="grid gap-3">
        <div className="rounded-xl border border-admin-primary/25 bg-admin-primary/10 p-4 dark:bg-admin-primary/10">
          <LayersIcon className="size-5 text-admin-primary" />
          <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
            Stripe mode, media limits, compression defaults, premium storage
            allocations, and social links are shared platform settings used
            wherever those systems appear.
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-600/10 p-4 dark:bg-amber-500/10">
          <GlobeIcon className="size-5 text-amber-600 dark:text-amber-300" />
          <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
            The coming soon gate only protects the public marketplace. Admin and
            seller dashboards remain accessible on their own subdomains.
          </p>
        </div>
      </div>
    </DashboardPanel>
  );
}
