import "server-only";

import { env } from "@/src/config/env";
import { sendNotificationEmail } from "@/src/modules/notifications/templates";
import { send360DialogDocumentTemplateMessage } from "@/src/modules/whatsapp-ordering/360dialog";

export const CREDIT_NOTE_EMAIL_TEMPLATE_KEY = "customer_credit_note_issued";
export const CREDIT_NOTE_WHATSAPP_TEMPLATE_NAME =
  "customer_credit_note_issued";
export const CREDIT_NOTE_NOTIFICATION_VARIABLES = [
  "customer_name",
  "order_number",
  "invoice_number",
  "credit_note_number",
  "credit_note_total",
  "credit_note_reason",
  "credit_note_download_url",
] as const;

type CreditNoteProviderMetadata = {
  providerMessageId?: string;
  providerStatus?: number;
};

export type CreditNoteDeliveryChannelResult =
  | (CreditNoteProviderMetadata & {
      idempotencyKey: string;
      status: "sent";
    })
  | {
      idempotencyKey: string;
      reason:
        | "already_sent"
        | "invalid_recipient"
        | "missing_recipient"
        | "not_configured"
        | "template_unavailable";
      status: "skipped";
    }
  | (CreditNoteProviderMetadata & {
      idempotencyKey: string;
      outcomeUnknown: true;
      reason: string;
      status: "verification_required";
    })
  | (CreditNoteProviderMetadata & {
      idempotencyKey: string;
      reason: string;
      status: "failed";
    });

export type CreditNoteDeliveryResult = Readonly<{
  email?: CreditNoteDeliveryChannelResult;
  whatsapp?: CreditNoteDeliveryChannelResult;
}>;

export type CreditNoteDeliveryOptions = Readonly<{
  channels?: Readonly<{
    email?: boolean;
    whatsapp?: boolean;
  }>;
  previouslyDelivered?: Readonly<{
    email?: boolean;
    whatsapp?: boolean;
  }>;
  whatsappTemplateLanguage?: string;
  whatsappTemplateName?: string;
}>;

export type DeliverCreditNoteInput = Readonly<{
  creditedTotalCents: number;
  creditNoteNumber: string;
  customerEmail?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerUserId?: string | null;
  orderNumber: string;
  originalInvoiceNumber: string;
  pdfBuffer: Buffer;
  reason: string;
  secureDownloadUrl: string;
}>;

type PreparedCreditNoteDeliveryInput = DeliverCreditNoteInput & {
  creditedTotal: string;
  reason: string;
  secureDownloadUrl: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "delivery_failed";
}

function formatZarCents(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    currencyDisplay: "symbol",
    style: "currency",
  }).format(value / 100);
}

function getCreditNoteFilename(creditNoteNumber: string) {
  const safeCreditNoteNumber = creditNoteNumber.replace(
    /[^A-Za-z0-9_-]/g,
    "_",
  );

  return `${safeCreditNoteNumber || "credit-note"}.pdf`;
}

function getChannelIdempotencyKey(
  creditNoteNumber: string,
  channel: "email" | "whatsapp",
) {
  const normalizedNumber = /^CN[1-9]\d*$/.test(creditNoteNumber)
    ? creditNoteNumber
    : creditNoteNumber.replace(/[^A-Za-z0-9_-]/g, "_");

  return `credit-note:${normalizedNumber}:${channel}:v1`;
}

function prepareDeliveryInput(
  input: DeliverCreditNoteInput,
): PreparedCreditNoteDeliveryInput {
  if (!Number.isInteger(input.creditedTotalCents) || input.creditedTotalCents <= 0) {
    throw new Error("Credit-note delivery requires a positive credited total.");
  }

  const reason = input.reason.trim();

  if (!reason) {
    throw new Error("Credit-note delivery requires a reason.");
  }

  return {
    ...input,
    creditedTotal: formatZarCents(input.creditedTotalCents),
    reason: reason.slice(0, 1_000),
    secureDownloadUrl: URL.canParse(input.secureDownloadUrl)
      ? input.secureDownloadUrl
      : new URL(input.secureDownloadUrl, env.APP_URL).toString(),
  };
}

async function deliverPreparedCreditNoteEmail(
  input: PreparedCreditNoteDeliveryInput,
  alreadySent: boolean,
): Promise<CreditNoteDeliveryChannelResult> {
  const idempotencyKey = getChannelIdempotencyKey(
    input.creditNoteNumber,
    "email",
  );

  if (alreadySent) {
    return { idempotencyKey, reason: "already_sent", status: "skipped" };
  }

  const recipientEmail = input.customerEmail?.trim();

  if (!recipientEmail) {
    return { idempotencyKey, reason: "missing_recipient", status: "skipped" };
  }

  try {
    const result = await sendNotificationEmail({
      attachments: [
        {
          content: input.pdfBuffer.toString("base64"),
          disposition: "attachment",
          filename: getCreditNoteFilename(input.creditNoteNumber),
          type: "application/pdf",
        },
      ],
      data: {
        credit_note_download_url: input.secureDownloadUrl,
        credit_note_number: input.creditNoteNumber,
        credit_note_reason: input.reason,
        credit_note_total: input.creditedTotal,
        customer_name: input.customerName,
        invoice_number: input.originalInvoiceNumber,
        order_number: input.orderNumber,
      },
      recipientEmail,
      recipientUserId: input.customerUserId ?? undefined,
      templateKey: CREDIT_NOTE_EMAIL_TEMPLATE_KEY,
    });

    if (result.delivered) {
      return {
        idempotencyKey,
        providerMessageId: result.providerMessageId,
        providerStatus: result.providerStatus,
        status: "sent",
      };
    }

    if (
      result.reason === "not_configured" ||
      result.reason === "template_unavailable"
    ) {
      return { idempotencyKey, reason: result.reason, status: "skipped" };
    }

    const outcomeUnknown =
      "outcomeUnknown" in result && result.outcomeUnknown === true;
    const providerMessageId =
      "providerMessageId" in result ? result.providerMessageId : undefined;
    const providerStatus =
      "providerStatus" in result ? result.providerStatus : undefined;

    if (outcomeUnknown || result.reason === "verification_required") {
      return {
        idempotencyKey,
        outcomeUnknown: true,
        providerMessageId,
        providerStatus,
        reason: result.reason,
        status: "verification_required",
      };
    }

    return {
      idempotencyKey,
      providerMessageId,
      providerStatus,
      reason: result.reason,
      status: "failed",
    };
  } catch (error) {
    return {
      idempotencyKey,
      outcomeUnknown: true,
      reason: getErrorMessage(error),
      status: "verification_required",
    };
  }
}

