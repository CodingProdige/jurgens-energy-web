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
  formatPublicBusinessDayRange,
  getPublicDeliveryFeeDescription,
  getPublicDeliveryTiming,
  getPublicDeliveryTimingDescription,
} from "@/src/modules/marketplace/public-delivery-copy";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import {
  createBreadcrumbStructuredData,
  createDeliveryServiceStructuredData,
  createFaqStructuredData,
  MarketplaceJsonLd,
} from "@/src/modules/marketplace/structured-data";

function createDeliveryFaqItems(
  deliveryFeeDescription: string,
  deliveryTimingDescription: string,
) {
  return [
    {
      question: "Where does Jurgens Energy deliver?",
      answer:
        "Jurgens Energy offers nationwide delivery within South Africa. Some Jurgens-delivered products use active local service-area postcodes. Checkout shows the final delivery option from the complete delivery address before payment.",
    },
    {
      question: "How long does delivery take?",
      answer: deliveryTimingDescription,
    },
    {
      question: "How much does delivery cost?",
      answer: deliveryFeeDescription,
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
  const deliveryTiming = getPublicDeliveryTiming(settings);
  const deliveryTimingDescription =
    getPublicDeliveryTimingDescription(settings);
  const deliveryTimingLabel = formatPublicBusinessDayRange(
    deliveryTiming.totalMinBusinessDays,
    deliveryTiming.totalMaxBusinessDays,
  );
  const deliveryFaqItems = createDeliveryFaqItems(
    deliveryFeeDescription,
    deliveryTimingDescription,
  );
  const shippingStructuredData =
    createDeliveryServiceStructuredData(settings);

  return (
    <article>
      <MarketplaceJsonLd
        data={[
          ...(shippingStructuredData ? [shippingStructuredData] : []),
          createBreadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "Delivery", path: "/lpg-delivery" },
          ]),
          createFaqStructuredData([...deliveryFaqItems]),
        ]}
      />

      <ContentHero
        breadcrumbLabel="Delivery"
        description={`Shop online for delivery in South Africa. ${deliveryTimingDescription} ${deliveryFeeDescription}`}
        eyebrow="South Africa delivery"
        icon={TruckIcon}
        title="Nationwide delivery, clear timing."
      />

      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
        <section className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-14">
          <ContentSectionHeading
            description="Choose your product, enter your South African delivery address, and review the standard delivery fee before payment."
            eyebrow="Simple online ordering"
            title="From checkout to your door."
          />

          <div className="grid gap-7 sm:grid-cols-3">
            <NumberedStep number="01" title="Choose your product">
              Select the product or available option you need.
            </NumberedStep>
            <NumberedStep number="02" title="Review delivery">
              Enter your South African delivery address and review the delivery
              fee before payment.
            </NumberedStep>
            <NumberedStep number="03" title="Receive your order">
              {deliveryTimingDescription}
            </NumberedStep>
          </div>
        </section>

        <section className="mt-14 grid gap-4 border-y border-[#deded7] py-10 dark:border-white/10 sm:mt-20 sm:grid-cols-2 sm:py-14 lg:grid-cols-4">
          {[
            {
              copy: "Nationwide delivery is available across South Africa. Some Jurgens-delivered products use active local service-area postcodes.",
              icon: MapPinnedIcon,
              title: "South Africa coverage",
            },
            {
              copy: deliveryTimingDescription,
              icon: Clock3Icon,
              title: deliveryTimingLabel,
            },
            {
              copy: "Exchange pricing is shown only when the required empty-cylinder handover is supported.",
              icon: RefreshCcwIcon,
              title: "Clear exchanges",
            },
            {
              copy: deliveryFeeDescription,
              icon: ShieldCheckIcon,
              title: "Delivery fee",
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
            description="Stock, final delivery details and any exchange requirements are shown during checkout."
            eyebrow="Shop online"
            title="Products for delivery."
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
            description="Choose the product you need online, or ask the team for help before placing an order."
            eyebrow="Ready to order?"
            title="Start with the product you need."
          />
        </div>
      </div>
    </article>
  );
}
