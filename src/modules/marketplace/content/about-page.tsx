import Link from "next/link";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  FlameIcon,
  HeadphonesIcon,
  RefreshCcwIcon,
  ShoppingBagIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "lucide-react";

import {
  ContentActionPanel,
  ContentHero,
  ContentSectionHeading,
  NumberedStep,
} from "@/src/modules/marketplace/content/content-page";

const services = [
  {
    description:
      "Shop LPG cylinders and the everyday gas equipment that keeps homes and businesses running.",
    href: "/products",
    icon: ShoppingBagIcon,
    title: "LPG essentials",
  },
  {
    description:
      "Choose an exchange-supported option and hand over an eligible empty cylinder when your order arrives.",
    href: "/products?exchange=1",
    icon: RefreshCcwIcon,
    title: "Cylinder exchange",
  },
  {
    description:
      "Delivery options, availability and fees are confirmed from the address and products in your order.",
    href: "/delivery-information",
    icon: TruckIcon,
    title: "Practical delivery",
  },
] as const;

const commitments = [
  {
    description:
      "We make safe handling, eligible exchanges and the right next step clear before handover.",
    icon: ShieldCheckIcon,
    title: "Safety is part of the service",
  },
  {
    description:
      "Product, price and exchange information should help you choose with confidence—not create another guessing game.",
    icon: BadgeCheckIcon,
    title: "Clear information",
  },
  {
    description:
      "Questions about a product, delivery or an existing order can be handled through the channel that suits you.",
    icon: HeadphonesIcon,
    title: "Human support",
  },
] as const;

export function AboutPage() {
  return (
    <article>
      <ContentHero
        breadcrumbLabel="About us"
        description="Jurgens Energy is a focused LPG store built around straightforward ordering, safe cylinder handling and dependable customer support."
        eyebrow="Modern energy, delivered"
        icon={FlameIcon}
        title="Gas should be simple."
      />

      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-14">
          <ContentSectionHeading
            description="We bring cylinders, exchange options and gas accessories into one clear shopping experience. Whether you are replacing an empty cylinder or setting up a new order, the aim is the same: fewer surprises and a safer handover."
            eyebrow="What we do"
            title="The LPG essentials, without the runaround."
          />

          <div className="grid gap-3">
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <Link
                  className="group grid min-w-0 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-[#e2e2db] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#ff5a1f]/65 hover:shadow-[0_14px_34px_rgba(8,8,8,0.06)] dark:border-white/10 dark:bg-[#141414] dark:hover:border-[#ff5a1f]/60 dark:hover:shadow-none sm:p-5"
                  href={service.href}
                  key={service.title}
                >
                  <span className="grid size-12 place-items-center rounded-lg bg-[#fff0e9] text-[#ff5a1f] dark:bg-[#ff5a1f]/10">
                    <Icon className="size-6" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-black uppercase leading-tight">
                      {service.title}
                    </span>
                    <span className="mt-1 block text-[12px] leading-5 text-[#676761] dark:text-[#b9b9b1] sm:text-[13px]">
                      {service.description}
                    </span>
                  </span>
                  <ArrowRightIcon className="size-4 text-[#aaa9a2] transition group-hover:translate-x-0.5 group-hover:text-[#ff5a1f]" />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-14 border-y border-[#dfdfd8] py-10 dark:border-white/10 sm:mt-20 sm:py-14">
          <ContentSectionHeading
            description="A good LPG order is more than a product in a box. The details around compatibility, exchange eligibility, delivery and support matter just as much."
            eyebrow="How we work"
            title="Built around the handover."
          />

          <div className="mt-8 grid gap-6 md:grid-cols-3 md:gap-8">
            {commitments.map((commitment) => {
              const Icon = commitment.icon;

              return (
                <article className="min-w-0" key={commitment.title}>
                  <span className="grid size-11 place-items-center rounded-full border border-[#ff5a1f]/35 text-[#ff5a1f]">
                    <Icon className="size-5" strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-5 text-[17px] font-black uppercase leading-tight">
                    {commitment.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#62625c] dark:text-[#bdbdb5]">
                    {commitment.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <ContentSectionHeading
            description="The store is designed to keep each step visible, from choosing the right product to receiving it safely."
            eyebrow="From browse to delivery"
            title="A straightforward way to order."
          />
          <div className="mt-8 grid gap-7 sm:grid-cols-3 sm:gap-8">
            <NumberedStep number="01" title="Choose what you need">
              Browse full cylinders, exchange-supported options and accessories.
              Check the product details before adding it to your cart.
            </NumberedStep>
            <NumberedStep number="02" title="Confirm the details">
              Provide the delivery address and, for an exchange, confirm the
              eligible empty cylinder required at handover.
            </NumberedStep>
            <NumberedStep number="03" title="Receive it safely">
              We confirm the applicable fulfilment details and keep you informed
              if availability, access or safety affects the handover.
            </NumberedStep>
          </div>
        </section>

        <ContentActionPanel
          actions={[
            { href: "/products", label: "Shop all products" },
            {
              href: "/contact",
              label: "Contact our team",
              variant: "secondary",
            },
          ]}
          description="Explore the current range or speak to us if you need help choosing a cylinder, exchange option or accessory."
          title="Let’s get the right gas to you."
        />
      </div>
    </article>
  );
}
