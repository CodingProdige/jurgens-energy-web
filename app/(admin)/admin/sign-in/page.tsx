import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signInAdminWithGoogle } from "@/app/auth/sso/actions";
import { signInAdminWithPassword } from "@/app/sign-in/actions";
import { AdminSignInScreen } from "@/app/(admin)/admin/sign-in/admin-sign-in-screen";
import { rememberedEmailCookieName } from "@/src/modules/auth/constants";
import { canAccessCapability } from "@/src/modules/auth/service";
import {
  getSurfaceAccessCookieName,
  verifySurfaceAccessToken,
} from "@/src/modules/auth/surface-access";

export const metadata: Metadata = {
  title: "Admin Sign In",
  description: "Sign in to the protected Jurgens Energy admin dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminSignInPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function AdminSignInPage({
  searchParams,
}: AdminSignInPageProps) {
  const { error } = await searchParams;
  const session = await auth();
  const cookieStore = await cookies();
  const rememberedEmail = cookieStore.get(rememberedEmailCookieName)?.value;
  const surfaceAccessToken = cookieStore.get(
    getSurfaceAccessCookieName("admin"),
  )?.value;

  if (
    session?.user &&
    canAccessCapability({ roles: session.user.roles }, "admin") &&
    verifySurfaceAccessToken({
      surface: "admin",
      token: surfaceAccessToken,
      userId: session.user.id,
    })
  ) {
    redirect("/");
  }

  return (
    <AdminSignInScreen
      action={signInAdminWithPassword}
      googleAction={signInAdminWithGoogle}
      rememberedEmail={rememberedEmail}
      ssoError={error}
    />
  );
}
