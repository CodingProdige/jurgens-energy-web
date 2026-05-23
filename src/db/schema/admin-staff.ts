import {
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "@/src/db/schema/users";

export const adminStaffRoles = [
  "owner",
  "manager",
  "operations",
  "catalog",
  "support",
  "finance",
  "marketing",
  "analyst",
  "readonly",
] as const;

export type AdminStaffRole = (typeof adminStaffRoles)[number];

export const adminStaff = pgTable(
  "admin_staff",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 64 }).$type<AdminStaffRole>().notNull(),
    roles: text("roles")
      .array()
      .$type<AdminStaffRole[]>()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (staff) => ({
    adminStaffUserUnique: unique("admin_staff_user_id_unique").on(staff.userId),
  }),
);

export const adminStaffInvitations = pgTable(
  "admin_staff_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    role: varchar("role", { length: 64 }).$type<AdminStaffRole>().notNull(),
    roles: text("roles")
      .array()
      .$type<AdminStaffRole[]>()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    tokenHash: text("token_hash").notNull(),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { mode: "date" }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (invitation) => ({
    adminStaffInvitationTokenUnique: unique(
      "admin_staff_invitations_token_hash_unique",
    ).on(invitation.tokenHash),
  }),
);
