import { z } from "zod";

import { invoiceDocumentDataSchema } from "@/src/modules/invoices/document-data";

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

const moneyInCentsSchema = z.number().int().nonnegative();

const creditNoteLineSchema = z
  .object({
    description: z.string().trim().min(1).max(500),
    grossAmountCents: moneyInCentsSchema,
    netAmountCents: moneyInCentsSchema,
    optionDescription: z.string().trim().max(300).optional(),
    quantity: z.number().positive().finite(),
    sku: z.string().trim().max(120).optional(),
    unitPriceGrossCents: moneyInCentsSchema,
    vatAmountCents: moneyInCentsSchema,
    vatRateBasisPoints: z.number().int().min(0).max(10_000),
  })
  .superRefine((line, context) => {
    if (line.netAmountCents + line.vatAmountCents !== line.grossAmountCents) {
      context.addIssue({
        code: "custom",
        message: "Credit-note net and VAT amounts must add up to the gross credit.",
        path: ["grossAmountCents"],
      });
    }
  });

export const creditNoteDocumentDataSchema = z
  .object({
    creditNoteNumber: z.string().trim().regex(/^CN[1-9]\d*$/, {
      message:
        "Credit-note numbers must use the sequential format CN1, CN2, and so on.",
    }),
    currency: z.literal("ZAR"),
    customer: invoiceDocumentDataSchema.shape.customer,
    issuedAt: z.iso.datetime({ offset: true }),
    issuer: invoiceDocumentDataSchema.shape.issuer,
    lines: z.array(creditNoteLineSchema).min(1),
    notes: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
    orderNumber: z.string().trim().min(1).max(120),
    originalInvoice: z.object({
      grossAmountCents: moneyInCentsSchema,
      invoiceNumber: z.string().trim().regex(/^INV[1-9]\d*$/),
      issuedAt: z.iso.datetime({ offset: true }),
    }),
    reason: z.string().trim().min(1).max(1_000),
    refund: z
      .object({
        amountCents: moneyInCentsSchema,
        processedAt: z.iso.datetime({ offset: true }),
        provider: z.string().trim().min(1).max(80),
        transactionReference: z.string().trim().min(1).max(200),
      })
      .optional(),
    totals: z.object({
      grossAmountCents: moneyInCentsSchema,
      netAmountCents: moneyInCentsSchema,
      vatAmountCents: moneyInCentsSchema,
    }),
  })
  .superRefine((creditNote, context) => {
    const lineTotals = creditNote.lines.reduce(
      (totals, line) => ({
        gross: totals.gross + line.grossAmountCents,
        net: totals.net + line.netAmountCents,
        vat: totals.vat + line.vatAmountCents,
      }),
      { gross: 0, net: 0, vat: 0 },
    );

    if (lineTotals.net !== creditNote.totals.netAmountCents) {
      context.addIssue({
        code: "custom",
        message: "Credit-note net total must equal the sum of its line net amounts.",
        path: ["totals", "netAmountCents"],
      });
    }

    if (lineTotals.vat !== creditNote.totals.vatAmountCents) {
      context.addIssue({
        code: "custom",
        message: "Credit-note VAT total must equal the sum of its line VAT amounts.",
        path: ["totals", "vatAmountCents"],
      });
    }

    if (lineTotals.gross !== creditNote.totals.grossAmountCents) {
      context.addIssue({
        code: "custom",
        message:
          "Credit-note gross total must equal the sum of its line gross amounts.",
        path: ["totals", "grossAmountCents"],
      });
    }

    if (creditNote.totals.grossAmountCents === 0) {
      context.addIssue({
        code: "custom",
        message: "A credit note must have a positive credited total.",
        path: ["totals", "grossAmountCents"],
      });
    }

    if (
      creditNote.totals.grossAmountCents >
      creditNote.originalInvoice.grossAmountCents
    ) {
      context.addIssue({
        code: "custom",
        message: "A credit note cannot exceed the original invoice total.",
        path: ["totals", "grossAmountCents"],
      });
    }

    if (
      creditNote.refund &&
      creditNote.refund.amountCents !== creditNote.totals.grossAmountCents
    ) {
      context.addIssue({
        code: "custom",
        message: "The recorded refund must equal the credit-note gross total.",
        path: ["refund", "amountCents"],
      });
    }
  });

export type CreditNoteDocumentData = DeepReadonly<
  z.infer<typeof creditNoteDocumentDataSchema>
>;

export function parseCreditNoteDocumentData(
  input: unknown,
): CreditNoteDocumentData {
  return creditNoteDocumentDataSchema.parse(input) as CreditNoteDocumentData;
}
