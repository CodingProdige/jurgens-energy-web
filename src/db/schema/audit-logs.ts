import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "@/src/db/schema/users";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: varchar("action", { length: 160 }).notNull(),
  entityType: varchar("entity_type", { length: 120 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
