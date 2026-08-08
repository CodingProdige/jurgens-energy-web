import "server-only";

import { getSendGridIntegrationConfig } from "@/src/modules/marketplace/settings";

type SendGridEmailAddress = {
  email: string;
  name?: string;
};

export type SendEmailAttachment = {
  /** Base64-encoded file contents, without a data-URL prefix. */
  content: string;
  disposition?: "attachment" | "inline";
  filename: string;
  type?: string;
};

type SendGridMessage = {
  attachments?: SendEmailAttachment[];
  personalizations: Array<{
    custom_args?: Record<string, string>;
    to: SendGridEmailAddress[];
    subject: string;
  }>;
  from: SendGridEmailAddress;
  content: Array<{
    type: "text/plain" | "text/html";
    value: string;
  }>;
};

export type SendEmailResult =
  | {
      delivered: true;
      outcomeUnknown?: false;
      providerMessageId?: string;
      providerStatus?: number;
    }
  | {
      delivered: false;
      outcomeUnknown?: boolean;
      providerMessageId?: string;
      providerStatus?: number;
      reason: "not_configured" | "send_failed";
    };

function isOutcomeUnknownStatus(status: number) {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status >= 500 && status <= 599)
  );
}

export async function sendEmail(message: Omit<SendGridMessage, "from">) {
  const config = await getSendGridIntegrationConfig();

  if (!config.isConfigured || !config.apiKey || !config.fromEmail) {
    return { delivered: false, reason: "not_configured" } satisfies SendEmailResult;
  }

  let response: Response;

  try {
    response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...message,
        from: {
          email: config.fromEmail,
          name: config.fromName,
        },
      } satisfies SendGridMessage),
    });
  } catch (error) {
    console.error(
      "[sendgrid] email delivery request failed",
      error instanceof Error ? error.message : "unknown error",
    );

    return {
      delivered: false,
      outcomeUnknown: true,
      reason: "send_failed",
    } satisfies SendEmailResult;
  }

  const providerMessageId =
    response.headers.get("x-message-id") ?? undefined;

  if (!response.ok) {
    const body = await response.text();

    console.error(
      `[sendgrid] email delivery failed with ${response.status}: ${body}`,
    );

    return {
      delivered: false,
      outcomeUnknown: isOutcomeUnknownStatus(response.status),
      providerMessageId,
      providerStatus: response.status,
      reason: "send_failed",
    } satisfies SendEmailResult;
  }

  return {
    delivered: true,
    outcomeUnknown: false,
    providerMessageId,
    providerStatus: response.status,
  } satisfies SendEmailResult;
}

export async function verifySendGridConnection() {
  const config = await getSendGridIntegrationConfig();

  if (!config.isConfigured || !config.apiKey || !config.fromEmail) {
    return {
      ok: false as const,
      message: "Save an enabled API key and verified sender email first.",
    };
  }

  let response: Response;

  try {
    response = await fetch("https://api.sendgrid.com/v3/scopes", {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error(
      "[sendgrid] connection test failed",
      error instanceof Error ? error.message : "unknown error",
    );

    return {
      ok: false as const,
      message: "Could not reach SendGrid. Check the server connection and retry.",
    };
  }

  if (!response.ok) {
    return {
      ok: false as const,
      message:
        response.status === 401 || response.status === 403
          ? "SendGrid rejected the saved API key. Replace it with a valid key."
          : `SendGrid connection test failed with status ${response.status}.`,
    };
  }

  const body = (await response.json().catch(() => null)) as
    | { scopes?: unknown }
    | null;
  const scopes = Array.isArray(body?.scopes)
    ? body.scopes.filter((scope): scope is string => typeof scope === "string")
    : [];

  if (!scopes.includes("mail.send")) {
    return {
      ok: false as const,
      message:
        "The API key is valid but does not have the required mail.send permission.",
    };
  }

  return {
    ok: true as const,
    message: `SendGrid is connected with mail.send access for ${config.fromEmail}.`,
  };
}
