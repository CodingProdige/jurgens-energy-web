import Link from "next/link";
import {
  HeadphonesIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";

import { JurgensEnergyLogo } from "@/components/brand/jurgens-energy-logo";

const footerServices = [
  {
    description: "Fast & reliable delivery across your area.",
    icon: TruckIcon,
    title: "Same Day Delivery",
  },
  {
    description: "Our cylinders are tested, certified and compliant.",
    icon: ShieldCheckIcon,
    title: "Safe & Certified",
  },
  {
    description: "Thousands of homes and businesses trust us.",
    icon: UsersIcon,
    title: "Reliable Service",
  },
  {
    description: "We're here to help before, during and after delivery.",
    icon: HeadphonesIcon,
    title: "Customer Support",
  },
] as const;

export function MarketplaceFooter() {
  return (
    <footer
      className="mt-10 border-t border-[#e8e8e2] bg-white text-[#080808] dark:border-white/10 dark:bg-[#080808] dark:text-[#f7f7f2]"
      id="contact"
    >
      <div className="mx-auto w-full px-0 py-6 sm:w-[min(1500px,calc(100%-1rem))] sm:px-6 sm:py-8 lg:px-10">
        <section
          className="grid border-y border-[#ecece6] bg-[#fbfbf8] dark:border-white/10 dark:bg-white/[0.04] sm:overflow-hidden sm:rounded-lg sm:border sm:shadow-[0_12px_35px_rgba(8,8,8,0.04)] sm:dark:shadow-none md:grid-cols-2 xl:grid-cols-4"
          id="delivery"
        >
          {footerServices.map((item) => {
            const Icon = item.icon;

            return (
              <article
                className="grid min-h-[70px] grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3 border-b border-[#e8e8e2] px-4 py-3 last:border-b-0 dark:border-white/10 sm:min-h-[88px] sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-4 sm:px-5 sm:py-4 xl:border-b-0 xl:border-r xl:last:border-r-0"
                key={item.title}
              >
                <span className="grid size-9 place-items-center text-[#ff5a1f] sm:size-11">
                  <Icon className="size-6 stroke-[1.8] sm:size-8 sm:stroke-[1.6]" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[12px] font-black uppercase leading-4 sm:text-[13px]">
                    {item.title}
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#4f4f49] dark:text-[#c8c8c0] sm:mt-1 sm:text-[12px]">
                    {item.description}
                  </p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid gap-7 border-b border-[#ecece6] px-4 py-7 dark:border-white/10 sm:px-0 sm:py-9 md:grid-cols-[1.3fr_0.8fr_0.8fr] lg:grid-cols-[1.5fr_0.75fr_0.75fr_0.75fr_1.1fr_1fr]">
          <div className="min-w-0">
            <Link aria-label="Jurgens Energy home" href="/">
              <JurgensEnergyLogo />
            </Link>
            <p className="mt-3 max-w-xs text-[13px] leading-6 text-[#4f4f49] dark:text-[#c8c8c0]">
              Modern energy, delivered.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {["f", "ig", "wa"].map((label) => (
                <span
                  className="grid size-8 place-items-center rounded-full border border-[#d8d8d0] text-[11px] font-black uppercase text-[#4f4f49] dark:border-white/15 dark:text-[#c8c8c0]"
                  key={label}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <FooterColumn
            links={[
              ["All Products", "/products"],
              ["Cylinder Exchange", "/products?exchange=1"],
              ["Accessories", "/products?category=accessories"],
              ["Deals", "/products?sale=1"],
              ["Brands", "/products"],
            ]}
            title="Shop"
          />
          <FooterColumn
            links={[
              ["About Us", "/#about"],
              ["Safety", "/#delivery"],
              ["Delivery", "/#delivery"],
              ["FAQs", "/#exchange"],
              ["Contact Us", "/#contact"],
            ]}
            title="Company"
          />
          <FooterColumn
            links={[
              ["My Orders", "/cart"],
              ["Returns", "/#contact"],
              ["Terms & Conditions", "/#contact"],
              ["Privacy Policy", "/#contact"],
            ]}
            title="Help"
          />

          <div className="min-w-0">
            <h2 className="text-[13px] font-black uppercase">Contact Us</h2>
            <div className="mt-4 grid gap-3 text-[13px] text-[#1a1a1a] dark:text-[#f7f7f2]">
              <ContactLine icon={PhoneIcon} label="021 123 4567" />
              <ContactLine icon={PhoneIcon} label="081 234 5678" />
              <ContactLine icon={MailIcon} label="info@jurgensenergy.com" />
              <ContactLine icon={MapPinIcon} label="South Africa" />
            </div>
          </div>

          <div className="min-w-0">
            <h2 className="text-[13px] font-black uppercase">Payment Methods</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {["VISA", "Mastercard", "zapper", "mobicred"].map((label) => (
                <span
                  className="rounded-md border border-[#e8e8e2] bg-white px-3 py-2 text-[12px] font-black text-[#1a1a1a] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f7f7f2]"
                  key={label}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 px-4 pt-4 text-[12px] text-[#696963] dark:text-[#a8a89f] sm:flex-row sm:items-center sm:justify-between sm:px-0">
          <p>© 2025 Jurgens Energy. All rights reserved.</p>
          <p className="font-semibold text-[#1a1a1a] dark:text-[#f7f7f2]">
            Designed with care in South Africa
          </p>
        </div>
      </div>
    </footer>
  );
}

function ContactLine({
  icon: Icon,
  label,
}: {
  icon: typeof PhoneIcon;
  label: string;
}) {
  return (
    <p className="flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0 text-[#1a1a1a] dark:text-[#f7f7f2]" />
      <span className="truncate">{label}</span>
    </p>
  );
}

function FooterColumn({
  links,
  title,
}: {
  links: Array<[string, string]>;
  title: string;
}) {
  return (
    <div className="min-w-0">
      <h2 className="text-[13px] font-black uppercase">{title}</h2>
      <nav className="mt-4 grid gap-2.5 text-[13px] text-[#1a1a1a] dark:text-[#f7f7f2]">
        {links.map(([label, href]) => (
          <Link
            className="transition hover:text-[#ff5a1f]"
            href={href}
            key={label}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
