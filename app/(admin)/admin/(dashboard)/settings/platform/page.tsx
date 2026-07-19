import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3Icon,
  BracesIcon,
  ChevronRightIcon,
  CreditCardIcon,
  FolderUpIcon,
  GlobeIcon,
  GlobeLockIcon,
  LayersIcon,
  MailIcon,
  MessageCircleIcon,
  Share2Icon,
  TruckIcon,
} from "lucide-react";

import { DashboardBackButton } from "@/components/dashboard/dashboard-controls";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { Card, CardContent } from "@/components/ui/card";
import {
  getMarketplaceAdminSecrets,
  getMarketplaceSettings,
} from "@/src/modules/marketplace/settings";
import { getJurgensDeliveryZones } from "@/src/modules/shipping/jurgens-delivery";
import {
  ChatGptIntegrationSettingsForm,
  SettingsForm,
  GoogleMarketingSettingsForm,
  MediaStorageSettingsForm,
  NotificationSettingsForm,
  PayFastSettingsForm,
  SocialLinksForm,
  ShippingSettingsForm,
  WhatsappOrderingSettingsForm,
} from "@/app/(admin)/admin/(dashboard)/settings/platform/settings-form";
import { getAdminMediaLibrary } from "@/src/modules/media/admin";
import { getAdminNotificationSettings } from "@/src/modules/notifications/templates";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "Admin Settings",
  description: "Manage protected Jurgens Energy platform settings.",
  robots: {
    index: false,
    follow: false,
  },
};

