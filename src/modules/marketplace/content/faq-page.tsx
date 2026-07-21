import type { ReactNode } from "react";
import Link from "next/link";
import {
  ChevronDownIcon,
  CircleHelpIcon,
  MessageCircleQuestionIcon,
} from "lucide-react";

import {
  ContentActionPanel,
  ContentHero,
  ContentSectionHeading,
} from "@/src/modules/marketplace/content/content-page";

type FaqItem = {
  answer: ReactNode;
  question: string;
};

type FaqGroup = {
  description: string;
  id: string;
  items: FaqItem[];
  title: string;
};

const faqGroups: FaqGroup[] = [
  {
    description:
      "How ordering, South Africa delivery, timing and support work before an order reaches you.",
    id: "ordering-delivery",
    items: [
      {
        answer: (
          <>
            Browse the store, select the product and available option you need,
            and complete checkout. You can also use the primary WhatsApp action
            when WhatsApp ordering is available. Product availability and the
            applicable fulfilment details are confirmed as part of the order.
          </>
        ),
        question: "How do I place an order?",
      },
      {
        answer: (
          <>
            We deliver eligible online-store orders within South Africa.
            Enter your complete delivery address during checkout to confirm the
            available option and fee for the selected products. Read the full{" "}
            <Link
              className="font-bold text-[#ff5a1f] hover:underline"
              href="/delivery-information"
            >
              shipping and delivery policy
            </Link>{" "}
            for delivery and handover details.
          </>
        ),
        question: "Where do you deliver?",
      },
      {
        answer: (
          <>
            Handling takes 0–1 business day after payment confirmation. Our order
            cutoff is 2:00 PM SAST on business days, and an order placed after the
            cutoff begins processing on the next business day. Handling does not
            begin before payment is confirmed. Shipping then takes an estimated
            1–3 business days after dispatch, giving an estimated total delivery
            time of 1–4 business days. These times are estimates; stock, courier or
            vehicle capacity, weather, traffic, access and LPG safety requirements
            can affect them.
          </>
        ),
        question: "How quickly will my order arrive?",
      },
      {
        answer: (
          <>
            Contact the team as soon as possible with the order number and the
            requested change. Whether a change or cancellation is possible depends
            on payment and fulfilment status. See the{" "}
            <Link className="font-bold text-[#ff5a1f] hover:underline" href="/returns-and-refunds">
              Returns &amp; Refunds Policy
            </Link>{" "}
            for the applicable process.
          </>
        ),
        question: "Can I change or cancel an order?",
      },
    ],
    title: "Ordering & delivery",
  },
  {
    description:
      "What an exchange price means and what must be available at the cylinder handover.",
    id: "cylinder-exchange",
    items: [
      {
        answer: (
          <>
            An exchange-supported option assumes that you will hand over the
            eligible empty cylinder described on the product or selected variant.
            The full replacement cylinder is supplied as the empty cylinder is
            collected at the same handover.
          </>
        ),
        question: "How does a cylinder exchange work?",
      },
      {
        answer: (
          <>
            Check the exact exchange requirement shown on the product. Size, type,
            brand or ownership rules and condition may affect eligibility. Confirm
            the requirement before checkout rather than assuming that any empty
            cylinder can be exchanged.
          </>
        ),
        question: "Which empty cylinder can I exchange?",
      },
      {
        answer: (
          <>
            Choose a full-cylinder purchase rather than an exchange-supported
            price. If the expected empty cylinder is not available at handover,
            contact the team so the available correction, price difference,
            reschedule or cancellation options can be explained.
          </>
        ),
        question: "What if I do not have an empty cylinder?",
      },
      {
        answer: (
          <>
            A leaking, modified, illegally filled, severely damaged or otherwise
            unsafe cylinder may be refused. Do not try to repair, vent or refill it
            yourself. Keep people and ignition sources away and get guidance from a
            qualified LPG professional if the cylinder may be unsafe.
          </>
        ),
        question: "Will a damaged or leaking cylinder be accepted?",
      },
    ],
    title: "Cylinder exchange",
  },
  {
    description:
      "Choosing compatible equipment and knowing when a registered practitioner is required.",
    id: "products-safety",
    items: [
      {
        answer: (
          <>
            Match the cylinder, regulator, hose, connection and appliance to the
            manufacturer’s specifications. Product names alone do not prove
            compatibility. If the appliance or installation requirement is unclear,
            ask the manufacturer or a registered LPG practitioner before purchase
            or connection.
          </>
        ),
        question: "How do I choose the correct cylinder or regulator?",
      },
      {
        answer: (
          <>
            Gas installation work should be completed by a practitioner registered
            for the appropriate LPG scope. Ask to see the installer’s valid SAQCC Gas
            registration and obtain the required Certificate of Conformity for the
            completed installation. Our{" "}
            <Link className="font-bold text-[#ff5a1f] hover:underline" href="/lpg-safety">
              LPG safety guide
            </Link>{" "}
            has practical starting points and official resources.
          </>
        ),
        question: "Can I install an LPG appliance myself?",
      },
      {
        answer: (
          <>
            Do not use a naked flame. Follow the appliance and regulator
            instructions and use a soapy-water solution on accessible joints; new
            bubbles can indicate a leak. Close the supply if it is safe to do so,
            stop using the equipment and contact a qualified LPG professional if
            you suspect a leak.
          </>
        ),
        question: "How can I check a connection for a leak?",
      },
    ],
    title: "Products & safety",
  },
  {
    description:
      "Pricing, returns and the best way to get an order-specific issue resolved.",
    id: "payments-support",
    items: [
      {
        answer: (
          <>
            Store product prices are VAT-inclusive unless a product clearly states
            otherwise. Delivery, handling, deposit, exchange or other applicable
            charges are displayed separately before the order is confirmed where
            they apply.
          </>
        ),
        question: "Do displayed prices include VAT?",
      },
      {
        answer: (
          <>
            Stop using an item if continued use may create a safety risk. Contact
            Jurgens Energy promptly with the order number, a clear description and,
            where useful, photographs. The team may request product, serial, batch
            or packaging details so the correct remedy can be assessed.
          </>
        ),
        question: "What if the item is incorrect, damaged or defective?",
      },
      {
        answer: (
          <>
            Eligible online purchases have applicable seven-day cooling-off
            rights, and we also accept eligible new and unused voluntary returns
            when you contact us within seven calendar days after receipt. You pay
            the direct return courier cost for an eligible cooling-off or
            voluntary change-of-mind return. Jurgens Energy covers qualifying
            return transport for verified incorrect, damaged, unsafe or defective
            goods where required by law. Read the{" "}
            <Link
              className="font-bold text-[#ff5a1f] hover:underline"
              href="/returns-and-refunds"
            >
              Returns &amp; Refunds Policy
            </Link>{" "}
            and contact the team before returning anything. Never send LPG or a
            filled cylinder through an ordinary parcel service.
          </>
        ),
        question: "How do returns and refunds work?",
      },
      {
        answer: (
          <>
            Use the details on the{" "}
            <Link className="font-bold text-[#ff5a1f] hover:underline" href="/contact">
              contact page
            </Link>
            . Include the order number, name used for the order and a concise
            description. Never include card details, passwords or one-time PINs in
            a normal support message.
          </>
        ),
        question: "What should I include when asking for support?",
      },
    ],
    title: "Payments, returns & support",
  },
];

