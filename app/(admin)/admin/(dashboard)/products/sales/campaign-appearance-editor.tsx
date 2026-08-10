"use client";

import { EyeIcon } from "lucide-react";

import {
  DashboardInput,
  dashboardControlClass,
} from "@/components/dashboard/dashboard-controls";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  CampaignDynamicIcon,
  CampaignIconPicker,
} from "./campaign-icon-picker";

export type CampaignAppearanceValue = {
  badgeColor: string;
  badgeIcon: string | null;
  ctaLabel: string;
  headerPriority: number;
  headerVisible: boolean;
  publicHeadline: string;
};

export const defaultCampaignAppearance: CampaignAppearanceValue = {
  badgeColor: "#FF5A1F",
  badgeIcon: "badge-percent",
  ctaLabel: "Shop sale",
  headerPriority: 0,
  headerVisible: true,
  publicHeadline: "",
};

const campaignColorPresets = [
  { color: "#FF5A1F", label: "Flame" },
  { color: "#FFB000", label: "Amber" },
  { color: "#080808", label: "Ink" },
  { color: "#047857", label: "Emerald" },
  { color: "#0369A1", label: "Ocean" },
  { color: "#1D4ED8", label: "Cobalt" },
  { color: "#7E22CE", label: "Plum" },
  { color: "#BE123C", label: "Rose" },
] as const;

export function isCampaignHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function hexChannel(value: string, offset: number) {
  return Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
}

