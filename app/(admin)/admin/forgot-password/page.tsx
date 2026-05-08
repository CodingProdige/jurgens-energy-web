import type { Metadata } from "next";

import { requestAdminPasswordReset } from "@/app/forgot-password/actions";
import { ForgotPasswordScreen } from "@/components/auth/forgot-password-screen";

export const metadata: Metadata = {
  title: "Admin Password Reset",
  description: "Request a password reset link for Piessang admin access.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminForgotPasswordPage() {
  return (
    <ForgotPasswordScreen
      action={requestAdminPasswordReset}
      accent="gold"
      titleLead="No worries,"
      titleAccent="it happens"
      description="Enter your email address and we'll send you a link to reset your admin password."
    />
  );
}
