import { env } from "@/src/config/env";
import {
  send360DialogMediaMessage,
  send360DialogTextMessage,
} from "@/src/modules/whatsapp-ordering/360dialog";
import { getWhatsappIntegrationConfig } from "@/src/modules/marketplace/settings";
import {
  processWhatsappInboundMessage,
  type WhatsappAssistantMedia,
  type WhatsappInboundMessage,
} from "@/src/modules/whatsapp-ordering/service";
import {
  checkRateLimit,
  getClientIp,
} from "@/src/modules/security/rate-limit";
import {
  parse360DialogWhatsappPayload,
  parseTwilioWhatsappPayload,
} from "@/src/modules/whatsapp-ordering/webhook-payload";
import {
  timingSafeStringEqual,
  verifyInboundWhatsappWebhook,
  whatsappWebhookSecretHeader,
} from "@/src/modules/whatsapp-ordering/webhook-security";

export const runtime = "nodejs";

const maximumWebhookBodyBytes = 1_000_000;
const warnedUnverifiedProviders = new Set<string>();

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
    token &&
    timingSafeStringEqual(token, config.webhookVerifyToken)
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

  const rawBodyResult = await readWebhookBody(request);

  if (!rawBodyResult.ok) {
    return Response.json(
      { error: rawBodyResult.error, ok: false },
      {
        headers: { "Cache-Control": "private, no-store" },
        status: rawBodyResult.status,
      },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  const isTwilioForm = contentType.includes(
    "application/x-www-form-urlencoded",
  );
  const config = await getWhatsappIntegrationConfig();
  const verification = verifyInboundWhatsappWebhook({
    headers: request.headers,
    isTwilioForm,
    rawBody: rawBodyResult.body,
    requestUrl: request.url,
    twilioAuthToken: env.TWILIO_AUTH_TOKEN,
    webhookSigningSecret: config.webhookSigningSecret,
    webhookUrl: config.webhookUrl,
  });

  if (!verification.ok) {
    return Response.json(
      { error: verification.error, ok: false },
      {
        headers: { "Cache-Control": "private, no-store" },
        status: verification.status,
      },
    );
  }

  if (verification.unverifiedProvider === "Twilio") {
    warnUnverifiedProvider("Twilio", "TWILIO_AUTH_TOKEN");
  } else if (verification.unverifiedProvider === "360dialog") {
    warnUnverifiedProvider(
      "360dialog",
      `${whatsappWebhookSecretHeader} plus the WhatsApp settings signing secret`,
    );
  }

  const payloadResult = isTwilioForm
    ? parseTwilioWhatsappPayload(rawBodyResult.body)
    : parse360DialogWhatsappPayload(rawBodyResult.body);

  if (payloadResult.kind === "invalid") {
    return Response.json(
      { error: payloadResult.error, ok: false },
      {
        headers: { "Cache-Control": "private, no-store" },
        status: 400,
      },
    );
  }

  if (payloadResult.kind === "event") {
    return Response.json(
      { ok: true, skipped: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const parsed: WhatsappInboundMessage = payloadResult.message;
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
    return new Response(toTwiml(result.reply, result.media ?? []), {
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  }

  const outbound = await sendWhatsappReply({
    body: result.reply,
    media: result.media ?? [],
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

async function sendWhatsappReply({
  body,
  media,
  to,
}: {
  body: string;
  media: WhatsappAssistantMedia[];
  to: string;
}) {
  const results: Array<{
    kind: "media" | "text";
    result: Awaited<ReturnType<typeof send360DialogTextMessage>>;
  }> = [];

  for (const attachment of media) {
    try {
      results.push({
        kind: "media",
        result: await send360DialogMediaMessage({
          attachment,
          body: attachment.caption ?? undefined,
          to,
        }),
      });
    } catch (error) {
      console.error("Failed to send WhatsApp media through 360dialog", error);
      results.push({
        kind: "media",
        result: { ok: false, reason: "send_failed" },
      });
    }
  }

  try {
    results.push({
      kind: "text",
      result: await send360DialogTextMessage({ body, to }),
    });
  } catch (error) {
    console.error("Failed to send WhatsApp reply through 360dialog", error);
    results.push({
      kind: "text",
      result: { ok: false, reason: "send_failed" },
    });
  }

  return results;
}

async function readWebhookBody(request: Request): Promise<
  | { body: string; ok: true }
  | { error: "payload_too_large"; ok: false; status: 413 }
> {
  const contentLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(contentLength) &&
    contentLength > maximumWebhookBodyBytes
  ) {
    return { error: "payload_too_large", ok: false, status: 413 };
  }

  const body = await request.text();

  if (Buffer.byteLength(body, "utf8") > maximumWebhookBodyBytes) {
    return { error: "payload_too_large", ok: false, status: 413 };
  }

  return { body, ok: true };
}

function warnUnverifiedProvider(provider: string, configuration: string) {
  if (warnedUnverifiedProviders.has(provider)) {
    return;
  }

  warnedUnverifiedProviders.add(provider);
  console.warn(
    `[whatsapp-webhook] ${provider} verification is not configured; accepting inbound requests in compatibility mode. Configure ${configuration} to reject unauthenticated requests.`,
  );
}

function toTwiml(message: string, media: WhatsappAssistantMedia[]) {
  const mediaNodes = media
    .map((attachment) => `<Media>${escapeXml(attachment.url)}</Media>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>${escapeXml(
    message,
  )}</Body>${mediaNodes}</Message></Response>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
