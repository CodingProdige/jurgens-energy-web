import type { Metadata } from "next";

import { NotificationCenterPage } from "@/components/notifications/notification-center-page";
import { requireAdminAccess } from "@/src/modules/auth/permissions";
import { getNotificationCenter } from "@/src/modules/notifications/in-app";

export const metadata: Metadata = {
  title: "Admin Notifications",
  description: "Review Jurgens Energy admin dashboard notifications and event links.",
  robots: { follow: false, index: false },
};

export default async function AdminNotificationsPage() {
  const session = await requireAdminAccess();
  const notificationCenter = await getNotificationCenter({
    limit: 100,
    surface: "admin",
    userId: session.user.id,
  });

  return (
    <NotificationCenterPage
      breadcrumbs={["Admin", "Notifications"]}
      emptyCopy="Product, shipping, user, and platform events will appear here when they need attention."
      state={notificationCenter}
      title="Notifications"
    />
  );
}
