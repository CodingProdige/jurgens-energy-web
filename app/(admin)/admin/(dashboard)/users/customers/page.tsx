import type { Metadata } from "next";

import { UserManager } from "@/app/(admin)/admin/(dashboard)/users/user-manager";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminUsers } from "@/src/modules/users/admin";

export const metadata: Metadata = {
  title: "Admin Customers",
  description: "Manage Piessang marketplace customer accounts.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminCustomersPage() {
  const access = await requireAdminCapability("admin.users.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const userData = await getAdminUsers();

  return (
    <UserManager
      {...userData}
      canManage={access.session.user.adminCapabilities.includes(
        "admin.users.manage",
      )}
      page="customers"
    />
  );
}
