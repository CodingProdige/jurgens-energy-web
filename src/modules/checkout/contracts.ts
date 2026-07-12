import { z } from "zod";

import { cartLineInputSchema } from "@/src/modules/cart/contracts";
import { normalizePhoneNumber } from "@/src/modules/phone";

export const checkoutCustomerSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(2).max(160),
  phone: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value, context) => {
      const normalized = normalizePhoneNumber(value, { defaultCountryCode: "ZA" });

      if (!normalized) {
        context.addIssue({
          code: "custom",
          message: "Enter a valid South African phone number.",
        });

        return z.NEVER;
      }

      return normalized;
    }),
});

export const checkoutDeliveryAddressSchema = z.object({
  addressLine1: z.string().trim().min(2).max(240),
  addressLine2: z.string().trim().max(240).optional().default(""),
  city: z.string().trim().min(2).max(120),
  countryCode: z.string().trim().length(2).default("ZA"),
  postalCode: z.string().trim().min(2).max(40),
  province: z.string().trim().min(2).max(120),
  suburb: z.string().trim().min(2).max(120),
});

export const checkoutQuoteRequestSchema = z.object({
  deliveryAddress: checkoutDeliveryAddressSchema,
  items: z.array(cartLineInputSchema).min(1).max(100),
});

export const checkoutDeliverySelectionSchema = z.object({
  groupKey: z.string().trim().min(1).max(200),
  quoteId: z.string().uuid(),
});

export const checkoutDeliveryScheduleSchema = z.object({
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliveryInstructions: z.string().trim().max(500).optional().default(""),
  windowEnd: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  windowLabel: z.string().trim().min(2).max(80),
  windowStart: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const createCheckoutOrderRequestSchema = checkoutQuoteRequestSchema.extend({
  customer: checkoutCustomerSchema,
  deliverySelections: z.array(checkoutDeliverySelectionSchema).min(1).max(20),
  jurgensDeliverySchedule: checkoutDeliveryScheduleSchema.optional(),
});

export type CheckoutCustomer = z.infer<typeof checkoutCustomerSchema>;
export type CheckoutDeliveryAddress = z.infer<
  typeof checkoutDeliveryAddressSchema
>;
export type CheckoutQuoteRequest = z.infer<typeof checkoutQuoteRequestSchema>;
export type CreateCheckoutOrderRequest = z.infer<
  typeof createCheckoutOrderRequestSchema
>;
export type CheckoutDeliverySchedule = z.infer<
  typeof checkoutDeliveryScheduleSchema
>;

export type CheckoutDeliveryScheduleOption = {
  date: string;
  dateLabel: string;
  isSameDay: boolean;
  value: string;
  windowEnd: string;
  windowLabel: string;
  windowStart: string;
};

export type CheckoutDeliveryOption = {
  amountZar: number;
  deliveryInformation: string | null;
  label: string;
  provider: "bobgo" | "piessang_local";
  quoteId: string;
  serviceLevel: string | null;
};

export type CheckoutDeliveryGroup = {
  groupKey: string;
  label: string;
  options: CheckoutDeliveryOption[];
  scheduling: {
    options: CheckoutDeliveryScheduleOption[];
    required: boolean;
  } | null;
  sellerId: string | null;
  unavailableReason: string | null;
};

export type CheckoutQuoteResponse = {
  expiresAt: string | null;
  fingerprint: string;
  groups: CheckoutDeliveryGroup[];
};
