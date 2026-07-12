import { z } from "zod";

import { send360DialogTextMessage } from "@/src/modules/whatsapp-ordering/360dialog";
import { getWhatsappIntegrationConfig } from "@/src/modules/marketplace/settings";
import {
  processWhatsappInboundMessage,
  type WhatsappInboundMessage,
} from "@/src/modules/whatsapp-ordering/service";
import {
  checkRateLimit,
  getClientIp,
} from "@/src/modules/security/rate-limit";

export const runtime = "nodejs";

const genericInboundSchema = z.object({
  body: z.string().trim().min(1).optional(),
  from: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1).optional(),
  messageId: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  profileName: z.string().trim().min(1).optional(),
  provider: z
    .enum(["360dialog", "generic", "meta", "take_app", "twilio"])
    .optional(),
  text: z.string().trim().min(1).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const config = await getWhatsappIntegrationConfig();

  if (
    mode === "subscribe" &&
    challenge &&
    config.webhookVerifyToken &&
    token === config.webhookVerifyToken
  ) {
    return new Response(challenge, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  return Response.json({ error: "verification_failed" }, { status: 403 });
}

export async function POST(request: Request) {
  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit({
    key: `whatsapp-webhook:${clientIp}`,
    limit: 120,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "rate_limited" },
      {
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        status: 429,
      },
    );
  }

  const parsed = await parseWhatsappRequest(request);

  if (!parsed) {
    return Response.json({ ok: true, skipped: true });
  }

  const result = await processWhatsappInboundMessage(parsed);

  if (result.skipReply) {
    return Response.json(
      {
        draftUrl: result.draftUrl,
        ok: true,
        reply: result.reply,
        skipped: true,
        status: result.status,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  if (parsed.provider === "twilio") {
    return new Response(toTwiml(result.reply), {
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  }

  const outbound = await sendWhatsappReply({
    body: result.reply,
    to: parsed.from,
  });

  return Response.json(
    {
      draftUrl: result.draftUrl,
      ok: true,
      outbound,
      reply: result.reply,
      status: result.status,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

async function sendWhatsappReply({ body, to }: { body: string; to: string }) {
  try {
    return await send360DialogTextMessage({ body, to });
  } catch (error) {
    console.error("Failed to send WhatsApp reply through 360dialog", error);

    return { ok: false, skipped: true };
  }
}

async function parseWhatsappRequest(
  request: Request,
): Promise<WhatsappInboundMessage | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    const body = getFormString(formData, "Body");
    const from =
      getFormString(formData, "From") ??
      getFormString(formData, "WaId") ??
      getFormString(formData, "SmsFrom");

    if (!body || !from) {
      return null;
    }

    return {
      body,
      from,
      profileName: getFormString(formData, "ProfileName"),
      provider: "twilio",
      providerMessageId: getFormString(formData, "MessageSid"),
      rawPayload: Object.fromEntries(formData.entries()) as Record<string, unknown>,
    };
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return null;
  }

  const metaMessage = getMetaMessage(payload);

  if (metaMessage) {
    return metaMessage;
  }

  const parsed = genericInboundSchema.safeParse(payload);

  if (!parsed.success) {
    return null;
  }

  const from = parsed.data.from ?? parsed.data.phone;
  const body = parsed.data.body ?? parsed.data.text ?? parsed.data.message;

  if (!from || !body) {
    return null;
  }

  return {
    body,
    from,
    profileName: parsed.data.profileName ?? null,
    provider: parsed.data.provider ?? "generic",
    providerMessageId: parsed.data.messageId ?? null,
    rawPayload: isRecord(payload) ? payload : undefined,
  };
}

function getMetaMessage(payload: unknown): WhatsappInboundMessage | null {
  if (!isRecord(payload)) {
    return null;
  }

  const entry = Array.isArray(payload.entry) ? payload.entry[0] : null;
  const change =
    isRecord(entry) && Array.isArray(entry.changes) ? entry.changes[0] : null;
  const value = isRecord(change) ? change.value : null;
  const messages =
    isRecord(value) && Array.isArray(value.messages) ? value.messages : null;
  const contacts =
    isRecord(value) && Array.isArray(value.contacts) ? value.contacts : null;
  const message = messages?.find(isRecord);

  if (!isRecord(message)) {
    return null;
  }

  const from = getString(message.from);
  const body =
    getString(getRecord(message.text)?.body) ??
    getString(getRecord(message.button)?.text) ??
    getString(getRecord(getRecord(message.interactive)?.button_reply)?.title) ??
    getString(getRecord(getRecord(message.interactive)?.list_reply)?.title);

  if (!from || !body) {
    return null;
  }

  const contact = contacts?.find(isRecord);
  const profileName = getString(getRecord(getRecord(contact)?.profile)?.name);
  const metadata = getRecord(value)?.metadata;
  const providerConversationId =
    getString(getRecord(metadata)?.phone_number_id) ??
    getString(getRecord(metadata)?.display_phone_number);

  return {
    body,
    from,
    profileName,
    provider: "meta",
    providerConversationId,
    providerMessageId: getString(message.id),
    rawPayload: payload,
  };
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toTwiml(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
    message,
  )}</Message></Response>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
