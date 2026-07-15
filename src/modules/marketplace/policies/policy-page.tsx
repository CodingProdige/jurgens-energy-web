import Link from "next/link";
import {
  ArrowRightIcon,
  BookOpenCheckIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  RefreshCcwIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "lucide-react";

import {
  POLICY_EFFECTIVE_DATE,
  type PolicyDocument,
  type PolicyKind,
  policyLinks,
} from "@/src/modules/marketplace/policies/documents";
import { POLICY_EFFECTIVE_DATE_ISO } from "@/src/modules/marketplace/policies/constants";

const policyIcons = {
  delivery: TruckIcon,
  privacy: ShieldCheckIcon,
  returns: RefreshCcwIcon,
  terms: ClipboardCheckIcon,
} satisfies Record<PolicyKind, typeof ShieldCheckIcon>;

export function PolicyPage({ document }: { document: PolicyDocument }) {
  const DocumentIcon = policyIcons[document.kind];
  const relatedPolicies = policyLinks.filter(
    (policy) => policy.kind !== document.kind,
  );

  return (
    <article>
      <header className="relative overflow-hidden border-b border-white/10 bg-[#080808] text-[#f7f7f2]">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 size-72 rounded-full border border-[#ff5a1f]/25 sm:size-96"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-28 right-16 size-52 rounded-full bg-[#ff5a1f]/10 blur-3xl sm:size-72"
        />
        <div className="relative mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
          <nav
            aria-label={`${document.shortTitle} breadcrumbs`}
            className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/55 sm:text-xs"
          >
            <Link className="transition hover:text-[#ff5a1f]" href="/">
              Home
            </Link>
            <ChevronRightIcon className="size-3.5 shrink-0" />
            <span className="truncate text-white/85">{document.shortTitle}</span>
          </nav>

          <div className="mt-8 grid gap-6 sm:mt-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-10">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#ff5a1f] sm:text-xs">
                {document.eyebrow}
              </p>
              <h1 className="mt-3 max-w-4xl text-[34px] font-black uppercase leading-[0.98] tracking-[-0.025em] sm:text-[48px] lg:text-[62px]">
                {document.title}
              </h1>
              <p className="mt-5 max-w-3xl text-[15px] font-medium leading-7 text-white/68 sm:text-[17px] sm:leading-8">
                {document.description}
              </p>
            </div>

            <div className="flex items-center gap-3 sm:flex-col sm:items-end">
              <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[#ff5a1f]/50 bg-[#ff5a1f]/10 text-[#ff5a1f] sm:size-14">
                <DocumentIcon className="size-5 sm:size-7" strokeWidth={1.8} />
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55 sm:text-right">
                Effective
                <time
                  className="mt-0.5 block text-[12px] normal-case tracking-normal text-white/90"
                  dateTime={POLICY_EFFECTIVE_DATE_ISO}
                >
                  {POLICY_EFFECTIVE_DATE}
                </time>
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1180px] gap-7 px-4 py-7 sm:px-7 sm:py-10 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-10 lg:py-14 xl:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-[140px]">
          <div className="overflow-hidden rounded-lg border border-[#e4e4de] bg-white shadow-[0_12px_35px_rgba(8,8,8,0.04)] dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
            <div className="flex items-center gap-2.5 border-b border-[#ecece6] px-4 py-3.5 dark:border-white/10">
              <BookOpenCheckIcon className="size-4 text-[#ff5a1f]" />
              <h2 className="text-[12px] font-black uppercase tracking-[0.08em]">
                On this page
              </h2>
            </div>
            <nav
              aria-label={`${document.shortTitle} sections`}
              className="max-h-[min(58vh,520px)] overflow-y-auto p-2"
            >
              {document.sections.map((section) => (
                <a
                  className="group flex items-start gap-2.5 rounded-md px-2.5 py-2 text-[12px] font-semibold leading-4 text-[#666660] transition hover:bg-[#f7f7f2] hover:text-[#080808] dark:text-[#b9b9b1] dark:hover:bg-white/[0.06] dark:hover:text-white"
                  href={`#${document.kind}-${section.id}`}
                  key={section.id}
                >
                  <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-[#d0d0c9] transition group-hover:bg-[#ff5a1f] dark:bg-white/25" />
                  <span>{section.title}</span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="overflow-hidden rounded-lg border border-[#e4e4de] bg-white shadow-[0_16px_45px_rgba(8,8,8,0.05)] dark:border-white/10 dark:bg-[#101010] dark:shadow-none">
            {document.sections.map((section) => (
              <section
                className="scroll-mt-[140px] border-b border-[#ecece6] px-4 py-6 last:border-b-0 dark:border-white/10 sm:px-7 sm:py-8 lg:px-9"
                id={`${document.kind}-${section.id}`}
                key={section.id}
              >
                <h2 className="text-[20px] font-black leading-tight text-[#080808] dark:text-[#f7f7f2] sm:text-[24px]">
                  {section.title}
                </h2>
                <div className="mt-4 grid gap-4 text-[14px] leading-7 text-[#4f4f49] dark:text-[#c8c8c0] sm:text-[15px] sm:leading-7">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.bullets ? (
                    <ul className="grid gap-2.5 pl-0">
                      {section.bullets.map((bullet) => (
                        <li
                          className="grid grid-cols-[8px_minmax(0,1fr)] gap-3"
                          key={bullet}
                        >
                          <span className="mt-[10px] size-1.5 rounded-full bg-[#ff5a1f]" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {section.note ? (
                    <div className="border-l-2 border-[#ff5a1f] bg-[#fff6f0] px-4 py-3.5 font-semibold text-[#2f2f2b] dark:bg-[#ff5a1f]/10 dark:text-[#f0f0e9]">
                      {section.note}
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-7 overflow-hidden rounded-lg bg-[#1a1a1a] px-5 py-6 text-[#f7f7f2] sm:px-7 sm:py-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ff5a1f]">
                  Need help?
                </p>
                <h2 className="mt-2 text-[22px] font-black leading-tight sm:text-[26px]">
                  Let’s resolve it together.
                </h2>
                <p className="mt-2 max-w-xl text-[13px] leading-6 text-white/65 sm:text-sm">
                  Send us the relevant order number and a clear description so
                  our team can investigate quickly.
                </p>
              </div>
              <Link
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#ff5a1f] px-5 text-[12px] font-black uppercase tracking-[0.06em] text-white transition hover:bg-[#e94d15]"
                href="/contact"
              >
                Contact us
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </section>

          <section className="mt-9 sm:mt-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ff5a1f]">
                  More information
                </p>
                <h2 className="mt-2 text-[24px] font-black leading-tight sm:text-[30px]">
                  Related store policies
                </h2>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {relatedPolicies.map((policy) => {
                const RelatedIcon = policyIcons[policy.kind];

                return (
                  <Link
                    className="group flex min-w-0 flex-col rounded-lg border border-[#e4e4de] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#ff5a1f]/60 hover:shadow-[0_12px_30px_rgba(8,8,8,0.06)] dark:border-white/10 dark:bg-[#141414] dark:hover:border-[#ff5a1f]/60 dark:hover:shadow-none"
                    href={policy.href}
                    key={policy.href}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="grid size-9 place-items-center rounded-full bg-[#fff1e9] text-[#ff5a1f] dark:bg-[#ff5a1f]/10">
                        <RelatedIcon className="size-[18px]" />
                      </span>
                      <ArrowRightIcon className="size-4 text-[#a0a099] transition group-hover:translate-x-0.5 group-hover:text-[#ff5a1f]" />
                    </div>
                    <h3 className="mt-4 text-[14px] font-black">
                      {policy.label}
                    </h3>
                    <p className="mt-1.5 text-[12px] leading-5 text-[#666660] dark:text-[#b9b9b1]">
                      {policy.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
