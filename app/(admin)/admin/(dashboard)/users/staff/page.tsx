import type { Metadata } from "next";

import { AdminStaffManager } from "@/app/(admin)/admin/(dashboard)/users/staff/staff-manager";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import { getAdminStaffDirectory } from "@/src/modules/admin/staff";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "Admin Staff",
  description: "Invite and manage Piessang admin dashboard staff access.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminStaffPage() {
  const access = await requireAdminCapability("admin.staff.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const directory = await getAdminStaffDirectory();

  return (
    <AdminStaffManager
      canManage={access.session.user.adminCapabilities.includes(
        "admin.staff.manage",
      )}
      currentUserId={access.session.user.id}
      currentUserIsOwner={access.session.user.adminStaffRole === "owner"}
      invitations={directory.invitations}
      staff={directory.staff}
    />
  );
}
