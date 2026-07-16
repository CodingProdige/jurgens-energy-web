import { z } from "zod";

import { cartLineInputSchema } from "@/src/modules/cart/contracts";
import { normalizePhoneNumber } from "@/src/modules/phone";
import { POLICY_EFFECTIVE_DATE_ISO } from "@/src/modules/marketplace/policies/constants";

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
          message: "Enter a valid phone number.",
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
  suburb: z.string().trim().max(120).optional().default(""),
});

export const checkoutBillingDetailsSchema = z
  .object({
    address: checkoutDeliveryAddressSchema.optional(),
    businessName: z.string().trim().max(200).optional().default(""),
    name: z.string().trim().min(2).max(160),
    sameAsDelivery: z.boolean().default(true),
    vatRegistrationNumber: z
      .string()
      .trim()
      .max(80)
      .optional()
      .default("")
      .transform((value) => value.replace(/\s+/g, ""))
      .refine(
        (value) => !value || /^\d{10}$/.test(value),
        "Enter a valid 10-digit South African VAT number.",
      ),
  })
  .superRefine((billing, context) => {
    if (!billing.sameAsDelivery && !billing.address) {
      context.addIssue({
        code: "custom",
        message: "Enter the billing address.",
        path: ["address"],
      });
    }
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
});

const checkoutAddressBookLabelSchema = z.string().trim().min(1).max(80);

export const checkoutAddressBookIntentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("none"),
  }),
  z.object({
    addressId: z.string().uuid(),
    kind: z.literal("use_saved"),
  }),
  z.object({
    isDefault: z.boolean(),
    kind: z.literal("save_new"),
    label: checkoutAddressBookLabelSchema,
  }),
  z.object({
    addressId: z.string().uuid(),
    isDefault: z.boolean(),
    kind: z.literal("update_existing"),
    label: checkoutAddressBookLabelSchema,
  }),
]);

export const createCheckoutOrderRequestSchema = checkoutQuoteRequestSchema.extend({
  addressBookIntent: checkoutAddressBookIntentSchema.default({ kind: "none" }),
  billingDetails: checkoutBillingDetailsSchema.optional(),
  customer: checkoutCustomerSchema,
  deliverySelections: z.array(checkoutDeliverySelectionSchema).min(1).max(20),
  jurgensDeliverySchedule: checkoutDeliveryScheduleSchema.optional(),
  policyAcceptance: z.object({
    accepted: z.literal(true),
    version: z.literal(POLICY_EFFECTIVE_DATE_ISO),
  }),
});

export type CheckoutCustomer = z.infer<typeof checkoutCustomerSchema>;
export type CheckoutBillingDetails = z.infer<
  typeof checkoutBillingDetailsSchema
>;
export type CheckoutAddressBookIntent = z.infer<
  typeof checkoutAddressBookIntentSchema
>;
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

export type CheckoutAddressPrefill = CheckoutDeliveryAddress & {
  recipientName: string;
  recipientPhone: string;
};

export type CheckoutSavedAddress = CheckoutAddressPrefill & {
  id: string;
  isDefault: boolean;
  label: string;
};

export type CheckoutDeliveryScheduleOption = {
  date: string;
  dateLabel: string;
  isSameDay: boolean;
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
    cutoffTime: string;
    cutoffTimeZone: "Africa/Johannesburg";
    nextPolicyChangeAt: string | null;
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
