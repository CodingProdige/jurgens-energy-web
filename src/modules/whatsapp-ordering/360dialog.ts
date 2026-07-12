import { env } from "@/src/config/env";
import { getWhatsappIntegrationConfig } from "@/src/modules/marketplace/settings";
import { normalizeWhatsappAccountPhone } from "@/src/modules/whatsapp-ordering/customer-links";

export type WhatsappSendResult = {
  ok: boolean;
  skipped?: boolean;
  status?: number;
};

export async function send360DialogTextMessage({
  body,
  to,
}: {
  body: string;
  to: string;
}): Promise<WhatsappSendResult> {
  const config = await getWhatsappIntegrationConfig();

  if (!config.isConfigured || !config.apiKey) {
    return { ok: false, skipped: true };
  }

  const normalizedPhone = normalizeWhatsappAccountPhone(to);

  if (!normalizedPhone) {
    return { ok: false, skipped: true };
  }

  const response = await fetch(getMessagesEndpoint(config.messageUrl), {
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      text: {
        body,
        preview_url: true,
      },
      to: normalizedPhone.replace(/\D/g, ""),
      type: "text",
    }),
    headers: {
      "Content-Type": "application/json",
      "D360-API-KEY": config.apiKey,
    },
    method: "POST",
  });

  return {
    ok: response.ok,
    status: response.status,
  };
}

export type WhatsappMediaMessageAttachment = {
  fileName?: string | null;
  mimeType: string;
  type: "document" | "image" | "video";
  url: string;
};

export async function send360DialogMediaMessage({
  attachment,
  body,
  to,
}: {
  attachment: WhatsappMediaMessageAttachment;
  body?: string;
  to: string;
}): Promise<WhatsappSendResult> {
  const config = await getWhatsappIntegrationConfig();

  if (!config.isConfigured || !config.apiKey) {
    return { ok: false, skipped: true };
  }

  const normalizedPhone = normalizeWhatsappAccountPhone(to);

  if (!normalizedPhone) {
    return { ok: false, skipped: true };
  }

  const caption = body?.trim() || undefined;
  const link = toAbsoluteMediaUrl(attachment.url);
  const mediaPayload =
    attachment.type === "document"
      ? {
          caption,
          filename: attachment.fileName ?? undefined,
          link,
        }
      : {
          caption,
          link,
        };

  const response = await fetch(getMessagesEndpoint(config.messageUrl), {
    body: JSON.stringify({
      [attachment.type]: mediaPayload,
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone.replace(/\D/g, ""),
      type: attachment.type,
    }),
    headers: {
      "Content-Type": "application/json",
      "D360-API-KEY": config.apiKey,
    },
    method: "POST",
  });

  return {
    ok: response.ok,
    status: response.status,
  };
}

function getMessagesEndpoint(messageUrl: string) {
  const trimmed = messageUrl.replace(/\/+$/, "");

  return trimmed.endsWith("/messages") ? trimmed : `${trimmed}/messages`;
}

function toAbsoluteMediaUrl(url: string) {
  return URL.canParse(url) ? url : new URL(url, env.APP_URL).toString();
}
