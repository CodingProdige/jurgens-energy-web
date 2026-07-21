import type { BusinessInformation } from "@/src/modules/business-information";
import type { MarketplaceSettings } from "@/src/modules/marketplace/settings";
import { formatRegisteredBusinessAddress } from "../business-information/address-formatting.ts";
import { normalizePhoneNumber } from "../phone/index.ts";

type CustomerSupportBusinessInformation = Pick<
  BusinessInformation,
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "companyRegistrationNumber"
  | "countryCode"
  | "invoiceEmail"
  | "invoicePhone"
  | "legalName"
  | "postalCode"
  | "province"
  | "suburb"
  | "tradingName"
  | "vatRegistrationNumber"
>;

type CustomerSupportMarketplaceSettings = Pick<
  MarketplaceSettings,
  | "contactEmail"
  | "contactPhonePrimary"
  | "contactPhoneSecondary"
  | "whatsappBusinessPhoneNumber"
>;

export type CustomerSupportContactDetails = {
  businessAddress: string | null;
  businessName: string;
  companyRegistrationNumber: string | null;
  email: string | null;
  legalName: string | null;
  phoneNumbers: string[];
  vatRegistrationNumber: string | null;
  whatsappPhone: string | null;
};

function cleanOptionalValue(value: string | null | undefined) {
  return value?.trim() || null;
}

function uniqueValues(values: (string | null | undefined)[]) {
  const seenValues = new Set<string>();

  return values.flatMap((value) => {
    const cleanedValue = cleanOptionalValue(value);

    if (!cleanedValue) {
      return [];
    }

    const comparableValue = cleanedValue.toLocaleLowerCase("en-ZA");

    if (seenValues.has(comparableValue)) {
      return [];
    }

    seenValues.add(comparableValue);
    return [cleanedValue];
  });
}

export function formatCustomerSupportBusinessAddress(
  business: CustomerSupportBusinessInformation,
) {
  return formatRegisteredBusinessAddress(business);
}

export function createCustomerSupportContactDetails({
  business,
  settings,
}: {
  business: CustomerSupportBusinessInformation;
  settings: CustomerSupportMarketplaceSettings;
}): CustomerSupportContactDetails {
  const configuredPhoneNumbers = uniqueValues([
    settings.contactPhonePrimary,
    settings.contactPhoneSecondary,
  ]);
  const configuredWhatsappPhone = cleanOptionalValue(
    settings.whatsappBusinessPhoneNumber,
  );

  return {
    businessAddress: formatCustomerSupportBusinessAddress(business),
    businessName:
      cleanOptionalValue(business.tradingName) ??
      cleanOptionalValue(business.legalName) ??
      "Jurgens Energy",
    companyRegistrationNumber: cleanOptionalValue(
      business.companyRegistrationNumber,
    ),
    email:
      cleanOptionalValue(settings.contactEmail) ??
      cleanOptionalValue(business.invoiceEmail),
    legalName: cleanOptionalValue(business.legalName),
    phoneNumbers:
      configuredPhoneNumbers.length > 0
        ? configuredPhoneNumbers
        : uniqueValues([business.invoicePhone]),
    vatRegistrationNumber: cleanOptionalValue(business.vatRegistrationNumber),
    whatsappPhone: configuredWhatsappPhone
      ? normalizePhoneNumber(configuredWhatsappPhone, {
          defaultCountryCode: "ZA",
        })
      : null,
  };
}

export function formatCustomerSupportChannels(
  details: CustomerSupportContactDetails,
) {
  const whatsappDigits = details.whatsappPhone?.replace(/\D/g, "") ?? "";

  return [
    details.email ? `email ${details.email}` : null,
    details.phoneNumbers.length > 0
      ? `call ${details.phoneNumbers.join(" or ")}`
      : null,
    details.whatsappPhone &&
    !details.phoneNumbers.some(
      (phoneNumber) =>
        phoneNumber.replace(/\D/g, "") === whatsappDigits,
    )
      ? `WhatsApp ${details.whatsappPhone}`
      : null,
  ].filter((value): value is string => Boolean(value));
}

export function formatCustomerSupportContactSentence(
  details: CustomerSupportContactDetails,
) {
  const channels = formatCustomerSupportChannels(details);

  return channels.length > 0
    ? `Contact ${details.businessName}: ${channels.join("; ")}.`
    : null;
}
