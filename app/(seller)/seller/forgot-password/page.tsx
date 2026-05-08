import type { Metadata } from "next";

import { requestSellerPasswordReset } from "@/app/forgot-password/actions";
import { ForgotPasswordScreen } from "@/components/auth/forgot-password-screen";

export const metadata: Metadata = {
  title: "Seller Password Reset",
  description: "Request a password reset link for Piessang seller access.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SellerForgotPasswordPage() {
  return (
    <ForgotPasswordScreen
      action={requestSellerPasswordReset}
      accent="green"
      titleLead="No worries,"
      titleAccent="it happens"
      description="Enter your email address and we'll send you a link to reset your seller password."
    />
  );
}