async function deliverPreparedCreditNoteWhatsapp(
  input: PreparedCreditNoteDeliveryInput,
  {
    alreadySent,
    templateLanguage,
    templateName,
  }: {
    alreadySent: boolean;
    templateLanguage: string;
    templateName: string;
  },
): Promise<CreditNoteDeliveryChannelResult> {
  const idempotencyKey = getChannelIdempotencyKey(
    input.creditNoteNumber,
    "whatsapp",
  );

  if (alreadySent) {
    return { idempotencyKey, reason: "already_sent", status: "skipped" };
  }

  const recipientPhone = input.customerPhone?.trim();

  if (!recipientPhone) {
    return { idempotencyKey, reason: "missing_recipient", status: "skipped" };
  }

  try {
    const result = await send360DialogDocumentTemplateMessage({
      bodyParameters: [
        input.customerName,
        input.orderNumber,
        input.originalInvoiceNumber,
        input.creditNoteNumber,
        input.creditedTotal,
        input.reason,
        input.secureDownloadUrl,
      ],
      document: {
        fileName: getCreditNoteFilename(input.creditNoteNumber),
        url: input.secureDownloadUrl,
      },
      templateLanguage,
      templateName,
      to: recipientPhone,
    });

    if (result.ok) {
      return {
        idempotencyKey,
        providerMessageId: result.providerMessageId,
        providerStatus: result.providerStatus ?? result.status,
        status: "sent",
      };
    }

    if (result.skipped) {
      return {
        idempotencyKey,
        reason:
          result.reason === "invalid_recipient"
            ? "invalid_recipient"
            : "not_configured",
        status: "skipped",
      };
    }

    if (result.outcomeUnknown) {
      return {
        idempotencyKey,
        outcomeUnknown: true,
        providerMessageId: result.providerMessageId,
        providerStatus: result.providerStatus ?? result.status,
        reason: result.reason ?? "send_failed",
        status: "verification_required",
      };
    }

    return {
      idempotencyKey,
      providerMessageId: result.providerMessageId,
      providerStatus: result.providerStatus ?? result.status,
      reason: result.reason ?? "send_failed",
      status: "failed",
    };
  } catch (error) {
    return {
      idempotencyKey,
      outcomeUnknown: true,
      reason: getErrorMessage(error),
      status: "verification_required",
    };
  }
}

/** Deliver the email channel unless persistence says it has already succeeded. */
export async function deliverCreditNoteEmail(
  input: DeliverCreditNoteInput,
  { alreadySent = false }: { alreadySent?: boolean } = {},
): Promise<CreditNoteDeliveryChannelResult> {
  return deliverPreparedCreditNoteEmail(prepareDeliveryInput(input), alreadySent);
}

/** Deliver the approved-template WhatsApp channel unless already successful. */
export async function deliverCreditNoteWhatsapp(
  input: DeliverCreditNoteInput,
  {
    alreadySent = false,
    templateLanguage = env.WHATSAPP_INVOICE_TEMPLATE_LANGUAGE,
    templateName = CREDIT_NOTE_WHATSAPP_TEMPLATE_NAME,
  }: {
    alreadySent?: boolean;
    templateLanguage?: string;
    templateName?: string;
  } = {},
): Promise<CreditNoteDeliveryChannelResult> {
  return deliverPreparedCreditNoteWhatsapp(prepareDeliveryInput(input), {
    alreadySent,
    templateLanguage,
    templateName,
  });
}

/**
 * Delivers a generated credit note through requested customer channels.
 * Callers pass persisted channel outcomes on retries; successful channels then
 * return `already_sent` without making another provider request.
 */
export async function deliverCreditNote(
  input: DeliverCreditNoteInput,
  options: CreditNoteDeliveryOptions = {},
): Promise<CreditNoteDeliveryResult> {
  const preparedInput = prepareDeliveryInput(input);
  const channels = options.channels ?? { email: true, whatsapp: true };
  const [email, whatsapp] = await Promise.all([
    channels.email === false
      ? undefined
      : deliverPreparedCreditNoteEmail(
          preparedInput,
          options.previouslyDelivered?.email === true,
        ),
    channels.whatsapp === false
      ? undefined
      : deliverPreparedCreditNoteWhatsapp(preparedInput, {
          alreadySent: options.previouslyDelivered?.whatsapp === true,
          templateLanguage:
            options.whatsappTemplateLanguage ??
            env.WHATSAPP_INVOICE_TEMPLATE_LANGUAGE,
          templateName:
            options.whatsappTemplateName ?? CREDIT_NOTE_WHATSAPP_TEMPLATE_NAME,
        }),
  ]);

  return { email, whatsapp };
}
