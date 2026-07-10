"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { accounts, auditLogs, users, type PlatformRole } from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { createPasswordResetToken, getUserRoles } from "@/src/modules/auth/service";
import { sendPasswordResetEmail } from "@/src/modules/auth/password-reset-email";

export type UserMutationState = {
  devResetUrl?: string;
  message?: string;
  ok?: boolean;
};

const userIdSchema = z.object({
  id: z.string().uuid(),
});

const updateUserProfileSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  id: z.string().uuid(),
  image: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .refine(
      (value) =>
        !value ||
        value.startsWith("/") ||
        value.startsWith("http://") ||
        value.startsWith("https://"),
      "Use an absolute URL or a site-relative image path.",
    ),
  isActive: z.enum(["active", "inactive"]),
  name: z.string().trim().max(160).optional(),
});

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue || undefined;
}

function getRequestOrigin(headerStore: Headers) {
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");

  if (!host) {
    return "http://localhost:3000";
  }

  return `${forwardedProto ?? "http"}://${host}`;
}

function getResetSurface(roles: PlatformRole[]) {
  if (roles.some((role) => role === "admin" || role === "superadmin")) {
    return "admin" as const;
  }

  return "marketplace" as const;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function writeUserAuditLog({
  actorUserId,
  action,
  entityId,
  metadata,
}: {
  action: string;
  actorUserId: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    actorUserId,
    action,
    entityType: "user",
    entityId,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

async function findTargetUser(userId: string) {
  return db.query.users.findFirst({
    where: (user, { eq }) => eq(user.id, userId),
  });
}

async function getLinkedAccountProviders(userId: string) {
  const rows = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  return rows.map((row) => row.provider);
}

function revalidateUserPages() {
  revalidatePath("/users");
  revalidatePath("/users/all");
  revalidatePath("/users/customers");
  revalidatePath("/users/admins");
}

export async function updateAdminUserProfile(
  _state: UserMutationState,
  formData: FormData,
): Promise<UserMutationState> {
  const access = await requireAdminCapability("admin.users.manage");

  if (!access.ok) {
    return { ok: false, message: "You do not have permission to manage users." };
  }

  const session = access.session;
  const parsed = updateUserProfileSchema.safeParse({
    email: formData.get("email"),
    id: formData.get("id"),
    image: optionalString(formData.get("image")),
    isActive: formData.get("isActive"),
    name: optionalString(formData.get("name")),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the user fields.",
    };
  }

  const targetUser = await findTargetUser(parsed.data.id);

  if (!targetUser) {
    return { ok: false, message: "User was not found." };
  }

  if (session.user.id === parsed.data.id && parsed.data.isActive === "inactive") {
    return { ok: false, message: "You cannot deactivate your own admin account." };
  }

  const linkedProviders = await getLinkedAccountProviders(parsed.data.id);

  if (
    linkedProviders.length > 0 &&
    targetUser.email.toLowerCase() !== parsed.data.email
  ) {
    return {
      ok: false,
      message: "Email is managed by the linked sign-in provider.",
    };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          email: parsed.data.email,
          image: parsed.data.image ?? null,
          isActive: parsed.data.isActive === "active",
          name: parsed.data.name ?? null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, parsed.data.id));

      await tx.insert(auditLogs).values({
        actorUserId: session.user.id,
        action: "admin.user.update_profile",
        entityType: "user",
        entityId: parsed.data.id,
        metadata: JSON.stringify({
          emailChanged: targetUser.email !== parsed.data.email,
          imageChanged: targetUser.image !== (parsed.data.image ?? null),
          statusChanged: targetUser.isActive !== (parsed.data.isActive === "active"),
        }),
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: "Another user already uses that email address." };
    }

    throw error;
  }

  revalidateUserPages();

  return { ok: true, message: "User updated." };
}

export async function sendAdminUserPasswordReset(
  _state: UserMutationState,
  formData: FormData,
): Promise<UserMutationState> {
  const access = await requireAdminCapability("admin.users.manage");

  if (!access.ok) {
    return { ok: false, message: "You do not have permission to manage users." };
  }

  const session = access.session;
  const parsed = userIdSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { ok: false, message: "User was not found." };
  }

  const targetUser = await findTargetUser(parsed.data.id);

  if (!targetUser?.isActive) {
    return { ok: false, message: "Only active users can receive reset links." };
  }

  const roles = await getUserRoles(targetUser.id);
  const { token, expiresAt } = await createPasswordResetToken(targetUser.id);
  const origin = getRequestOrigin(await headers());
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const emailResult = await sendPasswordResetEmail({
    expiresAt,
    resetUrl,
    surface: getResetSurface(roles),
    to: targetUser.email,
  });

  await writeUserAuditLog({
    actorUserId: session.user.id,
    action: "admin.user.send_password_reset",
    entityId: targetUser.id,
    metadata: { delivered: emailResult.delivered },
  });

  return {
    devResetUrl:
      process.env.NODE_ENV === "production" || emailResult.delivered
        ? undefined
        : resetUrl,
    ok: true,
    message:
      emailResult.delivered || process.env.NODE_ENV === "production"
        ? "Password reset email sent."
        : "Password reset link prepared.",
  };
}

export async function setAdminUserActive(
  _state: UserMutationState,
  formData: FormData,
): Promise<UserMutationState> {
  const access = await requireAdminCapability("admin.users.manage");

  if (!access.ok) {
    return { ok: false, message: "You do not have permission to manage users." };
  }

  const session = access.session;
  const parsed = z
    .object({
      id: z.string().uuid(),
      isActive: z.enum(["active", "inactive"]),
    })
    .safeParse({
      id: formData.get("id"),
      isActive: formData.get("isActive"),
    });

  if (!parsed.success) {
    return { ok: false, message: "Check the user status." };
  }

  if (session.user.id === parsed.data.id && parsed.data.isActive === "inactive") {
    return { ok: false, message: "You cannot deactivate your own admin account." };
  }

  const targetUser = await findTargetUser(parsed.data.id);

  if (!targetUser) {
    return { ok: false, message: "User was not found." };
  }

  const nextIsActive = parsed.data.isActive === "active";

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ isActive: nextIsActive, updatedAt: new Date() })
      .where(and(eq(users.id, parsed.data.id), ne(users.isActive, nextIsActive)));

    await tx.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: nextIsActive
        ? "admin.user.activate"
        : "admin.user.deactivate",
      entityType: "user",
      entityId: parsed.data.id,
      metadata: JSON.stringify({ email: targetUser.email }),
    });
  });

  revalidateUserPages();

  return {
    ok: true,
    message: nextIsActive ? "User activated." : "User deactivated.",
  };
}
