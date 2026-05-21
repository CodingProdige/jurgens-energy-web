import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  notificationDeliveries,
  notificationGlobalVariables,
  notificationTemplates,
  notificationTemplateVersions,
  type NotificationDeliveryStatus,
  type NotificationTemplateStatus,
} from "@/src/db/schema";
import { sendEmail } from "@/src/modules/email/sendgrid";

export type AdminNotificationTemplate = {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
  status: NotificationTemplateStatus;
  subject: string;
  previewText: string | null;
  htmlBody: string;
  textBody: string;
  requiredVariables: string[];
  version: number;
  versions: AdminNotificationTemplateVersion[];
  updatedAt: Date;
};

export type AdminNotificationTemplateVersion = {
  id: string;
  version: number;
  subject: string;
  previewText: string | null;
  requiredVariables: string[];
  createdAt: Date;
};

export type AdminNotificationDelivery = {
  id: string;
  templateKey: string;
  recipientEmail: string;
  subject: string;
  status: NotificationDeliveryStatus;
  errorMessage: string | null;
  openCount: number;
  openedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
};

export type AdminNotificationGlobalVariable = {
  id: string | null;
  key: string;
  label: string;
  value: string;
  description: string | null;
  source: "system" | "custom";
  updatedAt: Date | null;
};

export async function getAdminNotificationSettings() {
  const [templates, versions, deliveries, globalVariables] = await Promise.all([
    db
      .select()
      .from(notificationTemplates)
      .orderBy(notificationTemplates.category, notificationTemplates.name),
    db
      .select()
      .from(notificationTemplateVersions)
      .orderBy(desc(notificationTemplateVersions.createdAt)),
    db
      .select()
      .from(notificationDeliveries)
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(90),
    getNotificationGlobalVariables(),
  ]);

  return {
    deliveries: deliveries.map((delivery) => ({
      id: delivery.id,
      templateKey: delivery.templateKey,
      recipientEmail: delivery.recipientEmail,
      subject: delivery.subject,
      status: delivery.status,
      errorMessage: delivery.errorMessage,
      openCount: delivery.openCount,
      openedAt: delivery.openedAt,
      sentAt: delivery.sentAt,
      createdAt: delivery.createdAt,
    })),
    templates: templates.map((template) => ({
      id: template.id,
      key: template.key,
      name: template.name,
      category: template.category,
      description: template.description,
      status: template.status,
      subject: template.subject,
      previewText: template.previewText,
      htmlBody: template.htmlBody,
      textBody: template.textBody,
      requiredVariables: parseRequiredVariables(template.requiredVariables),
      version: template.version,
      versions: versions
        .filter((version) => version.templateId === template.id)
        .map((version) => ({
          id: version.id,
          previewText: version.previewText,
          requiredVariables: parseRequiredVariables(version.requiredVariables),
          subject: version.subject,
          version: version.version,
          createdAt: version.createdAt,
        })),
      updatedAt: template.updatedAt,
    })),
    globalVariables,
  };
}

export async function upsertNotificationGlobalVariable({
  actorUserId,
  description,
  id,
  key,
  label,
  value,
}: {
  actorUserId: string;
  description?: string;
  id?: string;
  key: string;
  label: string;
  value: string;
}) {
  if (getSystemNotificationGlobalVariableKeys().has(key)) {
    return {
      ok: false,
      message: "That key is reserved for a system global variable.",
    };
  }

  const now = new Date();

  if (id) {
    const [current] = await db
      .select()
      .from(notificationGlobalVariables)
      .where(eq(notificationGlobalVariables.id, id))
      .limit(1);

    if (!current) {
      return {
        ok: false,
        message: "Global variable could not be found.",
      };
    }

    const [duplicate] = await db
      .select()
      .from(notificationGlobalVariables)
      .where(eq(notificationGlobalVariables.key, key))
      .limit(1);

    if (duplicate && duplicate.id !== id) {
      return {
        ok: false,
        message: "A global variable already uses that key.",
      };
    }

    await db
      .update(notificationGlobalVariables)
      .set({
        description: description || null,
        key,
        label,
        updatedAt: now,
        updatedByUserId: actorUserId,
        value,
      })
      .where(eq(notificationGlobalVariables.id, id));

    return { ok: true, message: "Global variable saved." };
  }

  const [existing] = await db
    .select()
    .from(notificationGlobalVariables)
    .where(eq(notificationGlobalVariables.key, key))
    .limit(1);

  if (existing) {
    return {
      ok: false,
      message: "A global variable already uses that key.",
    };
  }

  await db.insert(notificationGlobalVariables).values({
    createdByUserId: actorUserId,
    description: description || null,
    key,
    label,
    updatedByUserId: actorUserId,
    value,
  });

  return { ok: true, message: "Global variable created." };
}

