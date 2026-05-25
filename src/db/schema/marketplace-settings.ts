import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const marketplaceSettings = pgTable("marketplace_settings", {
  id: integer("id").primaryKey().default(1),
  comingSoonEnabled: boolean("coming_soon_enabled").notNull().default(false),
  comingSoonPasswordHash: text("coming_soon_password_hash"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  twitterUrl: text("twitter_url"),
  freeStorageQuotaMb: integer("free_storage_quota_mb").notNull().default(512),
  premiumStorageQuotaMb: integer("premium_storage_quota_mb")
    .notNull()
    .default(5120),
  maxUploadFileMb: integer("max_upload_file_mb").notNull().default(10),
  maxVideoUploadFileMb: integer("max_video_upload_file_mb")
    .notNull()
    .default(100),
  imageCompressionQuality: integer("image_compression_quality")
    .notNull()
    .default(78),
  maxImageWidth: integer("max_image_width").notNull().default(2000),
  maxVideoWidth: integer("max_video_width").notNull().default(1280),
  videoCompressionCrf: integer("video_compression_crf").notNull().default(28),
  stripeMode: varchar("stripe_mode", { length: 16 })
    .notNull()
    .default("sandbox"),
  stripeLivePublishableKey: text("stripe_live_publishable_key"),
  stripeLiveSecretKeyEncrypted: text("stripe_live_secret_key_encrypted"),
  stripeLiveWebhookSecretEncrypted: text(
    "stripe_live_webhook_secret_encrypted",
  ),
  stripeSandboxPublishableKey: text("stripe_sandbox_publishable_key"),
  stripeSandboxSecretKeyEncrypted: text("stripe_sandbox_secret_key_encrypted"),
  stripeSandboxWebhookSecretEncrypted: text(
    "stripe_sandbox_webhook_secret_encrypted",
  ),
  shippingEnabled: boolean("shipping_enabled").notNull().default(false),
  shippingMarginBps: integer("shipping_margin_bps").notNull().default(0),
  shippingBufferBps: integer("shipping_buffer_bps").notNull().default(0),
  bobgoEnabled: boolean("bobgo_enabled").notNull().default(false),
  bobgoMode: varchar("bobgo_mode", { length: 16 }).notNull().default("sandbox"),
  bobgoApiKeyEncrypted: text("bobgo_api_key_encrypted"),
  bobgoWebhookSecretEncrypted: text("bobgo_webhook_secret_encrypted"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
