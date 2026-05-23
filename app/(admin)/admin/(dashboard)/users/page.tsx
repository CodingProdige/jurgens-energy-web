import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Admin Users",
  description: "Manage Piessang marketplace user accounts and access roles.",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminUsersPageProps = {
  searchParams: Promise<{
    role?: string | string[];
  }>;
};

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const { role } = await searchParams;
  const roleFilter = Array.isArray(role) ? role[0] : role;

  if (roleFilter === "customer") {
    redirect("/users/customers");
  }

  if (roleFilter === "admins") {
    redirect("/users/admins");
  }

  if (roleFilter === "sellers") {
    redirect("/users/sellers");
  }

  redirect("/users/all");
}