export async function deleteNotificationGlobalVariable({
  id,
}: {
  id: string;
}) {
  await db
    .delete(notificationGlobalVariables)
    .where(eq(notificationGlobalVariables.id, id));

  return { ok: true, message: "Global variable deleted." };
}

export async function updateNotificationTemplate({
  actorUserId,
  htmlBody,
  id,
  previewText,
  requiredVariables,
  status,
  subject,
  textBody,
}: {
  actorUserId: string;
  htmlBody: string;
  id: string;
  previewText?: string;
  requiredVariables: string[];
  status: NotificationTemplateStatus;
  subject: string;
  textBody: string;
}) {
  const [current] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.id, id))
    .limit(1);

  if (!current) {
    return {
      ok: false,
      message: "Notification template could not be found.",
    };
  }

  const nextVersion = current.version + 1;
  const now = new Date();
  const requiredVariablesValue = JSON.stringify(requiredVariables);

  await db.transaction(async (tx) => {
    await tx.insert(notificationTemplateVersions).values({
      createdByUserId: actorUserId,
      htmlBody: current.htmlBody,
      previewText: current.previewText,
      requiredVariables: current.requiredVariables,
      subject: current.subject,
      templateId: current.id,
      textBody: current.textBody,
      version: current.version,
    });

    await tx
      .update(notificationTemplates)
      .set({
        htmlBody,
        previewText: previewText || null,
        requiredVariables: requiredVariablesValue,
        status,
        subject,
        textBody,
        updatedAt: now,
        version: nextVersion,
      })
      .where(eq(notificationTemplates.id, id));
  });

  return {
    ok: true,
    message: "Notification template saved.",
  };
}

export async function restoreNotificationTemplateVersion({
  actorUserId,
  templateId,
  versionId,
}: {
  actorUserId: string;
  templateId: string;
  versionId: string;
}) {
  const [current] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.id, templateId))
    .limit(1);

  if (!current) {
    return {
      ok: false,
      message: "Notification template could not be found.",
    };
  }

  const [restoreVersion] = await db
    .select()
    .from(notificationTemplateVersions)
    .where(eq(notificationTemplateVersions.id, versionId))
    .limit(1);

  if (!restoreVersion || restoreVersion.templateId !== templateId) {
    return {
      ok: false,
      message: "Template version could not be found.",
    };
  }

  const nextVersion = current.version + 1;
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(notificationTemplateVersions).values({
      createdByUserId: actorUserId,
      htmlBody: current.htmlBody,
      previewText: current.previewText,
      requiredVariables: current.requiredVariables,
      subject: current.subject,
      templateId: current.id,
      textBody: current.textBody,
      version: current.version,
    });

    await tx
      .update(notificationTemplates)
      .set({
        htmlBody: restoreVersion.htmlBody,
        previewText: restoreVersion.previewText,
        requiredVariables: restoreVersion.requiredVariables,
        subject: restoreVersion.subject,
        textBody: restoreVersion.textBody,
        updatedAt: now,
        version: nextVersion,
      })
      .where(eq(notificationTemplates.id, templateId));
  });

  return {
    ok: true,
    message: `Restored version ${restoreVersion.version}.`,
  };
}

