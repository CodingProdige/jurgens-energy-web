import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "@/src/db/schema/users";

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (token) => ({
    userIdIdx: index("password_reset_tokens_user_id_idx").on(token.userId),
  }),
);
