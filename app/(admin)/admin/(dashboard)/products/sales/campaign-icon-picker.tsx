"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ImageOffIcon, SearchIcon } from "lucide-react";

import { MarketplaceCampaignIcon } from "@/components/marketplace/marketplace-campaign-icon";
import {
  DashboardButton,
  DashboardInput,
} from "@/components/dashboard/dashboard-controls";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  lucideCampaignIconNames,
  type LucideCampaignIconName,
} from "@/src/generated/lucide-campaign-icon-names";

const visibleIconLimit = 120;
const iconNameSet = new Set<string>(lucideCampaignIconNames);

export function isCampaignIconName(
  value: string | null,
): value is LucideCampaignIconName {
  return Boolean(value && iconNameSet.has(value));
}

export function CampaignDynamicIcon({
  className,
  iconName,
}: {
  className?: string;
  iconName: string | null;
}) {
  if (!isCampaignIconName(iconName)) {
    return null;
  }

  return <MarketplaceCampaignIcon className={className} name={iconName} />;
}

function humanizeIconName(name: string) {
  return name
    .split("-")
    .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function CampaignIconPicker({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (value: string | null) => void;
  value: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(
    query.trim().toLowerCase().replace(/\s+/g, "-"),
  );
  const matchingIcons = useMemo(
    () =>
      deferredQuery
        ? lucideCampaignIconNames.filter((name) =>
            name.includes(deferredQuery),
          )
        : lucideCampaignIconNames,
    [deferredQuery],
  );
  const visibleIcons = matchingIcons.slice(0, visibleIconLimit);

  return (
    <>
      <DashboardButton
        aria-haspopup="dialog"
        className="h-10 w-full justify-start"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        {isCampaignIconName(value) ? (
          <CampaignDynamicIcon className="size-4" iconName={value} />
        ) : (
          <ImageOffIcon className="size-4" />
        )}
        <span className="truncate">
          {isCampaignIconName(value) ? humanizeIconName(value) : "No icon"}
        </span>
      </DashboardButton>

      <Dialog
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);

          if (!nextOpen) {
            setQuery("");
          }
        }}
        open={open}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose campaign icon</DialogTitle>
            <DialogDescription>
              Search the complete Lucide icon catalog. Icons load only when they
              are visible.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <DashboardInput
                aria-label="Search campaign icons"
                autoFocus
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search all icons, for example flame, tag, gift..."
                value={query}
              />
            </div>

            <div
              aria-live="polite"
              className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-zinc-400"
            >
              <span>
                {matchingIcons.length.toLocaleString("en-ZA")} matching icon
                {matchingIcons.length === 1 ? "" : "s"}
              </span>
              {matchingIcons.length > visibleIconLimit ? (
                <span>
                  Showing the first {visibleIconLimit}; refine the search for
                  more.
                </span>
              ) : null}
            </div>

            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
              role="listbox"
            >
              <button
                aria-selected={!value}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary",
                  !value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 bg-white text-zinc-800 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100 dark:hover:bg-white/[0.07]",
                )}
                onClick={() => {
                  onChange(null);
                  setQuery("");
                  setOpen(false);
                }}
                role="option"
                type="button"
              >
                <ImageOffIcon className="size-4 shrink-0" />
                <span className="truncate">None</span>
              </button>

              {visibleIcons.map((iconName) => (
                <button
                  aria-selected={value === iconName}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary",
                    value === iconName
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 bg-white text-zinc-800 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100 dark:hover:bg-white/[0.07]",
                  )}
                  key={iconName}
                  onClick={() => {
                    onChange(iconName);
                    setQuery("");
                    setOpen(false);
                  }}
                  role="option"
                  type="button"
                >
                  <CampaignDynamicIcon
                    className="size-4 shrink-0"
                    iconName={iconName}
                  />
                  <span className="truncate" title={humanizeIconName(iconName)}>
                    {humanizeIconName(iconName)}
                  </span>
                </button>
              ))}
            </div>

            {matchingIcons.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-zinc-400">
                No icons match “{query.trim()}”. Try a shorter keyword.
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DashboardButton
              onClick={() => {
                setQuery("");
                setOpen(false);
              }}
              type="button"
            >
              Cancel
            </DashboardButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { lucideCampaignIconNames };
