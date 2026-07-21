import {
  FlameIcon,
  PackageCheckIcon,
  RefreshCcwIcon,
  ShoppingBagIcon,
  TruckIcon,
} from "lucide-react";

import { PublicBusinessIdentityDisclosure } from "@/components/marketplace/public-business-identity";
import type { PublicBusinessIdentity } from "@/src/modules/business-information";
import {
  ContentActionPanel,
  ContentHero,
  ContentSectionHeading,
} from "@/src/modules/marketplace/content/content-page";

const storeCategories = [
  {
    description:
      "Buy LPG cylinders online with clear product details, pricing and availability.",
    icon: ShoppingBagIcon,
    title: "LPG cylinders",
  },
  {
    description:
      "Choose an exchange-supported option and provide an eligible empty cylinder when your order is delivered.",
    icon: RefreshCcwIcon,
    title: "Cylinder exchanges",
  },
  {
    description:
      "Shop gas accessories and equipment for safe, practical everyday use.",
    icon: PackageCheckIcon,
    title: "Gas accessories",
  },
] as const;

export function AboutPage({
  businessIdentity,
}: {
  businessIdentity: PublicBusinessIdentity;
}) {
  return (
    <article>
      <ContentHero
        breadcrumbLabel="About us"
        description="JurgensEnergy.com is a South African online store for LPG cylinders, cylinder exchange options and gas accessories. Customers can browse, order and pay online for delivery within South Africa."
        eyebrow="About Jurgens Energy"
        icon={FlameIcon}
        title="JurgensEnergy.com is a South African online store."
      />

      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
        <section>
          <ContentSectionHeading
            description="Jurgens Energy brings the LPG products customers need into one straightforward online shopping experience. Product details explain what is included and whether an exchange requires an eligible empty cylinder at handover."
            eyebrow="What we sell"
            title="Cylinders, exchanges and accessories—online."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {storeCategories.map((category) => {
              const Icon = category.icon;

              return (
                <article
                  className="min-w-0 rounded-lg border border-[#e2e2db] bg-white p-5 dark:border-white/10 dark:bg-[#141414] sm:p-6"
                  key={category.title}
                >
                  <span className="grid size-11 place-items-center rounded-lg bg-[#fff0e9] text-[#ff5a1f] dark:bg-[#ff5a1f]/10">
                    <Icon className="size-5" strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-5 text-[17px] font-black uppercase leading-tight">
                    {category.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#62625c] dark:text-[#bdbdb5]">
                    {category.description}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-5 flex min-w-0 flex-col gap-4 rounded-lg bg-[#f7f7f2] p-5 dark:bg-[#1a1a1a] sm:flex-row sm:items-center sm:p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[#ff5a1f]/35 text-[#ff5a1f]">
              <TruckIcon className="size-5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-black uppercase leading-tight">
                Delivery in South Africa
              </h3>
              <p className="mt-1 text-[13px] leading-6 text-[#62625c] dark:text-[#bdbdb5]">
                Jurgens Energy does not operate a customer-facing physical
                store. Eligible orders are delivered within South Africa.
                Handling takes 0–1 business day after payment confirmation, with
                a 2:00 PM SAST order cut-off. Shipping takes 1–3 business days
                after dispatch, for an estimated total of 1–4 business days.
              </p>
            </div>
          </div>
        </section>

        <PublicBusinessIdentityDisclosure
          className="my-14 sm:my-20"
          identity={businessIdentity}
          title="The business behind Jurgens Energy"
        />

        <ContentActionPanel
          actions={[{ href: "/products", label: "Shop LPG products" }]}
          description="Browse LPG cylinders, exchange options and gas accessories available to order online."
          eyebrow="Shop online"
          title="Find what you need."
        />
      </div>
    </article>
  );
}
