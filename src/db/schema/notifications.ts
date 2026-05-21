import {
  integer,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "@/src/db/schema/users";

export const notificationTemplateStatuses = [
  "active",
  "disabled",
  "archived",
] as const;

export type NotificationTemplateStatus =
  (typeof notificationTemplateStatuses)[number];

export const notificationDeliveryStatuses = [
  "queued",
  "sent",
  "failed",
  "skipped",
] as const;

export type NotificationDeliveryStatus =
  (typeof notificationDeliveryStatuses)[number];

export const notificationTemplates = pgTable("notification_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  category: varchar("category", { length: 80 }).notNull().default("system"),
  description: text("description"),
  status: varchar("status", { length: 32 })
    .$type<NotificationTemplateStatus>()
    .notNull()
    .default("active"),
  subject: varchar("subject", { length: 240 }).notNull(),
  previewText: varchar("preview_text", { length: 240 }),
  htmlBody: text("html_body").notNull(),
  textBody: text("text_body").notNull(),
  requiredVariables: text("required_variables").notNull().default("[]"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const notificationTemplateVersions = pgTable(
  "notification_template_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => notificationTemplates.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    subject: varchar("subject", { length: 240 }).notNull(),
    previewText: varchar("preview_text", { length: 240 }),
    htmlBody: text("html_body").notNull(),
    textBody: text("text_body").notNull(),
    requiredVariables: text("required_variables").notNull().default("[]"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (templateVersion) => ({
    templateVersionUnique: unique(
      "notification_template_versions_template_id_version_unique",
    ).on(templateVersion.templateId, templateVersion.version),
  }),
);

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateKey: varchar("template_key", { length: 160 }).notNull(),
  recipientEmail: varchar("recipient_email", { length: 254 }).notNull(),
  recipientUserId: uuid("recipient_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  subject: varchar("subject", { length: 240 }).notNull(),
  status: varchar("status", { length: 32 })
    .$type<NotificationDeliveryStatus>()
    .notNull()
    .default("queued"),
  provider: varchar("provider", { length: 80 }).notNull().default("sendgrid"),
  providerMessageId: varchar("provider_message_id", { length: 240 }),
  errorMessage: text("error_message"),
  metadata: text("metadata"),
  openCount: integer("open_count").notNull().default(0),
  openedAt: timestamp("opened_at", { mode: "date" }),
  sentAt: timestamp("sent_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const notificationWebhookEvents = pgTable(
  "notification_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: varchar("provider", { length: 80 }).notNull().default("sendgrid"),
    providerEventId: varchar("provider_event_id", { length: 240 }).notNull(),
    deliveryId: uuid("delivery_id").references(() => notificationDeliveries.id, {
      onDelete: "set null",
    }),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    payload: text("payload").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (event) => ({
    notificationWebhookEventDeliveryIdx: index(
      "notification_webhook_events_delivery_id_idx",
    ).on(event.deliveryId),
    notificationWebhookEventProviderUnique: unique(
      "notification_webhook_events_provider_event_unique",
    ).on(event.provider, event.providerEventId),
  }),
);

export const notificationGlobalVariables = pgTable(
  "notification_global_variables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 80 }).notNull().unique(),
    label: varchar("label", { length: 160 }).notNull(),
    value: text("value").notNull(),
    description: text("description"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (variable) => ({
    notificationGlobalVariableKeyIdx: index(
      "notification_global_variables_key_idx",
    ).on(variable.key),
  }),
);
