import Link from "next/link";
import {
  CheckCircle2Icon,
  Clock3Icon,
  MapPinnedIcon,
  RefreshCcwIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "lucide-react";

import { MarketplaceProductCard } from "@/components/marketplace/product-card";
import { createMarketplaceWhatsAppHref } from "@/components/marketplace/marketplace-whatsapp-button";
import { getCurrencyContext } from "@/src/modules/currency/server";
import {
  ContentActionPanel,
  ContentHero,
  ContentSectionHeading,
  NumberedStep,
} from "@/src/modules/marketplace/content/content-page";
import { getMarketplaceCatalog } from "@/src/modules/marketplace/catalog";
import {
  getPublicDeliveryFeeDescription,
  publicDeliveryTimingDescription,
} from "@/src/modules/marketplace/public-delivery-copy";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import {
  createBreadcrumbStructuredData,
  createDeliveryServiceStructuredData,
  createFaqStructuredData,
  MarketplaceJsonLd,
} from "@/src/modules/marketplace/structured-data";

function createDeliveryFaqItems(deliveryFeeDescription: string) {
  return [
  {
    question: "Where does Jurgens Energy deliver?",
    answer:
      "Courier-eligible products can be delivered nationwide within South Africa. Products marked for Jurgens delivery require a postcode in an active Jurgens service area. Checkout confirms eligibility from the complete delivery address.",
  },
  {
    question: "How long does delivery take?",
    answer: publicDeliveryTimingDescription,
  },
  {
    question: "How much does delivery cost?",
    answer: `${deliveryFeeDescription} Courier-provider costs do not change the customer fee.`,
  },
  {
    question: "Can I exchange an empty LPG cylinder during delivery?",
    answer:
      "Yes, when the selected option supports exchanges and the empty cylinder meets the displayed size, type and condition requirements.",
  },
  ] as const;
}

export async function LocalDeliveryPage() {
  const currencyContext = await getCurrencyContext();
  const [catalog, settings] = await Promise.all([
    getMarketplaceCatalog({ currencyContext, limit: 48 }),
    getMarketplaceSettings(),
  ]);
  const deliveryProducts = catalog.products
    .filter((product) => product.fulfillmentMode === "jurgens_fulfilled")
    .slice(0, 8);
  const whatsappHref = settings.whatsappOrderingEnabled
    ? createMarketplaceWhatsAppHref(settings.whatsappBusinessPhoneNumber)
    : null;
  const deliveryFeeDescription = getPublicDeliveryFeeDescription(settings);
  const deliveryFaqItems = createDeliveryFaqItems(deliveryFeeDescription);
  const shippingStructuredData =
    createDeliveryServiceStructuredData(settings);

  return (
    <article>
      <MarketplaceJsonLd
        data={[
          ...(shippingStructuredData ? [shippingStructuredData] : []),
          createBreadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "LPG delivery", path: "/lpg-delivery" },
          ]),
          createFaqStructuredData([...deliveryFaqItems]),
        ]}
      />

      <ContentHero
        breadcrumbLabel="LPG delivery"
        description="Shop eligible LPG cylinders, exchange options and gas accessories online. Courier-eligible goods can ship nationwide within South Africa; Jurgens-delivered products are confirmed from the delivery postcode at checkout. Transit time depends on the destination and delivery service."
        eyebrow="South Africa delivery"
        icon={TruckIcon}
        title="South African delivery, confirmed at checkout."
      />

      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
        <section className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-14">
          <ContentSectionHeading
            description="Choose the exact product online, review the delivery fee before payment and track the order through one checkout. Product-specific safety and handover requirements remain visible throughout."
            eyebrow="Simple online ordering"
            title="From checkout to your door."
          />

          <div className="grid gap-7 sm:grid-cols-3">
            <NumberedStep number="01" title="Choose your product">
              Select a full cylinder, an eligible exchange option or the gas
              accessory you need.
            </NumberedStep>
            <NumberedStep number="02" title="Review delivery">
              Enter your complete South African delivery address and confirm
              product eligibility and the single order-level delivery fee before
              payment.
            </NumberedStep>
            <NumberedStep number="03" title="Receive your order">
              Handling normally takes 0–1 business day. Transit time and tracking
              depend on the destination and delivery service.
            </NumberedStep>
          </div>
        </section>

        <section className="mt-14 grid gap-4 border-y border-[#deded7] py-10 dark:border-white/10 sm:mt-20 sm:grid-cols-2 sm:py-14 lg:grid-cols-4">
          {[
            {
              copy: "Courier-eligible goods can ship nationwide; a Jurgens-delivered product requires an eligible delivery postcode.",
              icon: MapPinnedIcon,
              title: "South Africa coverage",
            },
            {
              copy: "Handling normally takes 0–1 business day after payment confirmation. Transit time depends on the destination and delivery service.",
              icon: Clock3Icon,
              title: "Service-based timing",
            },
            {
              copy: "Exchange pricing is shown only when the required empty-cylinder handover is supported.",
              icon: RefreshCcwIcon,
              title: "Clear exchanges",
            },
            {
              copy: deliveryFeeDescription,
              icon: ShieldCheckIcon,
              title: "One order fee",
            },
          ].map((item) => {
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
                  {item.copy}
                </p>
              </article>
            );
          })}
        </section>

        <section className="mt-14 sm:mt-20">
          <ContentSectionHeading
            description="These products are currently prepared for Jurgens Energy fulfilment. Stock, postcode eligibility and any exchange requirements are confirmed during checkout."
            eyebrow="Shop online"
            title="LPG products for delivery."
          />

          {deliveryProducts.length > 0 ? (
            <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {deliveryProducts.map((product) => (
                <MarketplaceProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-xl border border-[#deded7] bg-white p-6 dark:border-white/10 dark:bg-[#141414]">
              <p className="text-sm font-bold">Delivery products are being updated.</p>
              <Link
                className="mt-3 inline-flex text-[12px] font-black uppercase tracking-[0.08em] text-[#ff5a1f] hover:underline"
                href="/products"
              >
                Browse all available products
              </Link>
            </div>
          )}
        </section>

        <section className="mt-14 sm:mt-20">
          <ContentSectionHeading
            description="The essentials about timing, fees and cylinder exchanges."
            eyebrow="Delivery questions"
            title="Know what to expect."
          />
          <div className="mt-6 overflow-hidden rounded-xl border border-[#deded7] bg-white dark:border-white/10 dark:bg-[#141414]">
            {deliveryFaqItems.map((item, index) => (
              <details
                className="group border-b border-[#e9e9e3] last:border-b-0 dark:border-white/10"
                key={item.question}
                open={index === 0}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-[14px] font-black leading-5 hover:bg-[#fafaf7] dark:hover:bg-white/[0.035] sm:px-6 sm:py-5">
                  {item.question}
                  <CheckCircle2Icon className="size-4 shrink-0 text-[#ff5a1f]" />
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
              whatsappHref
                ? {
                    external: true,
                    href: whatsappHref,
                    label: "Ask on WhatsApp",
                    variant: "secondary" as const,
                  }
                : {
                    href: "/contact",
                    label: "Contact our team",
                    variant: "secondary" as const,
                  },
            ]}
            description="Choose the cylinder or gas product you need online, or ask the team for help before placing an order."
            eyebrow="Ready to order?"
            title="Start with the product you need."
          />
        </div>
      </div>
    </article>
  );
}
