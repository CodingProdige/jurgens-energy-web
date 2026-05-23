import { count } from "drizzle-orm";

import { db } from "@/src/db";
import {
  accounts,
  sellerStaff,
  sellers,
  userRoles,
  users,
  type PlatformRole,
} from "@/src/db/schema";

export type AdminUser = {
  accountProviders: string[];
  createdAt: Date;
  email: string;
  hasPassword: boolean;
  id: string;
  image: string | null;
  isActive: boolean;
  name: string | null;
  roles: PlatformRole[];
  sellerAccessCount: number;
  sellerOwnerCount: number;
  updatedAt: Date;
};

export type AdminUsersData = {
  activeUserCount: number;
  adminUserCount: number;
  customerUserCount: number;
  inactiveUserCount: number;
  sellerUserCount: number;
  totalUserCount: number;
  users: AdminUser[];
};

const roleOrder: PlatformRole[] = [
  "superadmin",
  "admin",
  "seller_owner",
  "seller_staff",
  "customer",
];

function sortRoles(roles: PlatformRole[]) {
  return [...roles].sort(
    (first, second) => roleOrder.indexOf(first) - roleOrder.indexOf(second),
  );
}

function isPlatformRole(role: string): role is PlatformRole {
  return roleOrder.includes(role as PlatformRole);
}

export async function getAdminUsers(): Promise<AdminUsersData> {
  const [
    rows,
    roleRows,
    accountRows,
    staffRows,
    ownerRows,
    [totalUsers],
  ] = await Promise.all([
    db
      .select({
        createdAt: users.createdAt,
        email: users.email,
        id: users.id,
        image: users.image,
        isActive: users.isActive,
        name: users.name,
        passwordHash: users.passwordHash,
        updatedAt: users.updatedAt,
      })
      .from(users),
    db
      .select({
        role: userRoles.role,
        userId: userRoles.userId,
      })
      .from(userRoles),
    db
      .select({
        provider: accounts.provider,
        userId: accounts.userId,
      })
      .from(accounts),
    db
      .select({
        userId: sellerStaff.userId,
      })
      .from(sellerStaff),
    db
      .select({
        ownerUserId: sellers.ownerUserId,
      })
      .from(sellers),
    db.select({ value: count() }).from(users),
  ]);

  const rolesByUserId = new Map<string, Set<PlatformRole>>();
  const providersByUserId = new Map<string, Set<string>>();
  const sellerAccessByUserId = new Map<string, number>();
  const sellerOwnersByUserId = new Map<string, number>();

  for (const row of roleRows) {
    if (!isPlatformRole(row.role)) {
      continue;
    }

    const roles = rolesByUserId.get(row.userId) ?? new Set<PlatformRole>();
    roles.add(row.role);
    rolesByUserId.set(row.userId, roles);
  }

  for (const row of accountRows) {
    const providers = providersByUserId.get(row.userId) ?? new Set<string>();
    providers.add(row.provider);
    providersByUserId.set(row.userId, providers);
  }

  for (const row of staffRows) {
    sellerAccessByUserId.set(
      row.userId,
      (sellerAccessByUserId.get(row.userId) ?? 0) + 1,
    );
  }

  for (const row of ownerRows) {
    sellerOwnersByUserId.set(
      row.ownerUserId,
      (sellerOwnersByUserId.get(row.ownerUserId) ?? 0) + 1,
    );
  }

  const adminUsers: AdminUser[] = rows
    .map((row) => {
      const roles = sortRoles(Array.from(rolesByUserId.get(row.id) ?? []));

      return {
        createdAt: row.createdAt,
        email: row.email,
        hasPassword: row.passwordHash !== null,
        id: row.id,
        image: row.image,
        isActive: row.isActive,
        name: row.name,
        updatedAt: row.updatedAt,
        accountProviders: Array.from(providersByUserId.get(row.id) ?? []).sort(),
        roles,
        sellerAccessCount: sellerAccessByUserId.get(row.id) ?? 0,
        sellerOwnerCount: sellerOwnersByUserId.get(row.id) ?? 0,
      };
    })
    .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime());

  return {
    activeUserCount: adminUsers.filter((user) => user.isActive).length,
    adminUserCount: adminUsers.filter((user) =>
      user.roles.some((role) => role === "admin" || role === "superadmin"),
    ).length,
    customerUserCount: adminUsers.filter((user) =>
      user.roles.includes("customer"),
    ).length,
    inactiveUserCount: adminUsers.filter((user) => !user.isActive).length,
    sellerUserCount: adminUsers.filter((user) =>
      user.roles.some((role) => role === "seller_owner" || role === "seller_staff"),
    ).length,
    totalUserCount: totalUsers.value,
    users: adminUsers,
  };
}
