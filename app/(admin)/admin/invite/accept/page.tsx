import type { Metadata } from "next";

import { acceptAdminInvite } from "@/app/(admin)/admin/invite/actions";
import { AdminInviteAcceptScreen } from "@/app/(admin)/admin/invite/accept/screen";
import { getValidAdminStaffInvitation } from "@/src/modules/admin/staff";

export const metadata: Metadata = {
  title: "Accept Admin Invitation",
  description: "Accept your Jurgens Energy admin staff invitation.",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminInviteAcceptPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function AdminInviteAcceptPage({
  searchParams,
}: AdminInviteAcceptPageProps) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token ?? "";
  const invitation = token ? await getValidAdminStaffInvitation(token) : null;

  return (
    <AdminInviteAcceptScreen
      action={acceptAdminInvite}
      email={invitation?.email ?? null}
      name={invitation?.name ?? null}
      roles={invitation?.roles ?? (invitation?.role ? [invitation.role] : [])}
      token={token}
      isTokenValid={Boolean(invitation)}
    />
  );
}
