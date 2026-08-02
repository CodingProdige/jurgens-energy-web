import {
  ClipboardCheckIcon,
  HeadphonesIcon,
  PackageCheckIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "lucide-react";

export const marketplaceTrustItems = [
  {
    description: "Eligibility checks apply",
    icon: ShieldCheckIcon,
    title: "Safety-First Handling",
  },
  {
    description: "Confirmed at checkout",
    icon: TruckIcon,
    title: "Delivery Availability",
  },
  {
    description: "Payment, invoice & delivery",
    icon: ClipboardCheckIcon,
    title: "Clear Order Updates",
  },
  {
    description: "We're here to help",
    icon: HeadphonesIcon,
    title: "Support",
  },
  {
    description: "Options shown at checkout",
    icon: PackageCheckIcon,
    title: "Product Delivery",
  },
] as const;
