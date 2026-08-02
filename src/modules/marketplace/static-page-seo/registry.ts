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
      "Shop home, energy, outdoor, appliance and lifestyle products with Jurgens Energy. Delivery is available throughout South Africa and confirmed at checkout.",
    defaultTitle: "South African Online Store",
    key: "home",
    label: "Homepage",
    path: "/",
    scanFocus:
      "The online storefront, live product range, checkout-confirmed delivery, payment methods, support access and business identity.",
  },
  products: {
    defaultDescription:
      "Browse products available from Jurgens Energy. Compare current prices, product choices, stock and available delivery methods online.",
    defaultTitle: "Shop Online Products",
    key: "products",
    label: "All products",
    path: "/products",
    scanFocus:
      "The live product catalogue, current product choices, stock, prices, delivery labels and shopping information.",
  },
  brands: {
    defaultDescription:
      "Explore brands available from Jurgens Energy, then browse each brand's current product range, pricing and delivery details online.",
    defaultTitle: "Brands Available Online",
    key: "brands",
    label: "Brands",
    path: "/brands",
    scanFocus:
      "The active brands shown on the page and the categories of products actually available under those brands.",
  },
  blog: {
    defaultDescription:
      "Read practical Jurgens Energy articles about online shopping, delivery, product guidance, safety, support and customer updates.",
    defaultTitle: "Product Advice, Delivery & Safety Guides",
    key: "blog",
    label: "Blog",
    path: "/blog",
    scanFocus:
      "Published guides and articles, using only topics represented by live posts or the visible blog page.",
  },
  about: {
    defaultDescription:
      "Jurgens Energy is a South African online store. Customers can shop and pay online, with delivery eligibility confirmed at checkout.",
    defaultTitle: "About Jurgens Energy",
    key: "about",
    label: "About us",
    path: "/about",
    scanFocus:
      "Verified business identity, the online-store model, product range, payment information, support options and checkout-confirmed delivery.",
  },
  contact: {
    defaultDescription:
      "Contact the Jurgens Energy online store for help with products, orders, delivery, payments, returns, refunds or support.",
    defaultTitle: "Contact Jurgens Energy",
    key: "contact",
    label: "Contact",
    path: "/contact",
    scanFocus:
      "The contact methods and customer-support topics visibly offered on the page, without exposing private or unpublished details.",
  },
  faq: {
    defaultDescription:
      "Find clear answers about ordering online, product availability, delivery, payments, returns, support and customer account help.",
    defaultTitle: "Ordering, Delivery & Support FAQs",
    key: "faq",
    label: "FAQs",
    path: "/faq",
    scanFocus:
      "The questions and answers that are visibly published, prioritising ordering, payment, delivery, returns and support topics.",
  },
  "lpg-delivery": {
    defaultDescription:
      "Shop online for delivery to eligible South African addresses. Checkout confirms delivery timing, fees and product-specific requirements.",
    defaultTitle: "Delivery in South Africa",
    key: "lpg-delivery",
    label: "LPG delivery",
    path: "/lpg-delivery",
    scanFocus:
      "The online ordering flow, checkout-confirmed delivery to eligible South African addresses, published timing, shipping costs and product-specific handover requirements.",
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
