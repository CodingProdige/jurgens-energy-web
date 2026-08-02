import {
  ClipboardCheckIcon,
  HeadphonesIcon,
  PackageCheckIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "lucide-react";

export const marketplaceTrustItems = [
  {
    description: "Handled with care",
    icon: ShieldCheckIcon,
    title: "Safety-First Handling",
  },
  {
    description: "Nationwide across South Africa",
    icon: TruckIcon,
    title: "Nationwide Delivery",
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
    title: "Final Delivery Details",
  },
] as const;
