import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin Users",
  description: "Seller applications have been retired for Jurgens Energy.",
  robots: {
    follow: false,
    index: false,
  },
};

export default function SellerApplicationsPage() {
  redirect("/users/all");
}
