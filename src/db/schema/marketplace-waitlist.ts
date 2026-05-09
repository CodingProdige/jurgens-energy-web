import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const marketplaceWaitlistSignups = pgTable(
  "marketplace_waitlist_signups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
);
