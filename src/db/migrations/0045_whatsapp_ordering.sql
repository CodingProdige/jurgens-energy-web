CREATE TABLE IF NOT EXISTS "whatsapp_customer_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phone" varchar(40) NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "linked_at" timestamp,
  "last_seen_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "whatsapp_customer_links_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_customer_links_phone_idx"
  ON "whatsapp_customer_links" ("phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_customer_links_user_id_idx"
  ON "whatsapp_customer_links" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_link_id" uuid REFERENCES "whatsapp_customer_links"("id") ON DELETE set null,
  "phone" varchar(40) NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "provider" varchar(40) NOT NULL,
  "provider_conversation_id" text,
  "status" varchar(32) DEFAULT 'open' NOT NULL,
  "last_intent" varchar(80),
  "state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_inbound_at" timestamp,
  "last_outbound_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_conversations_phone_idx"
  ON "whatsapp_conversations" ("phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_conversations_status_idx"
  ON "whatsapp_conversations" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_conversations_user_id_idx"
  ON "whatsapp_conversations" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "whatsapp_conversations"("id") ON DELETE cascade,
  "direction" varchar(16) NOT NULL,
  "provider" varchar(40) NOT NULL,
  "provider_message_id" text,
  "body" text NOT NULL,
  "payload" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "whatsapp_messages_provider_message_unique" UNIQUE("provider","provider_message_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_messages_conversation_id_idx"
  ON "whatsapp_messages" ("conversation_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_order_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "conversation_id" uuid REFERENCES "whatsapp_conversations"("id") ON DELETE set null,
  "source_order_id" uuid REFERENCES "orders"("id") ON DELETE set null,
  "source_order_item_id" uuid REFERENCES "order_items"("id") ON DELETE set null,
  "phone" varchar(40) NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "intent" varchar(80) NOT NULL,
  "variant_id" uuid NOT NULL REFERENCES "product_variants"("id"),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "quantity" integer DEFAULT 1 NOT NULL,
  "purchase_type" varchar(32) DEFAULT 'standard' NOT NULL,
  "exchange_empty_confirmed" boolean DEFAULT false NOT NULL,
  "customer_prompt" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "whatsapp_order_drafts_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_order_drafts_expires_at_idx"
  ON "whatsapp_order_drafts" ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_order_drafts_phone_idx"
  ON "whatsapp_order_drafts" ("phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_order_drafts_user_id_idx"
  ON "whatsapp_order_drafts" ("user_id");
