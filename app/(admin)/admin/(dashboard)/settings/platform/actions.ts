"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminCapability } from "@/src/modules/auth/permissions";
import {
  openAiReasoningEfforts,
  updateMarketplaceComingSoonSettings,
  updateMarketplaceFooterSettings,
  updateMarketplaceGoogleMarketingSettings,
  updateMarketplaceMediaSettings,
  updateMarketplaceOpenAiSettings,
  updateMarketplacePayFastSettings,
  updateMarketplaceShippingSettings,
  updateMarketplaceWhatsappSettings,
} from "@/src/modules/marketplace/settings";
import { normalizePhoneNumber } from "@/src/modules/phone";
import {
  deleteJurgensDeliveryZone,
  upsertJurgensDeliveryZone,
} from "@/src/modules/shipping/jurgens-delivery";
import {
  createInAppNotificationTemplateTest,
  deleteNotificationGlobalVariable,
  restoreInAppNotificationTemplateVersion,
  restoreNotificationTemplateVersion,
  sendNotificationTemplateTest,
  updateNotificationDeliveryPolicy,
  updateInAppNotificationTemplate,
  updateNotificationTemplate,
  upsertNotificationGlobalVariable,
} from "@/src/modules/notifications/templates";

export type AdminSettingsState = {
  message?: string;
  ok?: boolean;
};

async function requireSettingsManageAccess() {
  const access = await requireAdminCapability("admin.settings.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to manage settings.");
  }

  return access.session;
}

export async function updateMarketplaceGateSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireSettingsManageAccess();

  const password = String(formData.get("password") ?? "").trim();
  const enabled = formData.get("enabled") === "on";

  const result = await updateMarketplaceComingSoonSettings({
    enabled,
    password: password || undefined,
  });

  revalidatePath("/");
  revalidatePath("/sign-in");
  revalidatePath("/register");
  revalidatePath("/forgot-password");
  revalidatePath("/reset-password");
  revalidatePath("/settings/platform");

  return result;
}

const optionalUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine(
    (value) => !value || value.startsWith("https://"),
    "Use a full https:// URL.",
  )
  .refine((value) => !value || value.length <= 500, "URL is too long.");

const paymentMethodBadgesSchema = z
  .string()
  .max(5000, "Payment method data is too long.")
  .transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({
        code: "custom",
        message: "Payment methods could not be read. Refresh and try again.",
      });

      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(
        z.object({
          label: z
            .string()
            .trim()
            .min(1, "Each payment method needs a label.")
            .max(40, "Each payment method label must be 40 characters or fewer."),
          mediaId: z.string().uuid("Choose a valid payment icon.").nullable(),
        }),
      )
      .max(12, "Use 12 payment methods or fewer."),
  );

const socialLinksSchema = z.object({
  contactAddress: z
    .string()
    .trim()
    .max(300, "Contact address is too long."),
  contactEmail: z
    .string()
    .trim()
    .max(180, "Contact email is too long.")
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "Enter a valid contact email address.",
    ),
  contactPhonePrimary: z
    .string()
    .trim()
    .max(80, "Primary phone number is too long.")
    .refine(
      (value) => !value || /^[+()\d\s-]+$/.test(value),
      "Primary phone number can only contain digits, spaces, +, -, and brackets.",
    ),
  contactPhoneSecondary: z
    .string()
    .trim()
    .max(80, "Secondary phone number is too long.")
    .refine(
      (value) => !value || /^[+()\d\s-]+$/.test(value),
      "Secondary phone number can only contain digits, spaces, +, -, and brackets.",
    ),
  facebookUrl: optionalUrlSchema,
  footerTagline: z
    .string()
    .trim()
    .max(160, "Footer tagline is too long."),
  googleReviewUrl: optionalUrlSchema,
  instagramUrl: optionalUrlSchema,
  paymentMethodBadges: paymentMethodBadgesSchema,
  twitterUrl: optionalUrlSchema,
});

export async function updateMarketplaceSocialLinkSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireSettingsManageAccess();

  const parsed = socialLinksSchema.safeParse({
    contactAddress: String(formData.get("contactAddress") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhonePrimary: String(formData.get("contactPhonePrimary") ?? ""),
    contactPhoneSecondary: String(formData.get("contactPhoneSecondary") ?? ""),
    facebookUrl: String(formData.get("facebookUrl") ?? ""),
    footerTagline: String(formData.get("footerTagline") ?? ""),
    googleReviewUrl: String(formData.get("googleReviewUrl") ?? ""),
    instagramUrl: String(formData.get("instagramUrl") ?? ""),
    paymentMethodBadges: String(formData.get("paymentMethodBadges") ?? ""),
    twitterUrl: String(formData.get("twitterUrl") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the social links.",
    };
  }

  const result = await updateMarketplaceFooterSettings(parsed.data);

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/products");
  revalidatePath("/settings/platform");

  return result;
}

const optionalGoogleTagManagerIdSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value.toUpperCase() : undefined))
  .refine(
    (value) => !value || /^GTM-[A-Z0-9]+$/.test(value),
    "Google Tag Manager ID must look like GTM-XXXXXXX.",
  );

const optionalGoogleAnalyticsMeasurementIdSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value.toUpperCase() : undefined))
  .refine(
    (value) => !value || /^G-[A-Z0-9]+$/.test(value),
    "GA4 measurement ID must look like G-XXXXXXXXXX.",
  );

const optionalGoogleAdsConversionIdSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    const cleaned = value?.replace(/\s+/g, "") ?? "";

    if (!cleaned) {
      return undefined;
    }

    const upper = cleaned.toUpperCase();

    return upper.startsWith("AW-") ? upper : `AW-${upper}`;
  })
  .refine(
    (value) => !value || /^AW-\d{6,20}$/.test(value),
    "Google Ads conversion ID must look like AW-123456789.",
  );

const optionalGoogleAdsConversionLabelSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine(
    (value) => !value || /^[A-Za-z0-9_-]{1,120}$/.test(value),
    "Google Ads conversion label can only contain letters, numbers, hyphens, and underscores.",
  );

const optionalGoogleMerchantCenterIdSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value?.replace(/\s+/g, "") || undefined)
  .refine(
    (value) => !value || /^\d{5,30}$/.test(value),
    "Google Merchant Center ID must be numeric.",
  );

const optionalGoogleVerificationTokenSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine(
    (value) => !value || (!value.includes("<") && value.length <= 255),
    "Paste only the Google verification token, or the full meta tag from Google.",
  );

const optionalGoogleStoreCodeSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine(
    (value) => !value || /^[A-Za-z0-9_-]{1,64}$/.test(value),
    "The Business Profile store code can only contain letters, numbers, hyphens, and underscores.",
  );

const googleMarketingSettingsSchema = z.object({
  googleAdsConversionId: optionalGoogleAdsConversionIdSchema,
  googleAdsConversionLabel: optionalGoogleAdsConversionLabelSchema,
  googleAnalyticsMeasurementId: optionalGoogleAnalyticsMeasurementIdSchema,
  googleLocalInventoryCustomerAccessible: z.boolean(),
  googleLocalInventoryEnabled: z.boolean(),
  googleLocalInventoryStoreCode: optionalGoogleStoreCodeSchema,
  googleMerchantCenterId: optionalGoogleMerchantCenterIdSchema,
  googleSiteVerificationToken: optionalGoogleVerificationTokenSchema,
  googleTagManagerId: optionalGoogleTagManagerIdSchema,
}).superRefine((value, context) => {
  if (!value.googleLocalInventoryEnabled) {
    return;
  }

  if (!value.googleLocalInventoryCustomerAccessible) {
    context.addIssue({
      code: "custom",
      message:
        "Local inventory can only be enabled for a customer-accessible physical store.",
      path: ["googleLocalInventoryCustomerAccessible"],
    });
  }

  if (!value.googleLocalInventoryStoreCode) {
    context.addIssue({
      code: "custom",
      message:
        "Add the exact Google Business Profile store code before enabling local inventory.",
      path: ["googleLocalInventoryStoreCode"],
    });
  }
});

function extractGoogleSiteVerificationToken(value: string) {
  const trimmed = value.trim();
  const metaContent = trimmed.match(/\bcontent=["']([^"']+)["']/i)?.[1];

  return metaContent ?? trimmed;
}

