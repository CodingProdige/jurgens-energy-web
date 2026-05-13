import type { Metadata } from "next";

import { auth } from "@/auth";
import { SellerRegisterScreen } from "@/app/(seller)/seller/register/seller-register-screen";
import {
  findSellerApplicationByUserId,
  getSellerAccessState,
} from "@/src/modules/sellers/applications";

export const metadata: Metadata = {
  title: "Apply to Sell",
  description: "Apply to sell on Piessang Marketplace.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SellerRegisterPage() {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return <SellerRegisterScreen />;
  }

  const accessState = await getSellerAccessState(session.user.id);

  if (accessState.hasSellerAccess) {
    return (
      <SellerRegisterScreen
        initialEmailState={{
          email: session.user.email,
          mode: "already_seller",
          userName: session.user.name,
        }}
      />
    );
  }

  const application = await findSellerApplicationByUserId(session.user.id);

  if (application) {
    return (
      <SellerRegisterScreen
        initialEmailState={{
          applicationStatus: application.status,
          email: session.user.email,
          mode: "existing_application",
          userName: session.user.name,
        }}
      />
    );
  }

  return (
    <SellerRegisterScreen
      initialEmailState={{
        email: session.user.email,
        mode: "existing_signed_in",
        userName: session.user.name,
      }}
    />
  );
}
