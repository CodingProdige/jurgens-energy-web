export type PolicyKind = "delivery" | "privacy" | "returns" | "terms";

export const policyLinks = [
  {
    description: "How we collect, use, protect, and share personal information.",
    href: "/privacy-policy",
    kind: "privacy",
    label: "Privacy Policy",
  },
  {
    description: "The rules that apply when you use our store or place an order.",
    href: "/terms-and-conditions",
    kind: "terms",
    label: "Terms & Conditions",
  },
  {
    description:
      "Seven-day returns, return courier costs, defective goods, exchanges, and refunds.",
    href: "/returns-and-refunds",
    kind: "returns",
    label: "Returns & Refunds Policy",
  },
  {
    description:
      "South Africa delivery, handling and shipping estimates, fees, handover, and order issues.",
    href: "/delivery-information",
    kind: "delivery",
    label: "Shipping & Delivery Policy",
  },
] as const;
