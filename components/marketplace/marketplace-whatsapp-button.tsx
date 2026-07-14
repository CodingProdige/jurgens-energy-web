import Link from "next/link";

import { normalizePhoneNumber } from "@/src/modules/phone";

export function MarketplaceWhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.7 26.2 7.2 21a11.1 11.1 0 1 1 4.7 4.3l-6.2.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.25"
      />
      <path
        d="M11.3 10.4c.2-.4.4-.6.8-.6h.7c.2 0 .4.1.5.4l.8 1.9c.1.3.1.5-.1.8l-.6.6c-.2.2-.2.5-.1.8.5.9 1.2 1.7 2.1 2.4.8.6 1.5 1 2.3 1.2.3.1.6 0 .8-.2l.8-.8c.2-.2.5-.3.8-.2l1.9.8c.3.1.4.3.4.7 0 .7-.2 1.4-.7 1.9-.5.5-1.2.8-2 .8-1.1 0-3.6-.7-5.9-2.8-2.5-2.3-3.8-5-3.8-6.2 0-.5.1-1 .3-1.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.85"
      />
    </svg>
  );
}

export function createMarketplaceWhatsAppHref(phoneNumber: string | null) {
  if (!phoneNumber) {
    return null;
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber, {
    defaultCountryCode: "ZA",
  });

  if (!normalizedPhone) {
    return null;
  }

  const phoneDigits = normalizedPhone.replace(/\D/g, "");
  const text = encodeURIComponent("Hi Jurgens Energy, I need a gas topup.");

  return phoneDigits ? `https://wa.me/${phoneDigits}?text=${text}` : null;
}

export function MarketplaceWhatsAppButton({
  enabled,
  phoneNumber,
}: {
  enabled: boolean;
  phoneNumber: string | null;
}) {
  if (!enabled || !phoneNumber) {
    return null;
  }

  const whatsappHref = createMarketplaceWhatsAppHref(phoneNumber);

  if (!whatsappHref) {
    return null;
  }

  return (
    <Link
      aria-label="Order LPG gas on WhatsApp"
      className="group fixed bottom-5 right-5 z-[45] inline-flex h-14 items-center gap-2.5 overflow-hidden rounded-full bg-[#080808] px-5 text-sm font-normal uppercase text-white shadow-[0_14px_30px_rgba(8,8,8,0.24),0_0_16px_rgba(37,211,102,0.12)] ring-1 ring-[#25d366]/10 transition hover:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#25d366]/25 dark:ring-[#25d366]/15 max-[520px]:bottom-4 max-[520px]:right-4 max-[520px]:size-14 max-[520px]:justify-center max-[520px]:px-0"
      href={whatsappHref}
      rel="noreferrer"
      target="_blank"
    >
      <span className="marketplace-whatsapp-shimmer pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <MarketplaceWhatsAppIcon className="relative z-10 size-6 text-[#25d366]" />
      <span className="relative z-10 text-white max-[520px]:sr-only">
        Need gas?
      </span>
    </Link>
  );
}
