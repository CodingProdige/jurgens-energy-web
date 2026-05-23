import { and, eq, isNull } from "drizzle-orm";
import webPush, { type PushSubscription as WebPushSubscription } from "web-push";

import { env } from "@/src/config/env";
import { db } from "@/src/db";
import {
  type InAppNotificationSurface,
  pushNotificationSubscriptions,
} from "@/src/db/schema";

export type BrowserPushSubscriptionInput = {
  auth: string;
  endpoint: string;
  p256dh: string;
};

export type WebPushPayload = {
  body: string;
  icon?: string;
  tag: string;
  title: string;
  url?: string | null;
};

export function getWebPushPublicKey() {
  return env.WEB_PUSH_PUBLIC_KEY ?? null;
}

export function isWebPushConfigured() {
  return Boolean(
    env.WEB_PUSH_PUBLIC_KEY &&
      env.WEB_PUSH_PRIVATE_KEY &&
      env.WEB_PUSH_SUBJECT,
  );
}

function configureWebPush() {
  if (!isWebPushConfigured()) {
    return false;
  }

  webPush.setVapidDetails(
    env.WEB_PUSH_SUBJECT,
    env.WEB_PUSH_PUBLIC_KEY!,
    env.WEB_PUSH_PRIVATE_KEY!,
  );

  return true;
}

export async function savePushSubscription({
  subscription,
  surface,
  userAgent,
  userId,
}: {
  subscription: BrowserPushSubscriptionInput;
  surface: InAppNotificationSurface;
  userAgent?: string | null;
  userId: string;
}) {
  const now = new Date();
  const [existing] = await db
    .select({ id: pushNotificationSubscriptions.id })
    .from(pushNotificationSubscriptions)
    .where(eq(pushNotificationSubscriptions.endpoint, subscription.endpoint))
    .limit(1);

  if (existing) {
    await db
      .update(pushNotificationSubscriptions)
      .set({
        auth: subscription.auth,
        lastUsedAt: now,
        p256dh: subscription.p256dh,
        revokedAt: null,
        surface,
        updatedAt: now,
        userAgent: userAgent ?? null,
        userId,
      })
      .where(eq(pushNotificationSubscriptions.id, existing.id));

    return { ok: true, created: false } as const;
  }

  await db.insert(pushNotificationSubscriptions).values({
    auth: subscription.auth,
    endpoint: subscription.endpoint,
    lastUsedAt: now,
    p256dh: subscription.p256dh,
    surface,
    updatedAt: now,
    userAgent: userAgent ?? null,
    userId,
  });

  return { ok: true, created: true } as const;
}

export async function revokePushSubscription({
  endpoint,
  userId,
}: {
  endpoint: string;
  userId: string;
}) {
  await db
    .update(pushNotificationSubscriptions)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(pushNotificationSubscriptions.endpoint, endpoint),
        eq(pushNotificationSubscriptions.userId, userId),
      ),
    );

  return { ok: true } as const;
}

export async function sendPushNotificationToUser({
  payload,
  userId,
}: {
  payload: WebPushPayload;
  userId: string;
}) {
  const subscriptions = await db
    .select()
    .from(pushNotificationSubscriptions)
    .where(
      and(
        eq(pushNotificationSubscriptions.userId, userId),
        isNull(pushNotificationSubscriptions.revokedAt),
      ),
    );

  if (subscriptions.length === 0) {
    return {
      delivered: false,
      reason: "no_push_subscriptions",
      sentCount: 0,
      subscriptionCount: 0,
    } as const;
  }

  if (!configureWebPush()) {
    return {
      delivered: false,
      reason: "push_transport_not_configured",
      sentCount: 0,
      subscriptionCount: subscriptions.length,
    } as const;
  }

  let sentCount = 0;
  let revokedCount = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const webPushSubscription: WebPushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          auth: subscription.auth,
          p256dh: subscription.p256dh,
        },
      };

      try {
        await webPush.sendNotification(
          webPushSubscription,
          JSON.stringify(payload),
        );
        sentCount += 1;
        await db
          .update(pushNotificationSubscriptions)
          .set({ lastUsedAt: new Date(), updatedAt: new Date() })
          .where(eq(pushNotificationSubscriptions.id, subscription.id));
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number(error.statusCode)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          revokedCount += 1;
          await db
            .update(pushNotificationSubscriptions)
            .set({ revokedAt: new Date(), updatedAt: new Date() })
            .where(eq(pushNotificationSubscriptions.id, subscription.id));
        } else {
          console.error("Failed to send push notification", error);
        }
      }
    }),
  );

  return {
    delivered: sentCount > 0,
    revokedCount,
    sentCount,
    subscriptionCount: subscriptions.length,
  } as const;
}