export async function sendNotificationEmail({
  data,
  recipientEmail,
  recipientUserId,
  templateKey,
}: {
  data: Record<string, string | number | boolean | null | undefined>;
  recipientEmail: string;
  recipientUserId?: string;
  templateKey: string;
}) {
  const normalizedEmail = recipientEmail.trim().toLowerCase();
  const [template] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.key, templateKey))
    .limit(1);

  if (!template || template.status !== "active") {
    await db.insert(notificationDeliveries).values({
      errorMessage: !template
        ? "Notification template not found."
        : "Notification template is disabled.",
      recipientEmail: normalizedEmail,
      recipientUserId,
      status: "skipped",
      subject: template?.subject ?? templateKey,
      templateKey,
    });

    return { delivered: false, reason: "template_unavailable" } as const;
  }

  const globalData = await getNotificationGlobalVariableData();
  const renderData = { ...globalData, ...data };
  const subject = renderTemplate(template.subject, renderData);
  const htmlBody = renderTemplate(template.htmlBody, renderData);
  const textBody = renderTemplate(template.textBody, renderData);

  const [delivery] = await db
    .insert(notificationDeliveries)
    .values({
      metadata: JSON.stringify({ data: renderData }),
      recipientEmail: normalizedEmail,
      recipientUserId,
      status: "queued",
      subject,
      templateKey,
    })
    .returning({ id: notificationDeliveries.id });

  const result = await sendEmail({
    content: [
      { type: "text/plain", value: textBody },
      { type: "text/html", value: htmlBody },
    ],
    personalizations: [
      {
        custom_args: {
          piessang_delivery_id: delivery.id,
          piessang_template_key: templateKey,
        },
        subject,
        to: [{ email: normalizedEmail }],
      },
    ],
  });

  if (result.delivered) {
    await db
      .update(notificationDeliveries)
      .set({
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
        status: "sent",
      })
      .where(eq(notificationDeliveries.id, delivery.id));

    return { delivered: true } as const;
  }

  await db
    .update(notificationDeliveries)
    .set({
      errorMessage: result.reason,
      status: "failed",
    })
    .where(eq(notificationDeliveries.id, delivery.id));

  return { delivered: false, reason: result.reason } as const;
}

export async function sendNotificationTemplateTest({
  actorUserId,
  htmlBody,
  previewText,
  recipientEmail,
  requiredVariables,
  subject,
  templateKey,
  textBody,
}: {
  actorUserId: string;
  htmlBody: string;
  previewText?: string;
  recipientEmail: string;
  requiredVariables: string[];
  subject: string;
  templateKey: string;
  textBody: string;
}) {
  const normalizedEmail = recipientEmail.trim().toLowerCase();
  const globalData = await getNotificationGlobalVariableData();
  const data = Object.fromEntries(
    requiredVariables.map((variable) => [
      variable,
      globalData[variable] ?? sampleVariableValue(variable),
    ]),
  );
  const renderData = { ...globalData, ...data };
  const renderedSubject = `[Test] ${renderTemplate(subject, renderData)}`;
  const renderedHtmlBody = renderTemplate(htmlBody, renderData);
  const renderedTextBody = renderTemplate(textBody, renderData);

  const [delivery] = await db
    .insert(notificationDeliveries)
    .values({
      metadata: JSON.stringify({
        data: renderData,
        previewText,
        test: true,
      }),
      recipientEmail: normalizedEmail,
      recipientUserId: actorUserId,
      status: "queued",
      subject: renderedSubject,
      templateKey,
    })
    .returning({ id: notificationDeliveries.id });

  const result = await sendEmail({
    content: [
      { type: "text/plain", value: renderedTextBody },
      { type: "text/html", value: renderedHtmlBody },
    ],
    personalizations: [
      {
        custom_args: {
          piessang_delivery_id: delivery.id,
          piessang_template_key: templateKey,
        },
        subject: renderedSubject,
        to: [{ email: normalizedEmail }],
      },
    ],
  });

  if (result.delivered) {
    await db
      .update(notificationDeliveries)
      .set({
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
        status: "sent",
      })
      .where(eq(notificationDeliveries.id, delivery.id));

    return { ok: true, message: `Test email sent to ${normalizedEmail}.` };
  }

  await db
    .update(notificationDeliveries)
    .set({
      errorMessage: result.reason,
      status: "failed",
    })
    .where(eq(notificationDeliveries.id, delivery.id));

  return {
    ok: false,
    message:
      result.reason === "not_configured"
        ? "SendGrid is not configured yet."
        : "The test email could not be sent.",
  };
}

