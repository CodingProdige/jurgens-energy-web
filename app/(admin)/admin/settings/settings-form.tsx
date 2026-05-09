"use client";

import { useActionState, useState } from "react";
import { LinkIcon, LockIcon, SaveIcon } from "lucide-react";

import {
  updateMarketplaceSocialLinkSettings,
  updateMarketplaceGateSettings,
  type AdminSettingsState,
} from "@/app/(admin)/admin/settings/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
