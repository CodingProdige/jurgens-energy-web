import { z } from "zod";

type ParsedInboundMessage = {
  body: string;
  from: string;
  profileName: string | null;
  provider: "360dialog" | "meta" | "twilio";
  providerConversationId?: string | null;
  providerMessageId: string;
  rawPayload: Record<string, unknown>;
};

export type WhatsappWebhookPayloadResult =
  | { kind: "event" }
  | { error: "invalid_json" | "invalid_payload"; kind: "invalid" }
  | { kind: "message"; message: ParsedInboundMessage };

const messageBodySchema = z.string().trim().min(1).max(4096);
const phoneSchema = z.string().trim().min(3).max(64);
const messageIdSchema = z.string().trim().min(1).max(240);
const profileNameSchema = z.string().trim().min(1).max(256).optional();

const twilioInboundSchema = z
  .object({
    Body: messageBodySchema,
    From: phoneSchema.optional(),
    MessageSid: messageIdSchema,
    ProfileName: profileNameSchema,
    SmsFrom: phoneSchema.optional(),
    WaId: phoneSchema.optional(),
  })
  .passthrough()
  .refine((payload) => payload.From ?? payload.WaId ?? payload.SmsFrom, {
    message: "A sender number is required.",
  });

const metaMessageSchema = z
  .object({
    button: z.object({ text: messageBodySchema }).passthrough().optional(),
    from: phoneSchema,
    id: messageIdSchema,
    interactive: z
      .object({
        button_reply: z
          .object({ title: messageBodySchema })
          .passthrough()
          .optional(),
        list_reply: z
          .object({ title: messageBodySchema })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    text: z.object({ body: messageBodySchema }).passthrough().optional(),
  })
  .passthrough();

const metaWebhookSchema = z
  .object({
    entry: z
      .array(
        z
          .object({
            changes: z
              .array(
                z
                  .object({
                    value: z
                      .object({
                        contacts: z
                          .array(
                            z
                              .object({
                                profile: z
                                  .object({ name: profileNameSchema })
                                  .passthrough()
                                  .optional(),
                              })
                              .passthrough(),
                          )
                          .max(20)
                          .optional(),
                        messages: z.array(metaMessageSchema).max(20).optional(),
                        metadata: z
                          .object({
                            display_phone_number: phoneSchema.optional(),
                            phone_number_id: messageIdSchema.optional(),
                          })
                          .passthrough()
                          .optional(),
                      })
                      .passthrough(),
                  })
                  .passthrough(),
              )
              .max(20),
          })
          .passthrough(),
      )
      .max(20),
  })
  .passthrough();

const generic360DialogSchema = z
  .object({
    body: messageBodySchema.optional(),
    from: phoneSchema.optional(),
    message: messageBodySchema.optional(),
    messageId: messageIdSchema,
    phone: phoneSchema.optional(),
    profileName: profileNameSchema,
    text: messageBodySchema.optional(),
  })
  .passthrough()
  .refine((payload) => payload.from ?? payload.phone, {
    message: "A sender number is required.",
  })
  .refine((payload) => payload.body ?? payload.text ?? payload.message, {
    message: "A message body is required.",
  });

export function parseTwilioWhatsappPayload(
  rawBody: string,
): WhatsappWebhookPayloadResult {
  const parameters = Object.fromEntries(new URLSearchParams(rawBody).entries());
  const parsed = twilioInboundSchema.safeParse(parameters);

  if (!parsed.success) {
    return { error: "invalid_payload", kind: "invalid" };
  }

  const from = parsed.data.From ?? parsed.data.WaId ?? parsed.data.SmsFrom;

  if (!from) {
    return { error: "invalid_payload", kind: "invalid" };
  }

  return {
    kind: "message",
    message: {
      body: parsed.data.Body,
      from,
      profileName: parsed.data.ProfileName ?? null,
      provider: "twilio",
      providerMessageId: parsed.data.MessageSid,
      rawPayload: parameters,
    },
  };
}

export function parse360DialogWhatsappPayload(
  rawBody: string,
): WhatsappWebhookPayloadResult {
  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { error: "invalid_json", kind: "invalid" };
  }

  if (!isRecord(payload)) {
    return { error: "invalid_payload", kind: "invalid" };
  }

  if ("entry" in payload) {
    const metaPayload = metaWebhookSchema.safeParse(payload);

    if (!metaPayload.success) {
      return { error: "invalid_payload", kind: "invalid" };
    }

    return getMetaMessage(metaPayload.data);
  }

  const genericPayload = generic360DialogSchema.safeParse(payload);

  if (!genericPayload.success) {
    return { error: "invalid_payload", kind: "invalid" };
  }

  const from = genericPayload.data.from ?? genericPayload.data.phone;
  const body =
    genericPayload.data.body ??
    genericPayload.data.text ??
    genericPayload.data.message;

  if (!from || !body) {
    return { error: "invalid_payload", kind: "invalid" };
  }

  return {
    kind: "message",
    message: {
      body,
      from,
      profileName: genericPayload.data.profileName ?? null,
      provider: "360dialog",
      providerMessageId: genericPayload.data.messageId,
      rawPayload: payload,
    },
  };
}

function getMetaMessage(
  payload: z.infer<typeof metaWebhookSchema>,
): WhatsappWebhookPayloadResult {
  const value = payload.entry[0]?.changes[0]?.value;
  const message = value?.messages?.[0];

  if (!message) {
    return { kind: "event" };
  }

  const body =
    message.text?.body ??
    message.button?.text ??
    message.interactive?.button_reply?.title ??
    message.interactive?.list_reply?.title;

  if (!body) {
    return { kind: "event" };
  }

  return {
    kind: "message",
    message: {
      body,
      from: message.from,
      profileName: value?.contacts?.[0]?.profile?.name ?? null,
      // 360dialog forwards the Meta-shaped payload; keep the historical
      // provider key so retries remain idempotent across this deployment.
      provider: "meta",
      providerConversationId:
        value?.metadata?.phone_number_id ??
        value?.metadata?.display_phone_number ??
        null,
      providerMessageId: message.id,
      rawPayload: payload,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
