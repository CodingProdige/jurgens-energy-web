import Image from "next/image";
import Link from "next/link";
import {
  HeadphonesIcon,
  type LucideIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";

import { JurgensEnergyLogo } from "@/components/brand/jurgens-energy-logo";
import { PublicBusinessIdentityDisclosure } from "@/components/marketplace/public-business-identity";
import {
  FacebookMark,
  InstagramMark,
  TwitterMark,
  WhatsappMark,
} from "@/components/brand/social-links";
import { normalizePhoneNumber } from "@/src/modules/phone";
import { getPublicBusinessIdentity } from "@/src/modules/business-information";
import { getCustomerSupportContactDetails } from "@/src/modules/customer-support/server";
import { policyLinks } from "@/src/modules/marketplace/policies/documents";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";

const footerServices = [
  {
    description:
      "Eligible orders: estimated delivery in 1–4 business days.",
    icon: TruckIcon,
    title: "South Africa Delivery",
  },
  {
    description: "Eligibility and cylinder handover checks apply where required.",
    icon: ShieldCheckIcon,
    title: "Safety-First Handling",
  },
  {
    description: "Clear payment, invoice and delivery status updates.",
    icon: UsersIcon,
    title: "Clear Order Updates",
  },
  {
    description: "We're here to help before, during and after delivery.",
    icon: HeadphonesIcon,
    title: "Customer Support",
  },
] as const;

const footerPolicyLinks = policyLinks.map(
  ({ href, label }) => [label, href] as const,
);

function createWhatsappUrl(phoneNumber: string | null) {
  if (!phoneNumber) {
    return null;
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber, {
    defaultCountryCode: "ZA",
  });

  if (!normalizedPhone) {
    return null;
  }

  const phoneDigits = normalizedPhone.replace(/\D/g, "");

  return phoneDigits ? `https://wa.me/${phoneDigits}` : null;
}

export async function MarketplaceFooter() {
  const [businessIdentity, settings, support] = await Promise.all([
    getPublicBusinessIdentity(),
    getMarketplaceSettings(),
    getCustomerSupportContactDetails(),
  ]);
  const whatsappUrl = createWhatsappUrl(support.whatsappPhone);
  const socialLinks = [
    settings.facebookUrl
      ? { href: settings.facebookUrl, icon: FacebookMark, label: "Facebook" }
      : null,
    settings.instagramUrl
      ? { href: settings.instagramUrl, icon: InstagramMark, label: "Instagram" }
      : null,
    settings.twitterUrl
      ? { href: settings.twitterUrl, icon: TwitterMark, label: "X / Twitter" }
      : null,
    whatsappUrl
      ? { href: whatsappUrl, icon: WhatsappMark, label: "WhatsApp" }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const contactLines = [
    ...support.phoneNumbers.map((phoneNumber) => ({
      href: `tel:${phoneNumber.replace(/[^\d+]/g, "")}`,
      icon: PhoneIcon,
      label: phoneNumber,
    })),
    support.email
      ? {
          href: `mailto:${support.email}`,
          icon: MailIcon,
          label: support.email,
        }
      : null,
    support.businessAddress
      ? {
          href: null,
          icon: MapPinIcon,
          label: support.businessAddress,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <footer
      className="mt-10 border-t border-[#e8e8e2] bg-white text-[#080808] dark:border-white/10 dark:bg-[#080808] dark:text-[#f7f7f2]"
      id="contact"
    >
      <div className="mx-auto w-full px-0 py-6 sm:w-[min(1500px,calc(100%-1rem))] sm:px-6 sm:py-8 lg:px-10">
        <section
          className="grid border-y border-[#ecece6] bg-[#fbfbf8] dark:border-white/10 dark:bg-white/[0.04] sm:overflow-hidden sm:rounded-lg sm:border sm:shadow-[0_12px_35px_rgba(8,8,8,0.04)] sm:dark:shadow-none md:grid-cols-2 xl:grid-cols-4"
          id="delivery"
        >
          {footerServices.map((item) => {
            const Icon = item.icon;

            return (
              <article
                className="grid min-h-[70px] grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3 border-b border-[#e8e8e2] px-4 py-3 last:border-b-0 dark:border-white/10 sm:min-h-[88px] sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-4 sm:px-5 sm:py-4 xl:border-b-0 xl:border-r xl:last:border-r-0"
                key={item.title}
              >
                <span className="grid size-9 place-items-center text-[#ff5a1f] sm:size-11">
                  <Icon className="size-6 stroke-[1.8] sm:size-8 sm:stroke-[1.6]" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[12px] font-black uppercase leading-4 sm:text-[13px]">
                    {item.title}
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#4f4f49] dark:text-[#c8c8c0] sm:mt-1 sm:text-[12px]">
                    {item.description}
                  </p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid gap-7 border-b border-[#ecece6] px-4 py-7 dark:border-white/10 sm:px-0 sm:py-9 md:grid-cols-[1.3fr_0.8fr_0.8fr] lg:grid-cols-4 xl:grid-cols-[1.5fr_0.75fr_0.75fr_0.65fr_1fr_1.1fr_1fr]">
          <div className="min-w-0">
            <Link aria-label="Jurgens Energy home" href="/">
              <JurgensEnergyLogo />
            </Link>
            {settings.footerTagline ? (
              <p className="mt-3 max-w-xs text-[13px] leading-6 text-[#4f4f49] dark:text-[#c8c8c0]">
                {settings.footerTagline}
              </p>
            ) : null}
            {socialLinks.length > 0 ? (
              <div className="mt-5 flex items-center gap-3">
                {socialLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <a
                      aria-label={item.label}
                      className="grid size-8 place-items-center rounded-full border border-[#d8d8d0] text-[#4f4f49] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15 dark:text-[#c8c8c0]"
                      href={item.href}
                      key={item.label}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Icon />
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>

          <FooterColumn
            links={[
              ["All Products", "/products"],
              ["Cylinder Exchange", "/products?exchange=1"],
              [
                "Accessories",
                "/categories/gas-cylinders/cylinder-accessories",
              ],
              ["Deals", "/products?sale=1"],
              ["Brands", "/brands"],
            ]}
            title="Shop"
          />
          <FooterColumn
            links={[
              ["About Us", "/about"],
              ["Safety", "/lpg-safety"],
              ["Delivery", "/lpg-delivery"],
              ["FAQs", "/faq"],
              ["Contact Us", "/contact"],
            ]}
            title="Company"
          />
          <FooterColumn
            links={[["My Orders", "/account/orders"]]}
            title="Help"
          />
          <FooterColumn links={footerPolicyLinks} title="Policies" />

          <div className="min-w-0">
            <h2 className="text-[13px] font-black uppercase">Contact Us</h2>
            <div className="mt-4 grid gap-3 text-[13px] text-[#1a1a1a] dark:text-[#f7f7f2]">
              {contactLines.map((item) => (
                <ContactLine
                  href={item.href}
                  icon={item.icon}
                  key={`${item.label}-${item.href ?? "text"}`}
                  label={item.label}
                />
              ))}
            </div>
          </div>

          {settings.paymentMethodBadges.length > 0 ? (
            <div className="min-w-0">
              <h2 className="text-[13px] font-black uppercase">
                Payment Methods
              </h2>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {settings.paymentMethodBadges.map((paymentMethod, index) =>
                  paymentMethod.iconUrl ? (
                    <span
                      className="relative h-10 w-24 overflow-hidden rounded-md border border-[#e8e8e2] bg-white"
                      key={`${paymentMethod.label}-${paymentMethod.mediaId ?? index}`}
                      title={paymentMethod.label}
                    >
                      <Image
                        alt={`${paymentMethod.label} payment method`}
                        className="object-contain p-1.5"
                        fill
                        sizes="96px"
                        src={paymentMethod.iconUrl}
                      />
                    </span>
                  ) : (
                    <span
                      className="rounded-md border border-[#e8e8e2] bg-white px-3 py-2 text-[12px] font-black text-[#1a1a1a] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f7f7f2]"
                      key={`${paymentMethod.label}-${index}`}
                    >
                      {paymentMethod.label}
                    </span>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </section>

        <PublicBusinessIdentityDisclosure
          appearance="footer"
          identity={businessIdentity}
        />

        <div className="flex flex-col gap-3 px-4 pt-4 text-[12px] text-[#696963] dark:text-[#a8a89f] sm:flex-row sm:items-center sm:justify-between sm:px-0">
          <p>© {new Date().getFullYear()} Jurgens Energy. All rights reserved.</p>
          <p className="font-semibold text-[#1a1a1a] dark:text-[#f7f7f2]">
            Designed with care in South Africa
          </p>
        </div>
      </div>
    </footer>
  );
}

function ContactLine({
  href,
  icon: Icon,
  label,
}: {
  href?: string | null;
  icon: LucideIcon;
  label: string;
}) {
  const content = (
    <>
      <Icon className="size-4 shrink-0 text-[#1a1a1a] dark:text-[#f7f7f2]" />
      <span className="min-w-0 break-words">{label}</span>
    </>
  );

  if (href) {
    return (
      <a
        className="flex min-w-0 items-start gap-2 transition hover:text-[#ff5a1f]"
        href={href}
      >
        {content}
      </a>
    );
  }

  return (
    <p className="flex min-w-0 items-start gap-2">
      {content}
    </p>
  );
}

function FooterColumn({
  links,
  title,
}: {
  links: ReadonlyArray<readonly [string, string]>;
  title: string;
}) {
  return (
    <div className="min-w-0">
      <h2 className="text-[13px] font-black uppercase">{title}</h2>
      <nav className="mt-4 grid gap-2.5 text-[13px] text-[#1a1a1a] dark:text-[#f7f7f2]">
        {links.map(([label, href]) => (
          <Link
            className="transition hover:text-[#ff5a1f]"
            href={href}
            key={label}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
