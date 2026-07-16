import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inAppNotifications,
  inAppNotificationTemplates,
  inAppNotificationTemplateVersions,
  type InAppNotificationSurface,
  notificationDeliveries,
  notificationDeliveryPolicies,
  notificationGlobalVariables,
  notificationTemplates,
  notificationTemplateVersions,
  type NotificationDeliveryStatus,
  type NotificationPriorityLevel,
  type NotificationTemplateStatus,
  users,
} from "@/src/db/schema";
import {
  sendEmail,
  type SendEmailAttachment,
} from "@/src/modules/email/sendgrid";
import { sendPushNotificationToUser } from "@/src/modules/notifications/push";

export type AdminNotificationDeliveryPolicy = {
  digestEligible: boolean;
  emailEnabled: boolean;
  eventKey: string;
  inAppEnabled: boolean;
  priority: NotificationPriorityLevel;
  pushEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursEnd: string | null;
  quietHoursStart: string | null;
};

type NotificationEmailChannelResult =
  | Awaited<ReturnType<typeof sendNotificationEmail>>
  | {
      delivered: false;
      reason: "missing_recipient_email";
    };

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
  deliveryPolicy: AdminNotificationDeliveryPolicy;
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
  usageCount: number;
  updatedAt: Date | null;
};

export type AdminInAppNotificationTemplate = {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
  surface: InAppNotificationSurface;
  type: string;
  status: NotificationTemplateStatus;
  titleTemplate: string;
  bodyTemplate: string;
  actionLabelTemplate: string | null;
  actionUrlTemplate: string | null;
  requiredVariables: string[];
  deliveryPolicy: AdminNotificationDeliveryPolicy;
  version: number;
  versions: AdminInAppNotificationTemplateVersion[];
  updatedAt: Date;
};

export type AdminInAppNotificationTemplateVersion = {
  id: string;
  version: number;
  titleTemplate: string;
  requiredVariables: string[];
  createdAt: Date;
};

export async function getAdminNotificationSettings() {
  const [
    templates,
    versions,
    inAppTemplates,
    inAppVersions,
    deliveries,
    deliveryPolicies,
    globalVariables,
  ] = await Promise.all([
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
      .from(inAppNotificationTemplates)
      .orderBy(
        inAppNotificationTemplates.surface,
        inAppNotificationTemplates.category,
        inAppNotificationTemplates.name,
      ),
    db
      .select()
      .from(inAppNotificationTemplateVersions)
      .orderBy(desc(inAppNotificationTemplateVersions.createdAt)),
    db
      .select()
      .from(notificationDeliveries)
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(90),
    db.select().from(notificationDeliveryPolicies),
    getNotificationGlobalVariables(),
  ]);
  const policyMap = new Map(
    deliveryPolicies.map((policy) => [
      policy.eventKey,
      toAdminDeliveryPolicy(policy),
    ]),
  );
  const emailTemplateKeys = new Set(templates.map((template) => template.key));
  const inAppTemplateKeys = new Set(
    inAppTemplates.map((template) => template.key),
  );

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
      deliveryPolicy:
        policyMap.get(template.key) ??
        createDefaultDeliveryPolicy(template.key, {
          emailEnabled: true,
          inAppEnabled: inAppTemplateKeys.has(template.key),
        }),
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
    inAppTemplates: inAppTemplates.map((template) => ({
      id: template.id,
      key: template.key,
      name: template.name,
      category: template.category,
      description: template.description,
      surface: template.surface,
      type: template.type,
      status: template.status,
      titleTemplate: template.titleTemplate,
      bodyTemplate: template.bodyTemplate,
      actionLabelTemplate: template.actionLabelTemplate,
      actionUrlTemplate: template.actionUrlTemplate,
      requiredVariables: parseRequiredVariables(template.requiredVariables),
      deliveryPolicy:
        policyMap.get(template.key) ??
        createDefaultDeliveryPolicy(template.key, {
          emailEnabled: emailTemplateKeys.has(template.key),
          inAppEnabled: true,
        }),
      version: template.version,
      versions: inAppVersions
        .filter((version) => version.templateId === template.id)
        .map((version) => ({
          id: version.id,
          requiredVariables: parseRequiredVariables(version.requiredVariables),
          titleTemplate: version.titleTemplate,
          version: version.version,
          createdAt: version.createdAt,
        })),
      updatedAt: template.updatedAt,
    })),
    globalVariables: globalVariables.map((variable) => ({
      ...variable,
      usageCount: countNotificationGlobalVariableUsage(
        variable.key,
        templates,
        inAppTemplates,
      ),
    })),
  };
}

