import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const marketplaceSettings = pgTable("marketplace_settings", {
  id: integer("id").primaryKey().default(1),
  comingSoonEnabled: boolean("coming_soon_enabled").notNull().default(false),
  comingSoonPasswordHash: text("coming_soon_password_hash"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  twitterUrl: text("twitter_url"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
