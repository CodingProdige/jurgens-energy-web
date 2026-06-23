import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  inAppNotificationSurfaces,
  type InAppNotificationSurface,
} from "@/src/db/schema";
import { canAccessCapability } from "@/src/modules/auth/service";
import {
  getSurfaceAccessCookieName,
  verifySurfaceAccessToken,
} from "@/src/modules/auth/surface-access";
import { getNotificationCenter } from "@/src/modules/notifications/in-app";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const surface = searchParams.get("surface");

  if (
    !surface ||
    !inAppNotificationSurfaces.includes(surface as InAppNotificationSurface)
  ) {
    return NextResponse.json({ message: "Invalid surface" }, { status: 400 });
  }

  if (surface === "admin" || surface === "seller") {
    if (!canAccessCapability({ roles: session.user.roles }, surface)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const cookieStore = await cookies();
    const surfaceAccessToken = cookieStore.get(
      getSurfaceAccessCookieName(surface),
    )?.value;

    if (
      !verifySurfaceAccessToken({
        surface,
        token: surfaceAccessToken,
        userId: session.user.id,
      })
    ) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const parsedLimit = Number(searchParams.get("limit") ?? 12);
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 12;

  const notificationCenter = await getNotificationCenter({
    limit,
    surface: surface as InAppNotificationSurface,
    userId: session.user.id,
  });

  return NextResponse.json(notificationCenter);
}
