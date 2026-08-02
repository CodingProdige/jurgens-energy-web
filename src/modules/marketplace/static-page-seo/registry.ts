export const STATIC_SEO_PAGE_KEYS = [
  "home",
  "products",
  "brands",
  "blog",
  "about",
  "contact",
  "faq",
  "lpg-delivery",
  "lpg-safety",
  "delivery-information",
  "privacy-policy",
  "returns-and-refunds",
  "terms-and-conditions",
] as const;

export type StaticSeoPageKey = (typeof STATIC_SEO_PAGE_KEYS)[number];

export type StaticSeoPageRegistryEntry = {
  defaultDescription: string;
  defaultTitle: string;
  key: StaticSeoPageKey;
  label: string;
  path: `/${string}` | "/";
  scanFocus: string;
};

export const STATIC_SEO_PAGE_REGISTRY = {
  home: {
    defaultDescription:
      "Shop LPG cylinders, exchange options and gas accessories at JurgensEnergy.com. Delivery is available to eligible South African addresses confirmed at checkout.",
    defaultTitle: "South African Online LPG Store",
    key: "home",
    label: "Homepage",
    path: "/",
    scanFocus:
      "The online LPG storefront, core product range, cylinder exchange options and checkout-confirmed delivery to eligible South African addresses.",
  },
  products: {
    defaultDescription:
      "Browse LPG gas cylinders, cylinder exchange options and gas accessories. Compare current prices, product choices, stock and available delivery methods online.",
    defaultTitle: "Shop LPG Gas Cylinders & Gas Accessories",
    key: "products",
    label: "All products",
    path: "/products",
    scanFocus:
      "The live product catalogue, LPG cylinder choices, exchange-supported options, accessories and current shopping information.",
  },
  brands: {
    defaultDescription:
      "Explore LPG cylinder, gas appliance, regulator and accessory brands available from Jurgens Energy, then browse each brand's current product range online.",
    defaultTitle: "LPG Cylinder & Gas Equipment Brands",
    key: "brands",
    label: "Brands",
    path: "/brands",
    scanFocus:
      "The active brands shown on the page and the categories of products actually available under those brands.",
  },
  blog: {
    defaultDescription:
      "Read practical Jurgens Energy articles about LPG safety, gas cylinders, exchange ordering, delivery and choosing gas products for your home or business.",
    defaultTitle: "LPG Safety, Delivery & Product Advice",
    key: "blog",
    label: "Blog",
    path: "/blog",
    scanFocus:
      "Published LPG guides and articles, using only topics represented by live posts or the visible blog page.",
  },
  about: {
    defaultDescription:
      "JurgensEnergy.com is a South African online store for LPG cylinders and gas accessories. Delivery to eligible addresses is confirmed at checkout.",
    defaultTitle: "About Our Online LPG Store",
    key: "about",
    label: "About us",
    path: "/about",
    scanFocus:
      "Verified business identity, the online-store model, LPG products, cylinder exchanges and checkout-confirmed delivery to eligible South African addresses.",
  },
  contact: {
    defaultDescription:
      "Contact the Jurgens Energy online store for help with LPG products, cylinder exchanges, delivery, returns, refunds or an order by phone, email or WhatsApp.",
    defaultTitle: "Contact Our Online LPG Store",
    key: "contact",
    label: "Contact",
    path: "/contact",
    scanFocus:
      "The contact methods and customer-support topics visibly offered on the page, without exposing private or unpublished details.",
  },
  faq: {
    defaultDescription:
      "Find answers about ordering LPG cylinders, exchange handovers, product availability, delivery, payments, returns and support from Jurgens Energy.",
    defaultTitle: "LPG Ordering, Exchange & Delivery FAQs",
    key: "faq",
    label: "FAQs",
    path: "/faq",
    scanFocus:
      "The questions and answers that are visibly published, prioritising LPG ordering, exchange, payment and delivery topics.",
  },
  "lpg-delivery": {
    defaultDescription:
      "Order LPG online for delivery to eligible South African addresses. Checkout confirms current delivery timing, availability, fees and exchange requirements.",
    defaultTitle: "LPG Delivery in South Africa",
    key: "lpg-delivery",
    label: "LPG delivery",
    path: "/lpg-delivery",
    scanFocus:
      "The online ordering flow, checkout-confirmed delivery to eligible South African addresses, published timing, shipping costs and cylinder-exchange handover requirements.",
  },
  "lpg-safety": {
    defaultDescription:
      "Read essential LPG cylinder safety guidance for transport, storage, ventilation, leak checks and responsible use around your home or business.",
    defaultTitle: "LPG Gas Safety, Storage & Cylinder Guidance",
    key: "lpg-safety",
    label: "LPG safety",
    path: "/lpg-safety",
    scanFocus:
      "The safety advice actually published on the page. Do not introduce legal, technical or certification claims not present in the source.",
  },
  "delivery-information": {
    defaultDescription:
      "Read our South Africa Shipping & Delivery Policy for current delivery timing, fees, address eligibility, order handling and delivery support.",
    defaultTitle: "Shipping & Delivery Policy",
    key: "delivery-information",
    label: "Shipping & delivery policy",
    path: "/delivery-information",
    scanFocus:
      "The published shipping and delivery policy, including South Africa coverage, delivery fees, handling, cutoff, transit, total timing and exchange handover requirements.",
  },
  "privacy-policy": {
    defaultDescription:
      "Read the Jurgens Energy Privacy Policy to understand how personal information is collected, used, protected and managed when you use our website and services.",
    defaultTitle: "Privacy Policy",
    key: "privacy-policy",
    label: "Privacy policy",
    path: "/privacy-policy",
    scanFocus:
      "A faithful summary of the published privacy policy, without marketing language or legal claims beyond the document.",
  },
  "returns-and-refunds": {
    defaultDescription:
      "Read our Returns & Refunds Policy, including the current return period, change-of-mind courier fees and help for incorrect, damaged or defective goods.",
    defaultTitle: "Returns & Refunds Policy",
    key: "returns-and-refunds",
    label: "Returns & refunds policy",
    path: "/returns-and-refunds",
    scanFocus:
      "A faithful summary of the live returns and refunds policy, including eligibility, the configured return period, courier fees and statutory remedies.",
  },
  "terms-and-conditions": {
    defaultDescription:
      "Read the terms and conditions that apply when using the Jurgens Energy website, creating an account, placing an order, paying or arranging fulfilment.",
    defaultTitle: "Terms & Conditions",
    key: "terms-and-conditions",
    label: "Terms and conditions",
    path: "/terms-and-conditions",
    scanFocus:
      "A faithful summary of the published terms and conditions, without promotional copy or legal interpretations not found in the document.",
  },
} as const satisfies Record<StaticSeoPageKey, StaticSeoPageRegistryEntry>;

export function isStaticSeoPageKey(value: string): value is StaticSeoPageKey {
  return Object.hasOwn(STATIC_SEO_PAGE_REGISTRY, value);
}

export function getStaticSeoPageRegistryEntry(pageKey: StaticSeoPageKey) {
  return STATIC_SEO_PAGE_REGISTRY[pageKey];
}
