import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin Products",
  description: "Product reviews have been retired for the single Jurgens Energy catalog.",
  robots: {
    follow: false,
    index: false,
  },
};

export default function AdminProductReviewsPage() {
  redirect("/products/all");
}