export async function updateGoogleMarketingSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireSettingsManageAccess();

  const parsed = googleMarketingSettingsSchema.safeParse({
    googleAdsConversionId: String(formData.get("googleAdsConversionId") ?? ""),
    googleAdsConversionLabel: String(
      formData.get("googleAdsConversionLabel") ?? "",
    ),
    googleAnalyticsMeasurementId: String(
      formData.get("googleAnalyticsMeasurementId") ?? "",
    ),
    googleLocalInventoryCustomerAccessible:
      formData.get("googleLocalInventoryCustomerAccessible") === "on",
    googleLocalInventoryEnabled:
      formData.get("googleLocalInventoryEnabled") === "on",
    googleLocalInventoryStoreCode: String(
      formData.get("googleLocalInventoryStoreCode") ?? "",
    ),
    googleMerchantCenterId: String(
      formData.get("googleMerchantCenterId") ?? "",
    ),
    googleSiteVerificationToken: extractGoogleSiteVerificationToken(
      String(formData.get("googleSiteVerificationToken") ?? ""),
    ),
    googleTagManagerId: String(formData.get("googleTagManagerId") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the Google settings.",
    };
  }

  const result = await updateMarketplaceGoogleMarketingSettings(parsed.data);

  revalidatePath("/");
  revalidatePath("/settings/platform");

  return result;
}

const openAiSettingsSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .max(500, "The OpenAI API key is too long.")
    .optional()
    .transform((value) => value || undefined),
  enabled: z.coerce.boolean().default(false),
  model: z
    .string()
    .trim()
    .min(2, "Choose an OpenAI model.")
    .max(120, "The model name is too long.")
    .refine(
      (value) => /^[A-Za-z0-9._:-]+$/.test(value),
      "Model names can only contain letters, numbers, dots, hyphens, underscores, and colons.",
    ),
  reasoningEffort: z.enum(openAiReasoningEfforts),
});

export async function updateChatGptIntegrationSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireSettingsManageAccess();

  const parsed = openAiSettingsSchema.safeParse({
    apiKey: String(formData.get("apiKey") ?? ""),
    enabled: formData.get("enabled") === "on",
    model: String(formData.get("model") ?? ""),
    reasoningEffort: String(formData.get("reasoningEffort") ?? "medium"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Check the ChatGPT integration settings.",
    };
  }

  const result = await updateMarketplaceOpenAiSettings(parsed.data);

  revalidatePath("/settings/platform");

  return result;
}

const mediaSettingsSchema = z.object({
  freeStorageQuotaMb: z.coerce.number().int().min(50).max(102400),
  imageCompressionQuality: z.coerce.number().int().min(40).max(92),
  maxImageWidth: z.coerce.number().int().min(800).max(5000),
  maxUploadFileMb: z.coerce.number().int().min(1).max(100),
  maxVideoUploadFileMb: z.coerce.number().int().min(10).max(2048),
  maxVideoWidth: z.coerce.number().int().min(480).max(3840),
  videoCompressionCrf: z.coerce.number().int().min(18).max(35),
});

export async function updateMediaStorageSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireSettingsManageAccess();

  const parsed = mediaSettingsSchema.safeParse({
    freeStorageQuotaMb: formData.get("freeStorageQuotaMb"),
    imageCompressionQuality: formData.get("imageCompressionQuality"),
    maxImageWidth: formData.get("maxImageWidth"),
    maxUploadFileMb: formData.get("maxUploadFileMb"),
    maxVideoUploadFileMb: formData.get("maxVideoUploadFileMb"),
    maxVideoWidth: formData.get("maxVideoWidth"),
    videoCompressionCrf: formData.get("videoCompressionCrf"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the media settings.",
    };
  }

  const result = await updateMarketplaceMediaSettings(parsed.data);

  revalidatePath("/settings/platform");

  return result;
}

const optionalPayFastMerchantIdSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine(
    (value) => !value || /^\d{4,20}$/.test(value),
    "PayFast merchant ID must be numeric.",
  );

const optionalPayFastSecretSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => !value || value.length <= 255, "PayFast secret is too long.");

const payFastSettingsSchema = z.object({
  liveMerchantId: optionalPayFastMerchantIdSchema,
  liveMerchantKey: optionalPayFastSecretSchema,
  livePassphrase: optionalPayFastSecretSchema,
  mode: z.enum(["live", "sandbox"]),
  onsiteEnabled: z.coerce.boolean().default(false),
  sandboxMerchantId: optionalPayFastMerchantIdSchema,
  sandboxMerchantKey: optionalPayFastSecretSchema,
  sandboxPassphrase: optionalPayFastSecretSchema,
  tokenizationEnabled: z.coerce.boolean().default(false),
});

