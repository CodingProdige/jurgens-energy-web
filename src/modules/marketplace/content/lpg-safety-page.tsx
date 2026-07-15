import Link from "next/link";
import {
  AlertOctagonIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  FlameIcon,
  GaugeIcon,
  PackageCheckIcon,
  ShieldCheckIcon,
  WindIcon,
  WrenchIcon,
} from "lucide-react";

import {
  ContentActionPanel,
  ContentHero,
  ContentSectionHeading,
} from "@/src/modules/marketplace/content/content-page";

const safetyTopics = [
  {
    description:
      "Use legally filled cylinders and equipment intended for the appliance and the South African market.",
    icon: PackageCheckIcon,
    points: [
      "Check that a filled or exchanged cylinder has an intact branded shrink-wrap seal over the valve. The branding on the seal should match the branding on the cylinder.",
      "Do not accept a cylinder with no seal, a clear unbranded seal, or a seal marked only with generic LPG wording.",
      "Match the cylinder size, regulator, hose and connections to the appliance manufacturer’s instructions.",
      "Check the equipment regularly for damage, corrosion, worn hoses, loose fittings or a change in performance.",
    ],
    title: "Choose compliant equipment",
  },
  {
    description:
      "A cylinder and appliance need airflow, physical protection and separation from ignition and combustible material.",
    icon: WindIcon,
    points: [
      "Keep cylinders upright, stable and protected from impact, tampering and conditions that could damage them.",
      "Use and store LPG in a well-ventilated place and away from flames, sparks, hot surfaces and flammable material.",
      "Do not place cylinders below ground level or where leaking gas could collect. LPG vapour is denser than air and can travel along the ground or enter drains.",
      "Local storage limits and placement requirements can differ by premises and municipality. Confirm the applicable requirements for your property.",
    ],
    title: "Store it with ventilation",
  },
  {
    description:
      "Follow the appliance manual every time and stop when a connection or component does not look right.",
    icon: GaugeIcon,
    points: [
      "Do not detach the cylinder, regulator or another connection while the appliance is operating.",
      "Never use a naked flame to look for a leak. A soapy-water solution on accessible joints can show bubbles where gas is escaping.",
      "Do not leave an operating appliance unattended. Turn the gas supply off at the cylinder after use and while the appliance is unattended.",
      "Treat an ‘empty’ cylinder as potentially hazardous: it can still contain LPG vapour. Do not vent, tamper with, repair or unlawfully refill it.",
    ],
    title: "Connect and use with care",
  },
  {
    description:
      "Fixed installations, servicing and compliance checks belong with a practitioner registered for the relevant LPG scope.",
    icon: WrenchIcon,
    points: [
      "Ask the practitioner to show a current SAQCC Gas registration card and check that its scope covers the work required.",
      "Obtain and keep the required Certificate of Conformity after applicable installation work is completed.",
      "Do not alter an installation, regulator, safety device or appliance to make incompatible parts fit.",
      "Arrange professional inspection if an appliance performs differently, shows corrosion, repeatedly extinguishes or may be leaking.",
    ],
    title: "Use a registered practitioner",
  },
] as const;

const officialResources = [
  {
    description:
      "Consumer guidance on appliances, legally filled cylinders, connections and leak checks.",
    href: "https://lpgas.co.za/safety-tips/",
    label: "LPGSA safety tips",
  },
  {
    description:
      "Find and verify practitioners registered for the LPG work you need.",
    href: "https://saqccgas.co.za/",
    label: "SAQCC Gas practitioner search",
  },
  {
    description:
      "Read practical household LPG guidance published by the City of Cape Town.",
    href: "https://resource.capetown.gov.za/cityassets/Media%20Centre%20Assets/LPGas%20Safety%20at%20home.pdf",
    label: "Gas safety at home",
  },
] as const;

