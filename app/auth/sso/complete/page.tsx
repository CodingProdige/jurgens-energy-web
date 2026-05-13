import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  canAccessCapability,
  ensureUserRole,
  findUserById,
  getUserRoles,
} from "@/src/modules/auth/service";
import { getSharedAuthCookieDomain } from "@/src/modules/auth/constants";
import {
  createSurfaceAccessToken,
  getSurfaceAccessCookieName,
} from "@/src/modules/auth/surface-access";
import { isSsoIntent } from "@/src/modules/auth/sso";
import { addEmailSubscriber } from "@/src/modules/marketing/email-subscribers";

type SsoCompletePageProps = {
  searchParams: Promise<{
    intent?: string;
  }>;
};

async function setSessionSurfaceAccess(
  surface: "admin" | "seller",
  userId: string,
) {
  const cookieStore = await cookies();
  const surfaceAccessToken = createSurfaceAccessToken({
    remember: false,
    surface,
    userId,
  });

  cookieStore.set(getSurfaceAccessCookieName(surface), surfaceAccessToken, {
    domain: getSharedAuthCookieDomain(),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export default async function SsoCompletePage({
  searchParams,
}: SsoCompletePageProps) {
  const { intent: rawIntent } = await searchParams;
  const intent = isSsoIntent(rawIntent) ? rawIntent : null;
  const session = await auth();

  if (!intent || !session?.user?.id) {
    redirect("/sign-in");
  }

  const user = await findUserById(session.user.id);

  if (!user?.isActive) {
    redirect("/sign-in");
  }

  const roles = await getUserRoles(user.id);

  if (intent === "marketplace_sign_in" || intent === "marketplace_register") {
    if (!roles.includes("customer")) {
      await ensureUserRole(user.id, "customer");
    }

    if (user.email) {
      await addEmailSubscriber({
        email: user.email,
        source: "customer_signup",
      });
    }

    redirect("/");
  }

  if (intent === "admin_sign_in") {
    if (!canAccessCapability({ roles }, "admin")) {
      redirect("/sign-in?error=admin_access_required");
    }

    await setSessionSurfaceAccess("admin", user.id);
    redirect("/");
  }

  if (intent === "seller_sign_in") {
    if (!canAccessCapability({ roles }, "seller")) {
      redirect("/register?from=sso");
    }

    await setSessionSurfaceAccess("seller", user.id);
    redirect("/");
  }

  redirect("/register?from=sso");
}
