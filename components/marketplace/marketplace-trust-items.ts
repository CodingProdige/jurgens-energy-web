import {
  AwardIcon,
  HeadphonesIcon,
  PackageCheckIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "lucide-react";

export const marketplaceTrustItems = [
  {
    description: "100% secure",
    icon: ShieldCheckIcon,
    title: "Safe & Certified",
  },
  {
    description: "Across your area",
    icon: TruckIcon,
    title: "Same Day Delivery",
  },
  {
    description: "Tested & trusted",
    icon: AwardIcon,
    title: "Certified Quality",
  },
  {
    description: "We're here to help",
    icon: HeadphonesIcon,
    title: "Support",
  },
  {
    description: "Delivered to your door",
    icon: PackageCheckIcon,
    title: "Full cylinders",
  },
] as const;
