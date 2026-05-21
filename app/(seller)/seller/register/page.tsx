import type { Metadata } from "next";

import { auth } from "@/auth";
import { SellerRegisterScreen } from "@/app/(seller)/seller/register/seller-register-screen";
import { findUserById } from "@/src/modules/auth/service";
import { verifySsoHandoffToken } from "@/src/modules/auth/sso-handoff";
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

type SellerRegisterPageProps = {
  searchParams: Promise<{
    sso?: string;
  }>;
};

export default async function SellerRegisterPage({
  searchParams,
}: SellerRegisterPageProps) {
  const { sso } = await searchParams;
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    const handoff = verifySsoHandoffToken(sso);

    if (handoff) {
      const user = await findUserById(handoff.userId);

      if (
        user?.isActive &&
        user.email?.toLowerCase() === handoff.email.toLowerCase()
      ) {
        const accessState = await getSellerAccessState(user.id);

        if (accessState.hasSellerAccess) {
          return (
            <SellerRegisterScreen
              initialEmailState={{
                email: user.email,
                mode: "already_seller",
                userName: user.name,
              }}
              ssoHandoffToken={sso}
            />
          );
        }

        const application = await findSellerApplicationByUserId(user.id);

        if (application) {
          return (
            <SellerRegisterScreen
              initialEmailState={{
                applicationStatus: application.status,
                email: user.email,
                mode: "existing_application",
                userName: user.name,
              }}
              ssoHandoffToken={sso}
            />
          );
        }

        return (
          <SellerRegisterScreen
            initialEmailState={{
              email: user.email,
              mode: "existing_signed_in",
              userName: user.name,
            }}
            ssoHandoffToken={sso}
          />
        );
      }
    }

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
