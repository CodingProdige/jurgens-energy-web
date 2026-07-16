export const SOUTH_AFRICAN_ADDRESS_COUNTRY_CODE = "ZA";

export const SOUTH_AFRICAN_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
] as const;

export type SouthAfricanProvince =
  (typeof SOUTH_AFRICAN_PROVINCES)[number];

export function isSouthAfricanProvince(
  value: string,
): value is SouthAfricanProvince {
  return SOUTH_AFRICAN_PROVINCES.some((province) => province === value);
}