export async function updatePayFastPaymentSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireSettingsManageAccess();

  const parsed = payFastSettingsSchema.safeParse({
    liveMerchantId: String(formData.get("liveMerchantId") ?? ""),
    liveMerchantKey: String(formData.get("liveMerchantKey") ?? ""),
    livePassphrase: String(formData.get("livePassphrase") ?? ""),
    mode: String(formData.get("mode") ?? "sandbox"),
    onsiteEnabled: formData.get("onsiteEnabled") === "on",
    sandboxMerchantId: String(formData.get("sandboxMerchantId") ?? ""),
    sandboxMerchantKey: String(formData.get("sandboxMerchantKey") ?? ""),
    sandboxPassphrase: String(formData.get("sandboxPassphrase") ?? ""),
    tokenizationEnabled: formData.get("tokenizationEnabled") === "on",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the PayFast settings.",
    };
  }

  const result = await updateMarketplacePayFastSettings(parsed.data);

  revalidatePath("/settings/platform");

  return result;
}

const shippingSettingsSchema = z.object({
  bobgoApiKey: z.string().trim().optional().transform((value) => value || undefined),
  bobgoBookingMode: z.enum(["disabled", "quote_only", "quote_and_book"]),
  bobgoEnabled: z.coerce.boolean().default(false),
  bobgoLiveApiKey: z.string().trim().optional().transform((value) => value || undefined),
  bobgoLiveWebhookSecret: z.string().trim().optional().transform((value) => value || undefined),
  bobgoMode: z.enum(["live", "sandbox"]).default("sandbox"),
  bobgoSandboxApiKey: z.string().trim().optional().transform((value) => value || undefined),
  bobgoSandboxWebhookSecret: z.string().trim().optional().transform((value) => value || undefined),
  bobgoWebhookFulfillmentCreated: z.coerce.boolean().default(false),
  bobgoWebhookSecret: z.string().trim().optional().transform((value) => value || undefined),
  bobgoWebhookShipmentChargedAmountChanged: z.coerce.boolean().default(false),
  bobgoWebhookShipmentChargedWeightChanged: z.coerce.boolean().default(false),
  bobgoWebhookShipmentHealthStatusUpdated: z.coerce.boolean().default(false),
  bobgoWebhookShipmentSubmissionStatusUpdated: z.coerce.boolean().default(false),
  bobgoWebhookTrackingUpdated: z.coerce.boolean().default(false),
  jurgensDeliveryCutoffTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid cutoff time."),
  shippingBufferBps: z.coerce.number().int().min(0).max(10000),
  shippingEnabled: z.coerce.boolean().default(false),
  shippingMarginBps: z.coerce.number().int().min(0).max(10000),
});

const whatsappOptionalTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time.")
  .optional()
  .or(z.literal("").transform(() => undefined));

const whatsappSettingsSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine((value) => !value || value.length <= 500, "API key is too long."),
  businessPhoneNumber: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) =>
        !value ||
        Boolean(normalizePhoneNumber(value, { defaultCountryCode: "ZA" })),
      "Use a valid WhatsApp business phone number.",
    )
    .transform((value) =>
      value
        ? normalizePhoneNumber(value, { defaultCountryCode: "ZA" }) ?? value
        : undefined,
    ),
  enabled: z.coerce.boolean().default(false),
  followUpDefaultMessage: z
    .string()
    .trim()
    .min(10, "Default follow-up message is too short.")
    .max(1000, "Default follow-up message must be 1000 characters or less."),
  followUpDelayMinutes: z.coerce.number().int().min(5).max(1440),
  followUpDraftMessage: z
    .string()
    .trim()
    .min(10, "Draft follow-up message is too short.")
    .max(1000, "Draft follow-up message must be 1000 characters or less."),
  followUpMaxCount: z.coerce.number().int().min(1).max(5),
  followUpQuietHoursEnabled: z.boolean(),
  followUpQuietHoursEnd: whatsappOptionalTimeSchema.transform(
    (value) => value ?? null,
  ),
  followUpQuietHoursStart: whatsappOptionalTimeSchema.transform(
    (value) => value ?? null,
  ),
  followUpSupportMessage: z
    .string()
    .trim()
    .min(10, "Support follow-up message is too short.")
    .max(1000, "Support follow-up message must be 1000 characters or less."),
  followUpsEnabled: z.coerce.boolean().default(false),
  messageUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || value.startsWith("https://"),
      "Use the full https:// 360dialog API URL.",
    )
    .refine((value) => !value || value.length <= 500, "API URL is too long."),
  provider: z.literal("360dialog"),
  webhookSigningSecret: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || value.length >= 16,
      "Webhook signing secret must be at least 16 characters.",
    )
    .refine(
      (value) => !value || value.length <= 255,
      "Webhook signing secret is too long.",
    ),
  webhookVerifyToken: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || value.length <= 255,
      "Webhook verify token is too long.",
    ),
});

