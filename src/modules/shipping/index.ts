import { z } from "zod";

export type ProductFulfillmentMode = z.infer<typeof fulfillmentModeSchema>;

export type ShippingParcel = z.infer<typeof shippingParcelSchema>;

export const shippingParcelSchema = z.object({
  heightMm: z.coerce
    .number()
    .int("Height must be a whole number of millimetres.")
    .positive("Height is required for shipping rates."),
  isFragile: z.coerce.boolean().default(false),
  lengthMm: z.coerce
    .number()
    .int("Length must be a whole number of millimetres.")
    .positive("Length is required for shipping rates."),
  shipsAlone: z.coerce.boolean().default(false),
  weightGrams: z.coerce
    .number()
    .int("Weight must be a whole number of grams.")
    .positive("Weight is required for shipping rates."),
  widthMm: z.coerce
    .number()
    .int("Width must be a whole number of millimetres.")
    .positive("Width is required for shipping rates."),
});

export const fulfillmentModeSchema = z.enum([
  "seller_fulfilled",
  "piessang_fulfilled",
]);

export const shippingMoneySettingsSchema = z.object({
  bufferBps: z.coerce
    .number()
    .int()
    .min(0, "Shipping buffer cannot be negative.")
    .max(10000, "Shipping buffer cannot exceed 100%."),
  marginBps: z.coerce
    .number()
    .int()
    .min(0, "Shipping margin cannot be negative.")
    .max(10000, "Shipping margin cannot exceed 100%."),
});

export const fulfillmentProfileSchema = z.object({
  addressLine1: z.string().trim().min(1, "Collection street address is required."),
  addressLine2: z.string().trim().optional(),
  addressType: z.enum(["business", "residential"]).default("business"),
  city: z.string().trim().min(1, "Collection city is required."),
  collectionInstructions: z.string().trim().optional(),
  contactEmail: z.string().trim().email("A valid collection email is required."),
  contactName: z.string().trim().min(1, "Collection contact name is required."),
  contactPhone: z.string().trim().min(1, "Collection phone number is required."),
  countryCode: z
    .string()
    .trim()
    .length(2, "Country code must be a two-letter ISO code.")
    .default("ZA"),
  postalCode: z.string().trim().min(1, "Collection postal code is required."),
  province: z.string().trim().min(1, "Collection province is required."),
  suburb: z.string().trim().min(1, "Collection suburb is required."),
});

export function getMissingParcelFields(
  parcel: Partial<Record<keyof ShippingParcel, number | boolean | null | undefined>>,
) {
  const missingFields: Array<keyof Pick<
    ShippingParcel,
    "heightMm" | "lengthMm" | "weightGrams" | "widthMm"
  >> = [];

  if (!Number.isInteger(parcel.weightGrams) || Number(parcel.weightGrams) <= 0) {
    missingFields.push("weightGrams");
  }

  if (!Number.isInteger(parcel.lengthMm) || Number(parcel.lengthMm) <= 0) {
    missingFields.push("lengthMm");
  }

  if (!Number.isInteger(parcel.widthMm) || Number(parcel.widthMm) <= 0) {
    missingFields.push("widthMm");
  }

  if (!Number.isInteger(parcel.heightMm) || Number(parcel.heightMm) <= 0) {
    missingFields.push("heightMm");
  }

  return missingFields;
}

export function isShippingParcelComplete(
  parcel: Partial<Record<keyof ShippingParcel, number | boolean | null | undefined>>,
) {
  return getMissingParcelFields(parcel).length === 0;
}

export function assertShippingParcelComplete(
  parcel: Partial<Record<keyof ShippingParcel, number | boolean | null | undefined>>,
) {
  const missingFields = getMissingParcelFields(parcel);

  if (missingFields.length > 0) {
    throw new Error(
      `Product variant is missing required shipping fields: ${missingFields.join(", ")}.`,
    );
  }
}

export function calculateVolumetricWeightGrams(parcel: Pick<
  ShippingParcel,
  "heightMm" | "lengthMm" | "widthMm"
>) {
  const lengthCm = parcel.lengthMm / 10;
  const widthCm = parcel.widthMm / 10;
  const heightCm = parcel.heightMm / 10;

  return Math.ceil((lengthCm * widthCm * heightCm) / 5);
}

export function calculateChargeableWeightGrams(
  parcel: Pick<
    ShippingParcel,
    "heightMm" | "lengthMm" | "weightGrams" | "widthMm"
  >,
) {
  return Math.max(parcel.weightGrams, calculateVolumetricWeightGrams(parcel));
}