function linearizeChannel(value: number) {
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

export function getCampaignTextColor(backgroundColor: string) {
  if (!isCampaignHexColor(backgroundColor)) {
    return "#FFFFFF";
  }

  const color = backgroundColor.trim();
  const luminance =
    0.2126 * linearizeChannel(hexChannel(color, 1)) +
    0.7152 * linearizeChannel(hexChannel(color, 3)) +
    0.0722 * linearizeChannel(hexChannel(color, 5));
  const whiteContrast = 1.05 / (luminance + 0.05);
  const inkContrast = (luminance + 0.05) / 0.052428;

  return inkContrast >= whiteContrast ? "#080808" : "#FFFFFF";
}

export function CampaignAppearanceEditor({
  badgeText,
  campaignName,
  disabled = false,
  onChange,
  value,
}: {
  badgeText: string;
  campaignName: string;
  disabled?: boolean;
  onChange: (value: CampaignAppearanceValue) => void;
  value: CampaignAppearanceValue;
}) {
  const colorIsValid = isCampaignHexColor(value.badgeColor);
  const previewColor = colorIsValid ? value.badgeColor : "#FF5A1F";
  const previewTextColor = getCampaignTextColor(previewColor);
  const previewHeadline =
    value.publicHeadline.trim() || campaignName.trim() || "Your campaign headline";
  const previewBadge = badgeText.trim() || "Sale";
  const previewCta = value.ctaLabel.trim() || "Shop sale";

  function update<Key extends keyof CampaignAppearanceValue>(
    key: Key,
    nextValue: CampaignAppearanceValue[Key],
  ) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          <span>Public headline</span>
          <DashboardInput
            disabled={disabled}
            maxLength={200}
            onChange={(event) => update("publicHeadline", event.target.value)}
            placeholder={campaignName.trim() || "August gas sale"}
            value={value.publicHeadline}
          />
          <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">
            Optional. The campaign name is used when this is empty.
          </span>
        </label>

        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          <span>
            Call-to-action label <span className="text-red-600">*</span>
          </span>
          <DashboardInput
            aria-required="true"
            disabled={disabled}
            maxLength={80}
            onChange={(event) => update("ctaLabel", event.target.value)}
            placeholder="Shop sale"
            required
            value={value.ctaLabel}
          />
          <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">
            Keep it short so the spotlight remains usable on mobile.
          </span>
        </label>

        <div className="grid min-w-0 gap-1 text-sm font-semibold">
          <span>Campaign icon</span>
          <CampaignIconPicker
            disabled={disabled}
            onChange={(iconName) => update("badgeIcon", iconName)}
            value={value.badgeIcon}
          />
          <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">
            Search the full Lucide catalog or choose no icon.
          </span>
        </div>

        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          <span>
            Custom colour <span className="text-red-600">*</span>
          </span>
          <div className="flex min-w-0 gap-2">
            <input
              aria-label="Campaign colour picker"
              className={cn(
                "h-10 w-12 shrink-0 cursor-pointer rounded-md border p-1",
                dashboardControlClass,
              )}
              disabled={disabled}
              onChange={(event) => update("badgeColor", event.target.value)}
              type="color"
              value={previewColor}
            />
            <DashboardInput
              aria-invalid={!colorIsValid}
              aria-required="true"
              className="min-w-0 font-mono uppercase"
              disabled={disabled}
              maxLength={7}
              onChange={(event) => update("badgeColor", event.target.value)}
              placeholder="#FF5A1F"
              required
              value={value.badgeColor}
            />
          </div>
          <span
            className={cn(
              "text-xs font-normal",
              colorIsValid
                ? "text-slate-500 dark:text-zinc-400"
                : "font-semibold text-red-600 dark:text-red-300",
            )}
          >
            {colorIsValid
              ? "Readable Ink or white text is chosen automatically."
              : "Enter a complete colour such as #FF5A1F."}
          </span>
        </label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Colour presets</legend>
        <div className="flex flex-wrap gap-2">
          {campaignColorPresets.map((preset) => (
            <button
              aria-label={`Use ${preset.label} ${preset.color}`}
              aria-pressed={
                value.badgeColor.toUpperCase() === preset.color.toUpperCase()
              }
              className={cn(
                "flex h-9 items-center gap-2 rounded-md border bg-white px-2.5 text-xs font-semibold text-zinc-800 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[0.03] dark:text-zinc-100 dark:hover:bg-white/[0.07]",
                value.badgeColor.toUpperCase() === preset.color.toUpperCase()
                  ? "border-primary ring-1 ring-primary"
                  : "border-slate-200 dark:border-white/10",
              )}
              disabled={disabled}
              key={preset.color}
              onClick={() => update("badgeColor", preset.color)}
              type="button"
            >
              <span
                className="size-4 rounded-full border border-black/10"
                style={{ backgroundColor: preset.color }}
              />
              {preset.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="flex min-w-0 items-start justify-between gap-4 rounded-lg border border-slate-200 p-3 dark:border-white/10">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Feature in header</span>
            <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-zinc-400">
              Include this campaign in the rotating storefront spotlight.
            </span>
          </span>
          <Switch
            checked={value.headerVisible}
            disabled={disabled}
            onCheckedChange={(checked) => update("headerVisible", checked)}
          />
        </label>

        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          <span>
            Header priority <span className="text-red-600">*</span>
          </span>
          <DashboardInput
            aria-required="true"
            disabled={disabled || !value.headerVisible}
            max="32767"
            min="0"
            onChange={(event) =>
              update("headerPriority", Number(event.target.value) || 0)
            }
            type="number"
            value={value.headerPriority}
          />
          <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">
            Higher priorities appear first.
          </span>
        </label>
      </div>

      <div className="grid gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
          <EyeIcon className="size-3.5" /> Live appearance preview
          {!value.headerVisible ? " · Header hidden" : ""}
        </span>
        <div
          className="flex min-w-0 flex-col gap-2 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ backgroundColor: previewColor, color: previewTextColor }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <CampaignDynamicIcon
              className="size-5 shrink-0"
              iconName={value.badgeIcon}
            />
            <span className="min-w-0 truncate text-sm font-black uppercase tracking-[0.08em]">
              {previewHeadline}
            </span>
          </div>
          <span className="shrink-0 text-xs font-bold uppercase tracking-[0.08em] underline underline-offset-4">
            {previewCta} →
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            Product badge
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
            style={{ backgroundColor: previewColor, color: previewTextColor }}
          >
            <CampaignDynamicIcon
              className="size-3.5"
              iconName={value.badgeIcon}
            />
            {previewBadge}
          </span>
        </div>
      </div>
    </div>
  );
}