export function LpgSafetyPage() {
  return (
    <article>
      <ContentHero
        breadcrumbLabel="LPG safety"
        description="A practical starting point for choosing, storing, connecting and using LPG cylinders responsibly in South Africa."
        eyebrow="Handle with care"
        icon={ShieldCheckIcon}
        title="Safe gas starts before ignition."
      />

      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
        <section className="overflow-hidden rounded-xl border border-[#ff5a1f]/50 bg-[#1a1a1a] text-white">
          <div className="grid gap-5 p-5 sm:grid-cols-[56px_minmax(0,1fr)] sm:p-7 lg:p-8">
            <span className="grid size-14 place-items-center rounded-full bg-[#ff5a1f] text-white">
              <AlertOctagonIcon className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ff9a73]">
                If you smell gas
              </p>
              <h2 className="mt-2 text-[22px] font-black uppercase leading-tight sm:text-[28px]">
                Keep ignition away and move people to safety.
              </h2>
              <div className="mt-4 grid gap-3 text-[13px] leading-6 text-white/72 sm:text-[14px] lg:grid-cols-2 lg:gap-x-8">
                <p>
                  Do not smoke, light a flame or operate an electrical switch near
                  the suspected leak. If it can be done without putting anyone at
                  risk, close the cylinder valve and ventilate the area naturally.
                </p>
                <p>
                  Stop using the equipment and contact a qualified LPG professional.
                  For a fire, an uncontrolled leak, a strong or persistent gas smell,
                  or immediate danger, leave the area and call the appropriate
                  emergency service. From a South African mobile phone, call{" "}
                  <a className="font-black text-[#ff9a73] underline" href="tel:112">
                    112
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 sm:mt-20">
          <ContentSectionHeading
            description="This guidance supports—not replaces—the appliance manual, instructions from your LPG supplier, local fire and building requirements, or advice from a registered practitioner."
            eyebrow="Everyday safety"
            title="Four habits that reduce risk."
          />

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {safetyTopics.map((topic) => {
              const Icon = topic.icon;

              return (
                <article
                  className="min-w-0 rounded-xl border border-[#e1e1da] bg-white p-5 dark:border-white/10 dark:bg-[#141414] sm:p-7"
                  key={topic.title}
                >
                  <div className="grid gap-4 sm:grid-cols-[48px_minmax(0,1fr)]">
                    <span className="grid size-12 place-items-center rounded-lg bg-[#fff0e9] text-[#ff5a1f] dark:bg-[#ff5a1f]/10">
                      <Icon className="size-6" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[17px] font-black uppercase leading-tight sm:text-[19px]">
                        {topic.title}
                      </h3>
                      <p className="mt-2 text-[12px] leading-5 text-[#676761] dark:text-[#b9b9b1] sm:text-[13px]">
                        {topic.description}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-5 grid gap-3 border-t border-[#eeeee8] pt-5 dark:border-white/10">
                    {topic.points.map((point) => (
                      <li
                        className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5 text-[13px] leading-6 text-[#555550] dark:text-[#c7c7bf]"
                        key={point}
                      >
                        <CheckCircle2Icon className="mt-1 size-4 text-[#ff5a1f]" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-14 border-y border-[#dfdfd8] py-10 dark:border-white/10 sm:mt-20 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <ContentSectionHeading
              description="A cylinder exchange is also a safety handover. The replacement and the empty cylinder both need to meet the applicable product and supplier requirements."
              eyebrow="Cylinder exchange"
              title="Bring the right empty cylinder."
            />
            <div className="grid gap-3">
              {[
                "Read the exchange requirement shown on the product before ordering. Size, type, brand or ownership rules and condition may affect eligibility.",
                "Keep the eligible empty cylinder upright and ready in a ventilated place that the delivery team can access safely.",
                "Do not present a leaking, modified, severely damaged or illegally filled cylinder for exchange.",
                "If the empty cylinder may be unsafe or does not meet the stated requirement, contact the team before delivery so the available options can be confirmed.",
              ].map((point, index) => (
                <article
                  className="grid grid-cols-[38px_minmax(0,1fr)] items-start gap-3 rounded-lg bg-[#eeeee8] p-4 dark:bg-white/[0.055]"
                  key={point}
                >
                  <span className="grid size-9 place-items-center rounded-full bg-white text-[12px] font-black text-[#ff5a1f] shadow-sm dark:bg-[#1a1a1a]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="pt-1 text-[13px] leading-6 text-[#555550] dark:text-[#c7c7bf]">
                    {point}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 sm:mt-16">
          <ContentSectionHeading
            description="For installation requirements, permitted equipment and incident guidance, use the relevant South African authority or LPG industry resource."
            eyebrow="Official guidance"
            title="Verify before you proceed."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {officialResources.map((resource) => (
              <a
                className="group flex min-w-0 flex-col rounded-xl border border-[#e1e1da] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#ff5a1f]/65 hover:shadow-[0_14px_34px_rgba(8,8,8,0.06)] dark:border-white/10 dark:bg-[#141414] dark:hover:border-[#ff5a1f]/60 dark:hover:shadow-none"
                href={resource.href}
                key={resource.href}
                rel="noreferrer"
                target="_blank"
              >
                <span className="flex items-center justify-between gap-3">
                  <FlameIcon className="size-5 text-[#ff5a1f]" />
                  <ExternalLinkIcon className="size-4 text-[#aaa9a2] transition group-hover:text-[#ff5a1f]" />
                </span>
                <h3 className="mt-5 text-[14px] font-black uppercase leading-tight">
                  {resource.label}
                </h3>
                <p className="mt-2 text-[12px] leading-5 text-[#676761] dark:text-[#b9b9b1]">
                  {resource.description}
                </p>
              </a>
            ))}
          </div>
        </section>

        <div className="mt-12 sm:mt-16">
          <ContentActionPanel
            actions={[
              { href: "/products", label: "Browse LPG products" },
              {
                href: "/contact",
                label: "Ask before ordering",
                variant: "secondary",
              },
            ]}
            description="If you are unsure about a product or exchange requirement, confirm it before ordering. Installation and technical safety questions belong with a registered LPG practitioner."
            eyebrow="Choose carefully"
            title="Get the right product and the right help."
          />
        </div>

        <p className="mx-auto mt-6 max-w-4xl text-center text-[11px] leading-5 text-[#777771] dark:text-[#a8a8a0]">
          This page provides general consumer guidance and is not a substitute for
          emergency services, the product manufacturer’s instructions, applicable
          law or advice from a registered LPG practitioner. For store policies, see{" "}
          <Link className="font-bold text-[#ff5a1f] hover:underline" href="/terms-and-conditions">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
