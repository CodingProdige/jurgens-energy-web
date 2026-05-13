import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signInSellerWithGoogle } from "@/app/auth/sso/actions";
import { signInSellerWithPassword } from "@/app/sign-in/actions";
import { SellerSignInScreen } from "@/app/(seller)/seller/sign-in/seller-sign-in-screen";
import { rememberedEmailCookieName } from "@/src/modules/auth/constants";
import { canAccessCapability } from "@/src/modules/auth/service";
import {
  getSurfaceAccessCookieName,
  verifySurfaceAccessToken,
} from "@/src/modules/auth/surface-access";

export const metadata: Metadata = {
  title: "Seller Sign In",
  description: "Sign in to the protected Piessang seller dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SellerSignInPage() {
  const session = await auth();
  const cookieStore = await cookies();
  const rememberedEmail = cookieStore.get(rememberedEmailCookieName)?.value;
  const surfaceAccessToken = cookieStore.get(
    getSurfaceAccessCookieName("seller"),
  )?.value;

  if (
    session?.user &&
    canAccessCapability({ roles: session.user.roles }, "seller") &&
    verifySurfaceAccessToken({
      surface: "seller",
      token: surfaceAccessToken,
      userId: session.user.id,
    })
  ) {
    redirect("/");
  }

  return (
    <SellerSignInScreen
      action={signInSellerWithPassword}
      googleAction={signInSellerWithGoogle}
      rememberedEmail={rememberedEmail}
    />
  );
}
