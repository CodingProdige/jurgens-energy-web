"use client";

import { useActionState } from "react";
import { LockIcon, SaveIcon } from "lucide-react";

import {
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
