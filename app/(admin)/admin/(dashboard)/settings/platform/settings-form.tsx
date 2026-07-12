"use client";

import {
  type ComponentProps,
  type ChangeEvent,
  type DragEvent,
  type ReactElement,
  type RefObject,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BarChart3Icon,
  BellIcon,
  BracesIcon,
  Code2Icon,
  ClipboardIcon,
  CreditCardIcon,
  EyeOffIcon,
  EyeIcon,
  Globe2Icon,
  HistoryIcon,
  ImageIcon,
  KeyRoundIcon,
  LinkIcon,
  LockIcon,
  MailCheckIcon,
  MessageCircleIcon,
  MonitorIcon,
  MousePointerClickIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  SearchIcon,
  SendIcon,
  Redo2Icon,
  Trash2Icon,
  TruckIcon,
  Undo2Icon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import {
  updateMarketplaceSocialLinkSettings,
  updateMarketplaceGateSettings,
  updateGoogleMarketingSettings,
  updateMediaStorageSettings,
  deleteNotificationGlobalVariableSettings,
  saveNotificationGlobalVariableSettings,
  saveInAppNotificationTemplateSettings,
  saveNotificationTemplateSettings,
  restoreInAppNotificationTemplateSettings,
  restoreNotificationTemplateSettings,
  sendInAppNotificationTemplateTestSettings,
  sendNotificationTemplateTestSettings,
  deleteJurgensDeliveryZoneSettings,
  saveJurgensDeliveryZoneSettings,
  updatePayFastPaymentSettings,
  updateShippingIntegrationSettings,
  updateWhatsappOrderingSettings,
  type AdminSettingsState,
} from "@/app/(admin)/admin/(dashboard)/settings/platform/actions";
import type { JurgensDeliveryZone } from "@/src/modules/shipping/jurgens-delivery";
import type { getAdminMediaLibrary } from "@/src/modules/media/admin";
import type {
  AdminInAppNotificationTemplate,
  AdminNotificationDeliveryPolicy,
  AdminNotificationDelivery,
  AdminNotificationGlobalVariable,
  AdminNotificationTemplate,
} from "@/src/modules/notifications/templates";
import { MediaManagerDialog } from "@/components/media/media-manager-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SettingsFormProps = {
  comingSoonEnabled: boolean;
  hasPassword: boolean;
};