export async function updateWhatsappOrderingSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireSettingsManageAccess();

  const parsed = whatsappSettingsSchema.safeParse({
    apiKey: String(formData.get("apiKey") ?? ""),
    businessPhoneNumber: String(formData.get("businessPhoneNumber") ?? ""),
    enabled: formData.get("enabled") === "on",
    followUpDefaultMessage: String(formData.get("followUpDefaultMessage") ?? ""),
    followUpDelayMinutes: String(formData.get("followUpDelayMinutes") ?? "30"),
    followUpDraftMessage: String(formData.get("followUpDraftMessage") ?? ""),
    followUpMaxCount: String(formData.get("followUpMaxCount") ?? "1"),
    followUpQuietHoursEnabled:
      formData.get("followUpQuietHoursEnabled") === "on",
    followUpQuietHoursEnd: String(formData.get("followUpQuietHoursEnd") ?? ""),
    followUpQuietHoursStart: String(
      formData.get("followUpQuietHoursStart") ?? "",
    ),
    followUpSupportMessage: String(formData.get("followUpSupportMessage") ?? ""),
    followUpsEnabled: formData.get("followUpsEnabled") === "on",
    messageUrl: String(formData.get("messageUrl") ?? ""),
    provider: String(formData.get("provider") ?? "360dialog"),
    webhookSigningSecret: String(
      formData.get("webhookSigningSecret") ?? "",
    ),
    webhookVerifyToken: String(formData.get("webhookVerifyToken") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Check the WhatsApp settings.",
    };
  }

  if (
    parsed.data.followUpQuietHoursEnabled &&
    (!parsed.data.followUpQuietHoursStart || !parsed.data.followUpQuietHoursEnd)
  ) {
    return {
      ok: false,
      message: "Set both quiet-hours start and end times.",
    };
  }

  const result = await updateMarketplaceWhatsappSettings(parsed.data);

  revalidatePath("/");
  revalidatePath("/settings/platform");

  return result;
}

export async function updateShippingIntegrationSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireSettingsManageAccess();

  const parsed = shippingSettingsSchema.safeParse({
    bobgoApiKey: String(formData.get("bobgoApiKey") ?? ""),
    bobgoBookingMode: String(formData.get("bobgoBookingMode") ?? "disabled"),
    bobgoEnabled: formData.get("bobgoEnabled") === "on",
    bobgoLiveApiKey: String(formData.get("bobgoLiveApiKey") ?? ""),
    bobgoLiveWebhookSecret: String(formData.get("bobgoLiveWebhookSecret") ?? ""),
    bobgoMode: String(formData.get("bobgoMode") ?? "sandbox"),
    bobgoSandboxApiKey: String(formData.get("bobgoSandboxApiKey") ?? ""),
    bobgoSandboxWebhookSecret: String(
      formData.get("bobgoSandboxWebhookSecret") ?? "",
    ),
    bobgoWebhookFulfillmentCreated:
      formData.get("bobgoWebhookFulfillmentCreated") === "on",
    bobgoWebhookSecret: String(formData.get("bobgoWebhookSecret") ?? ""),
    bobgoWebhookShipmentChargedAmountChanged:
      formData.get("bobgoWebhookShipmentChargedAmountChanged") === "on",
    bobgoWebhookShipmentChargedWeightChanged:
      formData.get("bobgoWebhookShipmentChargedWeightChanged") === "on",
    bobgoWebhookShipmentHealthStatusUpdated:
      formData.get("bobgoWebhookShipmentHealthStatusUpdated") === "on",
    bobgoWebhookShipmentSubmissionStatusUpdated:
      formData.get("bobgoWebhookShipmentSubmissionStatusUpdated") === "on",
    bobgoWebhookTrackingUpdated:
      formData.get("bobgoWebhookTrackingUpdated") === "on",
    jurgensDeliveryCutoffTime: String(
      formData.get("jurgensDeliveryCutoffTime") ?? "14:00",
    ),
    shippingBufferBps: formData.get("shippingBufferBps"),
    shippingEnabled: formData.get("shippingEnabled") === "on",
    shippingMarginBps: formData.get("shippingMarginBps"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the shipping settings.",
    };
  }

  const result = await updateMarketplaceShippingSettings(parsed.data);

  revalidatePath("/settings/platform");

  return result;
}

const jurgensDeliveryRateSchema = z.object({
  fromAmount: z.coerce.number().finite().min(0).max(1_000_000),
  price: z.coerce.number().finite().min(0).max(1_000_000),
  upToAmount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.coerce.number().finite().min(0).max(1_000_000).nullable(),
  ),
});

