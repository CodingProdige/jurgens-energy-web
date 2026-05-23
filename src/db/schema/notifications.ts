import {
  boolean,
  integer,
  index,
  pgTable,
  text,
  timestamp,
  time,
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

export const inAppNotificationSurfaces = [
  "marketplace",
  "seller",
  "admin",
] as const;

export type InAppNotificationSurface =
  (typeof inAppNotificationSurfaces)[number];

export const notificationPriorityLevels = [
  "low",
  "normal",
  "high",
  "critical",
] as const;

export type NotificationPriorityLevel =
  (typeof notificationPriorityLevels)[number];

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

export const notificationDeliveryPolicies = pgTable(
  "notification_delivery_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventKey: varchar("event_key", { length: 160 }).notNull().unique(),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),
    emailEnabled: boolean("email_enabled").notNull().default(false),
    pushEnabled: boolean("push_enabled").notNull().default(false),
    priority: varchar("priority", { length: 32 })
      .$type<NotificationPriorityLevel>()
      .notNull()
      .default("normal"),
    quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(false),
    quietHoursStart: time("quiet_hours_start"),
    quietHoursEnd: time("quiet_hours_end"),
    digestEligible: boolean("digest_eligible").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (policy) => ({
    notificationDeliveryPoliciesEventKeyIdx: index(
      "notification_delivery_policies_event_key_idx",
    ).on(policy.eventKey),
  }),
);

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

export const inAppNotificationTemplates = pgTable(
  "in_app_notification_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 160 }).notNull().unique(),
    name: varchar("name", { length: 180 }).notNull(),
    category: varchar("category", { length: 80 }).notNull().default("system"),
    description: text("description"),
    surface: varchar("surface", { length: 32 })
      .$type<InAppNotificationSurface>()
      .notNull()
      .default("marketplace"),
    type: varchar("type", { length: 80 }).notNull().default("system"),
    status: varchar("status", { length: 32 })
      .$type<NotificationTemplateStatus>()
      .notNull()
      .default("active"),
    titleTemplate: varchar("title_template", { length: 180 }).notNull(),
    bodyTemplate: text("body_template").notNull(),
    actionLabelTemplate: varchar("action_label_template", { length: 120 }),
    actionUrlTemplate: text("action_url_template"),
    requiredVariables: text("required_variables").notNull().default("[]"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (template) => ({
    inAppNotificationTemplatesCategoryIdx: index(
      "in_app_notification_templates_category_idx",
    ).on(template.category),
    inAppNotificationTemplatesSurfaceIdx: index(
      "in_app_notification_templates_surface_idx",
    ).on(template.surface),
  }),
);

export const inAppNotificationTemplateVersions = pgTable(
  "in_app_notification_template_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => inAppNotificationTemplates.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    titleTemplate: varchar("title_template", { length: 180 }).notNull(),
    bodyTemplate: text("body_template").notNull(),
    actionLabelTemplate: varchar("action_label_template", { length: 120 }),
    actionUrlTemplate: text("action_url_template"),
    requiredVariables: text("required_variables").notNull().default("[]"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (templateVersion) => ({
    inAppNotificationTemplateVersionUnique: unique(
      "in_app_notification_template_versions_template_id_version_unique",
    ).on(templateVersion.templateId, templateVersion.version),
  }),
);

export const pushNotificationSubscriptions = pgTable(
  "push_notification_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    surface: varchar("surface", { length: 32 })
      .$type<InAppNotificationSurface>()
      .notNull()
      .default("marketplace"),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
  },
  (subscription) => ({
    pushNotificationSubscriptionsUserIdx: index(
      "push_notification_subscriptions_user_id_idx",
    ).on(subscription.userId),
    pushNotificationSubscriptionsSurfaceIdx: index(
      "push_notification_subscriptions_surface_idx",
    ).on(subscription.surface),
  }),
);

export const inAppNotifications = pgTable(
  "in_app_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateKey: varchar("template_key", { length: 160 }),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    surface: varchar("surface", { length: 32 })
      .$type<InAppNotificationSurface>()
      .notNull(),
    type: varchar("type", { length: 80 }).notNull().default("system"),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    actionLabel: varchar("action_label", { length: 120 }),
    actionUrl: text("action_url"),
    metadata: text("metadata"),
    readAt: timestamp("read_at", { mode: "date" }),
    dismissedAt: timestamp("dismissed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (notification) => ({
    inAppNotificationsRecipientIdx: index(
      "in_app_notifications_recipient_user_id_idx",
    ).on(notification.recipientUserId),
    inAppNotificationsSurfaceIdx: index(
      "in_app_notifications_surface_idx",
    ).on(notification.surface),
  }),
);
