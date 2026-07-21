import type { Metadata } from "next";

import { resetPassword } from "@/app/forgot-password/actions";
import { ResetPasswordScreen } from "@/components/auth/reset-password-screen";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { isPasswordResetTokenValid } from "@/src/modules/auth/service";

export const metadata: Metadata = {
  title: "Reset Online Store Password",
  description: "Set a new password for your Jurgens Energy online-store account.",
  robots: {
    index: false,
    follow: false,
  },
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token ?? "";
  const isTokenValid = token ? await isPasswordResetTokenValid(token) : false;

  return (
    <MarketplaceGate>
      <ResetPasswordScreen
        action={resetPassword}
        token={token}
        isTokenValid={isTokenValid}
        accent="gold"
      />
    </MarketplaceGate>
  );
}
