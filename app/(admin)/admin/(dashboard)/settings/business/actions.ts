"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { updateBusinessInformation } from "@/src/modules/business-information";
import {
  isPhoneCountryCode,
  normalizePhoneNumber,
} from "@/src/modules/phone";

export type BusinessInformationState = {
  message?: string;
  ok?: boolean;
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const businessInformationSchema = z
  .object({
    addressLine1: z.string().trim().min(2).max(240),
    addressLine2: optionalText(240),
    city: z.string().trim().min(2).max(120),
    collectionAddressLine1: optionalText(240),
    collectionAddressLine2: optionalText(240),
    collectionAddressSameAsRegistered: z.boolean(),
    collectionCity: optionalText(120),
    collectionContactName: z.string().trim().min(2).max(160),
    collectionContactPhone: z.string().trim().min(8).max(40),
    collectionCountryCode: optionalText(2),
    collectionPostalCode: optionalText(40),
    collectionProvince: optionalText(120),
    collectionSuburb: optionalText(120),
    companyRegistrationNumber: optionalText(80),
    countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
    invoiceEmail: z.string().trim().email().max(254),
    invoicePhone: z.string().trim().min(8).max(40),
    legalName: z.string().trim().min(2).max(200),
    postalCode: z.string().trim().min(2).max(40),
    province: z.string().trim().min(2).max(120),
    suburb: optionalText(120),
    tradingName: z.string().trim().min(2).max(200),
    vatRegistrationNumber: z
      .string()
      .trim()
      .transform((value) => value.replace(/\s+/g, ""))
      .refine((value) => /^\d{10}$/.test(value), "Enter a 10-digit VAT number."),
  })
  .superRefine((value, context) => {
    if (value.collectionAddressSameAsRegistered) {
      return;
    }

    const requiredCollectionFields = [
      ["collectionAddressLine1", value.collectionAddressLine1],
      ["collectionCity", value.collectionCity],
      ["collectionProvince", value.collectionProvince],
      ["collectionPostalCode", value.collectionPostalCode],
      ["collectionCountryCode", value.collectionCountryCode],
    ] as const;

    for (const [field, fieldValue] of requiredCollectionFields) {
      if (!fieldValue) {
        context.addIssue({
          code: "custom",
          message: "Complete the separate courier collection address.",
          path: [field],
        });
      }
    }
  });

function normalizedPhoneFromForm(formData: FormData, name: string) {
  const countryCodeValue = String(formData.get(`${name}CountryCode`) ?? "ZA");
  const countryCode = isPhoneCountryCode(countryCodeValue)
    ? countryCodeValue
    : "ZA";

  return (
    normalizePhoneNumber(String(formData.get(name) ?? ""), {
      defaultCountryCode: countryCode,
    }) ?? ""
  );
}

export async function saveBusinessInformation(
  _state: BusinessInformationState,
  formData: FormData,
): Promise<BusinessInformationState> {
  const access = await requireAdminCapability("admin.settings.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to manage business information.");
  }

  const collectionAddressSameAsRegistered =
    formData.get("collectionAddressSameAsRegistered") === "on";
  const parsed = businessInformationSchema.safeParse({
    addressLine1: String(formData.get("addressLine1") ?? ""),
    addressLine2: String(formData.get("addressLine2") ?? ""),
    city: String(formData.get("city") ?? ""),
    collectionAddressLine1: String(
      formData.get("collectionAddressLine1") ?? "",
    ),
    collectionAddressLine2: String(
      formData.get("collectionAddressLine2") ?? "",
    ),
    collectionAddressSameAsRegistered,
    collectionCity: String(formData.get("collectionCity") ?? ""),
    collectionContactName: String(
      formData.get("collectionContactName") ?? "",
    ),
    collectionContactPhone: normalizedPhoneFromForm(
      formData,
      "collectionContactPhone",
    ),
    collectionCountryCode: String(
      formData.get("collectionCountryCode") ?? "ZA",
    ),
    collectionPostalCode: String(
      formData.get("collectionPostalCode") ?? "",
    ),
    collectionProvince: String(formData.get("collectionProvince") ?? ""),
    collectionSuburb: String(formData.get("collectionSuburb") ?? ""),
    companyRegistrationNumber: String(
      formData.get("companyRegistrationNumber") ?? "",
    ),
    countryCode: String(formData.get("countryCode") ?? "ZA"),
    invoiceEmail: String(formData.get("invoiceEmail") ?? ""),
    invoicePhone: normalizedPhoneFromForm(formData, "invoicePhone"),
    legalName: String(formData.get("legalName") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    province: String(formData.get("province") ?? ""),
    suburb: String(formData.get("suburb") ?? ""),
    tradingName: String(formData.get("tradingName") ?? ""),
    vatRegistrationNumber: String(
      formData.get("vatRegistrationNumber") ?? "",
    ),
  });

  if (!parsed.success) {
    return {
      message:
        parsed.error.issues[0]?.message ??
        "Review the business information and try again.",
      ok: false,
    };
  }

  await updateBusinessInformation(parsed.data, access.session.user.id);
  revalidatePath("/settings/business");
  revalidatePath("/settings/platform");
  revalidatePath("/checkout");

  return {
    message:
      "Business, VAT, invoice, and courier collection information saved.",
    ok: true,
  };
}
