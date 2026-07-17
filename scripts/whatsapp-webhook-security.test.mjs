import assert from "node:assert/strict";
import test from "node:test";

import {
  createTwilioWebhookSignature,
  timingSafeStringEqual,
  verify360DialogWebhookSecret,
  verifyInboundWhatsappWebhook,
  verifyTwilioWebhookSignature,
} from "../src/modules/whatsapp-ordering/webhook-security.ts";
import {
  parse360DialogWhatsappPayload,
  parseTwilioWhatsappPayload,
} from "../src/modules/whatsapp-ordering/webhook-payload.ts";

test("verifies the configured 360dialog custom header without loose equality", () => {
  const headers = new Headers({
    "x-whatsapp-webhook-secret": "correct-long-secret",
  });

  assert.equal(
    verify360DialogWebhookSecret({ headers, secret: "correct-long-secret" }),
    true,
  );
  assert.equal(
    verify360DialogWebhookSecret({ headers, secret: "incorrect-long-secret" }),
    false,
  );
  assert.equal(timingSafeStringEqual("same", "same"), true);
  assert.equal(timingSafeStringEqual("short", "a-longer-value"), false);
});

test("requires the configured admin signing secret on 360dialog webhooks", () => {
  const secret = "admin-configured-long-secret";
  const baseInput = {
    isTwilioForm: false,
    rawBody: JSON.stringify({ object: "whatsapp_business_account" }),
    requestUrl: "https://jurgensenergy.com/api/webhooks/whatsapp",
    twilioAuthToken: null,
    webhookSigningSecret: secret,
    webhookUrl: "https://jurgensenergy.com/api/webhooks/whatsapp",
  };

  assert.deepEqual(
    verifyInboundWhatsappWebhook({
      ...baseInput,
      headers: new Headers({
        "x-whatsapp-webhook-secret": secret,
      }),
    }),
    { ok: true },
  );

  for (const headers of [
    new Headers(),
    new Headers({ "x-whatsapp-webhook-secret": "wrong-long-secret" }),
  ]) {
    assert.deepEqual(
      verifyInboundWhatsappWebhook({ ...baseInput, headers }),
      { error: "invalid_signature", ok: false, status: 401 },
    );
  }
});

test("does not use a 360dialog secret to authenticate Twilio form posts", () => {
  assert.deepEqual(
    verifyInboundWhatsappWebhook({
      headers: new Headers({
        "x-whatsapp-webhook-secret": "admin-configured-long-secret",
      }),
      isTwilioForm: true,
      rawBody: "Body=Hi&From=whatsapp%3A%2B27827223783&MessageSid=SM123",
      requestUrl: "https://jurgensenergy.com/api/webhooks/whatsapp",
      twilioAuthToken: null,
      webhookSigningSecret: "admin-configured-long-secret",
      webhookUrl: "https://jurgensenergy.com/api/webhooks/whatsapp",
    }),
    {
      error: "provider_verification_not_configured",
      ok: false,
      status: 503,
    },
  );
});

test("reports compatibility mode when no provider verification is configured", () => {
  const common = {
    headers: new Headers(),
    rawBody: "",
    requestUrl: "https://jurgensenergy.com/api/webhooks/whatsapp",
    twilioAuthToken: null,
    webhookSigningSecret: null,
    webhookUrl: "https://jurgensenergy.com/api/webhooks/whatsapp",
  };

  assert.deepEqual(
    verifyInboundWhatsappWebhook({ ...common, isTwilioForm: false }),
    { ok: true, unverifiedProvider: "360dialog" },
  );
  assert.deepEqual(
    verifyInboundWhatsappWebhook({ ...common, isTwilioForm: true }),
    { ok: true, unverifiedProvider: "Twilio" },
  );
});

test("verifies Twilio HMAC-SHA1 signatures over every received form parameter", () => {
  const authToken = "test-auth-token";
  const body =
    "To=whatsapp%3A%2B27606893558&From=whatsapp%3A%2B27827223783&Body=Hi&MessageSid=SM123&ProfileName=Dillon";
  const url = "https://jurgensenergy.com/api/webhooks/whatsapp";
  const signature = createTwilioWebhookSignature({ authToken, body, url });

  assert.equal(
    verifyTwilioWebhookSignature({ authToken, body, signature, url }),
    true,
  );
  assert.equal(
    verifyTwilioWebhookSignature({
      authToken,
      body: `${body}&Unexpected=new-provider-field`,
      signature,
      url,
    }),
    false,
  );
});

test("requires provider message IDs so webhook retries are durably idempotent", () => {
  const validTwilio = parseTwilioWhatsappPayload(
    "Body=Hi&From=whatsapp%3A%2B27827223783&MessageSid=SM123",
  );
  const missingTwilioId = parseTwilioWhatsappPayload(
    "Body=Hi&From=whatsapp%3A%2B27827223783",
  );

  assert.equal(validTwilio.kind, "message");
  assert.deepEqual(missingTwilioId, {
    error: "invalid_payload",
    kind: "invalid",
  });

  const valid360Dialog = parse360DialogWhatsappPayload(
    JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ profile: { name: "Dillon" } }],
                messages: [
                  { from: "27827223783", id: "wamid.123", text: { body: "Hi" } },
                ],
                metadata: { phone_number_id: "12345" },
              },
            },
          ],
        },
      ],
    }),
  );
  const missing360DialogId = parse360DialogWhatsappPayload(
    JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: "27827223783", text: { body: "Hi" } }],
              },
            },
          ],
        },
      ],
    }),
  );

  assert.equal(valid360Dialog.kind, "message");
  assert.deepEqual(missing360DialogId, {
    error: "invalid_payload",
    kind: "invalid",
  });
});

test("accepts delivery-status events without treating them as customer messages", () => {
  const result = parse360DialogWhatsappPayload(
    JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [{ id: "wamid.outbound", status: "delivered" }],
              },
            },
          ],
        },
      ],
    }),
  );

  assert.deepEqual(result, { kind: "event" });
});
