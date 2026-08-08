import { createPublicKey, createVerify } from "node:crypto";

import { getSendGridIntegrationConfig } from "@/src/modules/marketplace/settings";
import {
  recordSendGridWebhookEvents,
  type SendGridWebhookEvent,
} from "@/src/modules/notifications/sendgrid-events";

export const runtime = "nodejs";

const SIGNATURE_HEADER = "x-twilio-email-event-webhook-signature";
const TIMESTAMP_HEADER = "x-twilio-email-event-webhook-timestamp";

export async function POST(request: Request) {
  const body = await request.text();
  const config = await getSendGridIntegrationConfig();

  if (!config.webhookPublicKey) {
    console.error("[sendgrid-webhook] public verification key is not configured.");

    return Response.json(
      { ok: false, error: "webhook_not_configured" },
      { status: 500 },
    );
  }

  if (!verifySendGridSignature(request.headers, body, config.webhookPublicKey)) {
    return Response.json(
      { ok: false, error: "invalid_signature" },
      { status: 401 },
    );
  }

  let events: SendGridWebhookEvent[];

  try {
    const parsed = JSON.parse(body);
    events = Array.isArray(parsed) ? parsed : [];
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const result = await recordSendGridWebhookEvents(events);

  return Response.json({ ok: true, ...result });
}

function verifySendGridSignature(
  headers: Headers,
  payload: string,
  publicKey: string,
) {
  const signature = headers.get(SIGNATURE_HEADER);
  const timestamp = headers.get(TIMESTAMP_HEADER);

  if (!signature || !timestamp) {
    return false;
  }

  try {
    const verifier = createVerify("SHA256");
    verifier.update(timestamp, "utf8");
    verifier.update(payload, "utf8");
    verifier.end();

    return verifier.verify(
      parseSendGridPublicKey(publicKey),
      Buffer.from(signature, "base64"),
    );
  } catch (error) {
    console.error("[sendgrid-webhook] signature verification failed.", error);

    return false;
  }
}

function parseSendGridPublicKey(value: string) {
  const key = value.trim();

  if (key.includes("BEGIN PUBLIC KEY")) {
    return createPublicKey(key);
  }

  return createPublicKey({
    format: "der",
    key: Buffer.from(key, "base64"),
    type: "spki",
  });
}
