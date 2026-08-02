import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  numeric,
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
  googlePlacesEnabled: boolean("google_places_enabled")
    .notNull()
    .default(false),
  googlePlacesApiKeyEncrypted: text("google_places_api_key_encrypted"),
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
    .default(90),
  maxImageWidth: integer("max_image_width").notNull().default(2560),
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
  shippingFlatRate: numeric("shipping_flat_rate", {
    mode: "number",
    precision: 12,
    scale: 2,
  })
    .notNull()
    .default(0),
  shippingFreeOverAmount: numeric("shipping_free_over_amount", {
    mode: "number",
    precision: 12,
    scale: 2,
  }),
  shippingMarginBps: integer("shipping_margin_bps").notNull().default(0),
  shippingBufferBps: integer("shipping_buffer_bps").notNull().default(0),
  shippingHandlingMinBusinessDays: integer(
    "shipping_handling_min_business_days",
  )
    .notNull()
    .default(0),
  shippingHandlingMaxBusinessDays: integer(
    "shipping_handling_max_business_days",
  )
    .notNull()
    .default(1),
  shippingTransitMinBusinessDays: integer(
    "shipping_transit_min_business_days",
  )
    .notNull()
    .default(1),
  shippingTransitMaxBusinessDays: integer(
    "shipping_transit_max_business_days",
  )
    .notNull()
    .default(3),
  returnsPolicyUrl: text("returns_policy_url")
    .notNull()
    .default("https://jurgensenergy.com/returns-and-refunds"),
  returnsCountryCodes: jsonb("returns_country_codes")
    .$type<string[]>()
    .notNull()
    .default(["ZA"]),
  returnsAcceptance: varchar("returns_acceptance", { length: 40 })
    .notNull()
    .default("defective_and_non_defective"),
  returnsExchangesEnabled: boolean("returns_exchanges_enabled")
    .notNull()
    .default(true),
  returnsProductCondition: varchar("returns_product_condition", { length: 40 })
    .notNull()
    .default("only_new"),
  returnsWindowDays: integer("returns_window_days").notNull().default(7),
  returnsMethodCodes: jsonb("returns_method_codes")
    .$type<string[]>()
    .notNull()
    .default(["by_post"]),
  returnsCurrencyCode: varchar("returns_currency_code", { length: 3 })
    .notNull()
    .default("ZAR"),
  returnsLabelResponsibility: varchar("returns_label_responsibility", {
    length: 40,
  })
    .notNull()
    .default("customer"),
  returnsRestockingFeeType: varchar("returns_restocking_fee_type", {
    length: 40,
  })
    .notNull()
    .default("none"),
  returnsRestockingFeeAmount: numeric("returns_restocking_fee_amount", {
    mode: "number",
    precision: 12,
    scale: 2,
  }),
  returnsRestockingFeePercent: numeric("returns_restocking_fee_percent", {
    mode: "number",
    precision: 5,
    scale: 2,
  }),
  returnsRefundProcessingDays: integer("returns_refund_processing_days")
    .notNull()
    .default(7),
  returnsHazardousGoodsNoteEnabled: boolean(
    "returns_hazardous_goods_note_enabled",
  )
    .notNull()
    .default(true),
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
  courierGuyEnabled: boolean("courier_guy_enabled")
    .notNull()
    .default(false),
  courierGuyMode: varchar("courier_guy_mode", { length: 16 })
    .notNull()
    .default("sandbox"),
  courierGuyLiveAccountCode: varchar("courier_guy_live_account_code", {
    length: 64,
  }),
  courierGuyLiveApiKeyEncrypted: text(
    "courier_guy_live_api_key_encrypted",
  ),
  courierGuySandboxAccountCode: varchar("courier_guy_sandbox_account_code", {
    length: 64,
  }),
  courierGuySandboxApiKeyEncrypted: text(
    "courier_guy_sandbox_api_key_encrypted",
  ),
  courierGuyWebhookTokenEncrypted: text(
    "courier_guy_webhook_token_encrypted",
  ),
  courierGuyDefaultServiceCode: varchar(
    "courier_guy_default_service_code",
    { length: 64 },
  ),
  courierGuyDropoffType: varchar("courier_guy_dropoff_type", {
    length: 32,
  })
    .notNull()
    .default("generic_kiosk"),
  courierGuyDropoffPickupPointId: varchar(
    "courier_guy_dropoff_pickup_point_id",
    { length: 120 },
  ),
  courierGuyDropoffPickupPointLabel: varchar(
    "courier_guy_dropoff_pickup_point_label",
    { length: 500 },
  ),
  courierGuyDropoffProvider: varchar(
    "courier_guy_dropoff_provider",
    { length: 80 },
  )
    .notNull()
    .default("tcg-locker"),
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
  whatsappEmailNotificationsEnabled: boolean(
    "whatsapp_email_notifications_enabled",
  )
    .notNull()
    .default(false),
  whatsappEmailNotifyNewConversation: boolean(
    "whatsapp_email_notify_new_conversation",
  )
    .notNull()
    .default(true),
  whatsappEmailNotifyInboundMessage: boolean(
    "whatsapp_email_notify_inbound_message",
  )
    .notNull()
    .default(true),
  whatsappEmailNotificationRecipients: jsonb(
    "whatsapp_email_notification_recipients",
  )
    .$type<string[]>()
    .notNull()
    .default([]),
  whatsappOrderNotificationsEnabled: boolean(
    "whatsapp_order_notifications_enabled",
  )
    .notNull()
    .default(false),
  whatsappOrderNotificationRecipients: jsonb(
    "whatsapp_order_notification_recipients",
  )
    .$type<string[]>()
    .notNull()
    .default([]),
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
}, (settings) => ({
  courierGuyLiveAccountCodeValid: check(
    "marketplace_settings_courier_guy_live_account_code_valid",
    sql`${settings.courierGuyLiveAccountCode} IS NULL OR btrim(${settings.courierGuyLiveAccountCode}) <> ''`,
  ),
  courierGuySandboxAccountCodeValid: check(
    "marketplace_settings_courier_guy_sandbox_account_code_valid",
    sql`${settings.courierGuySandboxAccountCode} IS NULL OR btrim(${settings.courierGuySandboxAccountCode}) <> ''`,
  ),
  courierGuyDropoffPickupPointLabelValid: check(
    "marketplace_settings_cg_dropoff_point_label_valid",
    sql`${settings.courierGuyDropoffPickupPointLabel} IS NULL OR btrim(${settings.courierGuyDropoffPickupPointLabel}) <> ''`,
  ),
  shippingFlatRateNonnegative: check(
    "marketplace_settings_shipping_flat_rate_nonnegative",
    sql`${settings.shippingFlatRate} >= 0`,
  ),
  shippingFreeOverNonnegative: check(
    "marketplace_settings_shipping_free_over_nonnegative",
    sql`${settings.shippingFreeOverAmount} IS NULL OR ${settings.shippingFreeOverAmount} > 0`,
  ),
  shippingHandlingBusinessDaysValid: check(
    "marketplace_settings_shipping_handling_days_valid",
    sql`${settings.shippingHandlingMinBusinessDays} >= 0 AND ${settings.shippingHandlingMaxBusinessDays} <= 30 AND ${settings.shippingHandlingMinBusinessDays} <= ${settings.shippingHandlingMaxBusinessDays}`,
  ),
  shippingTransitBusinessDaysValid: check(
    "marketplace_settings_shipping_transit_days_valid",
    sql`${settings.shippingTransitMinBusinessDays} >= 0 AND ${settings.shippingTransitMaxBusinessDays} <= 60 AND ${settings.shippingTransitMinBusinessDays} <= ${settings.shippingTransitMaxBusinessDays}`,
  ),
  returnsPolicyUrlValid: check(
    "marketplace_settings_returns_policy_url_valid",
    sql`${settings.returnsPolicyUrl} ~ '^https://.+' AND length(${settings.returnsPolicyUrl}) <= 500`,
  ),
  returnsWindowDaysValid: check(
    "marketplace_settings_returns_window_days_valid",
    sql`${settings.returnsWindowDays} >= 1 AND ${settings.returnsWindowDays} <= 365`,
  ),
  returnsRefundProcessingDaysValid: check(
    "marketplace_settings_returns_refund_processing_days_valid",
    sql`${settings.returnsRefundProcessingDays} >= 0 AND ${settings.returnsRefundProcessingDays} <= 60`,
  ),
  returnsRestockingFeeAmountValid: check(
    "marketplace_settings_returns_restocking_amount_valid",
    sql`${settings.returnsRestockingFeeAmount} IS NULL OR ${settings.returnsRestockingFeeAmount} >= 0`,
  ),
  returnsRestockingFeePercentValid: check(
    "marketplace_settings_returns_restocking_percent_valid",
    sql`${settings.returnsRestockingFeePercent} IS NULL OR (${settings.returnsRestockingFeePercent} >= 0 AND ${settings.returnsRestockingFeePercent} <= 100)`,
  ),
}));
