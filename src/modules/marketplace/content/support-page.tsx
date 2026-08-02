import Link from "next/link";
import {
  CreditCardIcon,
  HelpCircleIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PackageSearchIcon,
  PhoneIcon,
  RefreshCcwIcon,
  ShoppingBagIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react";

import { createMarketplaceWhatsAppHref } from "@/components/marketplace/marketplace-whatsapp-button";
import { PublicEmailAddress } from "@/components/marketplace/public-email-address";
import {
  ContentActionPanel,
  ContentHero,
  ContentSectionHeading,
} from "@/src/modules/marketplace/content/content-page";
import { getCustomerSupportContactDetails } from "@/src/modules/customer-support/server";

type SupportContactMethod = {
  external: boolean;
  href: string | null;
  icon: LucideIcon;
  label: string;
  value: string;
};

const supportTopics = [
  {
    description:
      "Browse current products, compare options and review product-specific requirements before checkout.",
    href: "/products",
    icon: ShoppingBagIcon,
    title: "Products",
  },
  {
    description:
      "Review South Africa delivery timing, fees, product handling and order handover information.",
    href: "/delivery-information",
    icon: TruckIcon,
    title: "Delivery",
  },
  {
    description:
      "Confirm how PayFast hosted checkout works and what happens after payment.",
    href: "/payments",
    icon: CreditCardIcon,
    title: "Payments",
  },
  {
    description:
      "Read the current returns, exchange, refund and return-cost rules before sending anything back.",
    href: "/returns-and-refunds",
    icon: RefreshCcwIcon,
    title: "Returns",
  },
  {
    description:
      "Sign in to review order status, invoices, delivery details and available customer actions.",
    href: "/account/orders",
    icon: PackageSearchIcon,
    title: "My orders",
  },
  {
    description:
      "Find quick answers about ordering, availability, delivery, payments and support.",
    href: "/faq",
    icon: HelpCircleIcon,
    title: "FAQs",
  },
] as const;

function phoneHref(phoneNumber: string) {
  const dialableNumber = phoneNumber.replace(/[^\d+]/g, "");

  return dialableNumber ? `tel:${dialableNumber}` : null;
}

export async function SupportPage() {
  const support = await getCustomerSupportContactDetails();
  const whatsappUrl = createMarketplaceWhatsAppHref(support.whatsappPhone);
  const contactMethods: SupportContactMethod[] = [
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
          href: null,
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
          label: "WhatsApp support",
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
  ].filter((method): method is SupportContactMethod => Boolean(method));

  return (
    <article>
      <ContentHero
        breadcrumbLabel="Support"
        description="Get help with products, online orders, payments, delivery, returns and account questions."
        eyebrow="Support centre"
        icon={HelpCircleIcon}
        title="How can we help?"
      />

      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
        <section>
          <ContentSectionHeading
            description="Start with the topic that matches what you need. If you still need help, use the contact details below."
            eyebrow="Start here"
            title="Common support topics."
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {supportTopics.map((topic) => {
              const Icon = topic.icon;

              return (
                <Link
                  className="group rounded-xl border border-[#deded7] bg-white p-5 transition hover:border-[#ff5a1f]/55 hover:shadow-[0_16px_35px_rgba(8,8,8,0.06)] dark:border-white/10 dark:bg-[#141414]"
                  href={topic.href}
                  key={topic.title}
                >
                  <span className="grid size-10 place-items-center rounded-full bg-[#fff0e9] text-[#ff5a1f] dark:bg-[#ff5a1f]/10">
                    <Icon className="size-5" />
                  </span>
                  <h2 className="mt-4 text-[14px] font-black uppercase transition group-hover:text-[#ff5a1f]">
                    {topic.title}
                  </h2>
                  <p className="mt-2 text-[12px] leading-5 text-[#66665f] dark:text-[#bdbdb5]">
                    {topic.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-14 grid gap-9 border-y border-[#deded7] py-10 dark:border-white/10 sm:mt-20 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)] lg:gap-14">
          <div className="min-w-0">
            <ContentSectionHeading
              description="Use these details for online order support, product questions, delivery help, payment queries and return requests."
              eyebrow="Contact options"
              title="Reach Jurgens Energy."
            />

            {contactMethods.length > 0 ? (
              <address className="mt-7 divide-y divide-[#deded7] overflow-hidden rounded-xl border border-[#deded7] bg-white not-italic dark:divide-white/10 dark:border-white/10 dark:bg-[#141414]">
                {contactMethods.map((method) => {
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
                        {method.value.includes("@") ? (
                          <PublicEmailAddress
                            className="mt-1 block break-words text-[15px] font-black text-[#080808] transition group-hover:text-[#ff5a1f] dark:text-[#f7f7f2]"
                            email={method.value}
                          />
                        ) : (
                          <span className="mt-1 block break-words text-[15px] font-black text-[#080808] transition group-hover:text-[#ff5a1f] dark:text-[#f7f7f2]">
                            {method.value}
                          </span>
                        )}
                      </span>
                    </>
                  );

                  return method.href ? (
                    <a
                      className="group grid min-w-0 grid-cols-[42px_minmax(0,1fr)] gap-3 px-4 py-5 transition hover:text-[#ff5a1f] sm:px-5"
                      href={method.href}
                      key={`${method.label}-${method.value}`}
                      rel={method.external ? "noreferrer" : undefined}
                      target={method.external ? "_blank" : undefined}
                    >
                      {content}
                    </a>
                  ) : (
                    <div
                      className="grid min-w-0 grid-cols-[42px_minmax(0,1fr)] gap-3 px-4 py-5 sm:px-5"
                      key={`${method.label}-${method.value}`}
                    >
                      {content}
                    </div>
                  );
                })}
              </address>
            ) : (
              <p className="mt-7 rounded-xl border border-[#deded7] bg-white p-5 text-sm leading-6 text-[#5f5f59] dark:border-white/10 dark:bg-[#141414] dark:text-[#bdbdb5]">
                Contact details are being updated. Please use the contact form.
              </p>
            )}
          </div>

          <aside className="min-w-0 rounded-xl border border-[#deded7] bg-[#fbfbf8] p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <h2 className="text-[13px] font-black uppercase">
              Online-only support note
            </h2>
            <p className="mt-3 text-[13px] leading-6 text-[#5f5f59] dark:text-[#c3c3bb]">
              Jurgens Energy is an online store. We do not operate a public
              walk-in shop, customer collection counter or returns counter.
              Orders, payments and customer support are handled online.
            </p>
            <p className="mt-4 text-[13px] leading-6 text-[#5f5f59] dark:text-[#c3c3bb]">
              For returns, contact support first and wait for approval before
              sending goods by courier.
            </p>
          </aside>
        </section>

        <div className="mt-12 sm:mt-16">
          <ContentActionPanel
            actions={[
              { href: "/contact", label: "Contact us" },
              { href: "/faq", label: "Read FAQs", variant: "secondary" },
            ]}
            description="If a topic page does not answer your question, send us the details and include your order number where available."
            eyebrow="Still need help?"
            title="Send the support team a message."
          />
        </div>
      </div>
    </article>
  );
}
