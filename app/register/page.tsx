import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registerCustomerWithPassword } from "@/app/register/actions";
import { MarketplaceAuthScreen } from "@/components/auth/marketplace-auth-screen";

export const metadata: Metadata = {
  title: "Create Marketplace Account",
  description: "Create your Piessang marketplace account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RegisterPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  return (
    <MarketplaceAuthScreen
      action={registerCustomerWithPassword}
      mode="register"
    />
  );
}
