import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  brands,
  orders,
  productReviewStatuses,
  productVariants,
  products,
  reviews,
  users,
} from "@/src/db/schema";
import { getProductRatingSummariesByProductId } from "@/src/modules/reviews";

export type AdminCustomerReviewStatus =
  (typeof productReviewStatuses)[number];

export type AdminCustomerReviewRow = {
  approvedAt: Date | null;
  body: string | null;
  brandName: string | null;
  createdAt: Date;
  customerDisplayName: string | null;
  customerEmail: string | null;
  customerName: string | null;
  hiddenAt: Date | null;
  id: string;
  isVerifiedPurchase: boolean;
  orderId: string | null;
  orderNumber: string | null;
  productId: string;
  productSlug: string;
  productTitle: string;
  rating: number;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  status: AdminCustomerReviewStatus;
  title: string | null;
  updatedAt: Date;
  variantTitle: string | null;
};

export type AdminCustomerReviewsData = {
  metrics: {
    approved: number;
    averageRating: number | null;
    hidden: number;
    pending: number;
    rejected: number;
    reviews: number;
  };
  reviews: AdminCustomerReviewRow[];
};

export async function getAdminCustomerReviews(): Promise<AdminCustomerReviewsData> {
  const rows = await db
    .select({
      approvedAt: reviews.approvedAt,
      body: reviews.body,
      brandName: brands.name,
      createdAt: reviews.createdAt,
      customerDisplayName: reviews.customerDisplayName,
      customerEmail: users.email,
      customerName: users.name,
      hiddenAt: reviews.hiddenAt,
      id: reviews.id,
      isVerifiedPurchase: reviews.isVerifiedPurchase,
      orderId: reviews.orderId,
      orderNumber: orders.orderNumber,
      productId: reviews.productId,
      productSlug: products.slug,
      productTitle: products.title,
      rating: reviews.rating,
      rejectedAt: reviews.rejectedAt,
      rejectedReason: reviews.rejectedReason,
      status: reviews.status,
      title: reviews.title,
      updatedAt: reviews.updatedAt,
      variantTitle: productVariants.title,
    })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .leftJoin(productVariants, eq(productVariants.id, reviews.variantId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(orders, eq(orders.id, reviews.orderId))
    .leftJoin(users, eq(users.id, reviews.userId))
    .orderBy(desc(reviews.createdAt));

  const productIds = Array.from(new Set(rows.map((row) => row.productId)));
  const summaries = await getProductRatingSummariesByProductId(productIds);
  const aggregateReviewCount = Array.from(summaries.values()).reduce(
    (total, summary) => total + summary.reviewCount,
    0,
  );
  const aggregateRatingTotal = Array.from(summaries.values()).reduce(
    (total, summary) =>
      total + (summary.averageRating ?? 0) * summary.reviewCount,
    0,
  );

  return {
    metrics: {
      approved: rows.filter((row) => row.status === "approved").length,
      averageRating:
        aggregateReviewCount > 0
          ? Math.round((aggregateRatingTotal / aggregateReviewCount) * 10) / 10
          : null,
      hidden: rows.filter((row) => row.status === "hidden").length,
      pending: rows.filter((row) => row.status === "pending").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
      reviews: rows.length,
    },
    reviews: rows,
  };
}
