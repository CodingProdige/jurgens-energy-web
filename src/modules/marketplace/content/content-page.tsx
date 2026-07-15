import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, ChevronRightIcon, type LucideIcon } from "lucide-react";

export function ContentHero({
  breadcrumbLabel,
  description,
  eyebrow,
  icon: Icon,
  title,
}: {
  breadcrumbLabel: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <header className="relative overflow-hidden border-b border-white/10 bg-[#080808] text-[#f7f7f2]">
      <div
        aria-hidden="true"
        className="absolute -right-28 -top-28 size-72 rounded-full border border-[#ff5a1f]/25 sm:size-[430px]"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-36 right-[12%] size-72 rounded-full bg-[#ff5a1f]/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute left-[46%] top-0 h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent"
      />

      <div className="relative mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
        <nav
          aria-label={`${breadcrumbLabel} breadcrumbs`}
          className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/55 sm:text-xs"
        >
          <Link className="transition hover:text-[#ff5a1f]" href="/">
            Home
          </Link>
          <ChevronRightIcon className="size-3.5 shrink-0" />
          <span className="truncate text-white/85">{breadcrumbLabel}</span>
        </nav>

        <div className="mt-8 grid gap-7 sm:mt-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-10">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#ff5a1f] sm:text-xs">
              {eyebrow}
            </p>
            <h1 className="mt-3 max-w-4xl text-[34px] font-black uppercase leading-[0.98] tracking-[-0.025em] sm:text-[48px] lg:text-[62px]">
              {title}
            </h1>
            <p className="mt-5 max-w-3xl text-[15px] font-medium leading-7 text-white/68 sm:text-[17px] sm:leading-8">
              {description}
            </p>
          </div>

          <span className="grid size-14 shrink-0 place-items-center rounded-full border border-[#ff5a1f]/50 bg-[#ff5a1f]/10 text-[#ff5a1f] sm:size-[72px]">
            <Icon className="size-7 sm:size-9" strokeWidth={1.65} />
          </span>
        </div>
      </div>
    </header>
  );
}

export function ContentSectionHeading({
  description,
  eyebrow,
  title,
}: {
  description?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ff5a1f]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-[26px] font-black uppercase leading-[1.05] tracking-[-0.02em] sm:text-[34px]">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-[14px] leading-7 text-[#5f5f59] dark:text-[#bdbdb5] sm:text-[15px]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function ContentActionPanel({
  actions,
  description,
  eyebrow = "Ready when you are",
  title,
}: {
  actions: Array<{
    href: string;
    label: string;
    external?: boolean;
    variant?: "primary" | "secondary";
  }>;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-[#1a1a1a] px-5 py-7 text-[#f7f7f2] sm:px-8 sm:py-9">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ff5a1f]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-[24px] font-black uppercase leading-tight sm:text-[30px]">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-white/65 sm:text-sm">
            {description}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
          {actions.map((action) => {
            const className =
              action.variant === "secondary"
                ? "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/20 px-5 text-[12px] font-black uppercase tracking-[0.06em] text-white transition hover:border-[#ff5a1f] hover:text-[#ff5a1f]"
                : "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#ff5a1f] px-5 text-[12px] font-black uppercase tracking-[0.06em] text-white transition hover:bg-[#e94d15]";
            const content = (
              <>
                {action.label}
                <ArrowRightIcon className="size-4" />
              </>
            );

            return action.external ? (
              <a
                className={className}
                href={action.href}
                key={action.label}
                rel="noreferrer"
                target="_blank"
              >
                {content}
              </a>
            ) : (
              <Link className={className} href={action.href} key={action.label}>
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function NumberedStep({
  children,
  number,
  title,
}: {
  children: ReactNode;
  number: string;
  title: string;
}) {
  return (
    <article className="relative min-w-0 border-t border-[#deded7] pt-5 dark:border-white/10">
      <span className="text-[11px] font-black tracking-[0.18em] text-[#ff5a1f]">
        {number}
      </span>
      <h3 className="mt-3 text-[17px] font-black uppercase leading-tight">
        {title}
      </h3>
      <div className="mt-2 text-[13px] leading-6 text-[#64645e] dark:text-[#bdbdb5]">
        {children}
      </div>
    </article>
  );
}
