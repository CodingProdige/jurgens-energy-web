import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin Brands",
  description: "Brand requests have been retired for the single Jurgens Energy catalog.",
  robots: {
    follow: false,
    index: false,
  },
};

export default function AdminBrandRequestsPage() {
  redirect("/catalog/brands");
}