export const faqStructuredDataItems = [
  {
    question: "How do I place an order?",
    answer:
      "Browse the store, select the product and available option you need, and complete checkout. When WhatsApp ordering is available, you can also start from the primary WhatsApp action.",
  },
  {
    question: "Where do you deliver?",
    answer:
      "Jurgens Energy delivers eligible online-store orders within South Africa. Enter the complete delivery address during checkout to confirm the available option and fee for the selected products.",
  },
  {
    question: "How quickly will my order arrive?",
    answer:
      "Handling takes 0–1 business day after payment confirmation. The order cutoff is 2:00 PM SAST on business days, and an order placed after the cutoff begins processing on the next business day. Handling does not begin before payment is confirmed. Shipping takes an estimated 1–3 business days after dispatch, giving an estimated total delivery time of 1–4 business days. Stock, transport capacity, weather, traffic, access and LPG safety requirements can affect timing.",
  },
  {
    question: "How does a cylinder exchange work?",
    answer:
      "An exchange-supported option assumes that the eligible empty cylinder described on the product or selected variant will be handed over as the full replacement cylinder is delivered.",
  },
  {
    question: "Do displayed prices include VAT?",
    answer:
      "Store product prices are VAT-inclusive unless a product clearly states otherwise. Applicable delivery, handling, deposit, exchange or other charges are displayed separately before the order is confirmed.",
  },
  {
    question: "How do returns and refunds work?",
    answer:
      "Eligible online purchases have applicable seven-day cooling-off rights, and Jurgens Energy also accepts eligible new and unused voluntary returns when the customer contacts us within seven calendar days after receipt. The customer pays the direct return courier cost for an eligible cooling-off or voluntary change-of-mind return. Jurgens Energy covers qualifying incorrect, damaged, unsafe or defective return transport where required by law.",
  },
] as const;

