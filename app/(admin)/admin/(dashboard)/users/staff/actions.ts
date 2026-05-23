"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  adminStaffRoles,
  type AdminStaffRole,
} from "@/src/db/schema";
import {
  createAdminStaffInvitation,
  revokeAdminStaffInvitation,
  setAdminStaffEnabled,
  updateAdminStaffRoles,
} from "@/src/modules/admin/staff";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export type InviteAdminStaffState = {
  message?: string;
  ok?: boolean;
};

export type StaffMutationState = {
  message?: string;
  ok?: boolean;
};

const inviteAdminStaffSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  name: z.string().trim().max(160).optional(),
  roles: z.array(z.enum(adminStaffRoles)).min(1),
});

const staffIdSchema = z.object({
  id: z.string().uuid(),
});

const updateStaffRoleSchema = staffIdSchema.extend({
  roles: z.array(z.enum(adminStaffRoles)).min(1),
});

const setStaffEnabledSchema = staffIdSchema.extend({
  enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
  userId: z.string().uuid(),
});

function getRequestOrigin(headerStore: Headers) {
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");

  if (!host) {
    return "http://admin.localhost:3000";
  }

  return `${forwardedProto ?? "http"}://${host}`;
}

function revalidateAdminStaffPages() {
  revalidatePath("/users/staff");
  revalidatePath("/admin/users/staff");
}

export async function inviteAdminStaff(
  _state: InviteAdminStaffState,
  formData: FormData,
): Promise<InviteAdminStaffState> {
  const access = await requireAdminCapability("admin.staff.manage");

  if (!access.ok) {
    return { ok: false, message: "You do not have permission to invite staff." };
  }

  const parsed = inviteAdminStaffSchema.safeParse({
    email: formData.get("email"),
    name: String(formData.get("name") ?? "").trim() || undefined,
    roles: formData.getAll("roles") as AdminStaffRole[],
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the invitation fields.",
    };
  }

  await createAdminStaffInvitation({
    actorUserId: access.session.user.id,
    email: parsed.data.email,
    name: parsed.data.name,
    origin: getRequestOrigin(await headers()),
    roles: parsed.data.roles,
  });

  revalidateAdminStaffPages();

  return { ok: true, message: "Invitation sent." };
}

export async function updateAdminStaffRoleAction(formData: FormData) {
  const access = await requireAdminCapability("admin.staff.manage");

  if (!access.ok) {
    return;
  }

  const parsed = updateStaffRoleSchema.safeParse({
    id: formData.get("id"),
    roles: formData.getAll("roles") as AdminStaffRole[],
  });

  if (
    !parsed.success ||
    (parsed.data.roles.includes("owner") &&
      access.session.user.adminStaffRole !== "owner")
  ) {
    return;
  }

  await updateAdminStaffRoles({
    actorUserId: access.session.user.id,
    roles: parsed.data.roles,
    staffId: parsed.data.id,
  });

  revalidateAdminStaffPages();
}

export async function setAdminStaffEnabledAction(
  _state: StaffMutationState,
  formData: FormData,
): Promise<StaffMutationState> {
  const access = await requireAdminCapability("admin.staff.manage");

  if (!access.ok) {
    return { ok: false, message: "You do not have permission to manage staff." };
  }

  const parsed = setStaffEnabledSchema.safeParse({
    enabled: formData.get("enabled"),
    id: formData.get("id"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Staff member was not found." };
  }

  if (parsed.data.userId === access.session.user.id) {
    return { ok: false, message: "You cannot change your own staff access." };
  }

  const updated = await setAdminStaffEnabled({
    actorUserId: access.session.user.id,
    enabled: parsed.data.enabled,
    staffId: parsed.data.id,
  });

  if (!updated) {
    return { ok: false, message: "Staff access could not be updated." };
  }

  revalidateAdminStaffPages();

  return {
    ok: true,
    message: parsed.data.enabled ? "Staff access enabled." : "Staff access disabled.",
  };
}

export async function revokeAdminStaffInvitationAction(formData: FormData) {
  const access = await requireAdminCapability("admin.staff.manage");

  if (!access.ok) {
    return;
  }

  const parsed = staffIdSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return;
  }

  await revokeAdminStaffInvitation({
    actorUserId: access.session.user.id,
    invitationId: parsed.data.id,
  });

  revalidateAdminStaffPages();
}
