import { env } from "@/src/config/env";

type SendGridEmailAddress = {
  email: string;
  name?: string;
};

type SendGridMessage = {
  personalizations: Array<{
    to: SendGridEmailAddress[];
    subject: string;
  }>;
  from: SendGridEmailAddress;
  content: Array<{
    type: "text/plain" | "text/html";
    value: string;
  }>;
};

type SendEmailResult =
  | { delivered: true }
  | { delivered: false; reason: "not_configured" | "send_failed" };

export async function sendEmail(message: Omit<SendGridMessage, "from">) {
  if (!env.SENDGRID_API_KEY || !env.SENDGRID_FROM_EMAIL) {
    return { delivered: false, reason: "not_configured" } satisfies SendEmailResult;
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
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

  if (!response.ok) {
    const body = await response.text();

    console.error(
      `[sendgrid] email delivery failed with ${response.status}: ${body}`,
    );

    return { delivered: false, reason: "send_failed" } satisfies SendEmailResult;
  }

  return { delivered: true } satisfies SendEmailResult;
}