export function FaqPage() {
  return (
    <article>
      <ContentHero
        breadcrumbLabel="FAQs"
        description="Clear answers to common questions about LPG orders, delivery, cylinder exchanges, product safety, returns and support."
        eyebrow="Frequently asked questions"
        icon={MessageCircleQuestionIcon}
        title="Start with an answer."
      />

      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
        <section className="grid gap-7 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-10">
          <aside className="lg:sticky lg:top-[140px]">
            <nav
              aria-label="FAQ categories"
              className="overflow-hidden rounded-xl border border-[#e1e1da] bg-white p-2 dark:border-white/10 dark:bg-[#141414]"
            >
              <p className="flex items-center gap-2 border-b border-[#ecece6] px-3 py-3 text-[11px] font-black uppercase tracking-[0.14em] dark:border-white/10">
                <CircleHelpIcon className="size-4 text-[#ff5a1f]" />
                Browse questions
              </p>
              <div className="mt-1 grid gap-1">
                {faqGroups.map((group) => (
                  <a
                    className="rounded-md px-3 py-2.5 text-[12px] font-bold text-[#62625c] transition hover:bg-[#f7f7f2] hover:text-[#080808] dark:text-[#bdbdb5] dark:hover:bg-white/[0.06] dark:hover:text-white"
                    href={`#${group.id}`}
                    key={group.id}
                  >
                    {group.title}
                  </a>
                ))}
              </div>
            </nav>
          </aside>

          <div className="min-w-0 space-y-11 sm:space-y-14">
            {faqGroups.map((group) => (
              <section
                className="scroll-mt-[140px]"
                id={group.id}
                key={group.id}
              >
                <ContentSectionHeading
                  description={group.description}
                  eyebrow="Questions & answers"
                  title={group.title}
                />

                <div className="mt-5 overflow-hidden rounded-xl border border-[#e1e1da] bg-white dark:border-white/10 dark:bg-[#141414]">
                  {group.items.map((item, index) => (
                    <details
                      className="group border-b border-[#e9e9e3] last:border-b-0 dark:border-white/10"
                      key={item.question}
                      open={index === 0}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-[14px] font-black leading-5 transition hover:bg-[#fafaf7] dark:hover:bg-white/[0.035] sm:px-6 sm:py-5 sm:text-[15px] [&::-webkit-details-marker]:hidden">
                        <span>{item.question}</span>
                        <ChevronDownIcon className="size-[18px] shrink-0 text-[#ff5a1f] transition group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-[#eeeee8] px-4 py-4 text-[13px] leading-6 text-[#5f5f59] dark:border-white/[0.08] dark:text-[#c3c3bb] sm:px-6 sm:py-5 sm:text-[14px] sm:leading-7">
                        {item.answer}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <div className="mt-12 sm:mt-16">
          <ContentActionPanel
            actions={[
              { href: "/contact", label: "Contact our team" },
              {
                href: "/products",
                label: "Browse products",
                variant: "secondary",
              },
            ]}
            description="Tell us which product, cylinder size or order you are asking about, and we’ll help with the next step."
            eyebrow="Still need help?"
            title="Ask a more specific question."
          />
        </div>
      </div>
    </article>
  );
}
