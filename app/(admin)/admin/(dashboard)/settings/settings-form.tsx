"use client";

import {
  type ComponentProps,
  type ChangeEvent,
  type DragEvent,
  type RefObject,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BarChart3Icon,
  BracesIcon,
  Code2Icon,
  CrownIcon,
  CreditCardIcon,
  EyeIcon,
  Globe2Icon,
  HistoryIcon,
  ImageIcon,
  KeyRoundIcon,
  LinkIcon,
  LockIcon,
  MailCheckIcon,
  MousePointerClickIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  SearchIcon,
  SendIcon,
  SparklesIcon,
  Redo2Icon,
  Trash2Icon,
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
  updateMediaStorageSettings,
  savePremiumPlanSettings,
  deleteNotificationGlobalVariableSettings,
  saveNotificationGlobalVariableSettings,
  saveNotificationTemplateSettings,
  restoreNotificationTemplateSettings,
  sendNotificationTemplateTestSettings,
  updateStripePaymentSettings,
  type AdminSettingsState,
} from "@/app/(admin)/admin/(dashboard)/settings/actions";
import type { AdminPremiumPlan } from "@/src/modules/billing/premium-plans";
import type { getAdminMediaLibrary } from "@/src/modules/media/admin";
import type {
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
            Admin and seller dashboards stay accessible.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Preview password</Label>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
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
  instagramUrl: string | null;
  twitterUrl: string | null;
};

