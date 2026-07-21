export type RegisteredBusinessAddressInput = {
  addressLine1: string | null | undefined;
  addressLine2: string | null | undefined;
  city: string | null | undefined;
  countryCode: string | null | undefined;
  postalCode: string | null | undefined;
  province: string | null | undefined;
  suburb: string | null | undefined;
};

export function formatRegisteredBusinessAddress(
  address: RegisteredBusinessAddressInput | null | undefined,
) {
  const addressLine1 = address?.addressLine1?.trim() || "";
  const city = address?.city?.trim() || "";
  const countryCode = address?.countryCode?.trim().toUpperCase() || "";
  const postalCode = address?.postalCode?.trim() || "";
  const province = address?.province?.trim() || "";

  if (!addressLine1 || !city || !countryCode || !postalCode || !province) {
    return null;
  }

  const seenParts = new Set<string>();

  return [
    addressLine1,
    address?.addressLine2,
    address?.suburb,
    city,
    province,
    postalCode,
    countryCode === "ZA" ? "South Africa" : countryCode,
  ]
    .filter((part): part is string => {
      const cleanedPart = part?.trim();

      if (!cleanedPart) {
        return false;
      }

      const normalizedPart = cleanedPart.toLocaleLowerCase("en-ZA");

      if (seenParts.has(normalizedPart)) {
        return false;
      }

      seenParts.add(normalizedPart);
      return true;
    })
    .map((part) => part.trim())
    .join(", ");
}
