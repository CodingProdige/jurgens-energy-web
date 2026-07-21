import {
  AlertTriangleIcon,
  type LucideIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  ShoppingBagIcon,
} from "lucide-react";

import { createMarketplaceWhatsAppHref } from "@/components/marketplace/marketplace-whatsapp-button";
import { getCustomerSupportContactDetails } from "@/src/modules/customer-support/server";
import {
  ContactForm,
  type ContactInquiryAction,
} from "@/src/modules/marketplace/content/contact-form";

type ContactMethod = {
  external: boolean;
  href: string | null;
  icon: LucideIcon;
  label: string;
  value: string;
};

function phoneHref(phoneNumber: string) {
  const dialableNumber = phoneNumber.replace(/[^\d+]/g, "");

  return dialableNumber ? `tel:${dialableNumber}` : null;
}

export async function ContactPage({ action }: { action: ContactInquiryAction }) {
  const support = await getCustomerSupportContactDetails();
  const whatsappUrl = createMarketplaceWhatsAppHref(support.whatsappPhone);
  const supportMethods: ContactMethod[] = [
    ...support.phoneNumbers.flatMap((phoneNumber, index) => {
      const href = phoneHref(phoneNumber);

      return href
        ? [
            {
              href,
              icon: PhoneIcon,
              label: index === 0 ? "Customer support" : "Alternate phone",
              value: phoneNumber,
              external: false,
            },
          ]
        : [];
    }),
    support.email
      ? {
          href: `mailto:${support.email}`,
          icon: MailIcon,
          label: "Email support",
          value: support.email,
          external: false,
        }
      : null,
    whatsappUrl
      ? {
          href: whatsappUrl,
          icon: MessageCircleIcon,
          label: "WhatsApp",
          value: support.whatsappPhone ?? "Start a chat",
          external: true,
        }
      : null,
    support.businessAddress
      ? {
          href: null,
          icon: MapPinIcon,
          label: "Registered business address",
          value: support.businessAddress,
          external: false,
        }
      : null,
  ].filter((method): method is ContactMethod => Boolean(method));

  return (
    <article className="border-b border-[#e7e7e0] bg-[#fbfbf8] text-[#080808] dark:border-white/10 dark:bg-[#0d0d0d] dark:text-[#f7f7f2]">
      <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-4 py-10 sm:px-7 sm:py-14 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)] lg:gap-16 lg:px-10 lg:py-16">
        <section className="min-w-0" aria-labelledby="contact-page-title">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff5a1f]">
            Contact Jurgens Energy
          </p>
          <h1
            className="mt-3 text-[34px] font-black uppercase leading-none tracking-[-0.03em] sm:text-[46px]"
            id="contact-page-title"
          >
            Get in touch
          </h1>
          <p className="mt-4 max-w-2xl text-[14px] leading-7 text-[#5f5f59] dark:text-[#bdbdb5] sm:text-[15px]">
            Need help with a product, an online order, delivery or a return?
            Send us a message and our support team will reply by email.
          </p>

          <ContactForm action={action} />
        </section>

        <aside className="min-w-0 lg:border-l lg:border-[#deded7] lg:pl-12 dark:lg:border-white/10">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff5a1f]">
            Contact options
          </p>
          <h2 className="mt-3 text-[28px] font-black uppercase leading-none tracking-[-0.025em] sm:text-[34px]">
            Support details
          </h2>

          {supportMethods.length > 0 ? (
            <address className="mt-7 divide-y divide-[#deded7] border-y border-[#deded7] not-italic dark:divide-white/10 dark:border-white/10">
              {supportMethods.map((method) => {
                const Icon = method.icon;

                const content = (
                  <>
                    <span className="grid size-10 place-items-center rounded-full bg-[#fff0e9] text-[#ff5a1f] dark:bg-[#ff5a1f]/10">
                      <Icon className="size-5" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold text-[#666660] dark:text-[#aaa9a2]">
                        {method.label}
                      </span>
                      <span className="mt-1 block break-words text-[15px] font-black text-[#080808] transition group-hover:text-[#ff5a1f] dark:text-[#f7f7f2]">
                        {method.value}
                      </span>
                    </span>
                  </>
                );

                return method.href ? (
                  <a
                    className="group grid min-w-0 grid-cols-[42px_minmax(0,1fr)] gap-3 py-5 transition hover:text-[#ff5a1f]"
                    href={method.href}
                    key={`${method.label}-${method.value}`}
                    rel={method.external ? "noreferrer" : undefined}
                    target={method.external ? "_blank" : undefined}
                  >
                    {content}
                  </a>
                ) : (
                  <div
                    className="grid min-w-0 grid-cols-[42px_minmax(0,1fr)] gap-3 py-5"
                    key={`${method.label}-${method.value}`}
                  >
                    {content}
                  </div>
                );
              })}
            </address>
          ) : (
            <p className="mt-7 text-sm leading-6 text-[#5f5f59] dark:text-[#bdbdb5]">
              Contact details are being updated. Please use the message form.
            </p>
          )}

          <section className="mt-7 rounded-lg border border-[#deded7] bg-white p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-start gap-3">
              <ShoppingBagIcon className="mt-0.5 size-5 shrink-0 text-[#ff5a1f]" />
              <div>
                <h3 className="text-[13px] font-black uppercase">
                  Online-only store
                </h3>
                <p className="mt-2 text-[13px] leading-6 text-[#5f5f59] dark:text-[#bdbdb5]">
                  JurgensEnergy.com has no public walk-in shop or returns
                  counter. Place orders online and contact us before sending an
                  approved return by courier.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-lg border border-[#ff5a1f]/30 bg-[#fff4ee] p-4 dark:bg-[#ff5a1f]/10">
            <div className="flex items-start gap-3">
              <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-[#ff5a1f]" />
              <p className="text-[12px] leading-5 text-[#55554f] dark:text-[#cecec7]">
                <strong className="font-black text-[#080808] dark:text-white">
                  LPG emergency:
                </strong>{" "}
                Move to safety and call 112 from a South African mobile for a
                fire, strong gas smell or uncontrolled leak. Customer support
                is not an emergency service.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </article>
  );
}
