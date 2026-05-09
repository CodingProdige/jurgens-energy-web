import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const emailSubscriberSources = [
  "coming_soon",
  "customer_signup",
  "seller_signup",
  "admin",
  "import",
] as const;

export type EmailSubscriberSource = (typeof emailSubscriberSources)[number];

export const emailSubscribers = pgTable("email_subscribers", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source")
    .$type<EmailSubscriberSource>()
    .notNull()
    .default("coming_soon"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