export async function updateInAppNotificationTemplate({
  actionLabelTemplate,
  actionUrlTemplate,
  actorUserId,
  bodyTemplate,
  id,
  requiredVariables,
  status,
  titleTemplate,
}: {
  actionLabelTemplate?: string;
  actionUrlTemplate?: string;
  actorUserId: string;
  bodyTemplate: string;
  id: string;
  requiredVariables: string[];
  status: NotificationTemplateStatus;
  titleTemplate: string;
}) {
  const [current] = await db
    .select()
    .from(inAppNotificationTemplates)
    .where(eq(inAppNotificationTemplates.id, id))
    .limit(1);

  if (!current) {
    return {
      ok: false,
      message: "In-app notification template could not be found.",
    };
  }

  const nextVersion = current.version + 1;
  const now = new Date();
  const requiredVariablesValue = JSON.stringify(requiredVariables);

  await db.transaction(async (tx) => {
    await tx.insert(inAppNotificationTemplateVersions).values({
      actionLabelTemplate: current.actionLabelTemplate,
      actionUrlTemplate: current.actionUrlTemplate,
      bodyTemplate: current.bodyTemplate,
      createdByUserId: actorUserId,
      requiredVariables: current.requiredVariables,
      templateId: current.id,
      titleTemplate: current.titleTemplate,
      version: current.version,
    });

    await tx
      .update(inAppNotificationTemplates)
      .set({
        actionLabelTemplate: actionLabelTemplate || null,
        actionUrlTemplate: actionUrlTemplate || null,
        bodyTemplate,
        requiredVariables: requiredVariablesValue,
        status,
        titleTemplate,
        updatedAt: now,
        version: nextVersion,
      })
      .where(eq(inAppNotificationTemplates.id, id));
  });

  return {
    ok: true,
    message: "In-app notification template saved.",
  };
}

export async function restoreInAppNotificationTemplateVersion({
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
    .from(inAppNotificationTemplates)
    .where(eq(inAppNotificationTemplates.id, templateId))
    .limit(1);

  if (!current) {
    return {
      ok: false,
      message: "In-app notification template could not be found.",
    };
  }

  const [restoreVersion] = await db
    .select()
    .from(inAppNotificationTemplateVersions)
    .where(eq(inAppNotificationTemplateVersions.id, versionId))
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
    await tx.insert(inAppNotificationTemplateVersions).values({
      actionLabelTemplate: current.actionLabelTemplate,
      actionUrlTemplate: current.actionUrlTemplate,
      bodyTemplate: current.bodyTemplate,
      createdByUserId: actorUserId,
      requiredVariables: current.requiredVariables,
      templateId: current.id,
      titleTemplate: current.titleTemplate,
      version: current.version,
    });

    await tx
      .update(inAppNotificationTemplates)
      .set({
        actionLabelTemplate: restoreVersion.actionLabelTemplate,
        actionUrlTemplate: restoreVersion.actionUrlTemplate,
        bodyTemplate: restoreVersion.bodyTemplate,
        requiredVariables: restoreVersion.requiredVariables,
        titleTemplate: restoreVersion.titleTemplate,
        updatedAt: now,
        version: nextVersion,
      })
      .where(eq(inAppNotificationTemplates.id, templateId));
  });

  return {
    ok: true,
    message: `Restored version ${restoreVersion.version}.`,
  };
}

