const e164Pattern = /^\+[1-9]\d{6,14}$/;

export type PhoneCountryCode = "ZA";

type PhoneCountryRule = {
  callingCode: string;
  nationalMax: number;
  nationalMin: number;
};

const countryRules: Record<PhoneCountryCode, PhoneCountryRule> = {
  ZA: {
    callingCode: "27",
    nationalMax: 9,
    nationalMin: 9,
  },
};

export function normalizePhoneNumber(
  value: string,
  options: { defaultCountryCode?: PhoneCountryCode } = {},
) {
  const defaultCountryCode = options.defaultCountryCode ?? "ZA";
  const countryRule = countryRules[defaultCountryCode];
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    const digits = trimmed.replace(/^00/, "").replace(/\D/g, "");

    if (digits.startsWith(countryRule.callingCode)) {
      const nationalNumber = digits
        .slice(countryRule.callingCode.length)
        .replace(/^0+/, "");
      const normalized = `+${countryRule.callingCode}${nationalNumber}`;

      return isValidNationalNumber(nationalNumber, countryRule) &&
        e164Pattern.test(normalized)
        ? normalized
        : null;
    }

    const normalized = `+${digits}`;

    return e164Pattern.test(normalized) ? normalized : null;
  }

  let nationalNumber = trimmed.replace(/\D/g, "");

  if (nationalNumber.startsWith(countryRule.callingCode)) {
    nationalNumber = nationalNumber.slice(countryRule.callingCode.length);
  }

  nationalNumber = nationalNumber.replace(/^0+/, "");

  if (!isValidNationalNumber(nationalNumber, countryRule)) {
    return null;
  }

  return `+${countryRule.callingCode}${nationalNumber}`;
}

export function requireNormalizedPhoneNumber(
  value: string,
  options: { defaultCountryCode?: PhoneCountryCode; message?: string } = {},
) {
  const normalized = normalizePhoneNumber(value, {
    defaultCountryCode: options.defaultCountryCode,
  });

  if (!normalized) {
    throw new Error(options.message ?? "Enter a valid phone number.");
  }

  return normalized;
}

function isValidNationalNumber(value: string, rule: PhoneCountryRule) {
  return (
    /^\d+$/.test(value) &&
    value.length >= rule.nationalMin &&
    value.length <= rule.nationalMax
  );
}
