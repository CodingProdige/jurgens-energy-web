import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { sellerStaff, sellers } from "@/src/db/schema";
import {
  getAdminNotificationRecipientIds,
} from "@/src/modules/notifications/in-app";
import { notify } from "@/src/modules/notifications/templates";

type ProductReviewNotificationInput = {
  productId: string;
  productTitle: string;
};

async function getSellerNotificationRecipientIds(sellerId: string) {
  const [[seller], staffRows] = await Promise.all([
    db
      .select({ ownerUserId: sellers.ownerUserId })
      .from(sellers)
      .where(eq(sellers.id, sellerId))
      .limit(1),
    db
      .select({ userId: sellerStaff.userId })
      .from(sellerStaff)
      .where(eq(sellerStaff.sellerId, sellerId)),
  ]);

  return Array.from(
    new Set([
      seller?.ownerUserId,
      ...staffRows.map((row) => row.userId),
    ].filter((userId): userId is string => Boolean(userId))),
  );
}

export async function notifyAdminsProductSubmitted({
  productId,
  productTitle,
  sellerName,
}: ProductReviewNotificationInput & {
  sellerName: string;
}) {
  const adminUserIds = await getAdminNotificationRecipientIds();

  await Promise.all(
    adminUserIds.map((recipientUserId) =>
      notify({
        data: {
          adminProductReviewUrl: `/products/reviews`,
          productId,
          productTitle,
          sellerName,
        },
        event: "admin.product_review.submitted",
        recipientUserId,
      }),
    ),
  );
}

export async function notifySellerProductApproved({
  productId,
  productTitle,
  sellerId,
}: ProductReviewNotificationInput & {
  sellerId: string;
}) {
  const recipientUserIds = await getSellerNotificationRecipientIds(sellerId);

  await Promise.all(
    recipientUserIds.map((recipientUserId) =>
      notify({
        data: {
          productEditUrl: `/products/${productId}/edit`,
          productId,
          productTitle,
        },
        event: "seller.product_review.approved",
        recipientUserId,
      }),
    ),
  );
}

export async function notifySellerProductChangesRequested({
  productId,
  productTitle,
  reason,
  sellerId,
}: ProductReviewNotificationInput & {
  reason: string;
  sellerId: string;
}) {
  const recipientUserIds = await getSellerNotificationRecipientIds(sellerId);

  await Promise.all(
    recipientUserIds.map((recipientUserId) =>
      notify({
        data: {
          productEditUrl: `/products/${productId}/edit`,
          productId,
          productTitle,
          reason,
        },
        event: "seller.product_review.changes_requested",
        recipientUserId,
      }),
    ),
  );
}
