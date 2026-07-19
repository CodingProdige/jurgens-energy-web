import {
  AlertTriangleIcon,
  Clock3Icon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  SendIcon,
} from "lucide-react";

import {
  FacebookMark,
  InstagramMark,
  TwitterMark,
  WhatsappMark,
} from "@/components/brand/social-links";
import { createMarketplaceWhatsAppHref } from "@/components/marketplace/marketplace-whatsapp-button";
import {
  ContentHero,
  ContentSectionHeading,
} from "@/src/modules/marketplace/content/content-page";
import {
  getMarketplaceSettings,
  type MarketplaceSettings,
} from "@/src/modules/marketplace/settings";

function phoneHref(phoneNumber: string) {
  const dialableNumber = phoneNumber.replace(/[^\d+]/g, "");
  return dialableNumber ? `tel:${dialableNumber}` : null;
}

function buildContactMethods(settings: MarketplaceSettings) {
  const primaryPhone = settings.contactPhonePrimary.trim();
  const secondaryPhone = settings.contactPhoneSecondary.trim();
  const email = settings.contactEmail.trim();
  const address = settings.contactAddress.trim();
  const whatsappUrl = createMarketplaceWhatsAppHref(
    settings.whatsappBusinessPhoneNumber,
  );

  return [
    whatsappUrl
      ? {
          description: "Start a WhatsApp chat for product, delivery or order help.",
          href: whatsappUrl,
          icon: MessageCircleIcon,
          label: "WhatsApp",
          value: settings.whatsappBusinessPhoneNumber ?? "Chat with us",
          external: true,
        }
      : null,
    primaryPhone && phoneHref(primaryPhone)
      ? {
          description: "Call the customer-support number configured for the store.",
          href: phoneHref(primaryPhone)!,
          icon: PhoneIcon,
          label: "Call us",
          value: primaryPhone,
          external: false,
        }
      : null,
    secondaryPhone && phoneHref(secondaryPhone)
      ? {
          description: "Use our alternate telephone number if the primary line is unavailable.",
          href: phoneHref(secondaryPhone)!,
          icon: PhoneIcon,
          label: "Alternate number",
          value: secondaryPhone,
          external: false,
        }
      : null,
    email
      ? {
          description: "Best for requests that need documents, photographs or a detailed explanation.",
          href: `mailto:${email}`,
          icon: MailIcon,
          label: "Email us",
          value: email,
          external: false,
        }
      : null,
    address
      ? {
          description:
            "Business and dispatch contact address. Visits and returns are by prior arrangement only.",
          href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
          icon: MapPinIcon,
          label: "Business & dispatch address",
          value: address,
          external: true,
        }
      : null,
  ].filter((method): method is NonNullable<typeof method> => Boolean(method));
}

