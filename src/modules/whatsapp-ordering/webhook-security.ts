import { createHmac, timingSafeEqual } from "node:crypto";

export const whatsappWebhookSecretHeader = "x-whatsapp-webhook-secret";
export const twilioSignatureHeader = "x-twilio-signature";

export type WhatsappWebhookVerificationResult =
  | {
      ok: true;
      unverifiedProvider?: "360dialog" | "Twilio";
    }
  | {
      error: "invalid_signature" | "provider_verification_not_configured";
      ok: false;
      status: 401 | 503;
    };

export function verifyInboundWhatsappWebhook({
  headers,
  isTwilioForm,
  rawBody,
  requestUrl,
  twilioAuthToken,
  webhookSigningSecret,
  webhookUrl,
}: {
  headers: Headers;
  isTwilioForm: boolean;
  rawBody: string;
  requestUrl: string;
  twilioAuthToken: string | null | undefined;
  webhookSigningSecret: string | null | undefined;
  webhookUrl: string;
}): WhatsappWebhookVerificationResult {
  if (isTwilioForm) {
    if (twilioAuthToken) {
      const signature = headers.get(twilioSignatureHeader);
      const canonicalWebhookUrl = getCanonicalWebhookUrl(
        webhookUrl,
        requestUrl,
      );

      if (
        !signature ||
        !verifyTwilioWebhookSignature({
          authToken: twilioAuthToken,
          body: rawBody,
          signature,
          url: canonicalWebhookUrl,
        })
      ) {
        return { error: "invalid_signature", ok: false, status: 401 };
      }

      return { ok: true };
    }

    if (webhookSigningSecret) {
      return {
        error: "provider_verification_not_configured",
        ok: false,
        status: 503,
      };
    }

    return { ok: true, unverifiedProvider: "Twilio" };
  }

  if (webhookSigningSecret) {
    if (
      !verify360DialogWebhookSecret({
        headers,
        secret: webhookSigningSecret,
      })
    ) {
      return { error: "invalid_signature", ok: false, status: 401 };
    }

    return { ok: true };
  }

  return { ok: true, unverifiedProvider: "360dialog" };
}

export function verify360DialogWebhookSecret({
  headers,
  secret,
}: {
  headers: Headers;
  secret: string;
}) {
  const presentedSecret = headers.get(whatsappWebhookSecretHeader);

  return Boolean(
    presentedSecret && timingSafeStringEqual(presentedSecret, secret),
  );
}

export function verifyTwilioWebhookSignature({
  authToken,
  body,
  signature,
  url,
}: {
  authToken: string;
  body: string;
  signature: string;
  url: string;
}) {
  const expectedSignature = createTwilioWebhookSignature({
    authToken,
    body,
    url,
  });

  return timingSafeStringEqual(expectedSignature, signature.trim());
}

export function createTwilioWebhookSignature({
  authToken,
  body,
  url,
}: {
  authToken: string;
  body: string;
  url: string;
}) {
  const parameters = Array.from(new URLSearchParams(body).entries()).sort(
    ([leftName, leftValue], [rightName, rightValue]) =>
      compareSignatureComponent(leftName, rightName) ||
      compareSignatureComponent(leftValue, rightValue),
  );
  const signingPayload = parameters.reduce(
    (payload, [name, value]) => `${payload}${name}${value}`,
    url,
  );

  return createHmac("sha1", authToken)
    .update(signingPayload, "utf8")
    .digest("base64");
}

function compareSignatureComponent(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function getCanonicalWebhookUrl(configuredUrl: string, requestUrl: string) {
  const canonicalUrl = new URL(configuredUrl);
  canonicalUrl.search = new URL(requestUrl).search;

  return canonicalUrl.toString();
}

export function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
