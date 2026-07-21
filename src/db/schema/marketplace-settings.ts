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
  googleReviewUrl: text("google_review_url"),
  footerTagline: text("footer_tagline"),
  contactPhonePrimary: text("contact_phone_primary"),
  contactPhoneSecondary: text("contact_phone_secondary"),
  contactEmail: text("contact_email"),
  // Legacy storage only. Public addresses come from business_information.
  contactAddress: text("contact_address"),
  paymentMethodBadges: text("payment_method_badges"),
  googleTagManagerId: text("google_tag_manager_id"),
  googleAnalyticsMeasurementId: text("google_analytics_measurement_id"),
  googleAdsConversionId: text("google_ads_conversion_id"),
  googleAdsConversionLabel: text("google_ads_conversion_label"),
  googleMerchantCenterId: text("google_merchant_center_id"),
  googleLocalInventoryEnabled: boolean("google_local_inventory_enabled")
    .notNull()
    .default(false),
  googleLocalInventoryStoreCode: text("google_local_inventory_store_code"),
  googleLocalInventoryCustomerAccessible: boolean(
    "google_local_inventory_customer_accessible",
  )
    .notNull()
    .default(false),
  googleSiteVerificationToken: text("google_site_verification_token"),
  openAiEnabled: boolean("openai_enabled").notNull().default(true),
  openAiApiKeyEncrypted: text("openai_api_key_encrypted"),
  openAiModel: text("openai_model").notNull().default("gpt-5.6-luna"),
  openAiReasoningEffort: varchar("openai_reasoning_effort", { length: 16 })
    .notNull()
    .default("medium"),
  freeStorageQuotaMb: integer("free_storage_quota_mb").notNull().default(512),
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
  payfastMode: varchar("payfast_mode", { length: 16 })
    .notNull()
    .default("sandbox"),
  payfastOnsiteEnabled: boolean("payfast_onsite_enabled")
    .notNull()
    .default(false),
  payfastTokenizationEnabled: boolean("payfast_tokenization_enabled")
    .notNull()
    .default(false),
  payfastLiveMerchantId: text("payfast_live_merchant_id"),
  payfastLiveMerchantKeyEncrypted: text(
    "payfast_live_merchant_key_encrypted",
  ),
  payfastLivePassphraseEncrypted: text("payfast_live_passphrase_encrypted"),
  payfastSandboxMerchantId: text("payfast_sandbox_merchant_id"),
  payfastSandboxMerchantKeyEncrypted: text(
    "payfast_sandbox_merchant_key_encrypted",
  ),
  payfastSandboxPassphraseEncrypted: text(
    "payfast_sandbox_passphrase_encrypted",
  ),
  shippingEnabled: boolean("shipping_enabled").notNull().default(false),
  shippingMarginBps: integer("shipping_margin_bps").notNull().default(0),
  shippingBufferBps: integer("shipping_buffer_bps").notNull().default(0),
  jurgensDeliveryCutoffTime: varchar("jurgens_delivery_cutoff_time", {
    length: 5,
  })
    .notNull()
    .default("14:00"),
  bobgoEnabled: boolean("bobgo_enabled").notNull().default(false),
  bobgoMode: varchar("bobgo_mode", { length: 16 }).notNull().default("sandbox"),
  bobgoBookingMode: varchar("bobgo_booking_mode", { length: 32 })
    .notNull()
    .default("disabled"),
  bobgoApiKeyEncrypted: text("bobgo_api_key_encrypted"),
  bobgoWebhookSecretEncrypted: text("bobgo_webhook_secret_encrypted"),
  bobgoLiveApiKeyEncrypted: text("bobgo_live_api_key_encrypted"),
  bobgoLiveWebhookSecretEncrypted: text(
    "bobgo_live_webhook_secret_encrypted",
  ),
  bobgoSandboxApiKeyEncrypted: text("bobgo_sandbox_api_key_encrypted"),
  bobgoSandboxWebhookSecretEncrypted: text(
    "bobgo_sandbox_webhook_secret_encrypted",
  ),
  bobgoWebhookTrackingUpdated: boolean("bobgo_webhook_tracking_updated")
    .notNull()
    .default(true),
  bobgoWebhookFulfillmentCreated: boolean("bobgo_webhook_fulfillment_created")
    .notNull()
    .default(true),
  bobgoWebhookShipmentSubmissionStatusUpdated: boolean(
    "bobgo_webhook_shipment_submission_status_updated",
  )
    .notNull()
    .default(true),
  bobgoWebhookShipmentChargedAmountChanged: boolean(
    "bobgo_webhook_shipment_charged_amount_changed",
  )
    .notNull()
    .default(true),
  bobgoWebhookShipmentChargedWeightChanged: boolean(
    "bobgo_webhook_shipment_charged_weight_changed",
  )
    .notNull()
    .default(true),
  bobgoWebhookShipmentHealthStatusUpdated: boolean(
    "bobgo_webhook_shipment_health_status_updated",
  )
    .notNull()
    .default(true),
  whatsappOrderingEnabled: boolean("whatsapp_ordering_enabled")
    .notNull()
    .default(false),
  whatsappProvider: varchar("whatsapp_provider", { length: 32 })
    .notNull()
    .default("360dialog"),
  whatsappBusinessPhoneNumber: text("whatsapp_business_phone_number"),
  whatsappMessageUrl: text("whatsapp_message_url"),
  whatsappApiKeyEncrypted: text("whatsapp_api_key_encrypted"),
  whatsappWebhookVerifyTokenEncrypted: text(
    "whatsapp_webhook_verify_token_encrypted",
  ),
  whatsappWebhookSigningSecretEncrypted: text(
    "whatsapp_webhook_signing_secret_encrypted",
  ),
  whatsappFollowUpsEnabled: boolean("whatsapp_follow_ups_enabled")
    .notNull()
    .default(true),
  whatsappFollowUpDelayMinutes: integer("whatsapp_follow_up_delay_minutes")
    .notNull()
    .default(30),
  whatsappFollowUpMaxCount: integer("whatsapp_follow_up_max_count")
    .notNull()
    .default(1),
  whatsappFollowUpQuietHoursEnabled: boolean(
    "whatsapp_follow_up_quiet_hours_enabled",
  )
    .notNull()
    .default(false),
  whatsappFollowUpQuietHoursStart: varchar(
    "whatsapp_follow_up_quiet_hours_start",
    { length: 5 },
  ),
  whatsappFollowUpQuietHoursEnd: varchar("whatsapp_follow_up_quiet_hours_end", {
    length: 5,
  }),
  whatsappFollowUpDraftMessage: text("whatsapp_follow_up_draft_message"),
  whatsappFollowUpSupportMessage: text("whatsapp_follow_up_support_message"),
  whatsappFollowUpDefaultMessage: text("whatsapp_follow_up_default_message"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
