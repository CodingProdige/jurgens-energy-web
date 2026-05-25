import crypto from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "@/src/db";
import {
  accounts,
  passwordResetTokens,
  platformRoles,
  sellerApplications,
  userRoles,
  users,
  type PlatformRole,
} from "@/src/db/schema";
import { addEmailSubscriber } from "@/src/modules/marketing/email-subscribers";

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 15;

export function isPlatformRole(role: unknown): role is PlatformRole {
  return (
    typeof role === "string" &&
    platformRoles.includes(role as PlatformRole)
  );
}

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  return user;
}

export async function findUserById(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user;
}

export async function getUserRoles(userId: string) {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  return rows
    .map((row) => row.role)
    .filter((role): role is PlatformRole => isPlatformRole(role));
}

export async function ensureUserRole(userId: string, role: PlatformRole) {
  await db
    .insert(userRoles)
    .values({
      userId,
      role,
    })
    .onConflictDoNothing({
      target: [userRoles.userId, userRoles.role],
    });
}

export async function deleteOAuthOnlyUserWithoutAccess(userId: string) {
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.passwordHash) {
    return false;
  }

  const [account] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  if (!account) {
    return false;
  }

  const [role] = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))
    .limit(1);

  if (role) {
    return false;
  }

  const [sellerApplication] = await db
    .select({ id: sellerApplications.id })
    .from(sellerApplications)
    .where(eq(sellerApplications.userId, userId))
    .limit(1);

  if (sellerApplication) {
    return false;
  }

  await db.delete(users).where(eq(users.id, userId));

  return true;
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function createCustomerAccount({
  email,
  name,
  password,
}: {
  email: string;
  name: string;
  password: string;
}) {
  const passwordHash = await hashPassword(password);

  const [user] = await db.transaction(async (tx) => {
    const [createdUser] = await tx
      .insert(users)
      .values({
        email,
        name,
        passwordHash,
      })
      .returning({ id: users.id });

    await tx.insert(userRoles).values({
      userId: createdUser.id,
      role: "customer",
    });

    await addEmailSubscriber({
      database: tx,
      email,
      source: "customer_signup",
    });

    return [createdUser];
  });

  return user;
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashPasswordResetToken(token);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000,
  );

  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    await tx.insert(passwordResetTokens).values({
      userId,
      tokenHash,
      expiresAt,
    });
  });

  return { token, expiresAt };
}

export async function isPasswordResetTokenValid(token: string) {
  const tokenHash = hashPasswordResetToken(token);
  const [row] = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function resetPasswordWithToken(token: string, password: string) {
  const tokenHash = hashPasswordResetToken(token);
  const now = new Date();
  const [resetToken] = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
    })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!resetToken) {
    return false;
  }

  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, resetToken.userId));

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, resetToken.id));
  });

  return true;
}

export type AccessCapability = "marketplace" | "seller" | "admin";

export function canAccessCapability(
  user:
    | {
        roles?: PlatformRole[];
      }
    | undefined,
  capability: AccessCapability,
) {
  if (!user) {
    return false;
  }

  if (capability === "marketplace") {
    return true;
  }

  const roles = user.roles ?? [];

  if (capability === "admin") {
    return roles.includes("admin") || roles.includes("superadmin");
  }

  return (
    roles.includes("seller_owner") ||
    roles.includes("seller_staff") ||
    roles.includes("admin") ||
    roles.includes("superadmin")
  );
}
