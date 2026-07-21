import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const contactInquiryStatuses = ["new", "resolved"] as const;

export type ContactInquiryStatus = (typeof contactInquiryStatuses)[number];

export const contactInquiries = pgTable(
  "contact_inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    message: text("message").notNull(),
    status: varchar("status", { length: 32 })
      .$type<ContactInquiryStatus>()
      .notNull()
      .default("new"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (inquiry) => ({
    contactInquiriesStatusCreatedAtIdx: index(
      "contact_inquiries_status_created_at_idx",
    ).on(inquiry.status, inquiry.createdAt),
  }),
);
