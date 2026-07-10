import type { Metadata } from "next";

import { UserManager } from "@/app/(admin)/admin/(dashboard)/users/user-manager";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getAdminMediaLibrary } from "@/src/modules/media/admin";
import { getAdminUsers } from "@/src/modules/users/admin";

export const metadata: Metadata = {
  title: "Admin Customers",
  description: "Manage Jurgens Energy customer accounts.",
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

  const [userData, mediaLibrary] = await Promise.all([
    getAdminUsers(),
    getAdminMediaLibrary(access.session.user.id),
  ]);

  return (
    <UserManager
      {...userData}
      canManage={access.session.user.adminCapabilities.includes(
        "admin.users.manage",
      )}
      mediaLibrary={mediaLibrary}
      page="customers"
    />
  );
}
