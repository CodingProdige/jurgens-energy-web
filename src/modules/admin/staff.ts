import crypto from "node:crypto";

import { and, eq, gt, inArray, isNull } from "drizzle-orm";

import { db } from "@/src/db";
import {
  adminStaff,
  adminStaffInvitations,
  adminStaffRoles,
  auditLogs,
  userRoles,
  users,
  type AdminStaffRole,
} from "@/src/db/schema";
import { hashPassword } from "@/src/modules/auth/service";
import { sendNotificationEmail } from "@/src/modules/notifications/templates";
import {
  adminCapabilities,
  adminStaffRoleLabels,
  type AdminCapability,
} from "@/src/modules/admin/staff-constants";

const allCapabilities = new Set<AdminCapability>(adminCapabilities);

const roleCapabilities: Record<AdminStaffRole, readonly AdminCapability[]> = {
  owner: adminCapabilities,
  manager: [
    "admin.dashboard.view",
    "admin.staff.view",
    "admin.staff.manage",
    "admin.users.view",
    "admin.users.manage",
    "admin.analytics.view",
  ],
  operations: [
    "admin.dashboard.view",
    "admin.users.view",
    "admin.users.manage",
    "admin.orders.view",
    "admin.orders.manage",
    "admin.contact_inquiries.view",
    "admin.contact_inquiries.manage",
    "admin.catalog.view",
    "admin.analytics.view",
  ],
  catalog: [
    "admin.dashboard.view",
    "admin.catalog.view",
    "admin.catalog.manage",
    "admin.analytics.view",
  ],
  support: [
    "admin.dashboard.view",
    "admin.users.view",
    "admin.orders.view",
    "admin.contact_inquiries.view",
    "admin.contact_inquiries.manage",
  ],
  finance: [
    "admin.dashboard.view",
    "admin.orders.view",
    "admin.analytics.view",
  ],
  marketing: [
    "admin.dashboard.view",
    "admin.marketing.view",
    "admin.marketing.manage",
    "admin.analytics.view",
  ],
  analyst: ["admin.dashboard.view", "admin.analytics.view"],
  readonly: [
    "admin.dashboard.view",
    "admin.users.view",
    "admin.catalog.view",
    "admin.orders.view",
    "admin.marketing.view",
    "admin.analytics.view",
    "admin.settings.view",
  ],
};

export function isAdminStaffRole(role: unknown): role is AdminStaffRole {
  return (
    typeof role === "string" &&
    adminStaffRoles.includes(role as AdminStaffRole)
  );
}

export function getCapabilitiesForAdminStaffRole(role: AdminStaffRole) {
  return [...roleCapabilities[role]];
}

function normalizeAdminStaffRoles(roles: unknown, fallbackRole?: unknown) {
  const normalizedRoles = Array.isArray(roles)
    ? roles.filter(isAdminStaffRole)
    : [];

  if (normalizedRoles.length > 0) {
    return Array.from(new Set(normalizedRoles));
  }

  return isAdminStaffRole(fallbackRole) ? [fallbackRole] : [];
}

export function getCapabilitiesForAdminStaffRoles(roles: AdminStaffRole[]) {
  const capabilities = new Set<AdminCapability>();

  for (const role of roles) {
    for (const capability of roleCapabilities[role]) {
      capabilities.add(capability);
    }
  }

  return [...capabilities];
}

export function hasAdminCapability(
  capabilities: AdminCapability[] | undefined,
  capability: AdminCapability,
) {
  return Boolean(capabilities?.includes(capability));
}

export async function getAdminStaffAccess(userId: string) {
  const [staff] = await db
    .select({ role: adminStaff.role, roles: adminStaff.roles })
    .from(adminStaff)
    .where(eq(adminStaff.userId, userId))
    .limit(1);

  const roles = normalizeAdminStaffRoles(staff?.roles, staff?.role);

  if (!staff || roles.length === 0) {
    return { role: null, capabilities: [] as AdminCapability[] };
  }

  return {
    role: roles[0] ?? null,
    capabilities: getCapabilitiesForAdminStaffRoles(roles),
  };
}

export async function getAdminStaffUserIdsWithCapability(
  capability: AdminCapability,
) {
  const staffRows = await db
    .selectDistinct({
      role: adminStaff.role,
      roles: adminStaff.roles,
      userId: adminStaff.userId,
    })
    .from(adminStaff)
    .innerJoin(users, eq(users.id, adminStaff.userId))
    .innerJoin(userRoles, eq(userRoles.userId, adminStaff.userId))
    .where(
      and(
        eq(users.isActive, true),
        inArray(userRoles.role, ["admin", "superadmin"]),
      ),
    );

  return staffRows
    .filter((staff) => {
      const roles = normalizeAdminStaffRoles(staff.roles, staff.role);

      return getCapabilitiesForAdminStaffRoles(roles).includes(capability);
    })
    .map((staff) => staff.userId);
}

