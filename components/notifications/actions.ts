"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  inAppNotificationSurfaces,
  type InAppNotificationSurface,
} from "@/src/db/schema";
import {
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
} from "@/src/modules/notifications/in-app";

function parseSurface(surface: string): InAppNotificationSurface {
  if (
    inAppNotificationSurfaces.includes(surface as InAppNotificationSurface)
  ) {
    return surface as InAppNotificationSurface;
  }

  throw new Error("Invalid notification surface.");
}

export async function markNotificationReadAction({
  notificationId,
  surface,
}: {
  notificationId: string;
  surface: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false };
  }

  await markInAppNotificationRead({
    notificationId,
    surface: parseSurface(surface),
    userId: session.user.id,
  });
  revalidatePath("/");

  return { ok: true };
}

export async function markAllNotificationsReadAction({
  surface,
}: {
  surface: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false };
  }

  await markAllInAppNotificationsRead({
    surface: parseSurface(surface),
    userId: session.user.id,
  });
  revalidatePath("/");

  return { ok: true };
}
