import type { Metadata } from "next";

import { requestCustomerPasswordReset } from "@/app/forgot-password/actions";
import { ForgotPasswordScreen } from "@/components/auth/forgot-password-screen";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";

export const metadata: Metadata = {
  title: "Marketplace Password Reset",
  description: "Request a password reset link for your Piessang account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordPage() {
  return (
    <MarketplaceGate>
      <ForgotPasswordScreen
        action={requestCustomerPasswordReset}
        accent="gold"
        titleLead="No worries,"
        titleAccent="it happens"
        description="Enter your email address and we'll send you a link to reset your marketplace password."
      />
    </MarketplaceGate>
  );
}
