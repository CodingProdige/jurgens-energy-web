import type { Metadata } from "next";

import { ProductReviewManager } from "@/app/(admin)/admin/(dashboard)/products/reviews/product-review-manager";
import { hasAdminCapability } from "@/src/modules/admin/staff";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminCustomerReviews } from "@/src/modules/admin/customer-reviews";

export const metadata: Metadata = {
  title: "Product Reviews",
  description: "Moderate verified customer product ratings and reviews.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminProductReviewsPage() {
  const access = await requireAdminCapability("admin.catalog.view");

  if (!access.ok) {
    return null;
  }

  const data = await getAdminCustomerReviews();
  const canManage = hasAdminCapability(
    access.session.user.adminCapabilities,
    "admin.catalog.manage",
  );

  return <ProductReviewManager canManage={canManage} data={data} />;
}
