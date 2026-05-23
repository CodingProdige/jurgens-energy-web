"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAccess } from "@/src/modules/auth/permissions";
import {
  updateMarketplaceComingSoonSettings,
  updateMarketplaceMediaSettings,
  updateMarketplaceSocialLinks,
  updateMarketplaceStripeSettings,
} from "@/src/modules/marketplace/settings";
import { savePremiumPlan } from "@/src/modules/billing/premium-plans";
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

export async function updateMarketplaceGateSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireAdminAccess();

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
  revalidatePath("/settings");

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

const socialLinksSchema = z.object({
  facebookUrl: optionalUrlSchema,
  instagramUrl: optionalUrlSchema,
  twitterUrl: optionalUrlSchema,
});

export async function updateMarketplaceSocialLinkSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireAdminAccess();

  const parsed = socialLinksSchema.safeParse({
    facebookUrl: String(formData.get("facebookUrl") ?? ""),
    instagramUrl: String(formData.get("instagramUrl") ?? ""),
    twitterUrl: String(formData.get("twitterUrl") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the social links.",
    };
  }

  const result = await updateMarketplaceSocialLinks(parsed.data);

  revalidatePath("/");
  revalidatePath("/settings");

  return result;
}

const mediaSettingsSchema = z.object({
  freeStorageQuotaMb: z.coerce.number().int().min(50).max(102400),
  imageCompressionQuality: z.coerce.number().int().min(40).max(92),
  maxImageWidth: z.coerce.number().int().min(800).max(5000),
  maxUploadFileMb: z.coerce.number().int().min(1).max(100),
  maxVideoUploadFileMb: z.coerce.number().int().min(10).max(2048),
  maxVideoWidth: z.coerce.number().int().min(480).max(3840),
  premiumStorageQuotaMb: z.coerce.number().int().min(100).max(512000),
  videoCompressionCrf: z.coerce.number().int().min(18).max(35),
});

export async function updateMediaStorageSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireAdminAccess();

  const parsed = mediaSettingsSchema.safeParse({
    freeStorageQuotaMb: formData.get("freeStorageQuotaMb"),
    imageCompressionQuality: formData.get("imageCompressionQuality"),
    maxImageWidth: formData.get("maxImageWidth"),
    maxUploadFileMb: formData.get("maxUploadFileMb"),
    maxVideoUploadFileMb: formData.get("maxVideoUploadFileMb"),
    maxVideoWidth: formData.get("maxVideoWidth"),
    premiumStorageQuotaMb: formData.get("premiumStorageQuotaMb"),
    videoCompressionCrf: formData.get("videoCompressionCrf"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the media settings.",
    };
  }

  if (parsed.data.premiumStorageQuotaMb < parsed.data.freeStorageQuotaMb) {
    return {
      ok: false,
      message: "Premium storage must be greater than free storage.",
    };
  }

  const result = await updateMarketplaceMediaSettings(parsed.data);

  revalidatePath("/settings");

  return result;
}

const stripeSettingsSchema = z.object({
  livePublishableKey: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || value.startsWith("pk_live_"),
      "Live publishable key must start with pk_live_.",
    ),
  liveSecretKey: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || value.startsWith("sk_live_"),
      "Live secret key must start with sk_live_.",
    ),
  liveWebhookSecret: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || value.startsWith("whsec_"),
      "Live webhook secret must start with whsec_.",
    ),
  mode: z.enum(["live", "sandbox"]),
  sandboxPublishableKey: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || value.startsWith("pk_test_"),
      "Sandbox publishable key must start with pk_test_.",
    ),
  sandboxSecretKey: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || value.startsWith("sk_test_"),
      "Sandbox secret key must start with sk_test_.",
    ),
  sandboxWebhookSecret: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || value.startsWith("whsec_"),
      "Sandbox webhook secret must start with whsec_.",
    ),
});

export async function updateStripePaymentSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireAdminAccess();

  const parsed = stripeSettingsSchema.safeParse({
    livePublishableKey: String(formData.get("livePublishableKey") ?? ""),
    liveSecretKey: String(formData.get("liveSecretKey") ?? ""),
    liveWebhookSecret: String(formData.get("liveWebhookSecret") ?? ""),
    mode: String(formData.get("mode") ?? "sandbox"),
    sandboxPublishableKey: String(formData.get("sandboxPublishableKey") ?? ""),
    sandboxSecretKey: String(formData.get("sandboxSecretKey") ?? ""),
    sandboxWebhookSecret: String(formData.get("sandboxWebhookSecret") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the Stripe settings.",
    };
  }

  const result = await updateMarketplaceStripeSettings(parsed.data);

  revalidatePath("/settings");

  return result;
}

const premiumPlanSchema = z.object({
  billingInterval: z.enum(["month", "year"]),
  code: z
    .string()
    .trim()
    .min(3, "Use a short stable plan code.")
    .max(80)
    .regex(
      /^[a-z0-9-]+$/,
      "Plan code can only use lowercase letters, numbers, and hyphens.",
    ),
  currency: z
    .string()
    .trim()
    .length(3, "Use a three-letter currency code.")
    .transform((value) => value.toUpperCase()),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less.")
    .optional()
    .transform((value) => value || undefined),
  featureBullets: z
    .string()
    .trim()
    .min(1, "Add at least one feature bullet.")
    .max(1000, "Feature bullets are too long.")
    .transform((value) =>
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 8),
    ),
  id: z
    .string()
    .trim()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(2, "Plan name is required.").max(160),
  priceCents: z.coerce.number().int().min(0).max(100000000),
  scope: z.enum(["user", "seller"]),
  sortOrder: z.coerce.number().int().min(0).max(10000),
  status: z.enum(["active", "hidden", "archived"]),
  storageQuotaMb: z.coerce.number().int().min(100).max(512000),
});

export async function savePremiumPlanSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireAdminAccess();

  const parsed = premiumPlanSchema.safeParse({
    billingInterval: String(formData.get("billingInterval") ?? "month"),
    code: String(formData.get("code") ?? ""),
    currency: String(formData.get("currency") ?? "USD"),
    description: String(formData.get("description") ?? ""),
    featureBullets: String(formData.get("featureBullets") ?? ""),
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? ""),
    priceCents: formData.get("priceCents"),
    scope: String(formData.get("scope") ?? "user"),
    sortOrder: formData.get("sortOrder"),
    status: String(formData.get("status") ?? "active"),
    storageQuotaMb: formData.get("storageQuotaMb"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the premium plan.",
    };
  }

  const result = await savePremiumPlan({
    ...parsed.data,
    isDefault: formData.get("isDefault") === "on",
    isHighlighted: formData.get("isHighlighted") === "on",
  });

  revalidatePath("/settings");

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
  const session = await requireAdminAccess();

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

  revalidatePath("/settings");

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
  const session = await requireAdminAccess();

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

  revalidatePath("/settings");

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
  const session = await requireAdminAccess();

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

  revalidatePath("/settings");

  return result;
}

export async function restoreInAppNotificationTemplateSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  const session = await requireAdminAccess();

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

  revalidatePath("/settings");

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
  const session = await requireAdminAccess();

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

  revalidatePath("/settings");

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
  const session = await requireAdminAccess();

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

  revalidatePath("/settings");

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
  const session = await requireAdminAccess();

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

  revalidatePath("/settings");

  return result;
}

const deleteNotificationGlobalVariableSchema = z.object({
  id: z.string().trim().uuid(),
});

export async function deleteNotificationGlobalVariableSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireAdminAccess();

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

  revalidatePath("/settings");

  return result;
}
