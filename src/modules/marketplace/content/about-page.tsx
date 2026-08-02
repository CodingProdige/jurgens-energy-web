import {
  FlameIcon,
  PackageCheckIcon,
  ShieldCheckIcon,
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
      "Shop practical products for home, energy, outdoor and everyday use.",
    icon: ShoppingBagIcon,
    title: "Home and energy products",
  },
  {
    description:
      "Select gas-related products and accessories with clear compatibility and handling notes where they apply.",
    icon: ShieldCheckIcon,
    title: "Product-specific guidance",
  },
  {
    description:
      "Review product details, availability, delivery and support information before checkout.",
    icon: PackageCheckIcon,
    title: "Online ordering support",
  },
] as const;

export function AboutPage({
  businessIdentity,
  deliveryTimingDescription,
}: {
  businessIdentity: PublicBusinessIdentity;
  deliveryTimingDescription: string;
}) {
  return (
    <article>
      <ContentHero
        breadcrumbLabel="About us"
        description="Jurgens Energy is a South African online store. Customers can browse, order and pay online. Delivery is available throughout South Africa, and checkout shows the final delivery details before payment."
        eyebrow="About Jurgens Energy"
        icon={FlameIcon}
        title="Jurgens Energy is a South African online store."
      />

      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10 lg:py-16">
        <section>
          <ContentSectionHeading
            description="Jurgens Energy brings everyday retail and energy-related products into one straightforward online shopping experience. Product pages explain what is included, what is required, and whether any product-specific delivery or handover rules apply."
            eyebrow="What we sell"
            title="Products, details and support—online."
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
                Nationwide delivery
              </h3>
              <p className="mt-1 text-[13px] leading-6 text-[#62625c] dark:text-[#bdbdb5]">
                Jurgens Energy does not operate a customer-facing physical
                store. Delivery is available throughout South Africa. Checkout
                shows the final delivery details before payment.{" "}
                {deliveryTimingDescription} Our order cut-off is 2:00 PM SAST on
                business days.
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
          actions={[{ href: "/products", label: "Shop products" }]}
          description="Browse products available to order online and review delivery, payment and support information before checkout."
          eyebrow="Shop online"
          title="Find what you need."
        />
      </div>
    </article>
  );
}
