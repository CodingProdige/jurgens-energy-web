import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { media } from "@/src/db/schema/media";
import { users } from "@/src/db/schema/users";

export const supportAgents = pgTable(
  "support_agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    roleTitle: varchar("role_title", { length: 160 }),
    bio: text("bio"),
    publicEmail: varchar("public_email", { length: 254 }),
    publicPhone: varchar("public_phone", { length: 40 }),
    publicWhatsapp: varchar("public_whatsapp", { length: 40 }),
    photoMediaId: uuid("photo_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    availability: varchar("availability", { length: 240 }),
    isPublished: boolean("is_published").notNull().default(false),
    showInFooter: boolean("show_in_footer").notNull().default(false),
    showOnAbout: boolean("show_on_about").notNull().default(false),
    showOnSupport: boolean("show_on_support").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (agent) => ({
    placementOrderIdx: index("support_agents_placement_order_idx").on(
      agent.isPublished,
      agent.sortOrder,
    ),
    publicPlacementContactCheck: check(
      "support_agents_public_placement_contact_check",
      sql`
        ${agent.isPublished} = false
        OR (${agent.showInFooter} = false AND ${agent.showOnAbout} = false AND ${agent.showOnSupport} = false)
        OR NULLIF(BTRIM(${agent.publicEmail}), '') IS NOT NULL
        OR NULLIF(BTRIM(${agent.publicPhone}), '') IS NOT NULL
        OR NULLIF(BTRIM(${agent.publicWhatsapp}), '') IS NOT NULL
      `,
    ),
    sortOrderCheck: check(
      "support_agents_sort_order_nonnegative_check",
      sql`${agent.sortOrder} >= 0`,
    ),
    userIdx: index("support_agents_user_id_idx").on(agent.userId),
  }),
);
