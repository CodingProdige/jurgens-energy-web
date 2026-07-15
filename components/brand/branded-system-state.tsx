import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { JurgensEnergyLogo } from "@/components/brand/jurgens-energy-logo";

type BrandedSystemStateProps = {
  actions: ReactNode;
  code: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
};

export function BrandedSystemState({
  actions,
  code,
  description,
  eyebrow,
  icon: Icon,
  title,
}: BrandedSystemStateProps) {
  return (
    <main className="relative grid min-h-screen w-full place-items-center overflow-hidden bg-[#f7f7f2] px-4 py-10 text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2] sm:px-6">
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 size-80 rounded-full border border-[#ff5a1f]/20 sm:size-[30rem]"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 -left-28 size-96 rounded-full bg-[#ff5a1f]/10 blur-3xl"
      />

      <section className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-[#dfdfd8] bg-white shadow-[0_28px_80px_rgba(8,8,8,0.10)] dark:border-white/10 dark:bg-[#101010] dark:shadow-[0_28px_80px_rgba(0,0,0,0.38)]">
        <div className="h-1.5 bg-[#ff5a1f]" />
        <div className="px-5 py-6 sm:px-10 sm:py-9">
          <JurgensEnergyLogo compact={false} />

          <div className="mt-10 grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-8">
            <span className="grid size-14 place-items-center rounded-full border border-[#ff5a1f]/25 bg-[#fff2eb] text-[#ff5a1f] dark:bg-[#ff5a1f]/10 sm:size-16">
              <Icon className="size-7 sm:size-8" strokeWidth={1.8} />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff5a1f]">
                  {eyebrow}
                </p>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a8a82] dark:text-white/45">
                  {code}
                </span>
              </div>
              <h1 className="mt-3 text-[32px] font-black uppercase leading-[1.02] tracking-[-0.025em] sm:text-[46px]">
                {title}
              </h1>
              <p className="mt-4 max-w-xl text-[14px] font-medium leading-7 text-[#5c5c56] dark:text-[#c8c8c0] sm:text-[16px]">
                {description}
              </p>
              <div className="mt-7 flex flex-col gap-2.5 min-[420px]:flex-row min-[420px]:flex-wrap">
                {actions}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
