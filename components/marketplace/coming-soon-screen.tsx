"use client";

import { useActionState } from "react";
import { LockIcon, SparklesIcon } from "lucide-react";

import {
  unlockMarketplacePreview,
  type ComingSoonState,
} from "@/app/coming-soon/actions";
import { PiessangLogo } from "@/components/brand/piessang-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ComingSoonState = {};

export function ComingSoonScreen() {
  const [state, formAction, isPending] = useActionState(
    unlockMarketplacePreview,
    initialState,
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#090909] text-white">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <section className="grid min-h-screen place-items-center px-5 py-12">
        <div className="w-full max-w-md text-center">
          <PiessangLogo priority className="mx-auto h-10 w-48" />
          <div className="mx-auto mt-12 grid size-20 place-items-center rounded-full border border-amber-300/20 bg-amber-300/10 shadow-2xl shadow-amber-400/10">
            <SparklesIcon className="size-9 text-amber-300" />
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
            Coming soon
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">
            Piessang is getting ready.
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-white/70">
            The public marketplace is currently in private preview. Enter the
            preview password to continue.
          </p>

          <form action={formAction} className="mt-8 grid gap-4 text-left">
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-white">
                Preview password
              </Label>
              <div className="relative">
                <LockIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/38" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter preview password"
                  className="border-white/14 bg-white/[0.04] pl-10 text-white placeholder:text-white/38"
                />
              </div>
            </div>

            {state.error ? (
              <p className="rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">
                {state.error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={isPending}
              className="justify-center gap-2 bg-amber-300 text-zinc-950 hover:bg-amber-200"
            >
              <LockIcon className="size-4" />
              {isPending ? "Checking..." : "Enter marketplace"}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