export async function userHasAdminStaffAccess(userId: string) {
  const [staff] = await db
    .select({ id: adminStaff.id })
    .from(adminStaff)
    .where(eq(adminStaff.userId, userId))
    .limit(1);

  return Boolean(staff);
}

export function hashAdminStaffInvitationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function getAdminStaffDirectory() {
  const [staffRows, invitationRows] = await Promise.all([
    db
      .select({
        createdAt: adminStaff.createdAt,
        email: users.email,
        id: adminStaff.id,
        isActive: users.isActive,
        name: users.name,
        role: adminStaff.role,
        roles: adminStaff.roles,
        userId: users.id,
      })
      .from(adminStaff)
      .innerJoin(users, eq(users.id, adminStaff.userId)),
    db.select().from(adminStaffInvitations),
  ]);

  return {
    invitations: invitationRows
      .filter((invitation) => !invitation.acceptedAt && !invitation.revokedAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    staff: staffRows.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    ),
  };
}

export async function createAdminStaffInvitation({
  actorUserId,
  email,
  name,
  origin,
  roles,
}: {
  actorUserId: string;
  email: string;
  name?: string;
  origin: string;
  roles: AdminStaffRole[];
}) {
  const normalizedRoles = normalizeAdminStaffRoles(roles).filter(
    (role) => role !== "owner",
  );
  const primaryRole = normalizedRoles[0] ?? "readonly";
  const normalizedEmail = email.trim().toLowerCase();
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashAdminStaffInvitationToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const acceptUrl = `${origin}/invite/accept?token=${encodeURIComponent(token)}`;

  await db.transaction(async (tx) => {
    await tx
      .update(adminStaffInvitations)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(adminStaffInvitations.email, normalizedEmail),
          isNull(adminStaffInvitations.acceptedAt),
          isNull(adminStaffInvitations.revokedAt),
        ),
      );

    await tx.insert(adminStaffInvitations).values({
      email: normalizedEmail,
      expiresAt,
      invitedByUserId: actorUserId,
      name: name?.trim() || null,
      role: primaryRole,
      roles: normalizedRoles.length > 0 ? normalizedRoles : [primaryRole],
      tokenHash,
    });

    await tx.insert(auditLogs).values({
      actorUserId,
      action: "admin.staff.invite",
      entityType: "admin_staff_invitation",
      metadata: JSON.stringify({ email: normalizedEmail, roles: normalizedRoles }),
    });
  });

  await sendNotificationEmail({
    data: {
      acceptUrl,
      expiresAtLabel: expiresAt.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      name: name?.trim() || normalizedEmail,
      roleLabel: normalizedRoles
        .map((role) => adminStaffRoleLabels[role])
        .join(", "),
    },
    recipientEmail: normalizedEmail,
    templateKey: "admin.staff.invited",
  });

  return { expiresAt };
}

