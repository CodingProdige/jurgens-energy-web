import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signInCustomerWithPassword } from "@/app/sign-in/actions";
import { MarketplaceAuthScreen } from "@/components/auth/marketplace-auth-screen";
import { rememberedEmailCookieName } from "@/src/modules/auth/constants";

export const metadata: Metadata = {
  title: "Customer Sign In",
  description: "Sign in to your Piessang marketplace account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SignInPage() {
  const session = await auth();
  const cookieStore = await cookies();
  const rememberedEmail = cookieStore.get(rememberedEmailCookieName)?.value;

  if (session?.user) {
    redirect("/");
  }

  return (
    <MarketplaceAuthScreen
      action={signInCustomerWithPassword}
      rememberedEmail={rememberedEmail}
      mode="sign-in"
    />
  );
}
