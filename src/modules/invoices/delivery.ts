import "server-only";

import { env } from "@/src/config/env";
import { sendNotificationEmail } from "@/src/modules/notifications/templates";
import { send360DialogInvoiceTemplateMessage } from "@/src/modules/whatsapp-ordering/360dialog";

export type InvoiceDeliveryChannelResult =
  | { status: "sent" }
  | {
      reason:
        | "invalid_recipient"
        | "missing_recipient"
        | "not_configured"
        | "template_unavailable";
      status: "skipped";
    }
  | {
      providerStatus?: number;
      reason: string;
      status: "failed";
    };

export type InvoiceDeliveryResult = Readonly<{
  email?: InvoiceDeliveryChannelResult;
  whatsapp?: InvoiceDeliveryChannelResult;
}>;

export type InvoiceDeliveryChannels = Readonly<{
  email?: boolean;
  whatsapp?: boolean;
}>;

export type DeliverInvoiceInput = Readonly<{
  customerEmail?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerUserId?: string | null;
  invoiceNumber: string;
  invoiceTotalCents: number;
  orderNumber: string;
  pdfBuffer: Buffer;
  secureDownloadUrl: string;
}>;

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

function getInvoiceFilename(invoiceNumber: string) {
  const safeInvoiceNumber = invoiceNumber.replace(/[^A-Za-z0-9_-]/g, "_");

  return `${safeInvoiceNumber || "tax-invoice"}.pdf`;
}

function prepareDeliveryInput(input: DeliverInvoiceInput) {
  const invoiceTotal = formatZarCents(input.invoiceTotalCents);
  const secureDownloadUrl = URL.canParse(input.secureDownloadUrl)
    ? input.secureDownloadUrl
    : new URL(input.secureDownloadUrl, env.APP_URL).toString();

  return { ...input, invoiceTotal, secureDownloadUrl };
}

async function deliverPreparedInvoiceEmail({
  customerEmail,
  customerName,
  customerUserId,
  invoiceNumber,
  invoiceTotal,
  orderNumber,
  pdfBuffer,
  secureDownloadUrl,
}: Omit<DeliverInvoiceInput, "customerPhone" | "invoiceTotalCents"> & {
  invoiceTotal: string;
}): Promise<InvoiceDeliveryChannelResult> {
  const recipientEmail = customerEmail?.trim();

  if (!recipientEmail) {
    return { reason: "missing_recipient", status: "skipped" };
  }

  try {
    const result = await sendNotificationEmail({
      attachments: [
        {
          content: pdfBuffer.toString("base64"),
          disposition: "attachment",
          filename: getInvoiceFilename(invoiceNumber),
          type: "application/pdf",
        },
      ],
      data: {
        customer_name: customerName,
        invoice_download_url: secureDownloadUrl,
        invoice_number: invoiceNumber,
        invoice_total: invoiceTotal,
        order_number: orderNumber,
      },
      recipientEmail,
      recipientUserId: customerUserId ?? undefined,
      templateKey: "customer_invoice_issued",
    });

    if (result.delivered) {
      return { status: "sent" };
    }

    if (
      result.reason === "not_configured" ||
      result.reason === "template_unavailable"
    ) {
      return { reason: result.reason, status: "skipped" };
    }

    return { reason: result.reason, status: "failed" };
  } catch (error) {
    return { reason: getErrorMessage(error), status: "failed" };
  }
}

async function deliverPreparedInvoiceWhatsapp({
  customerName,
  customerPhone,
  invoiceNumber,
  invoiceTotal,
  orderNumber,
  secureDownloadUrl,
}: Pick<
  DeliverInvoiceInput,
  | "customerName"
  | "customerPhone"
  | "invoiceNumber"
  | "orderNumber"
  | "secureDownloadUrl"
> & {
  invoiceTotal: string;
}): Promise<InvoiceDeliveryChannelResult> {
  const recipientPhone = customerPhone?.trim();

  if (!recipientPhone) {
    return { reason: "missing_recipient", status: "skipped" };
  }

  try {
    const result = await send360DialogInvoiceTemplateMessage({
      customerName,
      document: {
        fileName: getInvoiceFilename(invoiceNumber),
        url: secureDownloadUrl,
      },
      invoiceNumber,
      invoiceTotal,
      orderNumber,
      secureDownloadUrl,
      to: recipientPhone,
    });

    if (result.ok) {
      return { status: "sent" };
    }

    if (result.skipped) {
      return {
        reason:
          result.reason === "invalid_recipient"
            ? "invalid_recipient"
            : "not_configured",
        status: "skipped",
      };
    }

    return {
      providerStatus: result.status,
      reason: result.reason ?? "send_failed",
      status: "failed",
    };
  } catch (error) {
    return { reason: getErrorMessage(error), status: "failed" };
  }
}

/** Deliver only the email channel for an already-generated invoice. */
export async function deliverInvoiceEmail(
  input: DeliverInvoiceInput,
): Promise<InvoiceDeliveryChannelResult> {
  return deliverPreparedInvoiceEmail(prepareDeliveryInput(input));
}

/** Deliver only the approved-template WhatsApp channel. */
export async function deliverInvoiceWhatsapp(
  input: DeliverInvoiceInput,
): Promise<InvoiceDeliveryChannelResult> {
  return deliverPreparedInvoiceWhatsapp(prepareDeliveryInput(input));
}

/**
 * Delivers an already-generated paid invoice over both customer channels.
 * Channel failures are isolated and returned to the invoice worker; neither a
 * missing integration nor a provider outage invalidates invoice generation.
 */
export async function deliverInvoice(
  input: DeliverInvoiceInput,
  channels: InvoiceDeliveryChannels = { email: true, whatsapp: true },
): Promise<InvoiceDeliveryResult> {
  const preparedInput = prepareDeliveryInput(input);
  const [email, whatsapp] = await Promise.all([
    channels.email === false
      ? undefined
      : deliverPreparedInvoiceEmail(preparedInput),
    channels.whatsapp === false
      ? undefined
      : deliverPreparedInvoiceWhatsapp(preparedInput),
  ]);

  return { email, whatsapp };
}
