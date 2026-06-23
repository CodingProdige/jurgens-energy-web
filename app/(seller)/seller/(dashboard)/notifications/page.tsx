import type { Metadata } from "next";

import { NotificationCenterPage } from "@/components/notifications/notification-center-page";
import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { getNotificationCenter } from "@/src/modules/notifications/in-app";

export const metadata: Metadata = {
  title: "Seller Notifications",
  description: "Review Piessang seller dashboard notifications and event links.",
  robots: { follow: false, index: false },
};

export default async function SellerNotificationsPage() {
  const session = await requireSellerDashboardAccess();
  const notificationCenter = await getNotificationCenter({
    limit: 100,
    surface: "seller",
    userId: session.user.id,
  });

  return (
    <NotificationCenterPage
      breadcrumbs={["Seller", "Notifications"]}
      emptyCopy="Product, order, shipping, payout, and setup events will appear here when they need attention."
      state={notificationCenter}
      title="Notifications"
    />
  );
}