const settingSections = [
  {
    key: "payfast-payments",
    title: "PayFast payments",
    description:
      "Manage live or sandbox PayFast onsite payment credentials.",
    icon: CreditCardIcon,
  },
  {
    key: "shipping",
    title: "Shipping",
    description:
      "Manage Jurgens Energy shipping margins and encrypted Bob Go provider credentials.",
    icon: TruckIcon,
  },
  {
    key: "whatsapp-ordering",
    title: "WhatsApp ordering",
    description:
      "Manage 360dialog credentials, webhook URL, and the quick gas topup assistant.",
    icon: MessageCircleIcon,
  },
  {
    key: "chatgpt-integration",
    title: "ChatGPT integration",
    description:
      "Manage the OpenAI API key, default model, and reasoning effort used by AI features.",
    icon: BracesIcon,
  },
  {
    key: "google-tags",
    title: "Google tags",
    description:
      "Manage Google Tag Manager, GA4, Ads, Merchant Center, and Search Console verification.",
    icon: BarChart3Icon,
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
    title: "Footer and public details",
    description:
      "Manage footer contact details, social links, and payment badges.",
    icon: Share2Icon,
  },
  {
    key: "media-storage",
    title: "Media storage",
    description:
      "Control upload limits, compression defaults, and media storage allocation.",
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
  const secrets =
    selectedSection === "payfast-payments" ||
    selectedSection === "shipping" ||
    selectedSection === "whatsapp-ordering" ||
    selectedSection === "chatgpt-integration"
      ? await getMarketplaceAdminSecrets()
      : null;
  const notificationSettings =
    selectedSection === "notifications"
      ? await getAdminNotificationSettings()
      : { deliveries: [], globalVariables: [], inAppTemplates: [], templates: [] };
  const notificationMediaLibrary =
    selectedSection === "notifications"
      ? await getAdminMediaLibrary(session.user.id)
      : null;
  const footerMediaLibrary =
    selectedSection === "social-links"
      ? await getAdminMediaLibrary(session.user.id)
      : null;
  const jurgensDeliveryZones =
    selectedSection === "shipping" ? await getJurgensDeliveryZones() : [];

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
          <DashboardBackButton href="/settings/platform" label="Back to settings" />
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
            footerMediaLibrary={footerMediaLibrary}
            notificationMediaLibrary={notificationMediaLibrary}
            jurgensDeliveryZones={jurgensDeliveryZones}
            selectedNotificationItem={selectedNotificationItem ?? null}
            notificationSettings={notificationSettings}
            section={selectedSection}
            secrets={secrets}
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
  footerMediaLibrary,
  notificationMediaLibrary,
  jurgensDeliveryZones,
  notificationSettings,
  selectedNotificationItem,
  section,
  secrets,
  settings,
}: {
  footerMediaLibrary: Awaited<ReturnType<typeof getAdminMediaLibrary>> | null;
  notificationMediaLibrary: Awaited<ReturnType<typeof getAdminMediaLibrary>> | null;
  jurgensDeliveryZones: Awaited<ReturnType<typeof getJurgensDeliveryZones>>;
  notificationSettings: Awaited<ReturnType<typeof getAdminNotificationSettings>>;
  selectedNotificationItem: string | null;
  section: SettingSectionKey;
  secrets: Awaited<ReturnType<typeof getMarketplaceAdminSecrets>> | null;
  settings: Awaited<ReturnType<typeof getMarketplaceSettings>>;
}) {
  if (section === "payfast-payments") {
    return (
      <DashboardPanel
        title="PayFast payments"
        description="Switch the onsite PayFast payment credentials between live and sandbox mode. Merchant keys and passphrases are encrypted before storage."
      >
        <PayFastSettingsForm
          hasPayfastLiveMerchantKey={settings.hasPayfastLiveMerchantKey}
          hasPayfastLivePassphrase={settings.hasPayfastLivePassphrase}
          hasPayfastSandboxMerchantKey={settings.hasPayfastSandboxMerchantKey}
          hasPayfastSandboxPassphrase={settings.hasPayfastSandboxPassphrase}
          payfastLiveMerchantId={settings.payfastLiveMerchantId}
          payfastLiveMerchantKey={secrets?.payfastLiveMerchantKey ?? null}
          payfastLivePassphrase={secrets?.payfastLivePassphrase ?? null}
          payfastMode={settings.payfastMode}
          payfastOnsiteEnabled={settings.payfastOnsiteEnabled}
          payfastSandboxMerchantId={settings.payfastSandboxMerchantId}
          payfastSandboxMerchantKey={secrets?.payfastSandboxMerchantKey ?? null}
          payfastSandboxPassphrase={secrets?.payfastSandboxPassphrase ?? null}
          payfastTokenizationEnabled={settings.payfastTokenizationEnabled}
        />
      </DashboardPanel>
    );
  }

  if (section === "shipping") {
    return (
      <DashboardPanel
        title="Shipping"
        description="Manage Jurgens Energy shipping controls and encrypted Bob Go credentials."
      >
        <ShippingSettingsForm
          bobgoBookingMode={settings.bobgoBookingMode}
          bobgoEnabled={settings.bobgoEnabled}
          bobgoMode={settings.bobgoMode}
          bobgoWebhookFulfillmentCreated={
            settings.bobgoWebhookFulfillmentCreated
          }
          bobgoWebhookShipmentChargedAmountChanged={
            settings.bobgoWebhookShipmentChargedAmountChanged
          }
          bobgoWebhookShipmentChargedWeightChanged={
            settings.bobgoWebhookShipmentChargedWeightChanged
          }
          bobgoWebhookShipmentHealthStatusUpdated={
            settings.bobgoWebhookShipmentHealthStatusUpdated
          }
          bobgoWebhookShipmentSubmissionStatusUpdated={
            settings.bobgoWebhookShipmentSubmissionStatusUpdated
          }
          bobgoWebhookTrackingUpdated={settings.bobgoWebhookTrackingUpdated}
          hasBobgoLiveApiKey={settings.hasBobgoLiveApiKey}
          hasBobgoLiveWebhookSecret={settings.hasBobgoLiveWebhookSecret}
          hasBobgoSandboxApiKey={settings.hasBobgoSandboxApiKey}
          hasBobgoSandboxWebhookSecret={settings.hasBobgoSandboxWebhookSecret}
          bobgoLiveApiKey={secrets?.bobgoLiveApiKey ?? null}
          bobgoLiveWebhookSecret={secrets?.bobgoLiveWebhookSecret ?? null}
          bobgoSandboxApiKey={secrets?.bobgoSandboxApiKey ?? null}
          bobgoSandboxWebhookSecret={secrets?.bobgoSandboxWebhookSecret ?? null}
          jurgensDeliveryCutoffTime={settings.jurgensDeliveryCutoffTime}
          jurgensDeliveryZones={jurgensDeliveryZones}
          shippingBufferBps={settings.shippingBufferBps}
          shippingEnabled={settings.shippingEnabled}
          shippingMarginBps={settings.shippingMarginBps}
        />
      </DashboardPanel>
    );
  }

  if (section === "whatsapp-ordering") {
    return (
      <DashboardPanel
        title="WhatsApp ordering"
        description="Manage 360dialog provider credentials, the public webhook URL, and the marketplace WhatsApp ordering switch."
      >
        <WhatsappOrderingSettingsForm
          hasWhatsappApiKey={settings.hasWhatsappApiKey}
          hasWhatsappWebhookSigningSecret={
            settings.hasWhatsappWebhookSigningSecret
          }
          hasWhatsappWebhookVerifyToken={
            settings.hasWhatsappWebhookVerifyToken
          }
          whatsappApiKey={secrets?.whatsappApiKey ?? null}
          whatsappBusinessPhoneNumber={settings.whatsappBusinessPhoneNumber}
          whatsappFollowUpDefaultMessage={
            settings.whatsappFollowUpDefaultMessage
          }
          whatsappFollowUpDelayMinutes={settings.whatsappFollowUpDelayMinutes}
          whatsappFollowUpDraftMessage={settings.whatsappFollowUpDraftMessage}
          whatsappFollowUpMaxCount={settings.whatsappFollowUpMaxCount}
          whatsappFollowUpQuietHoursEnabled={
            settings.whatsappFollowUpQuietHoursEnabled
          }
          whatsappFollowUpQuietHoursEnd={settings.whatsappFollowUpQuietHoursEnd}
          whatsappFollowUpQuietHoursStart={
            settings.whatsappFollowUpQuietHoursStart
          }
          whatsappFollowUpSupportMessage={
            settings.whatsappFollowUpSupportMessage
          }
          whatsappFollowUpsEnabled={settings.whatsappFollowUpsEnabled}
          whatsappMessageUrl={settings.whatsappMessageUrl}
          whatsappOrderingEnabled={settings.whatsappOrderingEnabled}
          whatsappWebhookUrl={settings.whatsappWebhookUrl}
          whatsappWebhookVerifyToken={
            secrets?.whatsappWebhookVerifyToken ?? null
          }
        />
      </DashboardPanel>
    );
  }

  if (section === "google-tags") {
    return (
      <DashboardPanel
        title="Google tags"
        description="Manage consent-aware Google measurement, verified purchase conversions, Merchant Center and Search Console values for the public marketplace."
      >
        <GoogleMarketingSettingsForm
          googleAdsConversionId={settings.googleAdsConversionId}
          googleAdsConversionLabel={settings.googleAdsConversionLabel}
          googleAnalyticsMeasurementId={settings.googleAnalyticsMeasurementId}
          googleMerchantCenterId={settings.googleMerchantCenterId}
          googleSiteVerificationToken={settings.googleSiteVerificationToken}
          googleTagManagerId={settings.googleTagManagerId}
        />
      </DashboardPanel>
    );
  }

  if (section === "chatgpt-integration") {
    return (
      <DashboardPanel
        title="ChatGPT integration"
        description="Manage the OpenAI key, default model, and reasoning effort used by marketplace AI features."
      >
        <ChatGptIntegrationSettingsForm
          hasOpenAiApiKey={settings.hasOpenAiApiKey}
          openAiApiKey={secrets?.openAiApiKey ?? null}
          openAiEnabled={settings.openAiEnabled}
          openAiModel={settings.openAiModel}
          openAiReasoningEffort={settings.openAiReasoningEffort}
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
        title="Footer and public details"
        description="Set the public Jurgens Energy footer details, contact information, social links, and payment badges."
      >
        <SocialLinksForm
          contactAddress={settings.contactAddress}
          contactEmail={settings.contactEmail}
          contactPhonePrimary={settings.contactPhonePrimary}
          contactPhoneSecondary={settings.contactPhoneSecondary}
          facebookUrl={settings.facebookUrl}
          footerTagline={settings.footerTagline}
          googleReviewUrl={settings.googleReviewUrl}
          instagramUrl={settings.instagramUrl}
          mediaLibrary={footerMediaLibrary}
          paymentMethodBadges={settings.paymentMethodBadges}
          twitterUrl={settings.twitterUrl}
        />
      </DashboardPanel>
    );
  }

  if (section === "media-storage") {
    return (
      <DashboardPanel
        title="Media storage"
        description="Control upload limits, compression defaults, and the storage allocation for media uploads."
      >
        <MediaStorageSettingsForm
          freeStorageQuotaMb={settings.freeStorageQuotaMb}
          imageCompressionQuality={settings.imageCompressionQuality}
          maxImageWidth={settings.maxImageWidth}
          maxUploadFileMb={settings.maxUploadFileMb}
          maxVideoUploadFileMb={settings.maxVideoUploadFileMb}
          maxVideoWidth={settings.maxVideoWidth}
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
            PayFast mode, Bob Go credentials, WhatsApp ordering credentials,
            Google tags, media limits, compression defaults, storage
            allocations, footer details, and social links are shared platform settings used
            wherever those systems appear.
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-600/10 p-4 dark:bg-amber-500/10">
          <GlobeIcon className="size-5 text-amber-600 dark:text-amber-300" />
          <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
            The coming soon gate only protects the public marketplace. The admin
            dashboard remains accessible on its own surface.
          </p>
        </div>
      </div>
    </DashboardPanel>
  );
}
