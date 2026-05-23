import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inAppNotifications,
  userRoles,
  type InAppNotificationSurface,
} from "@/src/db/schema";

export type NotificationCenterItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  surface: InAppNotificationSurface;
  actionLabel: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationCenterState = {
  unreadCount: number;
  notifications: NotificationCenterItem[];
};

export const emptyNotificationCenter: NotificationCenterState = {
  unreadCount: 0,
  notifications: [],
};

export async function getNotificationCenter({
  limit = 12,
  surface,
  userId,
}: {
  limit?: number;
  surface: InAppNotificationSurface;
  userId: string;
}): Promise<NotificationCenterState> {
  const [rows, unreadRows] = await Promise.all([
    db
      .select({
        actionLabel: inAppNotifications.actionLabel,
        actionUrl: inAppNotifications.actionUrl,
        body: inAppNotifications.body,
        createdAt: inAppNotifications.createdAt,
        id: inAppNotifications.id,
        readAt: inAppNotifications.readAt,
        surface: inAppNotifications.surface,
        title: inAppNotifications.title,
        type: inAppNotifications.type,
      })
      .from(inAppNotifications)
      .where(
        and(
          eq(inAppNotifications.recipientUserId, userId),
          eq(inAppNotifications.surface, surface),
          isNull(inAppNotifications.dismissedAt),
        ),
      )
      .orderBy(desc(inAppNotifications.createdAt))
      .limit(limit),
    db
      .select({ value: count() })
      .from(inAppNotifications)
      .where(
        and(
          eq(inAppNotifications.recipientUserId, userId),
          eq(inAppNotifications.surface, surface),
          isNull(inAppNotifications.dismissedAt),
          isNull(inAppNotifications.readAt),
        ),
      ),
  ]);

  return {
    unreadCount: unreadRows[0]?.value ?? 0,
    notifications: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    })),
  };
}

export async function markInAppNotificationRead({
  notificationId,
  surface,
  userId,
}: {
  notificationId: string;
  surface: InAppNotificationSurface;
  userId: string;
}) {
  await db
    .update(inAppNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(inAppNotifications.id, notificationId),
        eq(inAppNotifications.recipientUserId, userId),
        eq(inAppNotifications.surface, surface),
        isNull(inAppNotifications.readAt),
      ),
    );
}

export async function markAllInAppNotificationsRead({
  surface,
  userId,
}: {
  surface: InAppNotificationSurface;
  userId: string;
}) {
  await db
    .update(inAppNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(inAppNotifications.recipientUserId, userId),
        eq(inAppNotifications.surface, surface),
        isNull(inAppNotifications.readAt),
      ),
    );
}

export async function getAdminNotificationRecipientIds() {
  const rows = await db
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .where(inArray(userRoles.role, ["admin", "superadmin"]));

  return rows.map((row) => row.userId);
}