export async function ContactPage() {
  const settings = await getMarketplaceSettings();
  const contactMethods = buildContactMethods(settings);
  const whatsappUrl = createMarketplaceWhatsAppHref(
    settings.whatsappBusinessPhoneNumber,
  );
  const socialLinks = [
    settings.facebookUrl
      ? {
          href: settings.facebookUrl,
          icon: FacebookMark,
          label: "Facebook",
        }
      : null,
    settings.instagramUrl
      ? {
          href: settings.instagramUrl,
          icon: InstagramMark,
          label: "Instagram",
        }
      : null,
    settings.twitterUrl
      ? {
          href: settings.twitterUrl,
          icon: TwitterMark,
          label: "X / Twitter",
        }
      : null,
    whatsappUrl
      ? { href: whatsappUrl, icon: WhatsappMark, label: "WhatsApp" }
      : null,
  ].filter((link): link is NonNullable<typeof link> => Boolean(link));

  return (
    <article>
      <ContentHero
        breadcrumbLabel="Contact us"
        description="Questions about LPG cylinders, exchanges, delivery or an existing order? Reach Jurgens Energy through the contact channel that works for you."
        eyebrow="We’re here to help"
        icon={SendIcon}
        title="Talk to our team."
      />

      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
        <section>
          <ContentSectionHeading
            description="These details come directly from the store’s current contact settings. Tap a card to call, email, start a WhatsApp chat or view our business and dispatch address. Visits and returns are by prior arrangement only."
            eyebrow="Contact channels"
            title="Choose the fastest route."
          />

          {contactMethods.length > 0 ? (
            <address className="mt-7 grid gap-3 not-italic sm:grid-cols-2 lg:grid-cols-3">
              {contactMethods.map((method) => {
                const Icon = method.icon;

                return (
                  <a
                    className="group flex min-w-0 flex-col rounded-xl border border-[#e1e1da] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#ff5a1f]/65 hover:shadow-[0_14px_34px_rgba(8,8,8,0.06)] dark:border-white/10 dark:bg-[#141414] dark:hover:border-[#ff5a1f]/60 dark:hover:shadow-none"
                    href={method.href}
                    key={`${method.label}-${method.value}`}
                    rel={method.external ? "noreferrer" : undefined}
                    target={method.external ? "_blank" : undefined}
                  >
                    <span className="grid size-11 place-items-center rounded-full bg-[#fff0e9] text-[#ff5a1f] dark:bg-[#ff5a1f]/10">
                      <Icon className="size-5" strokeWidth={1.8} />
                    </span>
                    <span className="mt-5 text-[11px] font-black uppercase tracking-[0.16em] text-[#777771] dark:text-[#a8a8a0]">
                      {method.label}
                    </span>
                    <span className="mt-1 break-words text-[15px] font-black leading-6 transition group-hover:text-[#ff5a1f]">
                      {method.value}
                    </span>
                    <span className="mt-2 text-[12px] leading-5 text-[#686862] dark:text-[#b9b9b1]">
                      {method.description}
                    </span>
                  </a>
                );
              })}
            </address>
          ) : (
            <p className="mt-7 rounded-lg border border-[#e1e1da] bg-white p-5 text-sm text-[#62625c] dark:border-white/10 dark:bg-[#141414] dark:text-[#bdbdb5]">
              Contact details are being updated. Please check again shortly.
            </p>
          )}
        </section>

        <section className="mt-14 grid gap-8 border-y border-[#dfdfd8] py-10 dark:border-white/10 sm:mt-20 sm:py-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <ContentSectionHeading
            description="A little context helps us get you to the right answer faster. Never send card details, passwords or one-time PINs through an ordinary support message."
            eyebrow="Help us help you"
            title="Include the useful details."
          />

          <div className="grid gap-3">
            {[
              {
                copy: "Include the order number, the name used for the order and a short description of what needs attention.",
                label: "Existing order",
              },
              {
                copy: "Share the cylinder size, product or appliance and whether you have an eligible empty cylinder to exchange.",
                label: "Product or exchange question",
              },
              {
                copy: "Provide the suburb and any access details that may affect a safe delivery or cylinder handover.",
                label: "Delivery question",
              },
            ].map((item) => (
              <article
                className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 rounded-lg bg-[#eeeee8] p-4 dark:bg-white/[0.055]"
                key={item.label}
              >
                <span className="grid size-9 place-items-center rounded-full bg-white text-[#ff5a1f] shadow-sm dark:bg-[#1a1a1a]">
                  <Clock3Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-black uppercase">
                    {item.label}
                  </h3>
                  <p className="mt-1 text-[12px] leading-5 text-[#62625c] dark:text-[#bdbdb5]">
                    {item.copy}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-[#ff5a1f]/35 bg-[#fff4ee] p-5 dark:bg-[#ff5a1f]/10 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-[44px_minmax(0,1fr)] sm:items-start">
            <span className="grid size-11 place-items-center rounded-full bg-[#ff5a1f] text-white">
              <AlertTriangleIcon className="size-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-black uppercase">
                Customer support is not an emergency service
              </h2>
              <p className="mt-2 max-w-4xl text-[13px] leading-6 text-[#52524d] dark:text-[#d0d0c8]">
                If there is a gas fire, a strong or persistent gas smell, an
                uncontrolled leak, or an immediate danger to people or property,
                move to safety and contact the appropriate emergency service. From
                a South African mobile phone, dial 112.
              </p>
            </div>
          </div>
        </section>

        {socialLinks.length > 0 ? (
          <section className="mt-12 sm:mt-16">
            <ContentSectionHeading
              description="Follow Jurgens Energy or open a direct WhatsApp conversation. Social platforms are useful for updates; order-specific support is best handled privately."
              eyebrow="Stay connected"
              title="Find us online."
            />
            <div className="mt-6 flex flex-wrap gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;

                return (
                  <a
                    className="inline-flex h-12 items-center gap-3 rounded-lg border border-[#deded7] bg-white px-4 text-[13px] font-black transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/10 dark:bg-[#141414] dark:hover:border-[#ff5a1f]"
                    href={social.href}
                    key={social.label}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Icon />
                    {social.label}
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}
