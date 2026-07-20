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
      "Shop LPG cylinders, exchange-supported options and gas accessories from Jurgens Energy, with local delivery information for Paarl and the Cape Winelands.",
    defaultTitle: "LPG Cylinders, Exchange & Local Delivery",
    key: "home",
    label: "Homepage",
    path: "/",
    scanFocus:
      "The overall LPG storefront, core product range, exchange options and genuinely supported local delivery areas.",
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
      "Learn about Jurgens Energy, our approach to safe LPG supply and the online service we provide for gas cylinders, exchanges, accessories and local delivery.",
    defaultTitle: "About Your Local LPG Gas Supplier",
    key: "about",
    label: "About us",
    path: "/about",
    scanFocus:
      "Verified business background, LPG service, safety approach and service area claims explicitly supported by the page.",
  },
  contact: {
    defaultDescription:
      "Contact Jurgens Energy for help with LPG cylinder orders, exchanges, delivery, products or an existing purchase by WhatsApp, phone, email or online enquiry.",
    defaultTitle: "Contact Us for LPG Orders & Delivery Help",
    key: "contact",
    label: "Contact",
    path: "/contact",
    scanFocus:
      "The contact methods and customer-support topics visibly offered on the page, without exposing private or unpublished details.",
  },
  faq: {
    defaultDescription:
      "Find answers about ordering LPG cylinders, exchange handovers, product availability, delivery, payments, accounts and support from Jurgens Energy.",
    defaultTitle: "LPG Ordering, Exchange & Delivery FAQs",
    key: "faq",
    label: "FAQs",
    path: "/faq",
    scanFocus:
      "The questions and answers that are visibly published, prioritising LPG ordering, exchange, payment and delivery topics.",
  },
  "lpg-delivery": {
    defaultDescription:
      "Order LPG cylinders online for Jurgens Energy delivery in supported Paarl and Cape Winelands areas. Check products, your address and live checkout options.",
    defaultTitle: "LPG Delivery in Paarl & Cape Winelands",
    key: "lpg-delivery",
    label: "Local LPG delivery",
    path: "/lpg-delivery",
    scanFocus:
      "Only active, visibly supported delivery areas and the real address-based ordering flow; never promise unsupported coverage or delivery times.",
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
      "Read the Jurgens Energy Shipping & Delivery Policy covering delivery areas, address checks, rates, courier options, timing and cylinder exchange handovers.",
    defaultTitle: "Shipping & Delivery Policy",
    key: "delivery-information",
    label: "Shipping & delivery policy",
    path: "/delivery-information",
    scanFocus:
      "The published shipping and delivery policy, including address-based rates, courier availability and exchange handover requirements, without inventing rates or coverage.",
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
      "Read the Jurgens Energy returns, refunds and exchanges policy, including product-condition requirements, exclusions and the process for requesting assistance.",
    defaultTitle: "Returns & Refunds Policy",
    key: "returns-and-refunds",
    label: "Returns & refunds policy",
    path: "/returns-and-refunds",
    scanFocus:
      "A faithful summary of the live returns and refunds policy. Do not invent eligibility, time windows, fees or statutory promises.",
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
