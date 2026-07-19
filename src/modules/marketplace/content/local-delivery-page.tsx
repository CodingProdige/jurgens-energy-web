import Link from "next/link";
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  MapPinIcon,
  PackageCheckIcon,
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
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import {
  createBreadcrumbStructuredData,
  createDeliveryServiceStructuredData,
  createFaqStructuredData,
  MarketplaceJsonLd,
} from "@/src/modules/marketplace/structured-data";
import {
  getJurgensDeliveryZones,
  type JurgensDeliveryZone,
} from "@/src/modules/shipping/jurgens-delivery";
import { getJurgensImplicitFreeDeliveryThreshold } from "@/src/modules/shipping/jurgens-delivery-pricing";

const localDeliveryFaqItems = [
  {
    question: "How do I confirm whether Jurgens Energy delivers to my address?",
    answer:
      "Jurgens Energy local delivery is available only to addresses whose postal codes fall within a supported active local zone shown on this page. Enter the complete address and postal code during checkout; checkout is the final confirmation of availability and cost before payment.",
  },
  {
    question: "Can I exchange an empty LPG cylinder during delivery?",
    answer:
      "Yes, when the selected product option is marked as exchange supported and the empty cylinder satisfies the size, type, brand, ownership and condition requirements displayed for that option.",
  },
  {
    question: "Can I request a preferred delivery date?",
    answer:
      "A preferred date can be requested for eligible Jurgens Energy fulfilled items. It remains subject to the configured cut-off time, route capacity, payment confirmation, stock and safe access. If no date is selected, the delivery is placed into the normal route planning flow.",
  },
  {
    question: "What happens when my cart also contains courier products?",
    answer:
      "Jurgens Energy local delivery applies only to eligible locally fulfilled items. Courier-fulfilled products are quoted separately at checkout, so a free local-delivery tier does not remove a courier charge that applies to another item.",
  },
] as const;