const jurgensDeliveryZoneSchema = z.object({
  deliveryInformation: z
    .string()
    .trim()
    .max(255, "Delivery information must be 255 characters or less.")
    .optional()
    .transform((value) => value || undefined),
  id: z
    .string()
    .trim()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  isActive: z.coerce.boolean().default(false),
  minimumOrderAmount: z.coerce.number().finite().min(0).max(1_000_000),
  name: z
    .string()
    .trim()
    .min(2, "Zone name is required.")
    .max(120, "Zone name must be 120 characters or less."),
  postalCodes: z
    .string()
    .trim()
    .min(2, "Add at least one postal code.")
    .max(5000, "Postal code list is too long.")
    .transform((value) =>
      value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  rates: z.array(jurgensDeliveryRateSchema).min(1),
});

function parseJurgensDeliveryRates(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveJurgensDeliveryZoneSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireSettingsManageAccess();

  const parsed = jurgensDeliveryZoneSchema.safeParse({
    deliveryInformation: String(formData.get("deliveryInformation") ?? ""),
    id: String(formData.get("zoneId") ?? ""),
    isActive: formData.get("isActive") === "on",
    minimumOrderAmount: formData.get("minimumOrderAmount"),
    name: String(formData.get("name") ?? ""),
    postalCodes: String(formData.get("postalCodes") ?? ""),
    rates: parseJurgensDeliveryRates(formData.get("ratesJson")),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Check the Jurgens delivery zone.",
    };
  }

  const result = await upsertJurgensDeliveryZone(parsed.data);

  revalidatePath("/settings/platform");

  return result;
}

const deleteJurgensDeliveryZoneSchema = z.object({
  id: z.string().trim().uuid(),
});

export async function deleteJurgensDeliveryZoneSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireSettingsManageAccess();

  const parsed = deleteJurgensDeliveryZoneSchema.safeParse({
    id: String(formData.get("zoneId") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: "Choose a valid delivery zone." };
  }

  const result = await deleteJurgensDeliveryZone(parsed.data.id);

  revalidatePath("/settings/platform");

  return result;
}

const notificationTemplateSchema = z.object({
  htmlBody: z
    .string()
    .trim()
    .min(20, "HTML body is too short.")
    .max(20000, "HTML body is too long."),
  id: z.string().trim().uuid(),
  previewText: z
    .string()
    .trim()
    .max(240, "Preview text must be 240 characters or less.")
    .optional()
    .transform((value) => value || undefined),
  requiredVariables: z
    .string()
    .trim()
    .max(1000, "Variables list is too long.")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  status: z.enum(["active", "disabled", "archived"]),
  subject: z
    .string()
    .trim()
    .min(3, "Subject is required.")
    .max(240, "Subject must be 240 characters or less."),
  textBody: z
    .string()
    .trim()
    .min(10, "Plain text body is too short.")
    .max(10000, "Plain text body is too long."),
});

const optionalTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time.")
  .optional()
  .or(z.literal("").transform(() => undefined));

const notificationDeliveryPolicySchema = z.object({
  digestEligible: z.boolean(),
  emailEnabled: z.boolean(),
  eventKey: z.string().trim().min(3).max(160),
  inAppEnabled: z.boolean(),
  priority: z.enum(["low", "normal", "high", "critical"]),
  pushEnabled: z.boolean(),
  quietHoursEnabled: z.boolean(),
  quietHoursEnd: optionalTimeSchema.transform((value) => value ?? null),
  quietHoursStart: optionalTimeSchema.transform((value) => value ?? null),
});

function parseNotificationDeliveryPolicy(formData: FormData) {
  return notificationDeliveryPolicySchema.safeParse({
    digestEligible: formData.get("deliveryDigestEligible") === "on",
    emailEnabled: formData.get("deliveryEmailEnabled") === "on",
    eventKey: String(formData.get("deliveryEventKey") ?? ""),
    inAppEnabled: formData.get("deliveryInAppEnabled") === "on",
    priority: String(formData.get("deliveryPriority") ?? "normal"),
    pushEnabled: formData.get("deliveryPushEnabled") === "on",
    quietHoursEnabled: formData.get("deliveryQuietHoursEnabled") === "on",
    quietHoursEnd: String(formData.get("deliveryQuietHoursEnd") ?? ""),
    quietHoursStart: String(formData.get("deliveryQuietHoursStart") ?? ""),
  });
}

export async function saveNotificationTemplateSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  const session = await requireSettingsManageAccess();

  const parsed = notificationTemplateSchema.safeParse({
    htmlBody: String(formData.get("htmlBody") ?? ""),
    id: String(formData.get("id") ?? ""),
    previewText: String(formData.get("previewText") ?? ""),
    requiredVariables: String(formData.get("requiredVariables") ?? ""),
    status: String(formData.get("status") ?? "active"),
    subject: String(formData.get("subject") ?? ""),
    textBody: String(formData.get("textBody") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Check the notification template.",
    };
  }

  const policy = parseNotificationDeliveryPolicy(formData);

  if (!policy.success) {
    return {
      ok: false,
      message:
        policy.error.issues[0]?.message ?? "Check the delivery policy.",
    };
  }

  const result = await updateNotificationTemplate({
    actorUserId: session.user.id,
    ...parsed.data,
  });

  if (!result.ok) {
    return result;
  }

  await updateNotificationDeliveryPolicy(policy.data);

  revalidatePath("/settings/platform");

  return {
    ok: true,
    message: "Notification template and delivery policy saved.",
  };
}

const inAppNotificationTemplateSchema = z.object({
  actionLabelTemplate: z
    .string()
    .trim()
    .max(120, "Action label must be 120 characters or less.")
    .optional()
    .transform((value) => value || undefined),
  actionUrlTemplate: z
    .string()
    .trim()
    .max(1000, "Action URL template is too long.")
    .optional()
    .transform((value) => value || undefined),
  bodyTemplate: z
    .string()
    .trim()
    .min(10, "Notification body is too short.")
    .max(2000, "Notification body is too long."),
  id: z.string().trim().uuid(),
  requiredVariables: z
    .string()
    .trim()
    .max(1000, "Variables list is too long.")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  status: z.enum(["active", "disabled", "archived"]),
  titleTemplate: z
    .string()
    .trim()
    .min(3, "Notification title is required.")
    .max(180, "Notification title must be 180 characters or less."),
});

export async function saveInAppNotificationTemplateSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  const session = await requireSettingsManageAccess();

  const parsed = inAppNotificationTemplateSchema.safeParse({
    actionLabelTemplate: String(formData.get("actionLabelTemplate") ?? ""),
    actionUrlTemplate: String(formData.get("actionUrlTemplate") ?? ""),
    bodyTemplate: String(formData.get("bodyTemplate") ?? ""),
    id: String(formData.get("id") ?? ""),
    requiredVariables: String(formData.get("requiredVariables") ?? ""),
    status: String(formData.get("status") ?? "active"),
    titleTemplate: String(formData.get("titleTemplate") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Check the in-app notification template.",
    };
  }

  const policy = parseNotificationDeliveryPolicy(formData);

  if (!policy.success) {
    return {
      ok: false,
      message:
        policy.error.issues[0]?.message ?? "Check the delivery policy.",
    };
  }

  const result = await updateInAppNotificationTemplate({
    actorUserId: session.user.id,
    ...parsed.data,
  });

  if (!result.ok) {
    return result;
  }

  await updateNotificationDeliveryPolicy(policy.data);

  revalidatePath("/settings/platform");

  return {
    ok: true,
    message: "In-app template and delivery policy saved.",
  };
}

const restoreNotificationTemplateSchema = z.object({
  templateId: z.string().trim().uuid(),
  versionId: z.string().trim().uuid(),
});

export async function restoreNotificationTemplateSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  const session = await requireSettingsManageAccess();

  const parsed = restoreNotificationTemplateSchema.safeParse({
    templateId: String(formData.get("templateId") ?? ""),
    versionId: String(formData.get("versionId") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Choose a template version first.",
    };
  }

  const result = await restoreNotificationTemplateVersion({
    actorUserId: session.user.id,
    ...parsed.data,
  });

  revalidatePath("/settings/platform");

  return result;
}

export async function restoreInAppNotificationTemplateSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  const session = await requireSettingsManageAccess();

  const parsed = restoreNotificationTemplateSchema.safeParse({
    templateId: String(formData.get("templateId") ?? ""),
    versionId: String(formData.get("versionId") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Choose a template version first.",
    };
  }

  const result = await restoreInAppNotificationTemplateVersion({
    actorUserId: session.user.id,
    ...parsed.data,
  });

  revalidatePath("/settings/platform");

  return result;
}

const testNotificationTemplateSchema = z.object({
  htmlBody: z
    .string()
    .trim()
    .min(20, "HTML body is too short.")
    .max(20000, "HTML body is too long."),
  previewText: z
    .string()
    .trim()
    .max(240, "Preview text must be 240 characters or less.")
    .optional()
    .transform((value) => value || undefined),
  recipientEmail: z.string().trim().email("Enter a valid test email address."),
  requiredVariables: z
    .string()
    .trim()
    .max(1000, "Variables list is too long.")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  subject: z
    .string()
    .trim()
    .min(3, "Subject is required.")
    .max(240, "Subject must be 240 characters or less."),
  templateKey: z.string().trim().min(3).max(160),
  textBody: z
    .string()
    .trim()
    .min(10, "Plain text body is too short.")
    .max(10000, "Plain text body is too long."),
});

export async function sendNotificationTemplateTestSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  const session = await requireSettingsManageAccess();

  const parsed = testNotificationTemplateSchema.safeParse({
    htmlBody: String(formData.get("htmlBody") ?? ""),
    previewText: String(formData.get("previewText") ?? ""),
    recipientEmail: String(formData.get("recipientEmail") ?? ""),
    requiredVariables: String(formData.get("requiredVariables") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    templateKey: String(formData.get("templateKey") ?? ""),
    textBody: String(formData.get("textBody") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the test email.",
    };
  }

  const result = await sendNotificationTemplateTest({
    actorUserId: session.user.id,
    ...parsed.data,
  });

  revalidatePath("/settings/platform");

  return result;
}

const testInAppNotificationTemplateSchema = z.object({
  actionLabelTemplate: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || undefined),
  actionUrlTemplate: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || undefined),
  bodyTemplate: z.string().trim().min(10).max(2000),
  requiredVariables: z
    .string()
    .trim()
    .max(1000)
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  templateKey: z.string().trim().min(3).max(160),
  titleTemplate: z.string().trim().min(3).max(180),
});

export async function sendInAppNotificationTemplateTestSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  const session = await requireSettingsManageAccess();

  const parsed = testInAppNotificationTemplateSchema.safeParse({
    actionLabelTemplate: String(formData.get("actionLabelTemplate") ?? ""),
    actionUrlTemplate: String(formData.get("actionUrlTemplate") ?? ""),
    bodyTemplate: String(formData.get("bodyTemplate") ?? ""),
    requiredVariables: String(formData.get("requiredVariables") ?? ""),
    templateKey: String(formData.get("templateKey") ?? ""),
    titleTemplate: String(formData.get("titleTemplate") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Check the in-app notification test.",
    };
  }

  const result = await createInAppNotificationTemplateTest({
    recipientUserId: session.user.id,
    ...parsed.data,
  });

  revalidatePath("/settings/platform");

  return result;
}

const notificationGlobalVariableSchema = z.object({
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less.")
    .optional()
    .transform((value) => value || undefined),
  id: z
    .string()
    .trim()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  key: z
    .string()
    .trim()
    .min(2, "Use a short variable key.")
    .max(80, "Variable key must be 80 characters or less.")
    .regex(
      /^[a-zA-Z][a-zA-Z0-9]*$/,
      "Variable keys must start with a letter and use letters or numbers only.",
    ),
  label: z
    .string()
    .trim()
    .min(2, "Label is required.")
    .max(160, "Label must be 160 characters or less."),
  value: z
    .string()
    .trim()
    .min(1, "Value is required.")
    .max(5000, "Value must be 5,000 characters or less."),
});

export async function saveNotificationGlobalVariableSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  const session = await requireSettingsManageAccess();

  const parsed = notificationGlobalVariableSchema.safeParse({
    description: String(formData.get("description") ?? ""),
    id: String(formData.get("id") ?? ""),
    key: String(formData.get("key") ?? ""),
    label: String(formData.get("label") ?? ""),
    value: String(formData.get("value") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the global variable.",
    };
  }

  const result = await upsertNotificationGlobalVariable({
    actorUserId: session.user.id,
    ...parsed.data,
  });

  revalidatePath("/settings/platform");

  return result;
}

const deleteNotificationGlobalVariableSchema = z.object({
  id: z.string().trim().uuid(),
});

export async function deleteNotificationGlobalVariableSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireSettingsManageAccess();

  const parsed = deleteNotificationGlobalVariableSchema.safeParse({
    id: String(formData.get("id") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Choose a global variable.",
    };
  }

  const result = await deleteNotificationGlobalVariable(parsed.data);

  revalidatePath("/settings/platform");

  return result;
}
