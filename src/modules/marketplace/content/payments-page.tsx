import Image from "next/image";
import {
  CheckCircle2Icon,
  CreditCardIcon,
  FileTextIcon,
  RefreshCcwIcon,
  ShieldCheckIcon,
  WalletCardsIcon,
} from "lucide-react";

import {
  ContentActionPanel,
  ContentHero,
  ContentSectionHeading,
} from "@/src/modules/marketplace/content/content-page";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";

const paymentHighlights = [
  {
    description:
      "Checkout redirects to the secure PayFast hosted payment page before money is taken.",
    icon: ShieldCheckIcon,
    title: "Secure hosted checkout",
  },
  {
    description:
      "Product prices, delivery fees and order totals are shown clearly in South African rand.",
    icon: WalletCardsIcon,
    title: "Clear ZAR totals",
  },
  {
    description:
      "An order is treated as paid only after PayFast confirms successful payment.",
    icon: CheckCircle2Icon,
    title: "Confirmed before fulfilment",
  },
  {
    description:
      "Invoices are generated after payment and are emailed when ready. They are also available from your account.",
    icon: FileTextIcon,
    title: "Invoice support",
  },
] as const;

export async function PaymentsPage() {
  const settings = await getMarketplaceSettings();

  return (
    <article>
      <ContentHero
        breadcrumbLabel="Payments"
        description="Pay online through a secure hosted checkout. The total shown before payment is the customer-facing amount for the order."
        eyebrow="Payment information"
        icon={CreditCardIcon}
        title="Secure online payments."
      />

      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
        <section className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-14">
          <ContentSectionHeading
            description="Use this page to confirm how payments work before placing an order. Payment availability and the final payable total are shown during checkout."
            eyebrow="How payment works"
            title="Review, pay, then receive updates."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {paymentHighlights.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  className="rounded-xl border border-[#deded7] bg-white p-5 dark:border-white/10 dark:bg-[#141414]"
                  key={item.title}
                >
                  <span className="grid size-10 place-items-center rounded-full bg-[#fff0e9] text-[#ff5a1f] dark:bg-[#ff5a1f]/10">
                    <Icon className="size-5" />
                  </span>
                  <h2 className="mt-4 text-[14px] font-black uppercase">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-[12px] leading-5 text-[#66665f] dark:text-[#bdbdb5]">
                    {item.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-14 grid gap-8 border-y border-[#deded7] py-10 dark:border-white/10 sm:mt-20 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]">
          <div className="min-w-0">
            <ContentSectionHeading
              description="The available methods are shown on the hosted payment page before you confirm payment."
              eyebrow="Payment methods"
              title="PayFast hosted checkout."
            />
            <div className="mt-6 rounded-xl border border-[#deded7] bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
              <p className="text-[13px] leading-6 text-[#5f5f59] dark:text-[#c3c3bb]">
                Jurgens Energy uses PayFast by Network for online payments.
                Depending on PayFast availability and your device, the hosted
                checkout may offer card payments, instant EFT, wallet options
                or supported scan-to-pay methods. Choose a method on PayFast,
                then return to Jurgens Energy after payment.
              </p>
              <p className="mt-4 text-[13px] leading-6 text-[#5f5f59] dark:text-[#c3c3bb]">
                If a payment is cancelled or fails, the order is not fulfilled
                and you can retry payment where the payment window is still
                open. Contact support if you paid but your order still shows
                unpaid.
              </p>
            </div>
          </div>

          <aside className="min-w-0 rounded-xl border border-[#deded7] bg-[#fbfbf8] p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <h2 className="text-[13px] font-black uppercase">
              Public payment badges
            </h2>
            {settings.paymentMethodBadges.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-3">
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
            ) : (
              <p className="mt-3 text-[13px] leading-6 text-[#5f5f59] dark:text-[#c3c3bb]">
                Payment methods are shown on the hosted PayFast checkout page.
              </p>
            )}
          </aside>
        </section>

        <section className="mt-14 sm:mt-20">
          <ContentSectionHeading
            description="What to expect after a payment attempt."
            eyebrow="Payment questions"
            title="Short answers."
          />
          <div className="mt-6 overflow-hidden rounded-xl border border-[#deded7] bg-white dark:border-white/10 dark:bg-[#141414]">
            {[
              {
                answer:
                  "No. Products are released for fulfilment only after PayFast confirms the payment.",
                question: "Is my order fulfilled before payment is confirmed?",
              },
              {
                answer:
                  "Your invoice may take a moment to prepare. You do not need to wait on the confirmation page; it will be emailed when ready and available from your account.",
                question: "Where do I get my invoice?",
              },
              {
                answer:
                  "If PayFast reports a failed or cancelled payment, your order is not treated as paid. You can retry payment where the payment window is still open.",
                question: "What happens if payment fails?",
              },
              {
                answer:
                  "Contact support with your order number, payment amount and PayFast reference if you have one.",
                question: "What if I paid but the order still looks unpaid?",
              },
            ].map((item, index) => (
              <details
                className="group border-b border-[#e9e9e3] last:border-b-0 dark:border-white/10"
                key={item.question}
                open={index === 0}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-[14px] font-black leading-5 hover:bg-[#fafaf7] dark:hover:bg-white/[0.035] sm:px-6 sm:py-5">
                  {item.question}
                  <RefreshCcwIcon className="size-4 shrink-0 text-[#ff5a1f]" />
                </summary>
                <p className="border-t border-[#eeeee8] px-4 py-4 text-[13px] leading-6 text-[#5f5f59] dark:border-white/[0.08] dark:text-[#c3c3bb] sm:px-6 sm:py-5 sm:text-[14px]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-12 sm:mt-16">
          <ContentActionPanel
            actions={[
              { href: "/products", label: "Shop products" },
              { href: "/support", label: "Get support", variant: "secondary" },
            ]}
            description="Need help with a payment or invoice? Contact support and include your order number if you have one."
            eyebrow="Need payment help?"
            title="Contact support."
          />
        </div>
      </div>
    </article>
  );
}
