import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin Users",
  description: "Seller access has been retired for the single Jurgens Energy catalog.",
  robots: {
    follow: false,
    index: false,
  },
};

export default function SellerUsersPage() {
  redirect("/users/all");
}
