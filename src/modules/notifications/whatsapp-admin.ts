import { getWhatsappEmailNotificationSettings } from "@/src/modules/marketplace/settings";
import {
  buildSurfaceUrl,
  sendNotificationEmail,
} from "@/src/modules/notifications/templates";
import type { WhatsappAcceptedInboundMessage } from "@/src/modules/whatsapp-ordering/service";

const providerLabels: Record<
  WhatsappAcceptedInboundMessage["provider"],
  string
> = {
  "360dialog": "360dialog",
  generic: "WhatsApp",
  meta: "Meta WhatsApp",
  take_app: "Take App",
  twilio: "Twilio",
};

const receivedAtFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Johannesburg",
});

export async function dispatchWhatsappInboundAdminNotifications(
  message: WhatsappAcceptedInboundMessage,
) {
  try {
    const settings = await getWhatsappEmailNotificationSettings();
    const recipients = [
      ...new Set(
        settings.recipients
          .map((recipient) => recipient.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    if (!settings.enabled || recipients.length === 0) {
      return { attempted: 0, failed: 0, ok: true } as const;
    }

    const templateKeys: string[] = [];

    if (message.isNewConversation) {
      if (settings.notifyNewConversation) {
        templateKeys.push("admin.whatsapp.conversation.started");
      }
    } else if (settings.notifyInboundMessage) {
      templateKeys.push("admin.whatsapp.message.received");
    }

    if (templateKeys.length === 0) {
      return { attempted: 0, failed: 0, ok: true } as const;
    }

    const adminConversationUrl = new URL(
      `/whatsapp/${encodeURIComponent(message.conversationId)}`,
      `${buildSurfaceUrl("admin")}/`,
    ).toString();
    const data = {
      adminConversationUrl,
      customerDisplayName: message.profileName || message.phone,
      customerPhone: message.phone,
      messageBody: message.body,
      receivedAtLabel: receivedAtFormatter.format(message.receivedAt),
      providerLabel: providerLabels[message.provider],
    };
    const deliveries = templateKeys.flatMap((templateKey) =>
      recipients.map((recipientEmail) =>
        sendNotificationEmail({
          data,
          recipientEmail,
          templateKey,
        }),
      ),
    );
    const results = await Promise.allSettled(deliveries);
    const failed = results.filter(
      (result) =>
        result.status === "rejected" ||
        (result.status === "fulfilled" && !result.value.delivered),
    ).length;

    if (failed > 0) {
      console.error(
        `Failed to deliver ${failed} of ${results.length} WhatsApp admin email notifications`,
      );
    }

    return {
      attempted: results.length,
      failed,
      ok: failed === 0,
    } as const;
  } catch (error) {
    console.error("Failed to dispatch WhatsApp admin email notifications", error);

    return { attempted: 0, failed: 1, ok: false } as const;
  }
}
