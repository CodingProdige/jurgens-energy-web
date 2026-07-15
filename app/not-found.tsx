import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon, HouseIcon, SearchXIcon } from "lucide-react";

import { BrandedSystemState } from "@/components/brand/branded-system-state";
import {
  marketplacePrimaryActionClass,
  marketplaceSecondaryActionClass,
} from "@/components/marketplace/action-styles";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The requested Jurgens Energy page could not be found.",
};

export default function NotFound() {
  return (
    <BrandedSystemState
      actions={
        <>
          <Link
            className={`${marketplacePrimaryActionClass} gap-2`}
            href="/products"
          >
            Browse products
            <ArrowRightIcon className="size-4" />
          </Link>
          <Link
            className={`${marketplaceSecondaryActionClass} gap-2`}
            href="/"
          >
            <HouseIcon className="size-4" />
            Return home
          </Link>
        </>
      }
      code="404"
      description="The page may have moved, the address may be incorrect, or the product is no longer available. You can continue browsing our current LPG range."
      eyebrow="Page not found"
      icon={SearchXIcon}
      title="We couldn’t find that page."
    />
  );
}