export function SocialLinksForm({
  facebookUrl,
  instagramUrl,
  twitterUrl,
}: SocialLinksFormProps) {
  const [facebookValue, setFacebookValue] = useState(facebookUrl ?? "");
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
            placeholder="https://facebook.com/piessang"
            className="pl-10"
          />
        </div>
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
            placeholder="https://instagram.com/piessang"
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
            placeholder="https://x.com/piessang"
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

type MediaStorageSettingsFormProps = {
  freeStorageQuotaMb: number;
  imageCompressionQuality: number;
  maxImageWidth: number;
  maxUploadFileMb: number;
  maxVideoUploadFileMb: number;
  maxVideoWidth: number;
  premiumStorageQuotaMb: number;
  videoCompressionCrf: number;
};

export function MediaStorageSettingsForm({
  freeStorageQuotaMb,
  imageCompressionQuality,
  maxImageWidth,
  maxUploadFileMb,
  maxVideoUploadFileMb,
  maxVideoWidth,
  premiumStorageQuotaMb,
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
          <Label htmlFor="freeStorageQuotaMb">Free storage quota</Label>
          <Input
            id="freeStorageQuotaMb"
            name="freeStorageQuotaMb"
            type="number"
            min={50}
            max={102400}
            defaultValue={freeStorageQuotaMb}
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Default storage shown to regular users and sellers.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="premiumStorageQuotaMb">Premium storage quota</Label>
          <Input
            id="premiumStorageQuotaMb"
            name="premiumStorageQuotaMb"
            type="number"
            min={100}
            max={512000}
            defaultValue={premiumStorageQuotaMb}
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Upgrade value shown in media-heavy workflows.
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

type StripeSettingsFormProps = {
  hasStripeLiveSecretKey: boolean;
  hasStripeLiveWebhookSecret: boolean;
  hasStripeSandboxSecretKey: boolean;
  hasStripeSandboxWebhookSecret: boolean;
  stripeLivePublishableKey: string | null;
  stripeMode: "live" | "sandbox";
  stripeSandboxPublishableKey: string | null;
};

export function StripeSettingsForm({
  hasStripeLiveSecretKey,
  hasStripeLiveWebhookSecret,
  hasStripeSandboxSecretKey,
  hasStripeSandboxWebhookSecret,
  stripeLivePublishableKey,
  stripeMode,
  stripeSandboxPublishableKey,
}: StripeSettingsFormProps) {
  const [mode, setMode] = useState<"live" | "sandbox">(stripeMode);
  const [state, formAction, isPending] = useActionState(
    updateStripePaymentSettings,
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

      <div className="grid gap-4 xl:grid-cols-2">
        <StripeCredentialPanel
          active={mode === "live"}
          description="Used when the platform is processing real payments."
          hasSecretKey={hasStripeLiveSecretKey}
          hasWebhookSecret={hasStripeLiveWebhookSecret}
          mode="live"
          publishableKey={stripeLivePublishableKey}
          title="Live credentials"
        />

        <StripeCredentialPanel
          active={mode === "sandbox"}
          description="Used for local testing and payment-flow rehearsals."
          hasSecretKey={hasStripeSandboxSecretKey}
          hasWebhookSecret={hasStripeSandboxWebhookSecret}
          mode="sandbox"
          publishableKey={stripeSandboxPublishableKey}
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
        {isPending ? "Saving..." : "Save Stripe settings"}
      </Button>
    </form>
  );
}

function StripeCredentialPanel({
  active,
  description,
  hasSecretKey,
  hasWebhookSecret,
  mode,
  publishableKey,
  title,
}: {
  active: boolean;
  description: string;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  mode: "live" | "sandbox";
  publishableKey: string | null;
  title: string;
}) {
  const prefix = mode === "live" ? "live" : "sandbox";

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
          <Label htmlFor={`${prefix}PublishableKey`}>Publishable key</Label>
          <Input
            id={`${prefix}PublishableKey`}
            name={`${prefix}PublishableKey`}
            placeholder={mode === "live" ? "pk_live_..." : "pk_test_..."}
            defaultValue={publishableKey ?? ""}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${prefix}SecretKey`}>Secret key</Label>
          <div className="relative">
            <KeyRoundIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              id={`${prefix}SecretKey`}
              name={`${prefix}SecretKey`}
              type="password"
              autoComplete="off"
              placeholder={
                hasSecretKey
                  ? "Saved - leave blank to keep current secret"
                  : mode === "live"
                    ? "sk_live_..."
                    : "sk_test_..."
              }
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${prefix}WebhookSecret`}>
            Webhook signing secret
          </Label>
          <div className="relative">
            <KeyRoundIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              id={`${prefix}WebhookSecret`}
              name={`${prefix}WebhookSecret`}
              type="password"
              autoComplete="off"
              placeholder={
                hasWebhookSecret
                  ? "Saved - leave blank to keep current secret"
                  : "whsec_..."
              }
              className="pl-10"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type PremiumPlansSettingsFormProps = {
  plans: AdminPremiumPlan[];
  stripeMode: "live" | "sandbox";
};

export function PremiumPlansSettingsForm({
  plans,
  stripeMode,
}: PremiumPlansSettingsFormProps) {
  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 p-4 dark:bg-violet-400/10">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300">
            <CrownIcon className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              Stripe-managed plans
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              Save plans here and Piessang creates or updates the matching
              Stripe product and price for the current {stripeMode} mode.
            </p>
          </div>
        </div>
      </div>

      <PremiumPlanEditor stripeMode={stripeMode} />

      {plans.length > 0 ? (
        <div className="grid gap-4">
          {plans.map((plan) => (
            <PremiumPlanEditor
              key={plan.id}
              plan={plan}
              stripeMode={stripeMode}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-zinc-200 p-4 text-sm text-slate-600 dark:border-white/10 dark:text-zinc-300">
          No premium plans exist yet. Create the first plan above.
        </p>
      )}
    </div>
  );
}

function PremiumPlanEditor({
  plan,
  stripeMode,
}: {
  plan?: AdminPremiumPlan;
  stripeMode: "live" | "sandbox";
}) {
  const [billingInterval, setBillingInterval] = useState<"month" | "year">(
    plan?.billingInterval ?? "month",
  );
  const [scope, setScope] = useState<"user" | "seller">(plan?.scope ?? "user");
  const [status, setStatus] = useState<"active" | "hidden" | "archived">(
    plan?.status ?? "active",
  );
  const [state, formAction, isPending] = useActionState(
    savePremiumPlanSettings,
    initialState,
  );
  const activeStripePriceId =
    stripeMode === "live"
      ? plan?.stripeLivePriceId
      : plan?.stripeSandboxPriceId;

  return (
    <form
      action={formAction}
      className="grid gap-5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]"
    >
      <input type="hidden" name="id" value={plan?.id ?? ""} />
      <input type="hidden" name="billingInterval" value={billingInterval} />
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="status" value={status} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">
              {plan ? plan.name : "Create premium plan"}
            </h3>
            {plan?.isHighlighted ? (
              <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-200">
                Highlighted
              </Badge>
            ) : null}
            {plan?.isDefault ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-200">
                Default
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
            {plan
              ? `${formatPlanPrice(plan.priceCents, plan.currency)} / ${
                  plan.billingInterval
                }`
              : "Define the plan and Piessang will create the Stripe objects."}
          </p>
        </div>

        {plan ? (
          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
              Stripe {stripeMode} price
            </p>
            <p className="mt-1 max-w-[260px] truncate text-xs text-slate-600 dark:text-zinc-300">
              {activeStripePriceId ?? "Not synced yet"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${plan?.id ?? "new"}-plan-name`}>Plan name</Label>
          <Input
            id={`${plan?.id ?? "new"}-plan-name`}
            name="name"
            defaultValue={plan?.name ?? "Piessang Premium"}
            maxLength={160}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${plan?.id ?? "new"}-plan-code`}>Plan code</Label>
          <Input
            id={`${plan?.id ?? "new"}-plan-code`}
            name="code"
            defaultValue={plan?.code ?? "piessang-premium-monthly"}
            maxLength={80}
            pattern="[a-z0-9-]+"
            required
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Stable internal code. Use lowercase letters, numbers, and hyphens.
          </p>
        </div>

        <div className="grid gap-2">
          <Label>Billing interval</Label>
          <Select
            value={billingInterval}
            onValueChange={(value) =>
              setBillingInterval(value as "month" | "year")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as "active" | "hidden" | "archived")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${plan?.id ?? "new"}-price-cents`}>
            Price in cents
          </Label>
          <Input
            id={`${plan?.id ?? "new"}-price-cents`}
            name="priceCents"
            type="number"
            min={0}
            max={100000000}
            defaultValue={plan?.priceCents ?? 999}
            required
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            999 = {formatPlanPrice(999, plan?.currency ?? "USD")}. Changing
            price, currency, or interval creates a new Stripe Price.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${plan?.id ?? "new"}-currency`}>Currency</Label>
          <Input
            id={`${plan?.id ?? "new"}-currency`}
            name="currency"
            defaultValue={plan?.currency ?? "USD"}
            maxLength={3}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label>Plan scope</Label>
          <Select
            value={scope}
            onValueChange={(value) => setScope(value as "user" | "seller")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User account</SelectItem>
              <SelectItem value="seller">Seller account</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${plan?.id ?? "new"}-storage`}>
            Storage quota
          </Label>
          <Input
            id={`${plan?.id ?? "new"}-storage`}
            name="storageQuotaMb"
            type="number"
            min={100}
            max={512000}
            defaultValue={plan?.storageQuotaMb ?? 5120}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${plan?.id ?? "new"}-sort`}>Sort order</Label>
          <Input
            id={`${plan?.id ?? "new"}-sort`}
            name="sortOrder"
            type="number"
            min={0}
            max={10000}
            defaultValue={plan?.sortOrder ?? 10}
            required
          />
        </div>

        <div className="grid gap-2 lg:col-span-2">
          <Label htmlFor={`${plan?.id ?? "new"}-description`}>
            Description
          </Label>
          <Input
            id={`${plan?.id ?? "new"}-description`}
            name="description"
            defaultValue={plan?.description ?? ""}
            maxLength={500}
            placeholder="Unlock more storage, faster uploads, and premium tools."
          />
        </div>

        <div className="grid gap-2 lg:col-span-2">
          <Label htmlFor={`${plan?.id ?? "new"}-features`}>
            Feature bullets
          </Label>
          <Textarea
            id={`${plan?.id ?? "new"}-features`}
            name="featureBullets"
            defaultValue={
              plan?.featureBullets.join("\n") ??
              "5 GB of storage\nAdvanced media tools\nPriority support\nFaster uploads"
            }
            maxLength={1000}
            required
          />
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            One feature per line. The first 8 lines are shown in premium UI.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 dark:border-white/10">
          <Checkbox
            name="isHighlighted"
            defaultChecked={plan?.isHighlighted ?? true}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold">Highlighted</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Give this plan the premium visual emphasis.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 dark:border-white/10">
          <Checkbox
            name="isDefault"
            defaultChecked={plan?.isDefault ?? false}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold">Default plan</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Use as the preselected plan in upgrade flows.
            </span>
          </span>
        </label>
      </div>

      {state.message ? (
        <p
          className={cn(
            "rounded-lg border p-3 text-sm",
            state.ok
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
              : "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200",
          )}
        >
          {state.message}
        </p>
      ) : plan?.stripeSyncError ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          Last Stripe sync warning: {plan.stripeSyncError}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="w-fit gap-2">
        {isPending ? (
          <SparklesIcon className="size-4 animate-pulse" />
        ) : (
          <SaveIcon className="size-4" />
        )}
        {isPending ? "Syncing..." : plan ? "Save plan" : "Create plan"}
      </Button>
    </form>
  );
}

type NotificationSettingsFormProps = {
  deliveries: AdminNotificationDelivery[];
  globalVariables: AdminNotificationGlobalVariable[];
  mediaLibrary: Awaited<ReturnType<typeof getAdminMediaLibrary>> | null;
  templates: AdminNotificationTemplate[];
};

export function NotificationSettingsForm({
  deliveries,
  globalVariables,
  mediaLibrary,
  templates,
}: NotificationSettingsFormProps) {
  const [selectedItem, setSelectedItem] = useState(
    templates[0]?.id ?? "analytics",
  );
  const [templateSearch, setTemplateSearch] = useState("");
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
  const selectedTemplate =
    templates.find((template) => template.id === selectedItem) ?? null;

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-admin-primary/25 bg-admin-primary/8 p-4 dark:bg-admin-primary/10">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-admin-primary/15 text-admin-primary">
            <MailCheckIcon className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              Email-only notification center
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
              These templates are the source of truth for transactional emails.
              Seller application events will call these templates through
              SendGrid and record each delivery attempt.
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
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedItem(template.id)}
                className={cn(
                  "grid gap-1 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  selectedItem === template.id
                    ? "bg-admin-primary/12 text-zinc-950 ring-1 ring-admin-primary/25 dark:bg-admin-primary/20 dark:text-white"
                    : "text-slate-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
                )}
              >
                <span className="truncate font-semibold">{template.name}</span>
                <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                  <span className="truncate">{template.category}</span>
                  <span>v{template.version}</span>
                </span>
              </button>
            ))}

            {filteredTemplates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-sm text-slate-500 dark:border-white/10 dark:text-zinc-400">
                No templates match this search.
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setSelectedItem("analytics")}
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
              onClick={() => setSelectedItem("globals")}
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
          ) : selectedTemplate ? (
            <NotificationTemplateEditor
              globalVariables={globalVariables}
              mediaLibrary={mediaLibrary}
              key={selectedTemplate.id}
              template={selectedTemplate}
            />
          ) : (
            <p className="rounded-xl border border-zinc-200 p-4 text-sm text-slate-600 dark:border-white/10 dark:text-zinc-300">
              No notification templates exist yet. Run the latest database
              migrations to seed the default seller application templates.
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
  const systemVariables = variables.filter(
    (variable) => variable.source === "system",
  );
  const customVariables = variables.filter(
    (variable) => variable.source === "custom",
  );

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-4 flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-admin-primary/15 text-admin-primary">
            <Globe2Icon className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              Global template variables
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              Create reusable values that can be inserted into any email
              template with double braces, for example {"{{supportEmail}}"}.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {systemVariables.map((variable) => (
            <div
              key={variable.key}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="mb-2 flex items-center gap-2">
                <Globe2Icon className="size-4 text-admin-primary" />
                <p className="truncate text-sm font-bold text-zinc-950 dark:text-white">
                  {variable.label}
                </p>
              </div>
              <p className="truncate font-mono text-xs text-admin-primary">
                {`{{${variable.key}}}`}
              </p>
              <p className="mt-2 truncate text-xs text-slate-500 dark:text-zinc-400">
                {variable.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <NotificationGlobalVariableForm />

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              Custom globals
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              These values are stored in PostgreSQL and merged into every
              transactional email render.
            </p>
          </div>
          <Badge className="bg-admin-primary/15 text-admin-primary">
            {customVariables.length}
          </Badge>
        </div>

        {customVariables.length > 0 ? (
          <div className="grid gap-3">
            {customVariables.map((variable) => (
              <NotificationGlobalVariableForm
                key={variable.id ?? variable.key}
                variable={variable}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-slate-600 dark:border-white/10 dark:text-zinc-300">
            No custom global variables have been created yet.
          </p>
        )}
      </div>
    </div>
  );
}

function NotificationGlobalVariableForm({
  variable,
}: {
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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="id" value={variable?.id ?? ""} />
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
              placeholder="support@piessang.com"
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

      {variable?.id ? (
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

  return days.map(({ date: _date, ...day }) => day);
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
      "Piessang image";
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

function getTemplateVariableSample(
  variable: string,
  globalVariableValues: Record<string, string> = {},
) {
  if (globalVariableValues[variable]) {
    return globalVariableValues[variable];
  }

  const normalized = variable.toLowerCase();

  if (normalized.includes("sellerdashboard")) {
    return "https://seller.piessang.com";
  }

  if (normalized.includes("admindashboard")) {
    return "https://admin.piessang.com";
  }

  if (normalized.includes("email")) {
    return "admin@piessang.com";
  }

  if (normalized.includes("url")) {
    return "https://piessang.com";
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

function formatPlanPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(priceCents / 100);
}