export async function LocalDeliveryPage() {
  const currencyContext = await getCurrencyContext();
  const [catalog, settings, zones] = await Promise.all([
    getMarketplaceCatalog({ currencyContext, limit: 48 }),
    getMarketplaceSettings(),
    getJurgensDeliveryZones({ activeOnly: true }),
  ]);
  const localProducts = catalog.products
    .filter((product) => product.fulfillmentMode === "piessang_fulfilled")
    .slice(0, 8);
  const areaNames = zones.map((zone) => zone.name);
  const whatsappHref = settings.whatsappOrderingEnabled
    ? createMarketplaceWhatsAppHref(settings.whatsappBusinessPhoneNumber)
    : null;

  return (
    <article>
      <MarketplaceJsonLd
        data={[
          createDeliveryServiceStructuredData({ areaNames }),
          createBreadcrumbStructuredData([
            { name: "Home", path: "/" },
            { name: "LPG delivery", path: "/lpg-delivery" },
          ]),
          createFaqStructuredData([...localDeliveryFaqItems]),
        ]}
      />

      <ContentHero
        breadcrumbLabel="LPG delivery"
        description="Order eligible LPG cylinders and gas products only within the supported local postal-code zones shown below. Checkout confirms availability and the applicable delivery cost before payment."
        eyebrow="Local LPG delivery"
        icon={TruckIcon}
        title="LPG delivered with the right handover."
      />

      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
        <section className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-start lg:gap-14">
          <ContentSectionHeading
            description="The areas and postal codes below are the currently supported Jurgens Energy local delivery zones. Local delivery is not available to every South African address, and checkout remains the final confirmation because the product, exact address, order value and route conditions all matter."
            eyebrow="Current coverage"
            title="Check the local delivery areas."
          />

          {zones.length > 0 ? (
            <div className="grid gap-3">
              {zones.map((zone) => (
                <DeliveryZoneCard key={zone.id} zone={zone} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-[#deded7] bg-white p-6 dark:border-white/10 dark:bg-[#141414]">
              <p className="text-sm font-bold">Coverage is being updated.</p>
              <p className="mt-2 text-[13px] leading-6 text-[#66665f] dark:text-[#bdbdb5]">
                No local postal-code coverage is currently published. Enter
                your address during checkout or contact the team before
                ordering; do not assume local delivery is available until it is
                confirmed.
              </p>
            </div>
          )}
        </section>

        <section className="mt-14 border-y border-[#deded7] py-10 dark:border-white/10 sm:mt-20 sm:py-14">
          <ContentSectionHeading
            description="The quote and handover flow keeps local delivery, cylinder exchanges and courier products explicit before payment."
            eyebrow="How it works"
            title="From product to delivery."
          />
          <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            <NumberedStep number="01" title="Choose the exact option">
              Select the cylinder size and whether you are buying a full/new
              cylinder or an eligible exchange option.
            </NumberedStep>
            <NumberedStep number="02" title="Enter the address">
              Add the street, city, province and postal code. A suburb can be
              added when it helps the delivery team, but it is not required for
              the zone check. The postal code must fall within a supported
              active local zone.
            </NumberedStep>
            <NumberedStep number="03" title="Review the live quote">
              Checkout separates Jurgens Energy delivery from any courier rate
              and confirms the available option and cost before payment. An
              address outside the supported local postal codes will not receive
              a Jurgens Energy local-delivery option.
            </NumberedStep>
            <NumberedStep number="04" title="Complete the handover">
              Keep an eligible empty cylinder ready for exchange orders and make
              sure the driver can reach a safe handover point.
            </NumberedStep>
          </div>
        </section>

        <section className="mt-14 sm:mt-20">
          <ContentSectionHeading
            description="These products are currently marked for Jurgens Energy fulfilment, but that does not make every address serviceable. Final stock, supported postal-code coverage and the applicable delivery cost are confirmed during checkout."
            eyebrow="Available for local fulfilment"
            title="Shop LPG for local delivery."
          />

          {localProducts.length > 0 ? (
            <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {localProducts.map((product) => (
                <MarketplaceProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-xl border border-[#deded7] bg-white p-6 dark:border-white/10 dark:bg-[#141414]">
              <p className="text-sm font-bold">
                Local-delivery products are being updated.
              </p>
              <Link
                className="mt-3 inline-flex text-[12px] font-black uppercase tracking-[0.08em] text-[#ff5a1f] hover:underline"
                href="/products"
              >
                Browse all available products
              </Link>
            </div>
          )}
        </section>

        <section className="mt-14 grid gap-4 sm:mt-20 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              copy: "Exchange pricing is shown only when the required empty-cylinder handover is supported.",
              icon: RefreshCcwIcon,
              title: "Clear exchange rules",
            },
            {
              copy: "Delivery availability and pricing are calculated from the active zone matched to the entered postal code.",
              icon: MapPinIcon,
              title: "Address-based quoting",
            },
            {
              copy: "Optional preferred dates apply only to eligible Jurgens Energy fulfilled products and respect cut-off rules.",
              icon: CalendarDaysIcon,
              title: "Route-aware scheduling",
            },
            {
              copy: "Product, payment, fulfilment and invoice details stay attached to the same order flow.",
              icon: ShieldCheckIcon,
              title: "Secure checkout",
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
            description="The delivery flow is deliberately explicit about local fulfilment, exchanges and mixed orders."
            eyebrow="Delivery questions"
            title="Know what to expect."
          />
          <div className="mt-6 overflow-hidden rounded-xl border border-[#deded7] bg-white dark:border-white/10 dark:bg-[#141414]">
            {localDeliveryFaqItems.map((item, index) => (
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
            description="Choose the exact cylinder or gas product online, or ask the team for help before placing the order."
            eyebrow="Ready to order?"
            title="Start with the product you need."
          />
        </div>
      </div>
    </article>
  );
}

function DeliveryZoneCard({ zone }: { zone: JurgensDeliveryZone }) {
  return (
    <article className="rounded-xl border border-[#deded7] bg-white p-5 dark:border-white/10 dark:bg-[#141414] sm:p-6">
      <div className="flex min-w-0 items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#fff0e9] text-[#ff5a1f] dark:bg-[#ff5a1f]/10">
          <PackageCheckIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-black uppercase leading-tight">
            {zone.name}
          </h2>
          <p className="mt-2 text-[12px] leading-5 text-[#66665f] dark:text-[#bdbdb5]">
            {zone.deliveryInformation?.trim() ||
              "Local delivery is available when the entered address, order and products satisfy this active zone."}
          </p>
          <p className="mt-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#ff5a1f]">
            {getZonePriceSummary(zone)}
          </p>
          {zone.postalCodes.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Covered postal codes">
              {zone.postalCodes.map((postalCode) => (
                <span
                  className="rounded-full border border-[#deded7] bg-[#f7f7f2] px-2.5 py-1 text-[10px] font-bold text-[#55554f] dark:border-white/10 dark:bg-white/[0.055] dark:text-[#c8c8c0]"
                  key={postalCode}
                >
                  {postalCode}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function getZonePriceSummary(zone: JurgensDeliveryZone) {
  const explicitFreeThresholds = zone.rates.flatMap((rate) =>
    rate.price === 0 ? [rate.fromAmount] : [],
  );
  const implicitFreeThreshold = getJurgensImplicitFreeDeliveryThreshold(
    zone.rates,
  );
  const freeThreshold = Math.min(
    ...explicitFreeThresholds,
    ...(implicitFreeThreshold === null ? [] : [implicitFreeThreshold]),
  );
  const paidPrices = zone.rates.flatMap((rate) =>
    rate.price > 0 ? [rate.price] : [],
  );
  const lowestPaidPrice = Math.min(...paidPrices);
  const minimumCopy =
    zone.minimumOrderAmount > 0
      ? `Minimum order ${formatZar(zone.minimumOrderAmount)}`
      : "No minimum order";
  const summary = [minimumCopy];

  if (Number.isFinite(lowestPaidPrice)) {
    summary.push(`Delivery from ${formatZar(lowestPaidPrice)}`);
  }

  if (Number.isFinite(freeThreshold)) {
    summary.push(`Free from ${formatZar(freeThreshold)}`);
  }

  if (summary.length === 1) {
    summary.push("Price confirmed at checkout");
  }

  return summary.join(" · ");
}

function formatZar(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}
