import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Seller Sign In",
  description: "Seller access has moved into the Jurgens Energy admin dashboard.",
  robots: {
    follow: false,
    index: false,
  },
};

export default function SellerSignInPage() {
  redirect("/admin/sign-in");
}
