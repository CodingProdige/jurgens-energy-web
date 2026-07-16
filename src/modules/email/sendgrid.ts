import { env } from "@/src/config/env";

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
  if (!env.SENDGRID_API_KEY || !env.SENDGRID_FROM_EMAIL) {
    return { delivered: false, reason: "not_configured" } satisfies SendEmailResult;
  }

  let response: Response;

  try {
    response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...message,
        from: {
          email: env.SENDGRID_FROM_EMAIL,
          name: env.SENDGRID_FROM_NAME,
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
