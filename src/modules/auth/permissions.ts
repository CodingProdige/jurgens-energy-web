import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  hasAdminCapability,
} from "@/src/modules/admin/staff";
import type { AdminCapability } from "@/src/modules/admin/staff-constants";
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

export async function requireAdminCapability(capability: AdminCapability) {
  const session = await requireAdminAccess();

  if (!hasAdminCapability(session.user.adminCapabilities, capability)) {
    return {
      ok: false,
      session,
    } as const;
  }

  return {
    ok: true,
    session,
  } as const;
}

export async function requireSellerDashboardAccess() {
  return requireCapability("seller");
}
