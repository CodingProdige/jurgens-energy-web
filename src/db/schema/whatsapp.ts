import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { orderItems, orders } from "@/src/db/schema/orders";
import { productVariants, products } from "@/src/db/schema/products";
import { users } from "@/src/db/schema/users";

export const whatsappCustomerLinks = pgTable(
  "whatsapp_customer_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: varchar("phone", { length: 40 }).notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    verificationStatus: varchar("verification_status", { length: 32 })
      .notNull()
      .default("unverified"),
    verifiedAt: timestamp("verified_at", { mode: "date" }),
    linkSource: varchar("link_source", { length: 40 })
      .notNull()
      .default("whatsapp"),
    linkedAt: timestamp("linked_at", { mode: "date" }),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (link) => ({
    phoneIdx: index("whatsapp_customer_links_phone_idx").on(link.phone),
    phoneUnique: unique("whatsapp_customer_links_phone_unique").on(link.phone),
    userIdx: index("whatsapp_customer_links_user_id_idx").on(link.userId),
  }),
);

export const whatsappConversations = pgTable(
  "whatsapp_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerLinkId: uuid("customer_link_id").references(
      () => whatsappCustomerLinks.id,
      { onDelete: "set null" },
    ),
    phone: varchar("phone", { length: 40 }).notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 40 }).notNull(),
    providerConversationId: text("provider_conversation_id"),
    status: varchar("status", { length: 32 }).notNull().default("open"),
    lastIntent: varchar("last_intent", { length: 80 }),
    state: jsonb("state").$type<Record<string, unknown>>().notNull().default({}),
    lastInboundAt: timestamp("last_inbound_at", { mode: "date" }),
    lastOutboundAt: timestamp("last_outbound_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (conversation) => ({
    phoneIdx: index("whatsapp_conversations_phone_idx").on(conversation.phone),
    statusIdx: index("whatsapp_conversations_status_idx").on(conversation.status),
    userIdx: index("whatsapp_conversations_user_id_idx").on(conversation.userId),
  }),
);

export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => whatsappConversations.id, { onDelete: "cascade" }),
    direction: varchar("direction", { length: 16 }).notNull(),
    provider: varchar("provider", { length: 40 }).notNull(),
    providerMessageId: text("provider_message_id"),
    body: text("body").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (message) => ({
    conversationIdx: index("whatsapp_messages_conversation_id_idx").on(
      message.conversationId,
    ),
    providerMessageUnique: unique("whatsapp_messages_provider_message_unique").on(
      message.provider,
      message.providerMessageId,
    ),
  }),
);

export const whatsappOrderDrafts = pgTable(
  "whatsapp_order_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    conversationId: uuid("conversation_id").references(
      () => whatsappConversations.id,
      { onDelete: "set null" },
    ),
    sourceOrderId: uuid("source_order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    sourceOrderItemId: uuid("source_order_item_id").references(
      () => orderItems.id,
      { onDelete: "set null" },
    ),
    phone: varchar("phone", { length: 40 }).notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    intent: varchar("intent", { length: 80 }).notNull(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull().default(1),
    purchaseType: varchar("purchase_type", { length: 32 })
      .notNull()
      .default("standard"),
    exchangeEmptyConfirmed: boolean("exchange_empty_confirmed")
      .notNull()
      .default(false),
    customerPrompt: text("customer_prompt"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (draft) => ({
    expiresIdx: index("whatsapp_order_drafts_expires_at_idx").on(draft.expiresAt),
    phoneIdx: index("whatsapp_order_drafts_phone_idx").on(draft.phone),
    tokenUnique: unique("whatsapp_order_drafts_token_hash_unique").on(
      draft.tokenHash,
    ),
    userIdx: index("whatsapp_order_drafts_user_id_idx").on(draft.userId),
  }),
);
