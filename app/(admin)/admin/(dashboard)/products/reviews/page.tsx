import type { Metadata } from "next";

import { ProductReviewManager } from "@/app/(admin)/admin/(dashboard)/products/reviews/product-review-manager";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminProductReviews } from "@/src/modules/admin/product-reviews";

export const metadata: Metadata = {
  title: "Admin Product Reviews",
  description: "Review seller product submissions before they go live.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminProductReviewsPage() {
  const access = await requireAdminCapability("admin.catalog.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const data = await getAdminProductReviews();

  return <ProductReviewManager {...data} />;
}
