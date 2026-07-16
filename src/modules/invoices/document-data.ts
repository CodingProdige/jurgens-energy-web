import { z } from "zod";

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

const moneyInCentsSchema = z.number().int().nonnegative();

const postalAddressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  suburb: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1).max(120),
  province: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(20),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  countryName: z.string().trim().min(1).max(120),
});

const invoiceLineSchema = z
  .object({
    kind: z.enum(["product", "shipping", "adjustment"]),
    description: z.string().trim().min(1).max(500),
    sku: z.string().trim().max(120).optional(),
    optionDescription: z.string().trim().max(300).optional(),
    quantity: z.number().int().positive(),
    unitPriceGrossCents: moneyInCentsSchema,
    discountGrossCents: moneyInCentsSchema.default(0),
    vatRateBasisPoints: z.number().int().min(0).max(10_000),
    netAmountCents: moneyInCentsSchema,
    vatAmountCents: moneyInCentsSchema,
    grossAmountCents: moneyInCentsSchema,
  })
  .superRefine((line, context) => {
    const expectedGross =
      line.unitPriceGrossCents * line.quantity - line.discountGrossCents;

    if (expectedGross < 0 || expectedGross !== line.grossAmountCents) {
      context.addIssue({
        code: "custom",
        message:
          "Line gross amount must equal quantity multiplied by the VAT-inclusive unit price, less the discount.",
        path: ["grossAmountCents"],
      });
    }

    if (line.netAmountCents + line.vatAmountCents !== line.grossAmountCents) {
      context.addIssue({
        code: "custom",
        message: "Line net and VAT amounts must add up to the gross amount.",
        path: ["grossAmountCents"],
      });
    }
  });

export const invoiceDocumentDataSchema = z
  .object({
    invoiceNumber: z.string().trim().regex(/^INV[1-9]\d*$/, {
      message: "Invoice numbers must use the sequential format INV1, INV2, and so on.",
    }),
    issuedAt: z.iso.datetime({ offset: true }),
    supplyDate: z.iso.date(),
    currency: z.literal("ZAR"),
    orderNumber: z.string().trim().min(1).max(120),
    purchaseOrderReference: z.string().trim().max(120).optional(),
    issuer: z.object({
      legalName: z.string().trim().min(1).max(200),
      tradingName: z.string().trim().min(1).max(200),
      registrationNumber: z.string().trim().min(1).max(120).optional(),
      vatNumber: z.string().trim().min(1).max(120),
      address: postalAddressSchema,
      email: z.email().optional(),
      phone: z.string().trim().max(80).optional(),
      website: z.url().optional(),
    }),
    customer: z.object({
      name: z.string().trim().min(1).max(200),
      companyName: z.string().trim().max(200).optional(),
      vatNumber: z.string().trim().max(120).optional(),
      email: z.email().optional(),
      phone: z.string().trim().max(80).optional(),
      billingAddress: postalAddressSchema,
      deliveryAddress: postalAddressSchema.optional(),
    }),
    payment: z.object({
      provider: z.string().trim().min(1).max(80),
      transactionReference: z.string().trim().min(1).max(200),
      paidAt: z.iso.datetime({ offset: true }),
      amountPaidCents: moneyInCentsSchema,
    }),
    lines: z.array(invoiceLineSchema).min(1),
    totals: z.object({
      netAmountCents: moneyInCentsSchema,
      vatAmountCents: moneyInCentsSchema,
      grossAmountCents: moneyInCentsSchema,
    }),
    notes: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  })
  .superRefine((invoice, context) => {
    const lineTotals = invoice.lines.reduce(
      (totals, line) => ({
        net: totals.net + line.netAmountCents,
        vat: totals.vat + line.vatAmountCents,
        gross: totals.gross + line.grossAmountCents,
      }),
      { net: 0, vat: 0, gross: 0 },
    );

    if (lineTotals.net !== invoice.totals.netAmountCents) {
      context.addIssue({
        code: "custom",
        message: "Invoice net total must equal the sum of its line net amounts.",
        path: ["totals", "netAmountCents"],
      });
    }

    if (lineTotals.vat !== invoice.totals.vatAmountCents) {
      context.addIssue({
        code: "custom",
        message: "Invoice VAT total must equal the sum of its line VAT amounts.",
        path: ["totals", "vatAmountCents"],
      });
    }

    if (lineTotals.gross !== invoice.totals.grossAmountCents) {
      context.addIssue({
        code: "custom",
        message: "Invoice gross total must equal the sum of its line gross amounts.",
        path: ["totals", "grossAmountCents"],
      });
    }

    if (invoice.payment.amountPaidCents !== invoice.totals.grossAmountCents) {
      context.addIssue({
        code: "custom",
        message: "A paid invoice must record the full gross total as paid.",
        path: ["payment", "amountPaidCents"],
      });
    }
  });

export type InvoiceDocumentData = DeepReadonly<
  z.infer<typeof invoiceDocumentDataSchema>
>;

export function parseInvoiceDocumentData(input: unknown): InvoiceDocumentData {
  return invoiceDocumentDataSchema.parse(input) as InvoiceDocumentData;
}
