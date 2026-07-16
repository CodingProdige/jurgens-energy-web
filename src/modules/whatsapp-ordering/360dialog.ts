import { env } from "@/src/config/env";
import { getWhatsappIntegrationConfig } from "@/src/modules/marketplace/settings";
import { normalizeWhatsappAccountPhone } from "@/src/modules/whatsapp-ordering/customer-links";

export type WhatsappSendResult = {
  ok: boolean;
  outcomeUnknown?: boolean;
  providerMessageId?: string;
  providerStatus?: number;
  reason?: "invalid_recipient" | "not_configured" | "send_failed";
  skipped?: boolean;
  /** Backwards-compatible alias for providerStatus. */
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
    return { ok: false, reason: "not_configured", skipped: true };
  }

  const normalizedPhone = normalizeWhatsappAccountPhone(to);

  if (!normalizedPhone) {
    return { ok: false, reason: "invalid_recipient", skipped: true };
  }

  return send360DialogRequest({
    apiKey: config.apiKey,
    endpoint: getMessagesEndpoint(config.messageUrl),
    payload: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      text: {
        body,
        preview_url: true,
      },
      to: normalizedPhone.replace(/\D/g, ""),
      type: "text",
    },
  });
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
    return { ok: false, reason: "not_configured", skipped: true };
  }

  const normalizedPhone = normalizeWhatsappAccountPhone(to);

  if (!normalizedPhone) {
    return { ok: false, reason: "invalid_recipient", skipped: true };
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

  return send360DialogRequest({
    apiKey: config.apiKey,
    endpoint: getMessagesEndpoint(config.messageUrl),
    payload: {
      [attachment.type]: mediaPayload,
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone.replace(/\D/g, ""),
      type: attachment.type,
    },
  });
}

export type WhatsappDocumentTemplateInput = Readonly<{
  bodyParameters: readonly string[];
  document: Readonly<{ fileName: string; url: string }>;
  templateLanguage: string;
  templateName: string;
  to: string;
}>;

/**
 * Sends an approved WhatsApp template with a PDF/document header. Callers own
 * the exact approved body-variable contract and must pass parameters in that
 * template's declared order.
 */
export async function send360DialogDocumentTemplateMessage({
  bodyParameters,
  document,
  templateLanguage,
  templateName,
  to,
}: WhatsappDocumentTemplateInput): Promise<WhatsappSendResult> {
  const config = await getWhatsappIntegrationConfig();

  if (!config.isConfigured || !config.apiKey) {
    return { ok: false, reason: "not_configured", skipped: true };
  }

  const normalizedPhone = normalizeWhatsappAccountPhone(to);

  if (!normalizedPhone) {
    return { ok: false, reason: "invalid_recipient", skipped: true };
  }

  return send360DialogRequest({
    apiKey: config.apiKey,
    endpoint: getMessagesEndpoint(config.messageUrl),
    payload: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      template: {
        components: [
          {
            parameters: [
              {
                document: {
                  filename: document.fileName,
                  link: toAbsoluteMediaUrl(document.url),
                },
                type: "document",
              },
            ],
            type: "header",
          },
          {
            parameters: bodyParameters.map((text) => ({ text, type: "text" })),
            type: "body",
          },
        ],
        language: { code: templateLanguage },
        name: templateName,
      },
      to: normalizedPhone.replace(/\D/g, ""),
      type: "template",
    },
  });
}

/**
 * Sends the paid invoice through an approved WhatsApp template. Template
 * delivery is deliberately used instead of a free-form media message so this
 * remains valid when there is no open 24-hour customer-service window.
 *
 * The configured template must have a document header and five body variables,
 * in this order: customer name, order number, invoice number, invoice total,
 * and secure invoice URL.
 */
export async function send360DialogInvoiceTemplateMessage({
  customerName,
  document,
  invoiceNumber,
  invoiceTotal,
  orderNumber,
  secureDownloadUrl,
  to,
}: {
  customerName: string;
  document: { fileName: string; url: string };
  invoiceNumber: string;
  invoiceTotal: string;
  orderNumber: string;
  secureDownloadUrl: string;
  to: string;
}): Promise<WhatsappSendResult> {
  const downloadUrl = toAbsoluteMediaUrl(secureDownloadUrl);

  return send360DialogDocumentTemplateMessage({
    bodyParameters: [
      customerName,
      orderNumber,
      invoiceNumber,
      invoiceTotal,
      downloadUrl,
    ],
    document,
    templateLanguage: env.WHATSAPP_INVOICE_TEMPLATE_LANGUAGE,
    templateName: env.WHATSAPP_INVOICE_TEMPLATE_NAME,
    to,
  });
}

function getMessagesEndpoint(messageUrl: string) {
  const trimmed = messageUrl.replace(/\/+$/, "");

  return trimmed.endsWith("/messages") ? trimmed : `${trimmed}/messages`;
}

function isOutcomeUnknownStatus(status: number) {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status >= 500 && status <= 599)
  );
}

async function send360DialogRequest({
  apiKey,
  endpoint,
  payload,
}: {
  apiKey: string;
  endpoint: string;
  payload: Record<string, unknown>;
}): Promise<WhatsappSendResult> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        "D360-API-KEY": apiKey,
      },
      method: "POST",
    });
  } catch (error) {
    console.error(
      "[360dialog] message delivery request failed",
      error instanceof Error ? error.message : "unknown error",
    );

    return {
      ok: false,
      outcomeUnknown: true,
      reason: "send_failed",
    };
  }

  const responsePayload = await readJsonResponse(response);
  const providerMessageId = getProviderMessageId(responsePayload);

  return {
    ok: response.ok,
    outcomeUnknown:
      !response.ok && isOutcomeUnknownStatus(response.status),
    providerMessageId,
    providerStatus: response.status,
    reason: response.ok ? undefined : "send_failed",
    status: response.status,
  };
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    const body = await response.text();

    return body ? JSON.parse(body) : null;
  } catch {
    return null;
  }
}

function getProviderMessageId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const messages = Reflect.get(value, "messages");

  if (!Array.isArray(messages)) {
    return undefined;
  }

  for (const message of messages) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      continue;
    }

    const id = Reflect.get(message, "id");

    if (typeof id === "string" && id.trim()) {
      return id.trim();
    }
  }

  return undefined;
}

function toAbsoluteMediaUrl(url: string) {
  return URL.canParse(url) ? url : new URL(url, env.APP_URL).toString();
}