export async function updateNotificationDeliveryPolicy(
  input: AdminNotificationDeliveryPolicy,
) {
  const now = new Date();
  const values = {
    digestEligible: input.digestEligible,
    emailEnabled: input.emailEnabled,
    eventKey: input.eventKey,
    inAppEnabled: input.inAppEnabled,
    priority: input.priority,
    pushEnabled: input.pushEnabled,
    quietHoursEnabled: input.quietHoursEnabled,
    quietHoursEnd: input.quietHoursEnabled ? input.quietHoursEnd : null,
    quietHoursStart: input.quietHoursEnabled ? input.quietHoursStart : null,
    updatedAt: now,
  };
  const [existing] = await db
    .select({ id: notificationDeliveryPolicies.id })
    .from(notificationDeliveryPolicies)
    .where(eq(notificationDeliveryPolicies.eventKey, input.eventKey))
    .limit(1);

  if (existing) {
    await db
      .update(notificationDeliveryPolicies)
      .set(values)
      .where(eq(notificationDeliveryPolicies.id, existing.id));
  } else {
    await db.insert(notificationDeliveryPolicies).values({
      ...values,
      createdAt: now,
    });
  }

  return { ok: true, message: "Delivery policy saved." };
}

export async function createInAppNotification({
  data,
  recipientUserId,
  templateKey,
}: {
  data: Record<string, string | number | boolean | null | undefined>;
  recipientUserId: string;
  templateKey: string;
}) {
  const [template] = await db
    .select()
    .from(inAppNotificationTemplates)
    .where(eq(inAppNotificationTemplates.key, templateKey))
    .limit(1);

  if (!template || template.status !== "active") {
    return { created: false, reason: "template_unavailable" } as const;
  }

  const globalData = await getNotificationGlobalVariableData();
  const renderData = { ...globalData, ...data };
  const [notification] = await db
    .insert(inAppNotifications)
    .values({
      actionLabel: template.actionLabelTemplate
        ? renderTemplate(template.actionLabelTemplate, renderData)
        : null,
      actionUrl: template.actionUrlTemplate
        ? renderTemplate(template.actionUrlTemplate, renderData)
        : null,
      body: renderTemplate(template.bodyTemplate, renderData),
      metadata: JSON.stringify({ data: renderData }),
      recipientUserId,
      surface: template.surface,
      templateKey,
      title: renderTemplate(template.titleTemplate, renderData),
      type: template.type,
    })
    .returning({ id: inAppNotifications.id });

  return { created: true, id: notification.id } as const;
}

export async function notify({
  data,
  event,
  recipientEmail,
  recipientUserId,
}: {
  data?: Record<string, string | number | boolean | null | undefined>;
  event: string;
  recipientEmail?: string | null;
  recipientUserId: string;
}) {
  const policy = await getNotificationDeliveryPolicy(event);
  const payload = data ?? {};
  const result: {
    email?: NotificationEmailChannelResult | null;
    inApp?: Awaited<ReturnType<typeof createInAppNotification>> | null;
    policy: AdminNotificationDeliveryPolicy;
    push?: Awaited<ReturnType<typeof preparePushNotification>> | null;
  } = {
    policy,
  };

  if (policy.inAppEnabled) {
    result.inApp = await createInAppNotification({
      data: payload,
      recipientUserId,
      templateKey: event,
    });
  }

  if (policy.emailEnabled) {
    const normalizedEmail =
      recipientEmail?.trim().toLowerCase() ??
      (await getUserEmail(recipientUserId));

    if (normalizedEmail) {
      result.email = await sendNotificationEmail({
        data: payload,
        recipientEmail: normalizedEmail,
        recipientUserId,
        templateKey: event,
      });
    } else {
      result.email = {
        delivered: false,
        reason: "missing_recipient_email",
      } as const;
    }
  }

  if (policy.pushEnabled) {
    result.push = await preparePushNotification({
      data: payload,
      event,
      recipientUserId,
    });
  }

  return result;
}