function SecretTextInput({
  className,
  defaultValue,
  icon,
  id,
  minLength,
  name,
  placeholder,
}: {
  className?: string;
  defaultValue?: string | null;
  icon?: "key";
  id: string;
  minLength?: number;
  name: string;
  placeholder: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [inputValue, setInputValue] = useState(defaultValue ?? "");
  const Icon = isVisible ? EyeOffIcon : EyeIcon;

  useEffect(() => {
    setInputValue(defaultValue ?? "");
  }, [defaultValue]);

  return (
    <div className="relative">
      {icon === "key" ? (
        <KeyRoundIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
      ) : null}
      <Input
        id={id}
        name={name}
        type={isVisible ? "text" : "password"}
        autoComplete="off"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        minLength={minLength}
        placeholder={placeholder}
        className={cn(icon === "key" ? "pl-10 pr-12" : "pr-12", className)}
      />
      <Button
        aria-label={isVisible ? "Hide value" : "Show value"}
        className="absolute right-2 top-1/2 size-7 -translate-y-1/2 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
        onClick={() => setIsVisible((current) => !current)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Icon className="size-4" />
      </Button>
    </div>
  );
}

const initialState: AdminSettingsState = {};

export function SettingsForm({
  comingSoonEnabled,
  hasPassword,
}: SettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateMarketplaceGateSettings,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-5">
      <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <Checkbox
          id="enabled"
          name="enabled"
          defaultChecked={comingSoonEnabled}
          className="mt-1"
        />
        <div>
          <Label htmlFor="enabled" className="text-sm font-semibold">
            Hide marketplace behind coming soon gate
          </Label>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            When enabled, public marketplace pages require the preview password.
            The admin dashboard stays accessible.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Preview password</Label>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <SecretTextInput
            id="password"
            name="password"
            minLength={8}
            placeholder={
              hasPassword
                ? "Leave blank to keep current password"
                : "Set a password before enabling"
            }
            className="pl-10"
          />
        </div>
        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          Changing the password signs out existing marketplace preview visitors.
        </p>
      </div>

      {state.message ? (
        <p
          className={
            state.ok
              ? "rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200"
              : "rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="justify-center gap-2">
        <SaveIcon className="size-4" />
        {isPending ? "Saving..." : "Save marketplace gate"}
      </Button>
    </form>
  );
}

type SocialLinksFormProps = {
  facebookUrl: string | null;
  googleReviewUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
};

export function SocialLinksForm({
  facebookUrl,
  googleReviewUrl,
  instagramUrl,
  twitterUrl,
}: SocialLinksFormProps) {
  const [facebookValue, setFacebookValue] = useState(facebookUrl ?? "");
  const [googleReviewValue, setGoogleReviewValue] = useState(
    googleReviewUrl ?? "",
  );
  const [instagramValue, setInstagramValue] = useState(instagramUrl ?? "");
  const [twitterValue, setTwitterValue] = useState(twitterUrl ?? "");
  const [state, formAction, isPending] = useActionState(
    updateMarketplaceSocialLinkSettings,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="facebookUrl">Facebook URL</Label>
        <div className="relative">
          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            id="facebookUrl"
            name="facebookUrl"
            type="url"
            autoComplete="url"
            value={facebookValue}
            onChange={(event) => setFacebookValue(event.target.value)}
            placeholder="https://facebook.com/jurgensenergy"
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="googleReviewUrl">Google review URL</Label>
        <div className="relative">
          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            id="googleReviewUrl"
            name="googleReviewUrl"
            type="url"
            autoComplete="url"
            value={googleReviewValue}
            onChange={(event) => setGoogleReviewValue(event.target.value)}
            placeholder="https://g.page/r/your-google-review-link"
            className="pl-10"
          />
        </div>
        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          Used in completed Jurgens delivery thank-you messages.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="instagramUrl">Instagram URL</Label>
        <div className="relative">
          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            id="instagramUrl"
            name="instagramUrl"
            type="url"
            autoComplete="url"
            value={instagramValue}
            onChange={(event) => setInstagramValue(event.target.value)}
            placeholder="https://instagram.com/jurgensenergy"
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="twitterUrl">X / Twitter URL</Label>
        <div className="relative">
          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            id="twitterUrl"
            name="twitterUrl"
            type="url"
            autoComplete="url"
            value={twitterValue}
            onChange={(event) => setTwitterValue(event.target.value)}
            placeholder="https://x.com/jurgensenergy"
            className="pl-10"
          />
        </div>
        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          Leave a field blank to hide that social icon from marketplace
          surfaces.
        </p>
      </div>

      {state.message ? (
        <p
          className={
            state.ok
              ? "rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200"
              : "rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="justify-center gap-2">
        <SaveIcon className="size-4" />
        {isPending ? "Saving..." : "Save social links"}
      </Button>
    </form>
  );
}

type GoogleMarketingSettingsFormProps = {
  googleAdsConversionId: string | null;
  googleAdsConversionLabel: string | null;
  googleAnalyticsMeasurementId: string | null;
  googleMerchantCenterId: string | null;
  googleSiteVerificationToken: string | null;
  googleTagManagerId: string | null;
};

export function GoogleMarketingSettingsForm({
  googleAdsConversionId,
  googleAdsConversionLabel,
  googleAnalyticsMeasurementId,
  googleMerchantCenterId,
  googleSiteVerificationToken,
  googleTagManagerId,
}: GoogleMarketingSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateGoogleMarketingSettings,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="googleTagManagerId">Google Tag Manager ID</Label>
          <div className="relative">
            <Code2Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              autoComplete="off"
              className="pl-10"
              defaultValue={googleTagManagerId ?? ""}
              id="googleTagManagerId"
              name="googleTagManagerId"
              placeholder="GTM-XXXXXXX"
            />
          </div>
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Loads the GTM container on public marketplace pages only.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="googleAnalyticsMeasurementId">
            GA4 measurement ID
          </Label>
          <div className="relative">
            <BarChart3Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              autoComplete="off"
              className="pl-10"
              defaultValue={googleAnalyticsMeasurementId ?? ""}
              id="googleAnalyticsMeasurementId"
              name="googleAnalyticsMeasurementId"
              placeholder="G-XXXXXXXXXX"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="googleAdsConversionId">Google Ads conversion ID</Label>
          <div className="relative">
            <MousePointerClickIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              autoComplete="off"
              className="pl-10"
              defaultValue={googleAdsConversionId ?? ""}
              id="googleAdsConversionId"
              name="googleAdsConversionId"
              placeholder="AW-123456789"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="googleAdsConversionLabel">
            Google Ads conversion label
          </Label>
          <div className="relative">
            <MousePointerClickIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              autoComplete="off"
              className="pl-10"
              defaultValue={googleAdsConversionLabel ?? ""}
              id="googleAdsConversionLabel"
              name="googleAdsConversionLabel"
              placeholder="Optional conversion label"
            />
          </div>
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Saved for checkout conversion events and future campaign-specific
            tracking.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="googleMerchantCenterId">Merchant Center ID</Label>
          <div className="relative">
            <Globe2Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              autoComplete="off"
              className="pl-10"
              defaultValue={googleMerchantCenterId ?? ""}
              id="googleMerchantCenterId"
              inputMode="numeric"
              name="googleMerchantCenterId"
              placeholder="123456789"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="googleSiteVerificationToken">
            Search Console verification
          </Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              autoComplete="off"
              className="pl-10"
              defaultValue={googleSiteVerificationToken ?? ""}
              id="googleSiteVerificationToken"
              name="googleSiteVerificationToken"
              placeholder="Paste token or full meta tag"
            />
          </div>
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            If Google gives you a meta tag, paste it here and only the content
            token will be saved.
          </p>
        </div>
      </div>

      {state.message ? (
        <p
          className={
            state.ok
              ? "rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200"
              : "rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="w-fit gap-2">
        <SaveIcon className="size-4" />
        {isPending ? "Saving..." : "Save Google tags"}
      </Button>
    </form>
  );
}

type MediaStorageSettingsFormProps = {
  freeStorageQuotaMb: number;
  imageCompressionQuality: number;
  maxImageWidth: number;
  maxUploadFileMb: number;
  maxVideoUploadFileMb: number;
  maxVideoWidth: number;
  videoCompressionCrf: number;
};

export function MediaStorageSettingsForm({
  freeStorageQuotaMb,
  imageCompressionQuality,
  maxImageWidth,
  maxUploadFileMb,
  maxVideoUploadFileMb,
  maxVideoWidth,
  videoCompressionCrf,
}: MediaStorageSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateMediaStorageSettings,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="freeStorageQuotaMb">Media storage quota</Label>
          <Input
            id="freeStorageQuotaMb"
            name="freeStorageQuotaMb"
            type="number"
            min={50}
            max={102400}
            defaultValue={freeStorageQuotaMb}
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Storage available to the Jurgens Energy media library.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="maxUploadFileMb">Max upload file size</Label>
          <Input
            id="maxUploadFileMb"
            name="maxUploadFileMb"
            type="number"
            min={1}
            max={100}
            defaultValue={maxUploadFileMb}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="maxVideoUploadFileMb">Max video upload size</Label>
          <Input
            id="maxVideoUploadFileMb"
            name="maxVideoUploadFileMb"
            type="number"
            min={10}
            max={2048}
            defaultValue={maxVideoUploadFileMb}
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Applies before compression, so raw product videos stay controlled.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="maxImageWidth">Max image width</Label>
          <Input
            id="maxImageWidth"
            name="maxImageWidth"
            type="number"
            min={800}
            max={5000}
            defaultValue={maxImageWidth}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="maxVideoWidth">Max video width</Label>
          <Input
            id="maxVideoWidth"
            name="maxVideoWidth"
            type="number"
            min={480}
            max={3840}
            defaultValue={maxVideoWidth}
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Larger videos are scaled down during server-side compression.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="imageCompressionQuality">
            Image compression quality
          </Label>
          <Input
            id="imageCompressionQuality"
            name="imageCompressionQuality"
            type="number"
            min={40}
            max={92}
            defaultValue={imageCompressionQuality}
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Images are converted to WebP, resized, stripped of metadata, and
            compressed at this quality.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="videoCompressionCrf">Video compression CRF</Label>
          <Input
            id="videoCompressionCrf"
            name="videoCompressionCrf"
            type="number"
            min={18}
            max={35}
            defaultValue={videoCompressionCrf}
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Lower means higher quality and larger files. 28 is a practical
            product-video default.
          </p>
        </div>
      </div>

      {state.message ? (
        <p
          className={
            state.ok
              ? "rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200"
              : "rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="justify-center gap-2">
        <SaveIcon className="size-4" />
        {isPending ? "Saving..." : "Save media settings"}
      </Button>
    </form>
  );
}

type PayFastSettingsFormProps = {
  hasPayfastLiveMerchantKey: boolean;
  hasPayfastLivePassphrase: boolean;
  hasPayfastSandboxMerchantKey: boolean;
  hasPayfastSandboxPassphrase: boolean;
  payfastLiveMerchantId: string | null;
  payfastLiveMerchantKey: string | null;
  payfastLivePassphrase: string | null;
  payfastMode: "live" | "sandbox";
  payfastOnsiteEnabled: boolean;
  payfastSandboxMerchantId: string | null;
  payfastSandboxMerchantKey: string | null;
  payfastSandboxPassphrase: string | null;
  payfastTokenizationEnabled: boolean;
};

export function PayFastSettingsForm({
  hasPayfastLiveMerchantKey,
  hasPayfastLivePassphrase,
  hasPayfastSandboxMerchantKey,
  hasPayfastSandboxPassphrase,
  payfastLiveMerchantId,
  payfastLiveMerchantKey,
  payfastLivePassphrase,
  payfastMode,
  payfastOnsiteEnabled,
  payfastSandboxMerchantId,
  payfastSandboxMerchantKey,
  payfastSandboxPassphrase,
  payfastTokenizationEnabled,
}: PayFastSettingsFormProps) {
  const [mode, setMode] = useState<"live" | "sandbox">(payfastMode);
  const [state, formAction, isPending] = useActionState(
    updatePayFastPaymentSettings,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="mode" value={mode} />

      <div className="inline-grid w-fit grid-cols-2 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/[0.04]">
        {(["live", "sandbox"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={cn(
              "rounded-md px-5 py-2 text-sm font-semibold capitalize transition-colors",
              mode === option
                ? "bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950"
                : "text-slate-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white",
            )}
            aria-pressed={mode === option}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <label className="flex items-start gap-3">
          <Checkbox
            className="mt-1"
            defaultChecked={payfastOnsiteEnabled}
            id="onsiteEnabled"
            name="onsiteEnabled"
          />
          <span className="grid gap-1">
            <span className="text-sm font-semibold text-zinc-950 dark:text-white">
              Enable PayFast onsite payments
            </span>
            <span className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Checkout will use the secure PayFast onsite payment engine instead of
              sending buyers to a hosted PayFast checkout page.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <Checkbox
            className="mt-1"
            defaultChecked={payfastTokenizationEnabled}
            id="tokenizationEnabled"
            name="tokenizationEnabled"
          />
          <span className="grid gap-1">
            <span className="text-sm font-semibold text-zinc-950 dark:text-white">
              Enable PayFast tokenization
            </span>
            <span className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Allows future one-click style flows through the PayFast vault. Jurgens
              Energy must never store raw card numbers or CVV values.
            </span>
          </span>
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PayFastCredentialPanel
          active={mode === "live"}
          description="Used when Jurgens Energy is processing real payments."
          hasMerchantKey={hasPayfastLiveMerchantKey}
          hasPassphrase={hasPayfastLivePassphrase}
          merchantId={payfastLiveMerchantId}
          merchantKey={payfastLiveMerchantKey}
          mode="live"
          passphrase={payfastLivePassphrase}
          title="Live credentials"
        />

        <PayFastCredentialPanel
          active={mode === "sandbox"}
          description="Used for local testing and payment-flow rehearsals."
          hasMerchantKey={hasPayfastSandboxMerchantKey}
          hasPassphrase={hasPayfastSandboxPassphrase}
          merchantId={payfastSandboxMerchantId}
          merchantKey={payfastSandboxMerchantKey}
          mode="sandbox"
          passphrase={payfastSandboxPassphrase}
          title="Sandbox credentials"
        />
      </div>

      {state.message ? (
        <p
          className={
            state.ok
              ? "rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200"
              : "rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="w-fit gap-2">
        <SaveIcon className="size-4" />
        {isPending ? "Saving..." : "Save PayFast settings"}
      </Button>
    </form>
  );
}

function PayFastCredentialPanel({
  active,
  description,
  hasMerchantKey,
  hasPassphrase,
  merchantId,
  merchantKey,
  mode,
  passphrase,
  title,
}: {
  active: boolean;
  description: string;
  hasMerchantKey: boolean;
  hasPassphrase: boolean;
  merchantId: string | null;
  merchantKey: string | null;
  mode: "live" | "sandbox";
  passphrase: string | null;
  title: string;
}) {
  const prefix = mode === "live" ? "live" : "sandbox";
  const [merchantIdValue, setMerchantIdValue] = useState(merchantId ?? "");

  useEffect(() => {
    setMerchantIdValue(merchantId ?? "");
  }, [merchantId]);

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        active
          ? "border-admin-primary/45 bg-admin-primary/8 dark:border-admin-primary/60 dark:bg-admin-primary/10"
          : "border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.04]",
      )}
    >
      <div className="mb-5 flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
          <CreditCardIcon className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}MerchantId`}>Merchant ID</Label>
          <Input
            id={`${prefix}MerchantId`}
            name={`${prefix}MerchantId`}
            autoComplete="off"
            inputMode="numeric"
            value={merchantIdValue}
            onChange={(event) => setMerchantIdValue(event.target.value)}
            placeholder={mode === "live" ? "Live merchant ID" : "Sandbox merchant ID"}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${prefix}MerchantKey`}>Merchant key</Label>
          <SecretTextInput
            id={`${prefix}MerchantKey`}
            name={`${prefix}MerchantKey`}
            icon="key"
            defaultValue={merchantKey}
            placeholder={
              hasMerchantKey
                ? "Saved - leave blank to keep current merchant key"
                : "Paste PayFast merchant key"
            }
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${prefix}Passphrase`}>Passphrase</Label>
          <SecretTextInput
            id={`${prefix}Passphrase`}
            name={`${prefix}Passphrase`}
            icon="key"
            defaultValue={passphrase}
            placeholder={
              hasPassphrase
                ? "Saved - leave blank to keep current passphrase"
                : "Paste PayFast passphrase"
            }
          />
          <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
            Used server-side for payment signatures and webhook validation.
          </p>
        </div>
      </div>
    </div>
  );
}

type WhatsappOrderingSettingsFormProps = {
  hasWhatsappApiKey: boolean;
  hasWhatsappWebhookVerifyToken: boolean;
  whatsappApiKey: string | null;
  whatsappBusinessPhoneNumber: string | null;
  whatsappFollowUpDefaultMessage: string;
  whatsappFollowUpDelayMinutes: number;
  whatsappFollowUpDraftMessage: string;
  whatsappFollowUpMaxCount: number;
  whatsappFollowUpQuietHoursEnabled: boolean;
  whatsappFollowUpQuietHoursEnd: string | null;
  whatsappFollowUpQuietHoursStart: string | null;
  whatsappFollowUpSupportMessage: string;
  whatsappFollowUpsEnabled: boolean;
  whatsappMessageUrl: string;
  whatsappOrderingEnabled: boolean;
  whatsappWebhookUrl: string;
  whatsappWebhookVerifyToken: string | null;
};

export function WhatsappOrderingSettingsForm({
  hasWhatsappApiKey,
  hasWhatsappWebhookVerifyToken,
  whatsappApiKey,
  whatsappBusinessPhoneNumber,
  whatsappFollowUpDefaultMessage,
  whatsappFollowUpDelayMinutes,
  whatsappFollowUpDraftMessage,
  whatsappFollowUpMaxCount,
  whatsappFollowUpQuietHoursEnabled,
  whatsappFollowUpQuietHoursEnd,
  whatsappFollowUpQuietHoursStart,
  whatsappFollowUpSupportMessage,
  whatsappFollowUpsEnabled,
  whatsappMessageUrl,
  whatsappOrderingEnabled,
  whatsappWebhookUrl,
  whatsappWebhookVerifyToken,
}: WhatsappOrderingSettingsFormProps) {
  const [isEnabled, setIsEnabled] = useState(whatsappOrderingEnabled);
  const [businessPhoneValue, setBusinessPhoneValue] = useState(
    whatsappBusinessPhoneNumber ?? "",
  );
  const [messageUrlValue, setMessageUrlValue] = useState(whatsappMessageUrl);
  const [followUpsEnabledValue, setFollowUpsEnabledValue] = useState(
    whatsappFollowUpsEnabled,
  );
  const [quietHoursEnabledValue, setQuietHoursEnabledValue] = useState(
    whatsappFollowUpQuietHoursEnabled,
  );
  const [copied, setCopied] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateWhatsappOrderingSettings,
    initialState,
  );

  async function copyWebhookUrl() {
    try {
      await navigator.clipboard.writeText(whatsappWebhookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="provider" value="360dialog" />

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-5 flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#16a34a]/10 text-[#16a34a]">
            <MessageCircleIcon className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              WhatsApp ordering controls
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Receive customer WhatsApp messages, create secure checkout draft
              links, and send replies back through 360dialog.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-white/10">
            <Checkbox
              checked={isEnabled}
              name="enabled"
              onCheckedChange={(checked) => setIsEnabled(checked === true)}
            />
            <span className="grid gap-1">
              <span className="font-semibold text-zinc-950 dark:text-white">
                Enable WhatsApp ordering
              </span>
              <span className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Shows the marketplace WhatsApp button and lets webhook replies
                send through the configured provider.
              </span>
            </span>
          </label>

          <div className="grid gap-2">
            <Label htmlFor="businessPhoneNumber">
              WhatsApp business number
            </Label>
            <Input
              id="businessPhoneNumber"
              name="businessPhoneNumber"
              autoComplete="tel"
              inputMode="tel"
              value={businessPhoneValue}
              onChange={(event) => setBusinessPhoneValue(event.target.value)}
              placeholder="+27 60 689 3558"
            />
            <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Used for the storefront WhatsApp launcher and customer-facing
              ordering links.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="mb-5 flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
              <KeyRoundIcon className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                360dialog credentials
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                The API key is encrypted before storage. Leave it blank to keep
                the saved value.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="messageUrl">Messaging API URL</Label>
              <Input
                id="messageUrl"
                name="messageUrl"
                type="url"
                value={messageUrlValue}
                onChange={(event) => setMessageUrlValue(event.target.value)}
                placeholder="https://waba-v2.360dialog.io"
              />
              <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                The sender posts text replies to this URL plus /messages.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="apiKey">360dialog API key</Label>
              <SecretTextInput
                id="apiKey"
                name="apiKey"
                icon="key"
                defaultValue={whatsappApiKey}
                placeholder={
                  hasWhatsappApiKey
                    ? "Saved - leave blank to keep current API key"
                    : "Paste 360dialog API key"
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="webhookVerifyToken">
                Webhook verify token
              </Label>
              <SecretTextInput
                id="webhookVerifyToken"
                name="webhookVerifyToken"
                icon="key"
                defaultValue={whatsappWebhookVerifyToken}
                placeholder={
                  hasWhatsappWebhookVerifyToken
                    ? "Saved - leave blank to keep current token"
                    : "Optional Meta-style verification token"
                }
              />
              <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Optional. 360dialog mainly needs the URL below; this token is
                kept for providers that call the Meta verification handshake.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="mb-5 flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
              <Code2Icon className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                Webhook URL
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Copy this into 360dialog. It is generated from APP_URL and the
                canonical webhook route.
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="whatsappWebhookUrl">Provider webhook URL</Label>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <Input
                id="whatsappWebhookUrl"
                readOnly
                value={whatsappWebhookUrl}
                className="min-w-0 font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={copyWebhookUrl}
                className="h-10 shrink-0 gap-2"
              >
                <ClipboardIcon className="size-4" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
              For local testing, set APP_URL to your tunnel URL before starting
              the dev server, then paste the generated URL into 360dialog.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-5 flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#ff5a1f]/10 text-[#ff5a1f]">
            <HistoryIcon className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              Follow-up automation
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Control when unresolved WhatsApp conversations become follow-up
              candidates and what message gets sent.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-white/10">
            <Checkbox
              checked={followUpsEnabledValue}
              name="followUpsEnabled"
              onCheckedChange={(checked) =>
                setFollowUpsEnabledValue(checked === true)
              }
            />
            <span className="grid gap-1">
              <span className="font-semibold text-zinc-950 dark:text-white">
                Enable follow-ups
              </span>
              <span className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Allows conversations to be marked as needing a follow-up and
                sent by the automation runner.
              </span>
            </span>
          </label>

          <div className="grid gap-2">
            <Label htmlFor="followUpDelayMinutes">Delay before follow-up</Label>
            <Input
              id="followUpDelayMinutes"
              name="followUpDelayMinutes"
              type="number"
              min={5}
              max={1440}
              step={5}
              defaultValue={whatsappFollowUpDelayMinutes}
            />
            <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Minutes after the latest unresolved WhatsApp prompt.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="followUpMaxCount">Max automatic follow-ups</Label>
            <Input
              id="followUpMaxCount"
              name="followUpMaxCount"
              type="number"
              min={1}
              max={5}
              defaultValue={whatsappFollowUpMaxCount}
            />
            <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Limit per unresolved conversation turn.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-white/10">
            <Checkbox
              checked={quietHoursEnabledValue}
              name="followUpQuietHoursEnabled"
              onCheckedChange={(checked) =>
                setQuietHoursEnabledValue(checked === true)
              }
            />
            <span className="grid gap-1">
              <span className="font-semibold text-zinc-950 dark:text-white">
                Respect quiet hours
              </span>
              <span className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Automatic follow-ups pause during this window. Manual admin
                replies still work.
              </span>
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="followUpQuietHoursStart">Quiet start</Label>
              <Input
                id="followUpQuietHoursStart"
                name="followUpQuietHoursStart"
                type="time"
                defaultValue={whatsappFollowUpQuietHoursStart ?? ""}
                disabled={!quietHoursEnabledValue}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="followUpQuietHoursEnd">Quiet end</Label>
              <Input
                id="followUpQuietHoursEnd"
                name="followUpQuietHoursEnd"
                type="time"
                defaultValue={whatsappFollowUpQuietHoursEnd ?? ""}
                disabled={!quietHoursEnabledValue}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="followUpDraftMessage">Pending order message</Label>
            <Textarea
              id="followUpDraftMessage"
              name="followUpDraftMessage"
              defaultValue={whatsappFollowUpDraftMessage}
              rows={5}
              className="min-h-32 resize-y"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="followUpSupportMessage">Support message</Label>
            <Textarea
              id="followUpSupportMessage"
              name="followUpSupportMessage"
              defaultValue={whatsappFollowUpSupportMessage}
              rows={5}
              className="min-h-32 resize-y"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="followUpDefaultMessage">Default gas message</Label>
            <Textarea
              id="followUpDefaultMessage"
              name="followUpDefaultMessage"
              defaultValue={whatsappFollowUpDefaultMessage}
              rows={5}
              className="min-h-32 resize-y"
            />
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-zinc-400">
          WhatsApp provider rules still apply: free-form follow-ups can only be
          sent inside the customer-service window unless approved template
          sending is added later.
        </p>
      </div>

      {state.message ? (
        <p
          className={
            state.ok
              ? "rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200"
              : "rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="w-fit gap-2">
        <SaveIcon className="size-4" />
        {isPending ? "Saving..." : "Save WhatsApp settings"}
      </Button>
    </form>
  );
}

type ShippingSettingsFormProps = {
  bobgoLiveApiKey: string | null;
  bobgoLiveWebhookSecret: string | null;
  bobgoBookingMode: "disabled" | "quote_only" | "quote_and_book";
  bobgoEnabled: boolean;
  bobgoMode: "live" | "sandbox";
  bobgoSandboxApiKey: string | null;
  bobgoSandboxWebhookSecret: string | null;
  bobgoWebhookFulfillmentCreated: boolean;
  bobgoWebhookShipmentChargedAmountChanged: boolean;
  bobgoWebhookShipmentChargedWeightChanged: boolean;
  bobgoWebhookShipmentHealthStatusUpdated: boolean;
  bobgoWebhookShipmentSubmissionStatusUpdated: boolean;
  bobgoWebhookTrackingUpdated: boolean;
  hasBobgoLiveApiKey: boolean;
  hasBobgoLiveWebhookSecret: boolean;
  hasBobgoSandboxApiKey: boolean;
  hasBobgoSandboxWebhookSecret: boolean;
  jurgensDeliveryCutoffTime: string;
  jurgensDeliveryZones: JurgensDeliveryZone[];
  shippingBufferBps: number;
  shippingEnabled: boolean;
  shippingMarginBps: number;
};

export function ShippingSettingsForm({
  bobgoLiveApiKey,
  bobgoLiveWebhookSecret,
  bobgoBookingMode,
  bobgoEnabled,
  bobgoMode,
  bobgoSandboxApiKey,
  bobgoSandboxWebhookSecret,
  bobgoWebhookFulfillmentCreated,
  bobgoWebhookShipmentChargedAmountChanged,
  bobgoWebhookShipmentChargedWeightChanged,
  bobgoWebhookShipmentHealthStatusUpdated,
  bobgoWebhookShipmentSubmissionStatusUpdated,
  bobgoWebhookTrackingUpdated,
  hasBobgoLiveApiKey,
  hasBobgoLiveWebhookSecret,
  hasBobgoSandboxApiKey,
  hasBobgoSandboxWebhookSecret,
  jurgensDeliveryCutoffTime,
  jurgensDeliveryZones,
  shippingBufferBps,
  shippingEnabled,
  shippingMarginBps,
}: ShippingSettingsFormProps) {
  const [bookingMode, setBookingMode] = useState<
    "disabled" | "quote_only" | "quote_and_book"
  >(
    bobgoBookingMode === "quote_only" ||
      bobgoBookingMode === "quote_and_book"
      ? bobgoBookingMode
      : "disabled",
  );
  const [apiMode, setApiMode] = useState<"live" | "sandbox">(
    bobgoMode === "live" ? "live" : "sandbox",
  );
  const [isBobgoEnabled, setIsBobgoEnabled] = useState(bobgoEnabled);
  const [isShippingEnabled, setIsShippingEnabled] = useState(shippingEnabled);
  const [shippingBufferValue, setShippingBufferValue] = useState(
    String(shippingBufferBps),
  );
  const [shippingMarginValue, setShippingMarginValue] = useState(
    String(shippingMarginBps),
  );
  const [webhookTopics, setWebhookTopics] = useState({
    bobgoWebhookFulfillmentCreated,
    bobgoWebhookShipmentChargedAmountChanged,
    bobgoWebhookShipmentChargedWeightChanged,
    bobgoWebhookShipmentHealthStatusUpdated,
    bobgoWebhookShipmentSubmissionStatusUpdated,
    bobgoWebhookTrackingUpdated,
  });
  const [state, formAction, isPending] = useActionState(
    updateShippingIntegrationSettings,
    initialState,
  );

  return (
    <div className="grid gap-6">
    <form action={formAction} className="grid gap-5">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-5 flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
            <TruckIcon className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              Jurgens Energy shipping controls
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Choose whether checkout can quote shipping, whether Jurgens Energy can
              book Bob Go shipments, and how much margin or buffer is added to
              provider rates.
            </p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-white/10">
            <Checkbox
              checked={isShippingEnabled}
              name="shippingEnabled"
              onCheckedChange={(checked) =>
                setIsShippingEnabled(checked === true)
              }
            />
            Show shipping rates at checkout
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-white/10">
            <Checkbox
              checked={isBobgoEnabled}
              name="bobgoEnabled"
              onCheckedChange={(checked) => setIsBobgoEnabled(checked === true)}
            />
            Enable Bob Go provider integration
          </label>
          <div className="grid gap-2 lg:col-span-2">
            <Label htmlFor="jurgensDeliveryCutoffTime">
              Jurgens same-day cutoff
            </Label>
            <Input
              id="jurgensDeliveryCutoffTime"
              name="jurgensDeliveryCutoffTime"
              type="time"
              defaultValue={jurgensDeliveryCutoffTime}
            />
            <p className="text-xs leading-5 text-slate-500">
              Jurgens-delivered products show a same-day countdown until this
              South African time, then switch to delivery tomorrow. Bob Go
              courier items do not show delivery estimates.
            </p>
          </div>
          <div className="grid gap-2 lg:col-span-2">
            <Label htmlFor="bobgoMode">API environment</Label>
            <Select
              name="bobgoMode"
              value={apiMode}
              onValueChange={(value) => {
                if (value === "live" || value === "sandbox") {
                  setApiMode(value);
                }
              }}
            >
              <SelectTrigger id="bobgoMode" className="w-full">
                <SelectValue placeholder="Select API environment" />
              </SelectTrigger>
              <SelectContent
                align="start"
                className="min-w-[240px] max-w-[calc(100vw-2rem)]"
              >
                <SelectItem value="sandbox" className="whitespace-nowrap">
                  Sandbox API
                </SelectItem>
                <SelectItem value="live" className="whitespace-nowrap">
                  Live API
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-slate-500">
              Sandbox uses https://api.sandbox.bobgo.co.za/v2/. Production uses
              https://api.bobgo.co.za/v2/. The selected environment controls
              which bearer token and webhook secret Jurgens Energy uses.
            </p>
          </div>
          <div className="grid gap-2 lg:col-span-2">
            <Label htmlFor="bobgoBookingMode">Booking mode</Label>
            <Select
              name="bobgoBookingMode"
              value={bookingMode}
              onValueChange={(value) => {
                if (
                  value === "disabled" ||
                  value === "quote_only" ||
                  value === "quote_and_book"
                ) {
                  setBookingMode(value);
                }
              }}
            >
              <SelectTrigger id="bobgoBookingMode" className="w-full">
                <SelectValue placeholder="Select booking mode" />
              </SelectTrigger>
              <SelectContent
                align="start"
                className="min-w-[240px] max-w-[calc(100vw-2rem)]"
              >
                <SelectItem value="disabled" className="whitespace-nowrap">
                  Disabled
                </SelectItem>
                <SelectItem value="quote_only" className="whitespace-nowrap">
                  Quote only
                </SelectItem>
                <SelectItem value="quote_and_book">
                  Quote and book shipments
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-slate-500">
              Quote only lets checkout request rates without creating shipments.
              Quote and book lets paid orders create Bob Go shipments and
              waybills.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shippingMarginBps">Shipping margin (bps)</Label>
            <Input
              id="shippingMarginBps"
              name="shippingMarginBps"
              type="number"
              min={0}
              max={10000}
              value={shippingMarginValue}
              onChange={(event) => setShippingMarginValue(event.target.value)}
            />
            <p className="text-xs leading-5 text-slate-500">
              Markup applied to the courier rate before customers see it. 100
              bps = 1%.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shippingBufferBps">Shipping buffer (bps)</Label>
            <Input
              id="shippingBufferBps"
              name="shippingBufferBps"
              type="number"
              min={0}
              max={10000}
              value={shippingBufferValue}
              onChange={(event) => setShippingBufferValue(event.target.value)}
            />
            <p className="text-xs leading-5 text-slate-500">
              Extra buffer for adjustment risk before margin is applied. 100 bps
              = 1%.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BobGoCredentialPanel
          active={apiMode === "sandbox"}
          apiBaseUrl="https://api.sandbox.bobgo.co.za/v2/"
          apiKey={bobgoSandboxApiKey}
          description="Used with your Bob Go sandbox account for development, rate checks, booking tests, and webhook testing."
          hasApiKey={hasBobgoSandboxApiKey}
          hasWebhookSecret={hasBobgoSandboxWebhookSecret}
          mode="sandbox"
          title="Sandbox credentials"
          webhookSecret={bobgoSandboxWebhookSecret}
        />

        <BobGoCredentialPanel
          active={apiMode === "live"}
          apiBaseUrl="https://api.bobgo.co.za/v2/"
          apiKey={bobgoLiveApiKey}
          description="Used for real checkout rates, real shipment bookings, waybills, tracking, and webhook processing."
          hasApiKey={hasBobgoLiveApiKey}
          hasWebhookSecret={hasBobgoLiveWebhookSecret}
          mode="live"
          title="Production credentials"
          webhookSecret={bobgoLiveWebhookSecret}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="mb-5 flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
              <BellIcon className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                Required webhook topics
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Create Bob Go subscriptions for these events and point each one
                to /api/webhooks/bobgo.
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <BobGoWebhookCheckbox
              checked={webhookTopics.bobgoWebhookTrackingUpdated}
              name="bobgoWebhookTrackingUpdated"
              label="Tracking updated"
              onCheckedChange={(checked) =>
                setWebhookTopics((current) => ({
                  ...current,
                  bobgoWebhookTrackingUpdated: checked,
                }))
              }
            />
            <BobGoWebhookCheckbox
              checked={webhookTopics.bobgoWebhookFulfillmentCreated}
              name="bobgoWebhookFulfillmentCreated"
              label="Fulfillment created"
              onCheckedChange={(checked) =>
                setWebhookTopics((current) => ({
                  ...current,
                  bobgoWebhookFulfillmentCreated: checked,
                }))
              }
            />
            <BobGoWebhookCheckbox
              checked={
                webhookTopics.bobgoWebhookShipmentSubmissionStatusUpdated
              }
              name="bobgoWebhookShipmentSubmissionStatusUpdated"
              label="Shipment submission status updated"
              onCheckedChange={(checked) =>
                setWebhookTopics((current) => ({
                  ...current,
                  bobgoWebhookShipmentSubmissionStatusUpdated: checked,
                }))
              }
            />
            <BobGoWebhookCheckbox
              checked={webhookTopics.bobgoWebhookShipmentChargedAmountChanged}
              name="bobgoWebhookShipmentChargedAmountChanged"
              label="Shipment charged amount changed"
              onCheckedChange={(checked) =>
                setWebhookTopics((current) => ({
                  ...current,
                  bobgoWebhookShipmentChargedAmountChanged: checked,
                }))
              }
            />
            <BobGoWebhookCheckbox
              checked={webhookTopics.bobgoWebhookShipmentChargedWeightChanged}
              name="bobgoWebhookShipmentChargedWeightChanged"
              label="Shipment charged weight changed"
              onCheckedChange={(checked) =>
                setWebhookTopics((current) => ({
                  ...current,
                  bobgoWebhookShipmentChargedWeightChanged: checked,
                }))
              }
            />
            <BobGoWebhookCheckbox
              checked={webhookTopics.bobgoWebhookShipmentHealthStatusUpdated}
              name="bobgoWebhookShipmentHealthStatusUpdated"
              label="Shipment health status updated"
              onCheckedChange={(checked) =>
                setWebhookTopics((current) => ({
                  ...current,
                  bobgoWebhookShipmentHealthStatusUpdated: checked,
                }))
              }
            />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
        Keep Bob Go tracking emails disabled where possible. Bob Go should send
        Jurgens Energy webhook events, then Jurgens Energy sends customer
        notifications through our notification templates.
      </div>
      {state.message ? (
        <p
          className={
            state.ok
              ? "rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200"
              : "rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
          }
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="w-fit gap-2">
        <SaveIcon className="size-4" />
        {isPending ? "Saving..." : "Save shipping settings"}
      </Button>
    </form>
      <JurgensDeliveryZonesManager zones={jurgensDeliveryZones} />
    </div>
  );
}

function BobGoCredentialPanel({
  active,
  apiBaseUrl,
  apiKey,
  description,
  hasApiKey,
  hasWebhookSecret,
  mode,
  title,
  webhookSecret,
}: {
  active: boolean;
  apiBaseUrl: string;
  apiKey: string | null;
  description: string;
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  mode: "live" | "sandbox";
  title: string;
  webhookSecret: string | null;
}) {
  const prefix = mode === "live" ? "bobgoLive" : "bobgoSandbox";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        active
          ? "border-admin-primary/45 bg-admin-primary/8 dark:border-admin-primary/60 dark:bg-admin-primary/10"
          : "border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.04]",
      )}
    >
      <div className="mb-5 flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
          <KeyRoundIcon className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
            {description}
          </p>
          <p className="mt-2 rounded-md bg-zinc-100 px-2 py-1 font-mono text-[11px] text-slate-600 dark:bg-white/10 dark:text-zinc-300">
            {apiBaseUrl}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}ApiKey`}>Bearer token</Label>
          <SecretTextInput
            id={`${prefix}ApiKey`}
            name={`${prefix}ApiKey`}
            icon="key"
            defaultValue={apiKey}
            placeholder={
              hasApiKey
                ? "Saved - leave blank to keep current token"
                : "Paste Bob Go bearer token"
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}WebhookSecret`}>
            Webhook signing secret
          </Label>
          <SecretTextInput
            id={`${prefix}WebhookSecret`}
            name={`${prefix}WebhookSecret`}
            icon="key"
            defaultValue={webhookSecret}
            placeholder={
              hasWebhookSecret
                ? "Saved - leave blank to keep current secret"
                : "Paste webhook signing secret"
            }
          />
        </div>
      </div>
    </div>
  );
}

function BobGoWebhookCheckbox({
  checked,
  label,
  name,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  name: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-white/10">
      <Checkbox
        checked={checked}
        name={name}
        onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
      />
      {label}
    </label>
  );
}

type JurgensDeliveryRateDraft = {
  fromAmount: string;
  key: string;
  price: string;
  upToAmount: string;
};

function JurgensDeliveryZonesManager({
  zones,
}: {
  zones: JurgensDeliveryZone[];
}) {
  return (
    <section className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-admin-primary/10 text-admin-primary">
            <TruckIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              Jurgens Energy delivery zones
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Set the postal codes Jurgens Energy delivers to directly, then
              add minimum order rules and conditional local delivery prices.
            </p>
          </div>
        </div>

        <JurgensDeliveryZoneDialog
          trigger={
            <Button type="button" className="w-fit gap-2">
              <PlusIcon className="size-4" />
              Add zone
            </Button>
          }
        />
      </div>

      {zones.length > 0 ? (
        <div className="grid gap-3">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-white/10"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-sm font-bold text-zinc-950 dark:text-white">
                      {zone.name}
                    </h4>
                    <Badge variant={zone.isActive ? "default" : "secondary"}>
                      {zone.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                    {zone.postalCodes.length} postal code
                    {zone.postalCodes.length === 1 ? "" : "s"} · minimum order{" "}
                    {formatZar(zone.minimumOrderAmount)} ·{" "}
                    {summarizeJurgensDeliveryRates(zone)}
                  </p>
                  {zone.deliveryInformation ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-zinc-300">
                      {zone.deliveryInformation}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <JurgensDeliveryZoneDialog
                    zone={zone}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <PencilIcon className="size-3.5" />
                        Edit
                      </Button>
                    }
                  />
                  <DeleteJurgensDeliveryZoneButton zone={zone} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {zone.postalCodes.slice(0, 12).map((postalCode) => (
                  <span
                    key={postalCode}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
                  >
                    {postalCode}
                  </span>
                ))}
                {zone.postalCodes.length > 12 ? (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400">
                    +{zone.postalCodes.length - 12} more
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300">
          No Jurgens Energy delivery zones yet. Add postal-code zones before
          checkout can offer direct Jurgens delivery.
        </div>
      )}
    </section>
  );
}

function JurgensDeliveryZoneDialog({
  trigger,
  zone,
}: {
  trigger: ReactElement;
  zone?: JurgensDeliveryZone;
}) {
  const [state, formAction, isPending] = useActionState(
    saveJurgensDeliveryZoneSettings,
    initialState,
  );
  const [rates, setRates] = useState<JurgensDeliveryRateDraft[]>(() =>
    getInitialRateDrafts(zone),
  );
  const dialogId = zone?.id ?? "new";

  function updateRate(
    key: string,
    field: keyof Omit<JurgensDeliveryRateDraft, "key">,
    value: string,
  ) {
    setRates((current) =>
      current.map((rate) =>
        rate.key === key ? { ...rate, [field]: value } : rate,
      ),
    );
  }

  function addRate() {
    setRates((current) => {
      const previous = current[current.length - 1];

      return [
        ...current,
        {
          fromAmount: previous?.upToAmount || previous?.fromAmount || "0",
          key: createDeliveryRateKey(),
          price: "0",
          upToAmount: "",
        },
      ];
    });
  }

  function removeRate(key: string) {
    setRates((current) =>
      current.length === 1 ? current : current.filter((rate) => rate.key !== key),
    );
  }

  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-2xl">
        <form action={formAction} className="contents">
          <DialogHeader>
            <DialogTitle>{zone ? "Edit delivery zone" : "Add delivery zone"}</DialogTitle>
            <DialogDescription>
              Postal-code zones decide whether Jurgens Energy delivery can be
              offered for direct-delivery products at checkout.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-5">
            <input type="hidden" name="zoneId" value={zone?.id ?? ""} />
            <input
              type="hidden"
              name="ratesJson"
              value={JSON.stringify(toRatePayload(rates))}
            />

            <div className="grid gap-2">
              <Label htmlFor={`jurgens-zone-name-${dialogId}`}>Zone name</Label>
              <Input
                id={`jurgens-zone-name-${dialogId}`}
                name="name"
                defaultValue={zone?.name ?? ""}
                maxLength={120}
                placeholder="Paarl, Wellington, Franschhoek"
                required
              />
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-white/10">
              <Checkbox
                name="isActive"
                defaultChecked={zone?.isActive ?? true}
                className="mt-0.5"
              />
              <span>
                <span className="block font-semibold text-zinc-950 dark:text-white">
                  Active delivery zone
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-zinc-400">
                  Active zones can be matched at checkout. Inactive zones stay
                  saved but are not offered to customers.
                </span>
              </span>
            </label>

            <div className="grid gap-2">
              <Label htmlFor={`jurgens-zone-postal-codes-${dialogId}`}>
                Postal codes
              </Label>
              <Textarea
                id={`jurgens-zone-postal-codes-${dialogId}`}
                name="postalCodes"
                defaultValue={zone?.postalCodes.join(", ") ?? ""}
                minLength={2}
                placeholder="7646, 7655, 7600-7699, 76*"
                rows={4}
                required
              />
              <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Separate codes with commas or new lines. Use ranges like
                7600-7699, or prefix wildcards like 76*.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`jurgens-zone-minimum-${dialogId}`}>
                Minimum order price
              </Label>
              <Input
                id={`jurgens-zone-minimum-${dialogId}`}
                name="minimumOrderAmount"
                type="number"
                min={0}
                step="0.01"
                defaultValue={zone?.minimumOrderAmount ?? 0}
                required
              />
            </div>

            <div className="grid gap-3 rounded-xl border border-zinc-200 p-3 dark:border-white/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                    Conditional pricing
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                    Match the direct-delivery subtotal to a local delivery price.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit gap-2"
                  onClick={addRate}
                >
                  <PlusIcon className="size-3.5" />
                  Add tier
                </Button>
              </div>

              <div className="grid gap-2">
                {rates.map((rate, index) => (
                  <div
                    key={rate.key}
                    className="grid gap-2 rounded-lg border border-zinc-200 p-3 dark:border-white/10 lg:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <div className="grid gap-1.5">
                      <Label htmlFor={`rate-from-${dialogId}-${rate.key}`}>
                        Orders from
                      </Label>
                      <Input
                        id={`rate-from-${dialogId}-${rate.key}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={rate.fromAmount}
                        onChange={(event) =>
                          updateRate(rate.key, "fromAmount", event.target.value)
                        }
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`rate-up-to-${dialogId}-${rate.key}`}>
                        Up to
                      </Label>
                      <Input
                        id={`rate-up-to-${dialogId}-${rate.key}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={rate.upToAmount}
                        onChange={(event) =>
                          updateRate(rate.key, "upToAmount", event.target.value)
                        }
                        placeholder="No limit"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`rate-price-${dialogId}-${rate.key}`}>
                        Delivery price
                      </Label>
                      <Input
                        id={`rate-price-${dialogId}-${rate.key}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={rate.price}
                        onChange={(event) =>
                          updateRate(rate.key, "price", event.target.value)
                        }
                        required
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove delivery tier ${index + 1}`}
                        disabled={rates.length === 1}
                        onClick={() => removeRate(rate.key)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`jurgens-zone-delivery-info-${dialogId}`}>
                Delivery information
              </Label>
              <Textarea
                id={`jurgens-zone-delivery-info-${dialogId}`}
                name="deliveryInformation"
                defaultValue={zone?.deliveryInformation ?? ""}
                maxLength={255}
                placeholder="Delivery to Paarl, Wellington and Franschhoek."
                rows={3}
              />
              <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                This message can appear at checkout and on order confirmations.
              </p>
            </div>

            {state.message ? (
              <p
                className={
                  state.ok
                    ? "rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200"
                    : "rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
                }
              >
                {state.message}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={isPending} className="gap-2">
              <SaveIcon className="size-4" />
              {isPending ? "Saving..." : "Save zone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteJurgensDeliveryZoneButton({
  zone,
}: {
  zone: JurgensDeliveryZone;
}) {
  const [state, formAction, isPending] = useActionState(
    deleteJurgensDeliveryZoneSettings,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="zoneId" value={zone.id} />
      {state.message && !state.ok ? (
        <span className="sr-only">{state.message}</span>
      ) : null}
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${zone.name}`}
        disabled={isPending}
      >
        <Trash2Icon className="size-4" />
      </Button>
    </form>
  );
}

function getInitialRateDrafts(
  zone: JurgensDeliveryZone | undefined,
): JurgensDeliveryRateDraft[] {
  if (!zone || zone.rates.length === 0) {
    return [
      {
        fromAmount: "0",
        key: createDeliveryRateKey(),
        price: "0",
        upToAmount: "",
      },
    ];
  }

  return zone.rates.map((rate) => ({
    fromAmount: String(rate.fromAmount),
    key: rate.id,
    price: String(rate.price),
    upToAmount: rate.upToAmount === null ? "" : String(rate.upToAmount),
  }));
}

function createDeliveryRateKey() {
  return `rate-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toRatePayload(rates: JurgensDeliveryRateDraft[]) {
  return rates.map((rate) => ({
    fromAmount: rate.fromAmount,
    price: rate.price,
    upToAmount: rate.upToAmount.trim() ? rate.upToAmount : null,
  }));
}

function summarizeJurgensDeliveryRates(zone: JurgensDeliveryZone) {
  const firstRate = zone.rates[0];

  if (!firstRate) {
    return "no price tiers";
  }

  if (firstRate.price === 0) {
    return `free from ${formatZar(firstRate.fromAmount)}`;
  }

  return `${formatZar(firstRate.price)} from ${formatZar(firstRate.fromAmount)}`;
}

function formatZar(value: number) {
  return `R ${value.toFixed(2)}`;
}

type NotificationSettingsFormProps = {
  deliveries: AdminNotificationDelivery[];
  globalVariables: AdminNotificationGlobalVariable[];
  initialSelectedItem: string | null;
  inAppTemplates: AdminInAppNotificationTemplate[];
  mediaLibrary: Awaited<ReturnType<typeof getAdminMediaLibrary>> | null;
  templates: AdminNotificationTemplate[];
};

function getDefaultNotificationSelection(
  templates: AdminNotificationTemplate[],
  inAppTemplates: AdminInAppNotificationTemplate[],
) {
  return templates[0]
    ? `email:${templates[0].id}`
    : inAppTemplates[0]
      ? `in-app:${inAppTemplates[0].id}`
      : "analytics";
}

function isValidNotificationSelection(
  selection: string | null,
  templates: AdminNotificationTemplate[],
  inAppTemplates: AdminInAppNotificationTemplate[],
) {
  if (!selection) {
    return false;
  }

  if (selection === "analytics" || selection === "globals") {
    return true;
  }

  if (selection.startsWith("email:")) {
    return templates.some((template) => `email:${template.id}` === selection);
  }

  if (selection.startsWith("in-app:")) {
    return inAppTemplates.some(
      (template) => `in-app:${template.id}` === selection,
    );
  }

  return false;
}

function getInitialNotificationSelection(
  initialSelectedItem: string | null,
  templates: AdminNotificationTemplate[],
  inAppTemplates: AdminInAppNotificationTemplate[],
) {
  return isValidNotificationSelection(
    initialSelectedItem,
    templates,
    inAppTemplates,
  )
    ? initialSelectedItem!
    : getDefaultNotificationSelection(templates, inAppTemplates);
}

function updateNotificationSelectionUrl(
  selection: string,
  mode: "push" | "replace" = "push",
) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("section", "notifications");
  url.searchParams.set("notification", selection);

  const nextUrl = `${url.pathname}?${url.searchParams.toString()}${url.hash}`;

  if (mode === "replace") {
    window.history.replaceState(null, "", nextUrl);
    return;
  }

  window.history.pushState(null, "", nextUrl);
}

export function NotificationSettingsForm({
  deliveries,
  globalVariables,
  initialSelectedItem,
  inAppTemplates,
  mediaLibrary,
  templates,
}: NotificationSettingsFormProps) {
  const [selectedItem, setSelectedItem] = useState(() =>
    getInitialNotificationSelection(
      initialSelectedItem,
      templates,
      inAppTemplates,
    ),
  );
  const [templateSearch, setTemplateSearch] = useState("");
  const handleSelectedItemChange = (itemId: string) => {
    setSelectedItem(itemId);
    updateNotificationSelectionUrl(itemId);
  };

  useEffect(() => {
    if (
      isValidNotificationSelection(selectedItem, templates, inAppTemplates)
    ) {
      return;
    }

    const fallback = getDefaultNotificationSelection(
      templates,
      inAppTemplates,
    );
    setSelectedItem(fallback);
    updateNotificationSelectionUrl(fallback, "replace");
  }, [inAppTemplates, selectedItem, templates]);

  useEffect(() => {
    const handlePopState = () => {
      const nextSelectedItem = new URL(window.location.href).searchParams.get(
        "notification",
      );
      setSelectedItem(
        getInitialNotificationSelection(
          nextSelectedItem,
          templates,
          inAppTemplates,
        ),
      );
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [inAppTemplates, templates]);

  const normalizedTemplateSearch = templateSearch.trim().toLowerCase();
  const filteredTemplates = normalizedTemplateSearch
    ? templates.filter((template) =>
        [
          template.name,
          template.category,
          template.key,
          template.description ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedTemplateSearch),
      )
    : templates;
  const filteredInAppTemplates = normalizedTemplateSearch
    ? inAppTemplates.filter((template) =>
        [
          template.name,
          template.category,
          template.key,
          template.surface,
          template.type,
          template.description ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedTemplateSearch),
      )
    : inAppTemplates;
  const selectedEmailTemplate =
    selectedItem.startsWith("email:")
      ? templates.find((template) => `email:${template.id}` === selectedItem) ?? null
      : null;
  const selectedInAppTemplate =
    selectedItem.startsWith("in-app:")
      ? inAppTemplates.find((template) => `in-app:${template.id}` === selectedItem) ?? null
      : null;

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-admin-primary/25 bg-admin-primary/8 p-4 dark:bg-admin-primary/10">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-admin-primary/15 text-admin-primary">
            <MailCheckIcon className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              Notification control center
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              Email templates drive SendGrid messages. In-app templates drive
              dashboard notifications. Both use the same variable system,
              version history, test actions, and admin review flow.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Notification settings
          </div>
          <div className="relative mb-3">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
              placeholder="Search templates..."
              className="h-9 pl-9 text-sm"
            />
          </div>
          <div className="grid gap-1">
            <div className="px-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
              Email templates
            </div>
            {filteredTemplates.map((template) => {
              const itemId = `email:${template.id}`;

              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelectedItemChange(itemId)}
                  className={cn(
                    "grid gap-1 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    selectedItem === itemId
                      ? "bg-admin-primary/12 text-zinc-950 ring-1 ring-admin-primary/25 dark:bg-admin-primary/20 dark:text-white"
                      : "text-slate-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
                  )}
                >
                  <span className="truncate font-semibold">{template.name}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                    <MailCheckIcon className="size-3.5" />
                    <span className="truncate">{template.category}</span>
                    <span>v{template.version}</span>
                  </span>
                </button>
              );
            })}

            <div className="mt-3 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
              In-app templates
            </div>
            {filteredInAppTemplates.map((template) => {
              const itemId = `in-app:${template.id}`;

              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelectedItemChange(itemId)}
                  className={cn(
                    "grid gap-1 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    selectedItem === itemId
                      ? "bg-admin-primary/12 text-zinc-950 ring-1 ring-admin-primary/25 dark:bg-admin-primary/20 dark:text-white"
                      : "text-slate-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
                  )}
                >
                  <span className="truncate font-semibold">{template.name}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                    <BellIcon className="size-3.5" />
                    <span className="truncate">{template.surface}</span>
                    <span>v{template.version}</span>
                  </span>
                </button>
              );
            })}

            {filteredTemplates.length === 0 && filteredInAppTemplates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-sm text-slate-500 dark:border-white/10 dark:text-zinc-400">
                No templates match this search.
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => handleSelectedItemChange("analytics")}
              className={cn(
                "mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors",
                selectedItem === "analytics"
                  ? "bg-admin-primary/12 text-zinc-950 ring-1 ring-admin-primary/25 dark:bg-admin-primary/20 dark:text-white"
                  : "text-slate-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
              )}
            >
              <BarChart3Icon className="size-4" />
              Email analytics
            </button>

            <button
              type="button"
              onClick={() => handleSelectedItemChange("globals")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors",
                selectedItem === "globals"
                  ? "bg-admin-primary/12 text-zinc-950 ring-1 ring-admin-primary/25 dark:bg-admin-primary/20 dark:text-white"
                  : "text-slate-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
              )}
            >
              <Globe2Icon className="size-4" />
              Global variables
            </button>
          </div>
        </aside>

        <div className="min-w-0">
          {selectedItem === "analytics" ? (
            <NotificationAnalytics deliveries={deliveries} />
          ) : selectedItem === "globals" ? (
            <NotificationGlobalVariables variables={globalVariables} />
          ) : selectedEmailTemplate ? (
            <NotificationTemplateEditor
              globalVariables={globalVariables}
              mediaLibrary={mediaLibrary}
              key={selectedEmailTemplate.id}
              template={selectedEmailTemplate}
            />
          ) : selectedInAppTemplate ? (
            <InAppNotificationTemplateEditor
              globalVariables={globalVariables}
              key={selectedInAppTemplate.id}
              template={selectedInAppTemplate}
            />
          ) : (
            <p className="rounded-xl border border-zinc-200 p-4 text-sm text-slate-600 dark:border-white/10 dark:text-zinc-300">
              No notification templates exist yet. Run the latest database
              migrations to seed the default notification templates.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationGlobalVariables({
  variables,
}: {
  variables: AdminNotificationGlobalVariable[];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-admin-primary/15 text-admin-primary">
            <Globe2Icon className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              Global template variables
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Create reusable values that can be inserted into any email or
              in-app template with double braces, for example{" "}
              {"{{supportEmail}}"}.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Values are resolved at render time. Updating a value applies the
              next time a notification is rendered; renaming a custom key also
              updates every template placeholder currently using it.
            </p>
          </div>
        </div>

        <Dialog>
          <DialogTrigger
            render={
              <Button type="button" className="w-fit gap-2">
                <PlusIcon className="size-4" />
                Add global
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create global variable</DialogTitle>
              <DialogDescription>
                Add a reusable value that templates can reference with double
                braces.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <NotificationGlobalVariableForm embedded />
            </DialogBody>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {variables.map((variable) => (
          <NotificationGlobalVariableCard
            key={`${variable.source}-${variable.key}`}
            variable={variable}
          />
        ))}
      </div>
    </div>
  );
}

function NotificationGlobalVariableCard({
  variable,
}: {
  variable: AdminNotificationGlobalVariable;
}) {
  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteNotificationGlobalVariableSettings,
    initialState,
  );
  const isSystem = variable.source === "system";

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Globe2Icon className="size-4 shrink-0 text-admin-primary" />
            <p className="truncate text-sm font-bold text-zinc-950 dark:text-white">
              {variable.label}
            </p>
          </div>
          <p className="truncate font-mono text-xs text-admin-primary">
            {`{{${variable.key}}}`}
          </p>
        </div>
        <Badge
          className={cn(
            isSystem
              ? "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300"
              : "bg-admin-primary/15 text-admin-primary",
          )}
        >
          {isSystem ? "System" : "Custom"}
        </Badge>
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-zinc-300">
        {variable.value}
      </p>
      {variable.description ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-zinc-400">
          {variable.description}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-3 dark:border-white/10">
        <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
          Used in {variable.usageCount}{" "}
          {variable.usageCount === 1 ? "template" : "templates"}
        </span>

        {isSystem ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400">
            <LockIcon className="size-3.5" />
            Env managed
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                  >
                    Edit
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit global variable</DialogTitle>
                  <DialogDescription>
                    Saving updates the value used by every template referencing{" "}
                    {`{{${variable.key}}}`}.
                  </DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <NotificationGlobalVariableForm variable={variable} embedded />
                </DialogBody>
              </DialogContent>
            </Dialog>

            {variable.id ? (
              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 px-3 text-xs text-red-600 hover:text-red-700 dark:text-red-300"
                    >
                      Delete
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete global variable</DialogTitle>
                    <DialogDescription>
                      This removes {`{{${variable.key}}}`} from the global
                      variable list. Templates that still reference this key
                      will no longer receive a value for it.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                      This variable is currently used in {variable.usageCount}{" "}
                      {variable.usageCount === 1 ? "template" : "templates"}.
                    </div>
                  </DialogBody>
                  <DialogFooter>
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={variable.id} />
                      <Button
                        type="submit"
                        disabled={isDeleting}
                        variant="outline"
                        className="gap-2 text-red-600 hover:text-red-700 dark:text-red-300"
                      >
                        <Trash2Icon className="size-4" />
                        {isDeleting ? "Deleting..." : "Delete global"}
                      </Button>
                    </form>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        )}
      </div>

      {deleteState.message ? (
        <p
          className={cn(
            "mt-3 rounded-lg border p-2 text-xs",
            deleteState.ok
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
              : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200",
          )}
        >
          {deleteState.message}
        </p>
      ) : null}
    </div>
  );
}

function NotificationGlobalVariableForm({
  embedded = false,
  variable,
}: {
  embedded?: boolean;
  variable?: AdminNotificationGlobalVariable;
}) {
  const [state, formAction, isPending] = useActionState(
    saveNotificationGlobalVariableSettings,
    initialState,
  );
  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteNotificationGlobalVariableSettings,
    initialState,
  );
  const isExisting = Boolean(variable?.id);

  return (
    <div
      className={cn(
        !embedded &&
          "rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]",
      )}
    >
      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="id" value={variable?.id ?? ""} />
        {!embedded ? (
          <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-admin-primary/15 text-admin-primary">
            {isExisting ? (
              <Globe2Icon className="size-4" />
            ) : (
              <PlusIcon className="size-4" />
            )}
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              {isExisting ? "Edit global variable" : "Create global variable"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Use a stable camelCase key. System global keys are reserved.
            </p>
          </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`${variable?.id ?? "new"}-global-label`}>
              Label
            </Label>
            <Input
              id={`${variable?.id ?? "new"}-global-label`}
              name="label"
              defaultValue={variable?.label ?? ""}
              maxLength={160}
              placeholder="Support email"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${variable?.id ?? "new"}-global-key`}>Key</Label>
            <Input
              id={`${variable?.id ?? "new"}-global-key`}
              name="key"
              defaultValue={variable?.key ?? ""}
              maxLength={80}
              pattern="[A-Za-z][A-Za-z0-9]*"
              placeholder="supportEmail"
              required
            />
            <p className="font-mono text-xs text-slate-500 dark:text-zinc-400">
              {`{{${variable?.key || "supportEmail"}}}`}
            </p>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor={`${variable?.id ?? "new"}-global-value`}>
              Value
            </Label>
            <Textarea
              id={`${variable?.id ?? "new"}-global-value`}
              name="value"
              defaultValue={variable?.value ?? ""}
              maxLength={5000}
              placeholder="support@jurgensenergy.com"
              required
            />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor={`${variable?.id ?? "new"}-global-description`}>
              Description
            </Label>
            <Input
              id={`${variable?.id ?? "new"}-global-description`}
              name="description"
              defaultValue={variable?.description ?? ""}
              maxLength={500}
              placeholder="Where this variable should be used."
            />
          </div>
        </div>

        {(state.message || deleteState.message) ? (
          <p
            className={cn(
              "rounded-lg border p-3 text-sm",
              (state.ok ?? deleteState.ok)
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200",
            )}
          >
            {state.message ?? deleteState.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="submit" disabled={isPending} className="w-fit gap-2">
            <SaveIcon className="size-4" />
            {isPending ? "Saving..." : isExisting ? "Save global" : "Create global"}
          </Button>
        </div>
      </form>

      {variable?.id && !embedded ? (
        <form action={deleteAction} className="mt-3">
          <input type="hidden" name="id" value={variable.id} />
          <Button
            type="submit"
            disabled={isDeleting}
            variant="outline"
            className="w-fit gap-2 text-red-600 hover:text-red-700 dark:text-red-300"
          >
            <Trash2Icon className="size-4" />
            {isDeleting ? "Deleting..." : "Delete global"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function NotificationAnalytics({
  deliveries,
}: {
  deliveries: AdminNotificationDelivery[];
}) {
  const total = deliveries.length;
  const sent = deliveries.filter((delivery) => delivery.status === "sent").length;
  const failed = deliveries.filter(
    (delivery) => delivery.status === "failed",
  ).length;
  const skipped = deliveries.filter(
    (delivery) => delivery.status === "skipped",
  ).length;
  const opened = deliveries.filter((delivery) => delivery.openCount > 0).length;
  const activity = getNotificationActivity(deliveries);

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Total", total],
          ["Sent", sent],
          ["Opened", opened],
          ["Failed", failed],
          ["Skipped", skipped],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
            <HistoryIcon className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              Email analytics
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Recent SendGrid delivery attempts across transactional templates.
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-zinc-200 p-3 dark:border-white/10">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                Email activity
              </h4>
              <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Daily sent, opened, failed, and skipped activity from stored
                delivery records.
              </p>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              Last {activity.length} days
            </p>
          </div>
          <ChartContainer
            config={notificationActivityChartConfig}
            className="h-56 w-full"
          >
            <AreaChart data={activity} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <Area
                dataKey="sent"
                type="monotone"
                stroke="var(--color-sent)"
                fill="var(--color-sent)"
                fillOpacity={0.12}
                strokeWidth={2}
              />
              <Area
                dataKey="opened"
                type="monotone"
                stroke="var(--color-opened)"
                fill="var(--color-opened)"
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Area
                dataKey="failed"
                type="monotone"
                stroke="var(--color-failed)"
                fill="var(--color-failed)"
                fillOpacity={0.08}
                strokeWidth={2}
              />
              <Area
                dataKey="skipped"
                type="monotone"
                stroke="var(--color-skipped)"
                fill="var(--color-skipped)"
                fillOpacity={0.08}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </div>

        {deliveries.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-white/10">
            <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400 md:grid-cols-[1.1fr_1fr_auto_auto_auto]">
              <span>Template</span>
              <span className="hidden md:block">Recipient</span>
              <span>Status</span>
              <span className="hidden md:block">Opened</span>
              <span className="hidden md:block">Sent</span>
            </div>
            {deliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-zinc-200 px-3 py-3 text-sm last:border-b-0 dark:border-white/10 md:grid-cols-[1.1fr_1fr_auto_auto_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-950 dark:text-white">
                    {delivery.subject}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
                    {delivery.templateKey}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:hidden">
                    {delivery.recipientEmail}
                  </p>
                </div>
                <span className="hidden min-w-0 truncate text-slate-600 dark:text-zinc-300 md:block">
                  {delivery.recipientEmail}
                </span>
                <DeliveryStatusBadge status={delivery.status} />
                <span className="hidden text-right text-xs text-slate-500 dark:text-zinc-400 md:block">
                  {delivery.openCount > 0
                    ? `${delivery.openCount}x`
                    : "Not opened"}
                </span>
                <span className="hidden text-right text-xs text-slate-500 dark:text-zinc-400 md:block">
                  {delivery.sentAt
                    ? delivery.sentAt.toLocaleString()
                    : delivery.createdAt.toLocaleString()}
                </span>
                {delivery.errorMessage ? (
                  <p className="col-span-full text-xs text-red-600 dark:text-red-300">
                    {delivery.errorMessage}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-zinc-200 p-4 text-sm text-slate-600 dark:border-white/10 dark:text-zinc-300">
            No delivery attempts have been recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}

const notificationActivityChartConfig = {
  failed: {
    color: "#ef4444",
    label: "Failed",
  },
  opened: {
    color: "#16a34a",
    label: "Opened",
  },
  sent: {
    color: "#C4982D",
    label: "Sent",
  },
  skipped: {
    color: "#f59e0b",
    label: "Skipped",
  },
} satisfies ChartConfig;

function getNotificationActivity(deliveries: AdminNotificationDelivery[]) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (13 - index));

    return {
      date,
      failed: 0,
      label: date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
      }),
      opened: 0,
      sent: 0,
      skipped: 0,
    };
  });

  for (const delivery of deliveries) {
    const activityDate = new Date(
      (delivery.sentAt ?? delivery.createdAt).getTime(),
    );
    activityDate.setHours(0, 0, 0, 0);
    const day = days.find((item) => item.date.getTime() === activityDate.getTime());

    if (!day) {
      continue;
    }

    if (delivery.status === "sent") {
      day.sent += 1;
    }

    if (delivery.status === "failed") {
      day.failed += 1;
    }

    if (delivery.status === "skipped") {
      day.skipped += 1;
    }

    if (delivery.openCount > 0) {
      day.opened += 1;
    }
  }

  return days.map((day) => ({
    failed: day.failed,
    label: day.label,
    opened: day.opened,
    sent: day.sent,
    skipped: day.skipped,
  }));
}

function DeliveryPolicyFields({
  policy,
}: {
  policy: AdminNotificationDeliveryPolicy;
}) {
  return (
    <section className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <input type="hidden" name="deliveryEventKey" value={policy.eventKey} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
            Delivery policy
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
            Control which channels this event uses when the platform calls its
            notification key.
          </p>
        </div>
        <code className="rounded-md bg-white px-2 py-1 text-xs text-slate-500 dark:bg-white/[0.06] dark:text-zinc-400">
          {policy.eventKey}
        </code>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            description: "Creates a bell notification inside Jurgens Energy.",
            label: "In-app",
            name: "deliveryInAppEnabled",
            value: policy.inAppEnabled,
          },
          {
            description: "Sends the matching email template.",
            label: "Email",
            name: "deliveryEmailEnabled",
            value: policy.emailEnabled,
          },
          {
            description: "Sends browser push to subscribed devices.",
            label: "Push",
            name: "deliveryPushEnabled",
            value: policy.pushEnabled,
          },
        ].map((channel) => (
          <label
            key={channel.name}
            className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-white/[0.04]"
          >
            <input
              name={channel.name}
              type="checkbox"
              defaultChecked={channel.value}
              className="mt-1 size-4 accent-admin-primary"
            />
            <span>
              <span className="font-semibold text-zinc-950 dark:text-white">
                {channel.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-zinc-400">
                {channel.description}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor={`${policy.eventKey}-priority`}>Priority</Label>
          <select
            id={`${policy.eventKey}-priority`}
            name="deliveryPriority"
            defaultValue={policy.priority}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-admin-primary focus:ring-3 focus:ring-admin-primary/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <label className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-white/[0.04]">
          <input
            name="deliveryQuietHoursEnabled"
            type="checkbox"
            defaultChecked={policy.quietHoursEnabled}
            className="mt-1 size-4 accent-admin-primary"
          />
          <span>
            <span className="font-semibold text-zinc-950 dark:text-white">
              Quiet hours
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Hold non-critical sends during this window.
            </span>
          </span>
        </label>

        <div className="grid gap-2">
          <Label htmlFor={`${policy.eventKey}-quiet-start`}>Quiet start</Label>
          <Input
            id={`${policy.eventKey}-quiet-start`}
            name="deliveryQuietHoursStart"
            type="time"
            defaultValue={policy.quietHoursStart ?? ""}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${policy.eventKey}-quiet-end`}>Quiet end</Label>
          <Input
            id={`${policy.eventKey}-quiet-end`}
            name="deliveryQuietHoursEnd"
            type="time"
            defaultValue={policy.quietHoursEnd ?? ""}
          />
        </div>
      </div>

      <label className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-white/[0.04]">
        <input
          name="deliveryDigestEligible"
          type="checkbox"
          defaultChecked={policy.digestEligible}
          className="mt-1 size-4 accent-admin-primary"
        />
        <span>
          <span className="font-semibold text-zinc-950 dark:text-white">
            Digest eligible
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-zinc-400">
            Allow this event to be batched into a future digest instead of
            always sending immediately.
          </span>
        </span>
      </label>
    </section>
  );
}

function NotificationTemplateEditor({
  globalVariables,
  mediaLibrary,
  template,
}: {
  globalVariables: AdminNotificationGlobalVariable[];
  mediaLibrary: Awaited<ReturnType<typeof getAdminMediaLibrary>> | null;
  template: AdminNotificationTemplate;
}) {
  const [status, setStatus] = useState(template.status);
  const [subject, setSubject] = useState(template.subject);
  const [previewText, setPreviewText] = useState(template.previewText ?? "");
  const [variablesText, setVariablesText] = useState(
    template.requiredVariables.join(", "),
  );
  const [htmlBody, setHtmlBody] = useState(template.htmlBody);
  const [textBody, setTextBody] = useState(template.textBody);
  const [bodySyncSource, setBodySyncSource] = useState<"text" | "html">(
    "html",
  );
  const [activeTemplateField, setActiveTemplateField] = useState<
    "subject" | "preview" | "text" | "html"
  >(
    "text",
  );
  const [isMediaManagerOpen, setIsMediaManagerOpen] = useState(false);
  const htmlEditorRef = useRef<HTMLTextAreaElement>(null);
  const [state, formAction, isPending] = useActionState(
    saveNotificationTemplateSettings,
    initialState,
  );
  const variables = variablesText
    .split(",")
    .map((variable) => variable.trim())
    .filter(Boolean);
  const globalVariableValues = Object.fromEntries(
    globalVariables.map((variable) => [variable.key, variable.value]),
  );

  function insertVariable(variable: string, target = activeTemplateField) {
    const token = `{{${variable}}}`;

    if (target === "subject") {
      setSubject((current) => `${current}${current.endsWith(" ") ? "" : " "}${token}`);
      return;
    }

    if (target === "preview") {
      setPreviewText((current) => `${current}${current.endsWith(" ") ? "" : " "}${token}`);
      return;
    }

    if (target === "html") {
      setHtmlBody((current) => {
        const nextValue = `${current}${current.endsWith(" ") ? "" : " "}${token}`;

        if (bodySyncSource === "html") {
          setTextBody(htmlToPlainTextBody(nextValue));
        }

        return nextValue;
      });
      return;
    }

    setTextBody((current) => {
      const nextValue = `${current}${current.endsWith(" ") ? "" : " "}${token}`;

      if (bodySyncSource === "text") {
        setHtmlBody(plainTextToHtmlBody(nextValue));
      }

      return nextValue;
    });
  }

  function insertHtmlSnippet(snippet: string) {
    const editor = htmlEditorRef.current;

    if (!editor) {
      setHtmlBody((current) => {
        const nextValue = `${current}${current.endsWith("\n") ? "" : "\n"}${snippet}`;

        if (bodySyncSource === "html") {
          setTextBody(htmlToPlainTextBody(nextValue));
        }

        return nextValue;
      });
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const nextValue = `${htmlBody.slice(0, start)}${snippet}${htmlBody.slice(end)}`;
    setHtmlBody(nextValue);
    if (bodySyncSource === "html") {
      setTextBody(htmlToPlainTextBody(nextValue));
    }
    setActiveTemplateField("html");

    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }

  function insertImageAsset(asset: NonNullable<typeof mediaLibrary>["assets"][number]) {
    const src = toAbsoluteMediaUrl(asset.publicUrl);
    const alt =
      asset.altText ??
      asset.originalFileName?.replace(/\.[^.]+$/, "") ??
      "Jurgens Energy image";
    insertHtmlSnippet(
      `<img src="${escapeHtmlAttribute(src)}" alt="${escapeHtmlAttribute(alt)}" style="display:block;max-width:100%;height:auto;border:0;" />`,
    );
    setIsMediaManagerOpen(false);
  }

  function handleVariableDrop(
    event: DragEvent<HTMLInputElement | HTMLTextAreaElement>,
    target: "subject" | "preview" | "text" | "html",
  ) {
    event.preventDefault();
    const variable = event.dataTransfer.getData("text/piessang-variable");

    if (variable) {
      insertVariable(variable, target);
    }
  }

  function handleTextBodyChange(value: string) {
    setTextBody(value);

    if (bodySyncSource === "text") {
      setHtmlBody(plainTextToHtmlBody(value));
    }
  }

  function handleHtmlBodyChange(value: string) {
    setHtmlBody(value);

    if (bodySyncSource === "html") {
      setTextBody(htmlToPlainTextBody(value));
    }
  }

  function handleBodySyncSourceChange(source: "text" | "html") {
    setBodySyncSource(source);

    if (source === "text") {
      setHtmlBody(plainTextToHtmlBody(textBody));
      return;
    }

    setTextBody(htmlToPlainTextBody(htmlBody));
  }

  function handleFormatHtml() {
    const nextHtmlBody = formatHtmlForEditor(htmlBody);
    setHtmlBody(nextHtmlBody);

    if (bodySyncSource === "html") {
      setTextBody(htmlToPlainTextBody(nextHtmlBody));
    }
  }

  return (
    <div className="grid gap-5">
      <form
        action={formAction}
        className="grid gap-5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]"
      >
        <input type="hidden" name="id" value={template.id} />
        <input type="hidden" name="status" value={status} />

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">
              {template.name}
            </h3>
            <Badge className="bg-admin-primary/15 text-admin-primary">
              v{template.version}
            </Badge>
            <Badge
              className={cn(
                template.status === "active"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                  : "bg-zinc-500/12 text-zinc-600 dark:text-zinc-300",
              )}
            >
              {template.status}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
            {template.description}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-zinc-500">
            {template.key}
          </p>
        </div>

        <div className="grid gap-2 md:w-48">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as AdminNotificationTemplate["status"])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div>

        <DeliveryPolicyFields policy={template.deliveryPolicy} />

        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-admin-primary/15 text-admin-primary">
            <BracesIcon className="size-4" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
              Available template variables
            </h4>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Drag a variable into the plain text or HTML editor, or click one
              to insert it into the last focused body field.
            </p>
          </div>
        </div>

        {variables.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {variables.map((variable) => (
              <button
                key={variable}
                type="button"
                draggable
                onClick={() => insertVariable(variable)}
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "text/piessang-variable",
                    variable,
                  );
                  event.dataTransfer.effectAllowed = "copy";
                }}
                className="inline-flex cursor-grab items-center gap-2 rounded-lg border border-admin-primary/25 bg-white px-3 py-2 font-mono text-xs font-semibold text-admin-primary shadow-sm transition hover:border-admin-primary/50 hover:bg-admin-primary/10 active:cursor-grabbing dark:bg-white/[0.04]"
              >
                <MousePointerClickIcon className="size-3.5" />
                {`{{${variable}}}`}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-zinc-300">
            This template does not currently declare any variables.
          </p>
        )}

        {globalVariables.length > 0 ? (
          <div className="grid gap-2 border-t border-zinc-200 pt-3 dark:border-white/10">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Global variables
            </p>
            <div className="flex flex-wrap gap-2">
              {globalVariables.map((variable) => (
                <button
                  key={`${variable.source}-${variable.key}`}
                  type="button"
                  draggable
                  onClick={() => insertVariable(variable.key)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "text/piessang-variable",
                      variable.key,
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  title={variable.description ?? variable.label}
                  className="inline-flex cursor-grab items-center gap-2 rounded-lg border border-admin-primary/25 bg-white px-3 py-2 font-mono text-xs font-semibold text-admin-primary shadow-sm transition hover:border-admin-primary/50 hover:bg-admin-primary/10 active:cursor-grabbing dark:bg-white/[0.04]"
                >
                  <Globe2Icon className="size-3.5" />
                  {`{{${variable.key}}}`}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${template.id}-subject`}>Subject</Label>
          <Input
            id={`${template.id}-subject`}
            name="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            onFocus={() => setActiveTemplateField("subject")}
            onDrop={(event) => handleVariableDrop(event, "subject")}
            onDragOver={(event) => event.preventDefault()}
            maxLength={240}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${template.id}-preview`}>Preview text</Label>
          <Input
            id={`${template.id}-preview`}
            name="previewText"
            value={previewText}
            onChange={(event) => setPreviewText(event.target.value)}
            onFocus={() => setActiveTemplateField("preview")}
            onDrop={(event) => handleVariableDrop(event, "preview")}
            onDragOver={(event) => event.preventDefault()}
            maxLength={240}
            placeholder="Shown by inboxes when supported"
          />
        </div>

        <div className="grid gap-2 lg:col-span-2">
          <Label htmlFor={`${template.id}-variables`}>
            Template variables
          </Label>
          <Input
            id={`${template.id}-variables`}
            name="requiredVariables"
            value={variablesText}
            onChange={(event) => setVariablesText(event.target.value)}
            maxLength={1000}
            placeholder="name, storeName, reason"
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Comma-separated variables available as double-brace placeholders,
            for example {"{{storeName}}"}.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03] lg:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-zinc-950 dark:text-white">
              Live body sync
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Choose which body editor drives the other body and the rendered
              preview while you type.
            </p>
          </div>
          <div className="inline-flex w-fit rounded-lg border border-zinc-200 bg-white p-1 dark:border-white/10 dark:bg-white/[0.04]">
            <Button
              type="button"
              size="sm"
              variant={bodySyncSource === "text" ? "default" : "ghost"}
              className="h-8"
              onClick={() => handleBodySyncSourceChange("text")}
            >
              Plain text drives HTML
            </Button>
            <Button
              type="button"
              size="sm"
              variant={bodySyncSource === "html" ? "default" : "ghost"}
              className="h-8"
              onClick={() => handleBodySyncSourceChange("html")}
            >
              HTML drives text
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${template.id}-text`}>Plain text email</Label>
          <CodeEditor
            id={`${template.id}-text`}
            name="textBody"
            label="Plain text email"
            value={textBody}
            onValueChange={handleTextBodyChange}
            onFocus={() => setActiveTemplateField("text")}
            onDrop={(event) => handleVariableDrop(event, "text")}
            onDragOver={(event) => event.preventDefault()}
            maxLength={10000}
            required
          />
        </div>

        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor={`${template.id}-html`}>HTML email</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleFormatHtml}
              >
                <Code2Icon className="size-3.5" />
                Format HTML
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!mediaLibrary}
                onClick={() => setIsMediaManagerOpen(true)}
              >
                <ImageIcon className="size-3.5" />
                Insert image
              </Button>
            </div>
          </div>
          <CodeEditor
            id={`${template.id}-html`}
            name="htmlBody"
            label="HTML email"
            textareaRef={htmlEditorRef}
            value={htmlBody}
            onValueChange={handleHtmlBodyChange}
            onFocus={() => setActiveTemplateField("html")}
            onDrop={(event) => handleVariableDrop(event, "html")}
            onDragOver={(event) => event.preventDefault()}
            maxLength={20000}
            required
          />
        </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-admin-primary/15 text-admin-primary">
              <EyeIcon className="size-4" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                Rendered email preview
              </h4>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Variables render with sample values. The preview is sandboxed
                and does not execute scripts.
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-white/10">
            <iframe
              title={`${template.name} rendered preview`}
              sandbox=""
              srcDoc={renderTemplatePreviewHtml(
                htmlBody,
                Array.from(
                  new Set([...variables, ...globalVariables.map((item) => item.key)]),
                ),
                globalVariableValues,
              )}
              className="h-[420px] w-full bg-white"
            />
          </div>
        </div>

        {state.message ? (
          <p
            className={cn(
              "rounded-lg border p-3 text-sm",
              state.ok
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200",
            )}
          >
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="submit" disabled={isPending} className="w-fit gap-2">
            <SaveIcon className="size-4" />
            {isPending ? "Saving..." : "Save template"}
          </Button>
          <NotificationTemplateTestDialog
            htmlBody={htmlBody}
            previewText={previewText}
            requiredVariables={variablesText}
            subject={subject}
            templateKey={template.key}
            textBody={textBody}
          />
        </div>
      </form>

      <NotificationVersionHistory
        templateId={template.id}
        versions={template.versions}
      />

      {mediaLibrary ? (
        <MediaManagerDialog
          acceptedMediaTypes={["image"]}
          assets={mediaLibrary.assets}
          folders={mediaLibrary.folders}
          onOpenChange={setIsMediaManagerOpen}
          onSelect={insertImageAsset}
          open={isMediaManagerOpen}
          storage={mediaLibrary.storage}
          surface="admin"
          usedStorageBytes={mediaLibrary.usedStorageBytes}
        />
      ) : null}
    </div>
  );
}

function InAppNotificationTemplateEditor({
  globalVariables,
  template,
}: {
  globalVariables: AdminNotificationGlobalVariable[];
  template: AdminInAppNotificationTemplate;
}) {
  const [status, setStatus] = useState(template.status);
  const [titleTemplate, setTitleTemplate] = useState(template.titleTemplate);
  const [bodyTemplate, setBodyTemplate] = useState(template.bodyTemplate);
  const [actionLabelTemplate, setActionLabelTemplate] = useState(
    template.actionLabelTemplate ?? "",
  );
  const [actionUrlTemplate, setActionUrlTemplate] = useState(
    template.actionUrlTemplate ?? "",
  );
  const [variablesText, setVariablesText] = useState(
    template.requiredVariables.join(", "),
  );
  const [activeTemplateField, setActiveTemplateField] = useState<
    "title" | "body" | "actionLabel" | "actionUrl"
  >("body");
  const [state, formAction, isPending] = useActionState(
    saveInAppNotificationTemplateSettings,
    initialState,
  );
  const variables = variablesText
    .split(",")
    .map((variable) => variable.trim())
    .filter(Boolean);
  const allVariables = Array.from(
    new Set([...variables, ...globalVariables.map((item) => item.key)]),
  );
  const globalVariableValues = Object.fromEntries(
    globalVariables.map((variable) => [variable.key, variable.value]),
  );
  const renderedTitle = renderTemplateStringPreview(
    titleTemplate,
    allVariables,
    globalVariableValues,
  );
  const renderedBody = renderTemplateStringPreview(
    bodyTemplate,
    allVariables,
    globalVariableValues,
  );
  const renderedActionLabel = renderTemplateStringPreview(
    actionLabelTemplate,
    allVariables,
    globalVariableValues,
  );
  const renderedActionUrl = renderTemplateStringPreview(
    actionUrlTemplate,
    allVariables,
    globalVariableValues,
  );

  function insertVariable(variable: string, target = activeTemplateField) {
    const token = `{{${variable}}}`;
    const appendToken = (current: string) =>
      `${current}${current.endsWith(" ") || current.length === 0 ? "" : " "}${token}`;

    if (target === "title") {
      setTitleTemplate(appendToken);
      return;
    }

    if (target === "actionLabel") {
      setActionLabelTemplate(appendToken);
      return;
    }

    if (target === "actionUrl") {
      setActionUrlTemplate(appendToken);
      return;
    }

    setBodyTemplate(appendToken);
  }

  function handleVariableDrop(
    event: DragEvent<HTMLInputElement | HTMLTextAreaElement>,
    target: "title" | "body" | "actionLabel" | "actionUrl",
  ) {
    event.preventDefault();
    const variable = event.dataTransfer.getData("text/piessang-variable");

    if (variable) {
      insertVariable(variable, target);
    }
  }

  return (
    <div className="grid gap-5">
      <form
        action={formAction}
        className="grid gap-5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]"
      >
        <input type="hidden" name="id" value={template.id} />
        <input type="hidden" name="status" value={status} />

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                {template.name}
              </h3>
              <Badge className="bg-admin-primary/15 text-admin-primary">
                v{template.version}
              </Badge>
              <Badge className="bg-emerald-500/15 capitalize text-emerald-700 dark:text-emerald-200">
                {template.surface}
              </Badge>
              <Badge
                className={cn(
                  template.status === "active"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                    : "bg-zinc-500/12 text-zinc-600 dark:text-zinc-300",
                )}
              >
                {template.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              {template.description}
            </p>
            <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-zinc-500">
              {template.key}
            </p>
          </div>

          <div className="grid gap-2 md:w-48">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as AdminInAppNotificationTemplate["status"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DeliveryPolicyFields policy={template.deliveryPolicy} />

        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-admin-primary/15 text-admin-primary">
              <BracesIcon className="size-4" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                Available template variables
              </h4>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Drag a variable into title, body, action label, or action URL.
                Click inserts into the last focused field.
              </p>
            </div>
          </div>

          {variables.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {variables.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  draggable
                  onClick={() => insertVariable(variable)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "text/piessang-variable",
                      variable,
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  className="inline-flex cursor-grab items-center gap-2 rounded-lg border border-admin-primary/25 bg-white px-3 py-2 font-mono text-xs font-semibold text-admin-primary shadow-sm transition hover:border-admin-primary/50 hover:bg-admin-primary/10 active:cursor-grabbing dark:bg-white/[0.04]"
                >
                  <MousePointerClickIcon className="size-3.5" />
                  {`{{${variable}}}`}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-zinc-300">
              This template does not currently declare any variables.
            </p>
          )}

          {globalVariables.length > 0 ? (
            <div className="grid gap-2 border-t border-zinc-200 pt-3 dark:border-white/10">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Global variables
              </p>
              <div className="flex flex-wrap gap-2">
                {globalVariables.map((variable) => (
                  <button
                    key={`${variable.source}-${variable.key}`}
                    type="button"
                    draggable
                    onClick={() => insertVariable(variable.key)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "text/piessang-variable",
                        variable.key,
                      );
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    title={variable.description ?? variable.label}
                    className="inline-flex cursor-grab items-center gap-2 rounded-lg border border-admin-primary/25 bg-white px-3 py-2 font-mono text-xs font-semibold text-admin-primary shadow-sm transition hover:border-admin-primary/50 hover:bg-admin-primary/10 active:cursor-grabbing dark:bg-white/[0.04]"
                  >
                    <Globe2Icon className="size-3.5" />
                    {`{{${variable.key}}}`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`${template.id}-title`}>Title</Label>
            <Input
              id={`${template.id}-title`}
              name="titleTemplate"
              value={titleTemplate}
              onChange={(event) => setTitleTemplate(event.target.value)}
              onFocus={() => setActiveTemplateField("title")}
              onDrop={(event) => handleVariableDrop(event, "title")}
              onDragOver={(event) => event.preventDefault()}
              maxLength={180}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${template.id}-variables`}>
              Template variables
            </Label>
            <Input
              id={`${template.id}-variables`}
              name="requiredVariables"
              value={variablesText}
              onChange={(event) => setVariablesText(event.target.value)}
              maxLength={1000}
              placeholder="name, orderNumber, adminDashboardUrl"
            />
          </div>

          <div className="grid gap-2 lg:col-span-2">
            <Label htmlFor={`${template.id}-body`}>Notification body</Label>
            <CodeEditor
              id={`${template.id}-body`}
              name="bodyTemplate"
              label="In-app body"
              value={bodyTemplate}
              onValueChange={setBodyTemplate}
              onFocus={() => setActiveTemplateField("body")}
              onDrop={(event) => handleVariableDrop(event, "body")}
              onDragOver={(event) => event.preventDefault()}
              maxLength={2000}
              required
              className="min-h-40"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${template.id}-action-label`}>
              Action label
            </Label>
            <Input
              id={`${template.id}-action-label`}
              name="actionLabelTemplate"
              value={actionLabelTemplate}
              onChange={(event) => setActionLabelTemplate(event.target.value)}
              onFocus={() => setActiveTemplateField("actionLabel")}
              onDrop={(event) => handleVariableDrop(event, "actionLabel")}
              onDragOver={(event) => event.preventDefault()}
              maxLength={120}
              placeholder="Open dashboard"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${template.id}-action-url`}>Action URL</Label>
            <Input
              id={`${template.id}-action-url`}
              name="actionUrlTemplate"
              value={actionUrlTemplate}
              onChange={(event) => setActionUrlTemplate(event.target.value)}
              onFocus={() => setActiveTemplateField("actionUrl")}
              onDrop={(event) => handleVariableDrop(event, "actionUrl")}
              onDragOver={(event) => event.preventDefault()}
              maxLength={1000}
              placeholder="{{adminDashboardUrl}}"
            />
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-admin-primary/15 text-admin-primary">
              <MonitorIcon className="size-4" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                Rendered in-app preview
              </h4>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Variables render with sample values so you can see the actual
                notification card before saving.
              </p>
            </div>
          </div>

          <div className="max-w-md rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-admin-primary/15 text-admin-primary">
                <BellIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-zinc-950 dark:text-white">
                  {renderedTitle || "Notification title"}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
                  {renderedBody || "Notification body"}
                </p>
                {renderedActionLabel ? (
                  <p className="mt-3 inline-flex rounded-lg bg-admin-primary px-3 py-2 text-xs font-bold text-white">
                    {renderedActionLabel}
                  </p>
                ) : null}
                {renderedActionUrl ? (
                  <p className="mt-2 truncate font-mono text-[11px] text-slate-500 dark:text-zinc-500">
                    {renderedActionUrl}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {state.message ? (
          <p
            className={cn(
              "rounded-lg border p-3 text-sm",
              state.ok
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200",
            )}
          >
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="submit" disabled={isPending} className="w-fit gap-2">
            <SaveIcon className="size-4" />
            {isPending ? "Saving..." : "Save template"}
          </Button>
          <InAppNotificationTemplateTestDialog
            actionLabelTemplate={actionLabelTemplate}
            actionUrlTemplate={actionUrlTemplate}
            bodyTemplate={bodyTemplate}
            requiredVariables={variablesText}
            templateKey={template.key}
            titleTemplate={titleTemplate}
          />
        </div>
      </form>

      <InAppNotificationVersionHistory
        templateId={template.id}
        versions={template.versions}
      />
    </div>
  );
}

function CodeEditor({
  className,
  label,
  onValueChange,
  textareaRef,
  value,
  ...props
}: Omit<ComponentProps<"textarea">, "onChange" | "value"> & {
  label: string;
  onValueChange: (value: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  value: string;
}) {
  const [, setHistoryVersion] = useState(0);
  const historyRef = useRef([value]);
  const historyIndexRef = useRef(0);
  const isApplyingHistoryRef = useRef(false);
  const lineCount = Math.max(1, value ? String(value).split("\n").length : 1);
  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  function refreshHistoryControls() {
    setHistoryVersion((current) => current + 1);
  }

  function pushHistory(nextValue: string) {
    const currentValue = historyRef.current[historyIndexRef.current];

    if (nextValue === currentValue) {
      return;
    }

    const nextHistory = historyRef.current.slice(
      0,
      historyIndexRef.current + 1,
    );
    nextHistory.push(nextValue);

    if (nextHistory.length > 100) {
      nextHistory.shift();
    }

    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    refreshHistoryControls();
  }

  useEffect(() => {
    if (isApplyingHistoryRef.current) {
      isApplyingHistoryRef.current = false;
      refreshHistoryControls();
      return;
    }

    pushHistory(value);
  }, [value]);

  function handleEditorChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = event.target.value;
    pushHistory(nextValue);
    onValueChange(nextValue);
  }

  function applyHistoryValue(index: number) {
    historyIndexRef.current = index;
    isApplyingHistoryRef.current = true;
    onValueChange(historyRef.current[index] ?? "");
    refreshHistoryControls();
  }

  function handleUndo() {
    if (!canUndo) {
      return;
    }

    applyHistoryValue(historyIndexRef.current - 1);
  }

  function handleRedo() {
    if (!canRedo) {
      return;
    }

    applyHistoryValue(historyIndexRef.current + 1);
  }

  return (
    <div
      className={cn(
        "grid min-h-52 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 text-xs shadow-sm ring-offset-background focus-within:border-admin-primary focus-within:ring-3 focus-within:ring-admin-primary/20 dark:border-white/10",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        <span>{label}</span>
        <div className="flex items-center gap-2">
          <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
          <span className="h-4 w-px bg-white/10" aria-hidden="true" />
          <button
            type="button"
            aria-label={`Undo ${label}`}
            title="Undo"
            disabled={!canUndo}
            onClick={handleUndo}
            className="inline-flex size-6 items-center justify-center rounded-md text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35"
          >
            <Undo2Icon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Redo ${label}`}
            title="Redo"
            disabled={!canRedo}
            onClick={handleRedo}
            className="inline-flex size-6 items-center justify-center rounded-md text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35"
          >
            <Redo2Icon className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="grid min-h-48 grid-cols-[3rem_minmax(0,1fr)]">
        <div
          aria-hidden="true"
          className="select-none overflow-hidden border-r border-white/10 bg-white/[0.03] px-2 py-3 text-right font-mono leading-5 text-zinc-500"
        >
          {Array.from({ length: lineCount }, (_, index) => (
            <div key={index + 1}>{index + 1}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          aria-label={label}
          className="min-h-48 resize-y border-0 bg-transparent px-3 py-3 font-mono leading-5 text-zinc-100 outline-none placeholder:text-zinc-500"
          spellCheck={false}
          onChange={handleEditorChange}
          value={value}
          {...props}
        />
      </div>
    </div>
  );
}

function plainTextToHtmlBody(text: string) {
  const normalizedText = text
    .replace(/\r\n/g, "\n")
    .replaceAll("\\n", "\n")
    .trim();

  if (!normalizedText) {
    return "";
  }

  const paragraphs = normalizedText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const content = paragraph
        .split("\n")
        .map((line) => escapeHtmlText(line))
        .join("<br />");

      return `<p style="margin:0 0 12px">${content}</p>`;
    });

  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#070b16">\n  ${paragraphs.join("\n  ")}\n</div>`;
}

function htmlToPlainTextBody(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/p\s*>/gi, "\n\n")
      .replace(/<\s*\/div\s*>/gi, "\n")
      .replace(/<\s*\/h[1-6]\s*>/gi, "\n\n")
      .replace(/<\s*li[^>]*>/gi, "- ")
      .replace(/<\s*\/li\s*>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function renderTemplatePreviewHtml(
  htmlBody: string,
  variables: string[],
  globalVariableValues: Record<string, string> = {},
) {
  const renderedBody = variables.reduce((current, variable) => {
    return current.replaceAll(
      `{{${variable}}}`,
      escapeHtmlText(getTemplateVariableSample(variable, globalVariableValues)),
    );
  }, htmlBody);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; min-height: 100%; background: #f8fafc; color: #0f172a; }
      body { padding: 24px; font-family: Arial, sans-serif; }
      img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>${renderedBody}</body>
</html>`;
}

function renderTemplateStringPreview(
  value: string,
  variables: string[],
  globalVariableValues: Record<string, string> = {},
) {
  return variables.reduce((current, variable) => {
    return current.replaceAll(
      `{{${variable}}}`,
      getTemplateVariableSample(variable, globalVariableValues),
    );
  }, value);
}

function getTemplateVariableSample(
  variable: string,
  globalVariableValues: Record<string, string> = {},
) {
  if (globalVariableValues[variable]) {
    return globalVariableValues[variable];
  }

  const normalized = variable.toLowerCase();

  if (
    normalized.includes("sellerdashboard") ||
    normalized.includes("admindashboard")
  ) {
    return "https://admin.jurgensenergy.com";
  }

  if (normalized.includes("email")) {
    return "admin@jurgensenergy.com";
  }

  if (normalized.includes("url")) {
    return "https://jurgensenergy.com";
  }

  if (normalized.includes("store")) {
    return "Urban Trendz";
  }

  if (normalized.includes("reason")) {
    return "Please upload the requested business verification documents.";
  }

  if (normalized.includes("name")) {
    return "Dillon";
  }

  return variable
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase())
    .trim();
}

function formatHtmlForEditor(html: string) {
  const normalized = html
    .replace(/>\s+</g, "><")
    .replace(/(>)(<)(\/*)/g, "$1\n$2$3");
  const lines = normalized.split("\n");
  let depth = 0;

  return lines
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return "";
      }

      if (/^<\//.test(trimmed)) {
        depth = Math.max(depth - 1, 0);
      }

      const formatted = `${"  ".repeat(depth)}${trimmed}`;

      if (
        /^<[^!?/][^>]*[^/]>\s*$/.test(trimmed) &&
        !/^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(trimmed) &&
        !/<\/[^>]+>\s*$/.test(trimmed)
      ) {
        depth += 1;
      }

      return formatted;
    })
    .join("\n");
}

function toAbsoluteMediaUrl(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (typeof window === "undefined") {
    return url;
  }

  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

function escapeHtmlText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value: string) {
  return escapeHtmlText(value).replaceAll('"', "&quot;");
}

function NotificationTemplateTestDialog({
  htmlBody,
  previewText,
  requiredVariables,
  subject,
  templateKey,
  textBody,
}: {
  htmlBody: string;
  previewText: string;
  requiredVariables: string;
  subject: string;
  templateKey: string;
  textBody: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    sendNotificationTemplateTestSettings,
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-fit gap-2"
          >
            <SendIcon className="size-4" />
            Send test
          </Button>
        }
      />
      <DialogContent>
        <form action={formAction} className="contents">
          <input type="hidden" name="templateKey" value={templateKey} />
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="previewText" value={previewText} />
          <input type="hidden" name="htmlBody" value={htmlBody} />
          <input type="hidden" name="textBody" value={textBody} />
          <input
            type="hidden"
            name="requiredVariables"
            value={requiredVariables}
          />

          <DialogHeader>
            <DialogTitle>Send test email</DialogTitle>
            <DialogDescription>
              Send the current template draft with sample variable values.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`${templateKey}-test-email`}>Test email</Label>
              <Input
                id={`${templateKey}-test-email`}
                name="recipientEmail"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
              Variables such as <span className="font-mono">{"{{name}}"}</span>{" "}
              are replaced with safe example values for this test.
            </div>

            {state.message ? (
              <p
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  state.ok
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                    : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200",
                )}
              >
                {state.message}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="gap-2">
              <SendIcon className="size-4" />
              {isPending ? "Sending..." : "Send test email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NotificationVersionHistory({
  templateId,
  versions,
}: {
  templateId: string;
  versions: AdminNotificationTemplate["versions"];
}) {
  const [state, formAction, isPending] = useActionState(
    restoreNotificationTemplateSettings,
    initialState,
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
          <HistoryIcon className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
            Version history
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
            Restore an earlier template snapshot. Restoring creates a new
            current version, so history stays intact.
          </p>
        </div>
      </div>

      {state.message ? (
        <p
          className={cn(
            "mb-4 rounded-lg border p-3 text-sm",
            state.ok
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
              : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200",
          )}
        >
          {state.message}
        </p>
      ) : null}

      {versions.length > 0 ? (
        <div className="grid gap-2">
          {versions.map((version) => (
            <div
              key={version.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-admin-primary/15 text-admin-primary">
                    v{version.version}
                  </Badge>
                  <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                    {version.subject}
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  Saved {version.createdAt.toLocaleString()}
                </p>
                {version.requiredVariables.length > 0 ? (
                  <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-zinc-500">
                    {version.requiredVariables
                      .map((variable) => `{{${variable}}}`)
                      .join(" ")}
                  </p>
                ) : null}
              </div>

              <form action={formAction}>
                <input type="hidden" name="templateId" value={templateId} />
                <input type="hidden" name="versionId" value={version.id} />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isPending}
                  className="w-full gap-2 sm:w-fit"
                >
                  <RotateCcwIcon className="size-4" />
                  {isPending ? "Restoring..." : "Restore"}
                </Button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-zinc-200 p-4 text-sm text-slate-600 dark:border-white/10 dark:text-zinc-300">
          No previous versions yet. The first previous version appears after
          you save an edit to this template.
        </p>
      )}
    </div>
  );
}

function InAppNotificationTemplateTestDialog({
  actionLabelTemplate,
  actionUrlTemplate,
  bodyTemplate,
  requiredVariables,
  templateKey,
  titleTemplate,
}: {
  actionLabelTemplate: string;
  actionUrlTemplate: string;
  bodyTemplate: string;
  requiredVariables: string;
  templateKey: string;
  titleTemplate: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    sendInAppNotificationTemplateTestSettings,
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" className="w-fit gap-2">
            <SendIcon className="size-4" />
            Create test
          </Button>
        }
      />
      <DialogContent>
        <form action={formAction} className="contents">
          <input type="hidden" name="templateKey" value={templateKey} />
          <input
            type="hidden"
            name="titleTemplate"
            value={titleTemplate}
          />
          <input type="hidden" name="bodyTemplate" value={bodyTemplate} />
          <input
            type="hidden"
            name="actionLabelTemplate"
            value={actionLabelTemplate}
          />
          <input
            type="hidden"
            name="actionUrlTemplate"
            value={actionUrlTemplate}
          />
          <input
            type="hidden"
            name="requiredVariables"
            value={requiredVariables}
          />

          <DialogHeader>
            <DialogTitle>Create test notification</DialogTitle>
            <DialogDescription>
              Create this in-app notification for your admin account using
              sample variable values.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
              The test notification appears in your admin notification stream
              and is marked as a test in its metadata.
            </div>

            {state.message ? (
              <p
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  state.ok
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                    : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200",
                )}
              >
                {state.message}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="gap-2">
              <SendIcon className="size-4" />
              {isPending ? "Creating..." : "Create test notification"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InAppNotificationVersionHistory({
  templateId,
  versions,
}: {
  templateId: string;
  versions: AdminInAppNotificationTemplate["versions"];
}) {
  const [state, formAction, isPending] = useActionState(
    restoreInAppNotificationTemplateSettings,
    initialState,
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
          <HistoryIcon className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
            Version history
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
            Restore an earlier in-app notification snapshot. Restoring creates
            a new current version, so history stays intact.
          </p>
        </div>
      </div>

      {state.message ? (
        <p
          className={cn(
            "mb-4 rounded-lg border p-3 text-sm",
            state.ok
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
              : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200",
          )}
        >
          {state.message}
        </p>
      ) : null}

      {versions.length > 0 ? (
        <div className="grid gap-2">
          {versions.map((version) => (
            <div
              key={version.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-admin-primary/15 text-admin-primary">
                    v{version.version}
                  </Badge>
                  <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                    {version.titleTemplate}
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  Saved {version.createdAt.toLocaleString()}
                </p>
                {version.requiredVariables.length > 0 ? (
                  <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-zinc-500">
                    {version.requiredVariables
                      .map((variable) => `{{${variable}}}`)
                      .join(" ")}
                  </p>
                ) : null}
              </div>

              <form action={formAction}>
                <input type="hidden" name="templateId" value={templateId} />
                <input type="hidden" name="versionId" value={version.id} />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isPending}
                  className="w-full gap-2 sm:w-fit"
                >
                  <RotateCcwIcon className="size-4" />
                  {isPending ? "Restoring..." : "Restore"}
                </Button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-zinc-200 p-4 text-sm text-slate-600 dark:border-white/10 dark:text-zinc-300">
          No previous versions yet. The first previous version appears after
          you save an edit to this template.
        </p>
      )}
    </div>
  );
}

function DeliveryStatusBadge({
  status,
}: {
  status: AdminNotificationDelivery["status"];
}) {
  return (
    <Badge
      className={cn(
        "capitalize",
        status === "sent"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
          : status === "failed"
            ? "bg-red-500/15 text-red-700 dark:text-red-200"
            : status === "skipped"
              ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
              : "bg-slate-500/12 text-slate-700 dark:text-slate-200",
      )}
    >
      {status}
    </Badge>
  );
}
