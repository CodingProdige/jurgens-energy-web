import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  canAccessCapability,
  type AccessCapability,
} from "@/src/modules/auth/service";
import {
  getSurfaceAccessCookieName,
  verifySurfaceAccessToken,
} from "@/src/modules/auth/surface-access";

export async function requireCapability(capability: AccessCapability) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  if (!canAccessCapability({ roles: session.user.roles }, capability)) {
    redirect("/sign-in");
  }

  if (capability === "admin" || capability === "seller") {
    const cookieStore = await cookies();
    const surfaceAccessToken = cookieStore.get(
      getSurfaceAccessCookieName(capability),
    )?.value;

    if (
      !verifySurfaceAccessToken({
        surface: capability,
        token: surfaceAccessToken,
        userId: session.user.id,
      })
    ) {
      redirect("/sign-in");
    }
  }

  return session;
}

export async function requireAdminAccess() {
  return requireCapability("admin");
}

export async function requireSellerDashboardAccess() {
  return requireCapability("seller");
}