export async function getValidAdminStaffInvitation(token: string) {
  const tokenHash = hashAdminStaffInvitationToken(token);
  const [invitation] = await db
    .select()
    .from(adminStaffInvitations)
    .where(
      and(
        eq(adminStaffInvitations.tokenHash, tokenHash),
        isNull(adminStaffInvitations.acceptedAt),
        isNull(adminStaffInvitations.revokedAt),
        gt(adminStaffInvitations.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return invitation ?? null;
}

export async function acceptAdminStaffInvitation({
  name,
  password,
  token,
}: {
  name?: string;
  password: string;
  token: string;
}) {
  const invitation = await getValidAdminStaffInvitation(token);

  if (!invitation) {
    return null;
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const invitationRoles = normalizeAdminStaffRoles(
    invitation.roles,
    invitation.role,
  );
  const primaryInvitationRole = invitationRoles[0] ?? "readonly";
  const [acceptedUser] = await db.transaction(async (tx) => {
    const [existingUser] = await tx
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.email, invitation.email))
      .limit(1);
    const displayName = name?.trim() || invitation.name || existingUser?.name;
    const [user] = existingUser
      ? await tx
          .update(users)
          .set({
            isActive: true,
            name: displayName ?? null,
            passwordHash,
            updatedAt: now,
          })
          .where(eq(users.id, existingUser.id))
          .returning({ id: users.id })
      : await tx
          .insert(users)
          .values({
            email: invitation.email,
            isActive: true,
            name: displayName ?? null,
            passwordHash,
          })
          .returning({ id: users.id });

    await tx
      .insert(userRoles)
      .values({ role: "admin", userId: user.id })
      .onConflictDoNothing({ target: [userRoles.userId, userRoles.role] });

    await tx
      .insert(adminStaff)
      .values({
        invitedByUserId: invitation.invitedByUserId,
        role: primaryInvitationRole,
        roles: invitationRoles,
        userId: user.id,
      })
      .onConflictDoUpdate({
        target: adminStaff.userId,
        set: {
          role: primaryInvitationRole,
          roles: invitationRoles,
          updatedAt: now,
        },
      });

    await tx
      .update(adminStaffInvitations)
      .set({
        acceptedAt: now,
        acceptedByUserId: user.id,
        updatedAt: now,
      })
      .where(eq(adminStaffInvitations.id, invitation.id));

    await tx.insert(auditLogs).values({
      actorUserId: invitation.invitedByUserId,
      action: "admin.staff.accept_invitation",
      entityType: "admin_staff",
      entityId: user.id,
      metadata: JSON.stringify({ email: invitation.email, roles: invitationRoles }),
    });

    return [user];
  });

  return acceptedUser;
}

export async function updateAdminStaffRoles({
  actorUserId,
  roles,
  staffId,
}: {
  actorUserId: string;
  roles: AdminStaffRole[];
  staffId: string;
}) {
  const now = new Date();
  const normalizedRoles = normalizeAdminStaffRoles(roles);
  const primaryRole = normalizedRoles[0] ?? "readonly";
  const [actorStaff, targetStaff] = await Promise.all([
    db
      .select({ role: adminStaff.role, roles: adminStaff.roles })
      .from(adminStaff)
      .where(eq(adminStaff.userId, actorUserId))
      .limit(1),
    db
      .select({
        role: adminStaff.role,
        roles: adminStaff.roles,
        userId: adminStaff.userId,
      })
      .from(adminStaff)
      .where(eq(adminStaff.id, staffId))
      .limit(1),
  ]);
  const actorRoles = normalizeAdminStaffRoles(
    actorStaff[0]?.roles,
    actorStaff[0]?.role,
  );
  const targetRoles = normalizeAdminStaffRoles(
    targetStaff[0]?.roles,
    targetStaff[0]?.role,
  );
  const actorIsOwner = actorRoles.includes("owner");
  const targetIsOwner = targetRoles.includes("owner");

  if (
    !targetStaff[0] ||
    targetStaff[0].userId === actorUserId ||
    (targetIsOwner && !actorIsOwner) ||
    (normalizedRoles.includes("owner") && !actorIsOwner)
  ) {
    return false;
  }

  const [updated] = await db
    .update(adminStaff)
    .set({
      role: primaryRole,
      roles: normalizedRoles.length > 0 ? normalizedRoles : [primaryRole],
      updatedAt: now,
    })
    .where(eq(adminStaff.id, staffId))
    .returning({ userId: adminStaff.userId });

  if (!updated) {
    return false;
  }

  await db.insert(auditLogs).values({
    actorUserId,
    action: "admin.staff.update_role",
    entityType: "admin_staff",
    entityId: updated.userId,
    metadata: JSON.stringify({ roles: normalizedRoles }),
  });

  return true;
}

export async function setAdminStaffEnabled({
  actorUserId,
  enabled,
  staffId,
}: {
  actorUserId: string;
  enabled: boolean;
  staffId: string;
}) {
  const [staff] = await db
    .select({ role: adminStaff.role, roles: adminStaff.roles, userId: adminStaff.userId })
    .from(adminStaff)
    .where(eq(adminStaff.id, staffId))
    .limit(1);
  const [actorStaff] = await db
    .select({ role: adminStaff.role, roles: adminStaff.roles })
    .from(adminStaff)
    .where(eq(adminStaff.userId, actorUserId))
    .limit(1);
  const actorRoles = normalizeAdminStaffRoles(actorStaff?.roles, actorStaff?.role);
  const targetRoles = normalizeAdminStaffRoles(staff?.roles, staff?.role);

  if (
    !staff ||
    staff.userId === actorUserId ||
    (targetRoles.includes("owner") && !actorRoles.includes("owner"))
  ) {
    return false;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ isActive: enabled, updatedAt: new Date() })
      .where(eq(users.id, staff.userId));

    await tx.insert(auditLogs).values({
      actorUserId,
      action: enabled ? "admin.staff.enable" : "admin.staff.disable",
      entityType: "admin_staff",
      entityId: staff.userId,
      metadata: JSON.stringify({ enabled }),
    });
  });

  return true;
}

export async function revokeAdminStaffInvitation({
  actorUserId,
  invitationId,
}: {
  actorUserId: string;
  invitationId: string;
}) {
  const [revoked] = await db
    .update(adminStaffInvitations)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(adminStaffInvitations.id, invitationId),
        isNull(adminStaffInvitations.acceptedAt),
        isNull(adminStaffInvitations.revokedAt),
      ),
    )
    .returning({
      email: adminStaffInvitations.email,
      id: adminStaffInvitations.id,
      role: adminStaffInvitations.role,
      roles: adminStaffInvitations.roles,
    });

  if (!revoked) {
    return false;
  }

  await db.insert(auditLogs).values({
    actorUserId,
    action: "admin.staff.revoke_invitation",
    entityType: "admin_staff_invitation",
    entityId: revoked.id,
    metadata: JSON.stringify({
      email: revoked.email,
      roles: normalizeAdminStaffRoles(revoked.roles, revoked.role),
    }),
  });

  return true;
}

export { allCapabilities };
export { adminCapabilities, adminStaffRoleLabels, type AdminCapability };
