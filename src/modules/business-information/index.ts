import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { auditLogs, businessInformation } from "@/src/db/schema";

export type BusinessInformation = typeof businessInformation.$inferSelect;

const defaultBusinessInformation: BusinessInformation = {
  addressLine1: "",
  addressLine2: null,
  city: "",
  collectionAddressLine1: null,
  collectionAddressLine2: null,
  collectionAddressSameAsRegistered: true,
  collectionCity: null,
  collectionContactName: "",
  collectionContactPhone: "",
  collectionCountryCode: null,
  collectionPostalCode: null,
  collectionProvince: null,
  collectionSuburb: null,
  companyRegistrationNumber: null,
  countryCode: "ZA",
  createdAt: new Date(0),
  id: 1,
  invoiceEmail: "",
  invoicePhone: "",
  legalName: "",
  postalCode: "",
  province: "",
  suburb: null,
  tradingName: "Jurgens Energy",
  updatedAt: new Date(0),
  updatedByUserId: null,
  vatRegistrationNumber: "",
};

export async function getBusinessInformation(): Promise<BusinessInformation> {
  const [row] = await db
    .select()
    .from(businessInformation)
    .where(eq(businessInformation.id, 1))
    .limit(1);

  return row ?? defaultBusinessInformation;
}

export type UpdateBusinessInformationInput = Omit<
  typeof businessInformation.$inferInsert,
  "createdAt" | "id" | "updatedAt" | "updatedByUserId"
>;

export async function updateBusinessInformation(
  input: UpdateBusinessInformationInput,
  actorUserId: string,
) {
  const now = new Date();

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .insert(businessInformation)
      .values({
        ...input,
        id: 1,
        updatedAt: now,
        updatedByUserId: actorUserId,
      })
      .onConflictDoUpdate({
        target: businessInformation.id,
        set: {
          ...input,
          updatedAt: now,
          updatedByUserId: actorUserId,
        },
      })
      .returning();

    await tx.insert(auditLogs).values({
      action: "business_information.updated",
      actorUserId,
      entityType: "business_information",
      metadata: JSON.stringify({
        collectionAddressSameAsRegistered:
          input.collectionAddressSameAsRegistered,
        invoiceEmail: input.invoiceEmail,
        legalName: input.legalName,
        tradingName: input.tradingName,
      }),
    });

    return updated;
  });
}

export function isInvoiceBusinessInformationReady(
  information: BusinessInformation,
) {
  return Boolean(
    information.legalName.trim() &&
      information.tradingName.trim() &&
      information.vatRegistrationNumber.trim() &&
      information.invoiceEmail.trim() &&
      information.invoicePhone.trim() &&
      information.addressLine1.trim() &&
      information.city.trim() &&
      information.province.trim() &&
      information.postalCode.trim() &&
      information.countryCode.trim(),
  );
}

export async function getBusinessCollectionAddress() {
  const information = await getBusinessInformation();
  const same = information.collectionAddressSameAsRegistered;
  const address = {
    addressLine1: same
      ? information.addressLine1.trim()
      : information.collectionAddressLine1?.trim() ?? "",
    addressLine2: same
      ? information.addressLine2?.trim() || null
      : information.collectionAddressLine2?.trim() || null,
    city: same
      ? information.city.trim()
      : information.collectionCity?.trim() ?? "",
    company: information.tradingName.trim() || information.legalName.trim(),
    contactName:
      information.collectionContactName.trim() ||
      information.tradingName.trim() ||
      information.legalName.trim(),
    contactPhone:
      information.collectionContactPhone.trim() ||
      information.invoicePhone.trim(),
    countryCode: (
      same
        ? information.countryCode
        : information.collectionCountryCode || information.countryCode
    )
      .trim()
      .toUpperCase(),
    postalCode: same
      ? information.postalCode.trim()
      : information.collectionPostalCode?.trim() ?? "",
    province: same
      ? information.province.trim()
      : information.collectionProvince?.trim() ?? "",
    suburb: same
      ? information.suburb?.trim() || null
      : information.collectionSuburb?.trim() || null,
  };

  if (
    !address.addressLine1 ||
    !address.city ||
    !address.company ||
    !address.contactName ||
    !address.contactPhone ||
    !address.countryCode ||
    !address.postalCode ||
    !address.province
  ) {
    return null;
  }

  return address;
}
