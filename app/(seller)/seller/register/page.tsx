import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Seller Registration",
  description: "Seller registration has been retired for Jurgens Energy.",
  robots: {
    follow: false,
    index: false,
  },
};

export default function SellerRegisterPage() {
  redirect("/admin");
}