export async function createInAppNotificationTemplateTest({
  actionLabelTemplate,
  actionUrlTemplate,
  bodyTemplate,
  recipientUserId,
  requiredVariables,
  templateKey,
  titleTemplate,
}: {
  actionLabelTemplate?: string;
  actionUrlTemplate?: string;
  bodyTemplate: string;
  recipientUserId: string;
  requiredVariables: string[];
  templateKey: string;
  titleTemplate: string;
}) {
  const globalData = await getNotificationGlobalVariableData();
  const data = Object.fromEntries(
    requiredVariables.map((variable) => [
      variable,
      globalData[variable] ?? sampleVariableValue(variable),
    ]),
  );
  const renderData = { ...globalData, ...data };
  const policy = await getNotificationDeliveryPolicy(templateKey);

  await db.insert(inAppNotifications).values({
    actionLabel: actionLabelTemplate
      ? renderTemplate(actionLabelTemplate, renderData)
      : null,
    actionUrl: actionUrlTemplate
      ? renderTemplate(actionUrlTemplate, renderData)
      : null,
    body: renderTemplate(bodyTemplate, renderData),
    metadata: JSON.stringify({ data: renderData, test: true }),
    recipientUserId,
    surface: "admin",
    templateKey,
    title: `[Test] ${renderTemplate(titleTemplate, renderData)}`,
    type: "test",
  });

  const pushResult = policy.pushEnabled
    ? await sendPushNotificationToUser({
        payload: {
          body: renderTemplate(bodyTemplate, renderData),
          icon: "/brand/favicon-for-app/web-app-manifest-192x192.png",
          tag: `test:${templateKey}`,
          title: `[Test] ${renderTemplate(titleTemplate, renderData)}`,
          url: actionUrlTemplate
            ? renderTemplate(actionUrlTemplate, renderData)
            : "/settings?section=notifications",
        },
        userId: recipientUserId,
      })
    : null;

  const pushMessage = !policy.pushEnabled
    ? " Browser push was not sent because Push is disabled for this template."
    : pushResult?.delivered
      ? " Browser push was sent to your subscribed device."
      : pushResult?.reason === "no_push_subscriptions"
        ? " Browser push was not sent because this account has no active browser subscription."
        : pushResult?.reason === "push_transport_not_configured"
          ? " Browser push was not sent because VAPID settings are not configured."
          : " Browser push could not be delivered.";

  return {
    ok: true,
    message: `Test in-app notification created for your admin account.${pushMessage}`,
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

    await db.transaction(async (tx) => {
      if (current.key !== key) {
        const emailTemplates = await tx.select().from(notificationTemplates);
        const inAppTemplates = await tx.select().from(inAppNotificationTemplates);

        for (const template of emailTemplates) {
          const nextTemplate = replaceEmailTemplateGlobalKey(
            template,
            current.key,
            key,
          );

          if (!nextTemplate.changed) {
            continue;
          }

          await tx.insert(notificationTemplateVersions).values({
            createdByUserId: actorUserId,
            htmlBody: template.htmlBody,
            previewText: template.previewText,
            requiredVariables: template.requiredVariables,
            subject: template.subject,
            templateId: template.id,
            textBody: template.textBody,
            version: template.version,
          });

          await tx
            .update(notificationTemplates)
            .set({
              htmlBody: nextTemplate.htmlBody,
              previewText: nextTemplate.previewText,
              requiredVariables: nextTemplate.requiredVariables,
              subject: nextTemplate.subject,
              textBody: nextTemplate.textBody,
              updatedAt: now,
              version: template.version + 1,
            })
            .where(eq(notificationTemplates.id, template.id));
        }

        for (const template of inAppTemplates) {
          const nextTemplate = replaceInAppTemplateGlobalKey(
            template,
            current.key,
            key,
          );

          if (!nextTemplate.changed) {
            continue;
          }

          await tx.insert(inAppNotificationTemplateVersions).values({
            actionLabelTemplate: template.actionLabelTemplate,
            actionUrlTemplate: template.actionUrlTemplate,
            bodyTemplate: template.bodyTemplate,
            createdByUserId: actorUserId,
            requiredVariables: template.requiredVariables,
            templateId: template.id,
            titleTemplate: template.titleTemplate,
            version: template.version,
          });

          await tx
            .update(inAppNotificationTemplates)
            .set({
              actionLabelTemplate: nextTemplate.actionLabelTemplate,
              actionUrlTemplate: nextTemplate.actionUrlTemplate,
              bodyTemplate: nextTemplate.bodyTemplate,
              requiredVariables: nextTemplate.requiredVariables,
              titleTemplate: nextTemplate.titleTemplate,
              updatedAt: now,
              version: template.version + 1,
            })
            .where(eq(inAppNotificationTemplates.id, template.id));
        }
      }

      await tx
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
    });

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
  attachments,
  data,
  recipientEmail,
  recipientUserId,
  templateKey,
}: {
  attachments?: SendEmailAttachment[];
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
  const htmlBody = renderTemplate(
    template.htmlBody,
    escapeHtmlTemplateData(renderData),
  );
  const textBody = renderTemplate(template.textBody, renderData);

  const [delivery] = await db
    .insert(notificationDeliveries)
    .values({
      metadata: JSON.stringify({
        attachments: attachments?.map(({ disposition, filename, type }) => ({
          disposition: disposition ?? "attachment",
          filename,
          type: type ?? "application/octet-stream",
        })),
        data: renderData,
      }),
      recipientEmail: normalizedEmail,
      recipientUserId,
      status: "queued",
      subject,
      templateKey,
    })
    .returning({ id: notificationDeliveries.id });

  const result = await sendEmail({
    attachments,
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

    return {
      delivered: true,
      outcomeUnknown: false,
      providerMessageId: result.providerMessageId,
      providerStatus: result.providerStatus,
    } as const;
  }

  const outcomeUnknown = result.outcomeUnknown === true;
  const failureReason = outcomeUnknown
    ? ("verification_required" as const)
    : result.reason;

  await db
    .update(notificationDeliveries)
    .set({
      errorMessage: failureReason,
      providerMessageId: result.providerMessageId,
      status: "failed",
    })
    .where(eq(notificationDeliveries.id, delivery.id));

  return {
    delivered: false,
    outcomeUnknown,
    providerMessageId: result.providerMessageId,
    providerStatus: result.providerStatus,
    reason: failureReason,
  } as const;
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
  const renderedHtmlBody = renderTemplate(
    htmlBody,
    escapeHtmlTemplateData(renderData),
  );
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

  const outcomeUnknown = result.outcomeUnknown === true;

  await db
    .update(notificationDeliveries)
    .set({
      errorMessage: outcomeUnknown ? "verification_required" : result.reason,
      providerMessageId: result.providerMessageId,
      status: "failed",
    })
    .where(eq(notificationDeliveries.id, delivery.id));

  return {
    ok: false,
    message:
      result.reason === "not_configured"
        ? "SendGrid is not configured yet."
        : outcomeUnknown
          ? "SendGrid may have accepted the test email. Verify the provider outcome before retrying."
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

function templateTextUsesVariable(template: string | null | undefined, key: string) {
  if (!template) {
    return false;
  }

  return new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`).test(template);
}

function requiredVariablesUseKey(value: string, key: string) {
  return parseRequiredVariables(value).includes(key);
}

function countNotificationGlobalVariableUsage(
  key: string,
  emailTemplates: (typeof notificationTemplates.$inferSelect)[],
  inAppTemplates: (typeof inAppNotificationTemplates.$inferSelect)[],
) {
  const emailUsage = emailTemplates.filter((template) =>
    [
      templateTextUsesVariable(template.subject, key),
      templateTextUsesVariable(template.previewText, key),
      templateTextUsesVariable(template.htmlBody, key),
      templateTextUsesVariable(template.textBody, key),
      requiredVariablesUseKey(template.requiredVariables, key),
    ].some(Boolean),
  ).length;

  const inAppUsage = inAppTemplates.filter((template) =>
    [
      templateTextUsesVariable(template.titleTemplate, key),
      templateTextUsesVariable(template.bodyTemplate, key),
      templateTextUsesVariable(template.actionLabelTemplate, key),
      templateTextUsesVariable(template.actionUrlTemplate, key),
      requiredVariablesUseKey(template.requiredVariables, key),
    ].some(Boolean),
  ).length;

  return emailUsage + inAppUsage;
}

function replaceEmailTemplateGlobalKey(
  template: typeof notificationTemplates.$inferSelect,
  oldKey: string,
  newKey: string,
) {
  const subject = replaceTemplateVariableKey(template.subject, oldKey, newKey);
  const previewText = replaceTemplateVariableKey(
    template.previewText,
    oldKey,
    newKey,
  );
  const htmlBody = replaceTemplateVariableKey(template.htmlBody, oldKey, newKey);
  const textBody = replaceTemplateVariableKey(template.textBody, oldKey, newKey);
  const requiredVariables = replaceRequiredVariableKey(
    template.requiredVariables,
    oldKey,
    newKey,
  );

  return {
    changed:
      subject !== template.subject ||
      previewText !== template.previewText ||
      htmlBody !== template.htmlBody ||
      textBody !== template.textBody ||
      requiredVariables !== template.requiredVariables,
    htmlBody,
    previewText,
    requiredVariables,
    subject,
    textBody,
  };
}

function replaceInAppTemplateGlobalKey(
  template: typeof inAppNotificationTemplates.$inferSelect,
  oldKey: string,
  newKey: string,
) {
  const titleTemplate = replaceTemplateVariableKey(
    template.titleTemplate,
    oldKey,
    newKey,
  );
  const bodyTemplate = replaceTemplateVariableKey(
    template.bodyTemplate,
    oldKey,
    newKey,
  );
  const actionLabelTemplate = replaceTemplateVariableKey(
    template.actionLabelTemplate,
    oldKey,
    newKey,
  );
  const actionUrlTemplate = replaceTemplateVariableKey(
    template.actionUrlTemplate,
    oldKey,
    newKey,
  );
  const requiredVariables = replaceRequiredVariableKey(
    template.requiredVariables,
    oldKey,
    newKey,
  );

  return {
    actionLabelTemplate,
    actionUrlTemplate,
    bodyTemplate,
    changed:
      titleTemplate !== template.titleTemplate ||
      bodyTemplate !== template.bodyTemplate ||
      actionLabelTemplate !== template.actionLabelTemplate ||
      actionUrlTemplate !== template.actionUrlTemplate ||
      requiredVariables !== template.requiredVariables,
    requiredVariables,
    titleTemplate,
  };
}

function replaceTemplateVariableKey<T extends string | null>(
  value: T,
  oldKey: string,
  newKey: string,
): T {
  if (!value) {
    return value;
  }

  return value.replace(
    new RegExp(`\\{\\{\\s*${escapeRegExp(oldKey)}\\s*\\}\\}`, "g"),
    `{{${newKey}}}`,
  ) as T;
}

function replaceRequiredVariableKey(value: string, oldKey: string, newKey: string) {
  const variables = parseRequiredVariables(value);

  if (!variables.includes(oldKey)) {
    return value;
  }

  return JSON.stringify(
    variables.map((variable) => (variable === oldKey ? newKey : variable)),
  );
}

function toAdminDeliveryPolicy(
  policy: typeof notificationDeliveryPolicies.$inferSelect,
): AdminNotificationDeliveryPolicy {
  return {
    digestEligible: policy.digestEligible,
    emailEnabled: policy.emailEnabled,
    eventKey: policy.eventKey,
    inAppEnabled: policy.inAppEnabled,
    priority: policy.priority as NotificationPriorityLevel,
    pushEnabled: policy.pushEnabled,
    quietHoursEnabled: policy.quietHoursEnabled,
    quietHoursEnd: policy.quietHoursEnd,
    quietHoursStart: policy.quietHoursStart,
  };
}

function createDefaultDeliveryPolicy(
  eventKey: string,
  {
    emailEnabled,
    inAppEnabled,
  }: {
    emailEnabled: boolean;
    inAppEnabled: boolean;
  },
): AdminNotificationDeliveryPolicy {
  return {
    digestEligible: false,
    emailEnabled,
    eventKey,
    inAppEnabled,
    priority: eventKey.includes("application") ? "high" : "normal",
    pushEnabled: false,
    quietHoursEnabled: false,
    quietHoursEnd: null,
    quietHoursStart: null,
  };
}

async function getNotificationDeliveryPolicy(eventKey: string) {
  const [policy] = await db
    .select()
    .from(notificationDeliveryPolicies)
    .where(eq(notificationDeliveryPolicies.eventKey, eventKey))
    .limit(1);

  if (policy) {
    return toAdminDeliveryPolicy(policy);
  }

  const [[emailTemplate], [inAppTemplate]] = await Promise.all([
    db
      .select({ key: notificationTemplates.key })
      .from(notificationTemplates)
      .where(eq(notificationTemplates.key, eventKey))
      .limit(1),
    db
      .select({ key: inAppNotificationTemplates.key })
      .from(inAppNotificationTemplates)
      .where(eq(inAppNotificationTemplates.key, eventKey))
      .limit(1),
  ]);

  return createDefaultDeliveryPolicy(eventKey, {
    emailEnabled: Boolean(emailTemplate),
    inAppEnabled: Boolean(inAppTemplate),
  });
}

async function getUserEmail(userId: string) {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.email?.trim().toLowerCase() ?? null;
}

async function preparePushNotification({
  data,
  event,
  recipientUserId,
}: {
  data: Record<string, string | number | boolean | null | undefined>;
  event: string;
  recipientUserId: string;
}) {
  const payload = await renderPushPayload({ data, event });

  if (!payload) {
    return {
      delivered: false,
      event,
      reason: "template_unavailable",
      sentCount: 0,
      subscriptionCount: 0,
    } as const;
  }

  return sendPushNotificationToUser({
    payload,
    userId: recipientUserId,
  });
}

async function renderPushPayload({
  data,
  event,
}: {
  data: Record<string, string | number | boolean | null | undefined>;
  event: string;
}) {
  const [template] = await db
    .select()
    .from(inAppNotificationTemplates)
    .where(eq(inAppNotificationTemplates.key, event))
    .limit(1);

  if (!template || template.status !== "active") {
    return null;
  }

  const globalData = await getNotificationGlobalVariableData();
  const renderData = { ...globalData, ...data };

  return {
    body: renderTemplate(template.bodyTemplate, renderData),
    icon: "/brand/favicon-for-app/web-app-manifest-192x192.png",
    tag: event,
    title: renderTemplate(template.titleTemplate, renderData),
    url: template.actionUrlTemplate
      ? renderTemplate(template.actionUrlTemplate, renderData)
      : null,
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
        usageCount: 0,
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
      usageCount: 0,
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
      usageCount: 0,
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
      usageCount: 0,
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

function escapeHtmlTemplateData(
  data: Record<string, string | number | boolean | null | undefined>,
) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value == null
        ? value
        : String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;"),
    ]),
  );
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
    return "https://jurgensenergy.com";
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
