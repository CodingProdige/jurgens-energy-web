import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Seller Password Reset",
  description: "Seller access has moved into the Jurgens Energy admin dashboard.",
  robots: {
    follow: false,
    index: false,
  },
};

export default function SellerForgotPasswordPage() {
  redirect("/admin/forgot-password");
}