function parseRequiredVariables(value: string) {
  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }

  return [];
}

async function getNotificationGlobalVariables() {
  const customVariables = await db
    .select()
    .from(notificationGlobalVariables)
    .orderBy(notificationGlobalVariables.key);

  return [
    ...getSystemNotificationGlobalVariables(),
    ...customVariables.map(
      (variable): AdminNotificationGlobalVariable => ({
        description: variable.description,
        id: variable.id,
        key: variable.key,
        label: variable.label,
        source: "custom",
        updatedAt: variable.updatedAt,
        value: variable.value,
      }),
    ),
  ];
}

async function getNotificationGlobalVariableData() {
  const variables = await getNotificationGlobalVariables();

  return Object.fromEntries(
    variables.map((variable) => [variable.key, variable.value]),
  );
}

function getSystemNotificationGlobalVariables(): AdminNotificationGlobalVariable[] {
  return [
    {
      description: "Public marketplace base URL from APP_URL or AUTH_URL.",
      id: null,
      key: "marketplaceUrl",
      label: "Marketplace URL",
      source: "system",
      updatedAt: null,
      value: buildMarketplaceUrl(),
    },
    {
      description:
        "Seller dashboard base URL from SELLER_HOSTNAME and APP_URL or AUTH_URL.",
      id: null,
      key: "sellerDashboardUrl",
      label: "Seller dashboard URL",
      source: "system",
      updatedAt: null,
      value: buildSurfaceUrl("seller"),
    },
    {
      description:
        "Admin dashboard base URL from ADMIN_HOSTNAME and APP_URL or AUTH_URL.",
      id: null,
      key: "adminDashboardUrl",
      label: "Admin dashboard URL",
      source: "system",
      updatedAt: null,
      value: buildSurfaceUrl("admin"),
    },
  ];
}

function getSystemNotificationGlobalVariableKeys() {
  return new Set(
    getSystemNotificationGlobalVariables().map((variable) => variable.key),
  );
}

function renderTemplate(
  template: string,
  data: Record<string, string | number | boolean | null | undefined>,
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const value = data[key];

    return value == null ? "" : String(value);
  });
}

function sampleVariableValue(variable: string) {
  const normalized = variable.toLowerCase();

  if (normalized.includes("sellerdashboard")) {
    return buildSurfaceUrl("seller");
  }

  if (normalized.includes("admindashboard")) {
    return buildSurfaceUrl("admin");
  }

  if (normalized.includes("email")) {
    return "customer@example.com";
  }

  if (normalized.includes("store")) {
    return "Example Store";
  }

  if (normalized.includes("seller")) {
    return "Example Seller";
  }

  if (normalized.includes("reason")) {
    return "Additional verification is required.";
  }

  if (normalized.includes("name")) {
    return "Dillon";
  }

  if (normalized.includes("url") || normalized.includes("link")) {
    return "https://piessang.com";
  }

  return `Example ${variable}`;
}

function buildSurfaceUrl(surface: "admin" | "seller") {
  const appUrl = new URL(process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000");
  const isLocalhost =
    appUrl.hostname === "localhost" || appUrl.hostname.endsWith(".localhost");
  const hostname =
    surface === "admin"
      ? process.env.ADMIN_HOSTNAME ?? (isLocalhost ? "admin.localhost" : `admin.${appUrl.hostname}`)
      : process.env.SELLER_HOSTNAME ?? (isLocalhost ? "seller.localhost" : `seller.${appUrl.hostname}`);

  return `${appUrl.protocol}//${hostname}${appUrl.port ? `:${appUrl.port}` : ""}`;
}

function buildMarketplaceUrl() {
  const appUrl = new URL(
    process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000",
  );

  return `${appUrl.protocol}//${appUrl.host}`;
}
