const e164Pattern = /^\+[1-9]\d{6,14}$/;

type PhoneCountryOptionConfig = {
  callingCode: string;
  code: string;
  name: string;
  nationalMax?: number;
  nationalMin?: number;
};

export const phoneCountryOptions = [
  { code: "ZA", name: "South Africa", callingCode: "27", nationalMin: 9, nationalMax: 9 },
  { code: "NA", name: "Namibia", callingCode: "264" },
  { code: "BW", name: "Botswana", callingCode: "267" },
  { code: "ZM", name: "Zambia", callingCode: "260" },
  { code: "ZW", name: "Zimbabwe", callingCode: "263" },
  { code: "MZ", name: "Mozambique", callingCode: "258" },
  { code: "LS", name: "Lesotho", callingCode: "266" },
  { code: "SZ", name: "Eswatini", callingCode: "268" },
  { code: "AO", name: "Angola", callingCode: "244" },
  { code: "MW", name: "Malawi", callingCode: "265" },
  { code: "US", name: "United States", callingCode: "1" },
  { code: "CA", name: "Canada", callingCode: "1" },
  { code: "GB", name: "United Kingdom", callingCode: "44" },
  { code: "IE", name: "Ireland", callingCode: "353" },
  { code: "AU", name: "Australia", callingCode: "61" },
  { code: "NZ", name: "New Zealand", callingCode: "64" },
  { code: "AF", name: "Afghanistan", callingCode: "93" },
  { code: "AL", name: "Albania", callingCode: "355" },
  { code: "DZ", name: "Algeria", callingCode: "213" },
  { code: "AD", name: "Andorra", callingCode: "376" },
  { code: "AI", name: "Anguilla", callingCode: "1" },
  { code: "AG", name: "Antigua and Barbuda", callingCode: "1" },
  { code: "AR", name: "Argentina", callingCode: "54" },
  { code: "AM", name: "Armenia", callingCode: "374" },
  { code: "AS", name: "American Samoa", callingCode: "1" },
  { code: "AW", name: "Aruba", callingCode: "297" },
  { code: "AT", name: "Austria", callingCode: "43" },
  { code: "AZ", name: "Azerbaijan", callingCode: "994" },
  { code: "BS", name: "Bahamas", callingCode: "1" },
  { code: "BH", name: "Bahrain", callingCode: "973" },
  { code: "BD", name: "Bangladesh", callingCode: "880" },
  { code: "BB", name: "Barbados", callingCode: "1" },
  { code: "BY", name: "Belarus", callingCode: "375" },
  { code: "BE", name: "Belgium", callingCode: "32" },
  { code: "BZ", name: "Belize", callingCode: "501" },
  { code: "BJ", name: "Benin", callingCode: "229" },
  { code: "BM", name: "Bermuda", callingCode: "1" },
  { code: "BT", name: "Bhutan", callingCode: "975" },
  { code: "BO", name: "Bolivia", callingCode: "591" },
  { code: "BQ", name: "Caribbean Netherlands", callingCode: "599" },
  { code: "BA", name: "Bosnia and Herzegovina", callingCode: "387" },
  { code: "BR", name: "Brazil", callingCode: "55" },
  { code: "IO", name: "British Indian Ocean Territory", callingCode: "246" },
  { code: "VG", name: "British Virgin Islands", callingCode: "1" },
  { code: "BN", name: "Brunei", callingCode: "673" },
  { code: "BG", name: "Bulgaria", callingCode: "359" },
  { code: "BF", name: "Burkina Faso", callingCode: "226" },
  { code: "BI", name: "Burundi", callingCode: "257" },
  { code: "KH", name: "Cambodia", callingCode: "855" },
  { code: "CM", name: "Cameroon", callingCode: "237" },
  { code: "CV", name: "Cape Verde", callingCode: "238" },
  { code: "KY", name: "Cayman Islands", callingCode: "1" },
  { code: "CF", name: "Central African Republic", callingCode: "236" },
  { code: "TD", name: "Chad", callingCode: "235" },
  { code: "CL", name: "Chile", callingCode: "56" },
  { code: "CN", name: "China", callingCode: "86" },
  { code: "CO", name: "Colombia", callingCode: "57" },
  { code: "KM", name: "Comoros", callingCode: "269" },
  { code: "CK", name: "Cook Islands", callingCode: "682" },
  { code: "CG", name: "Congo", callingCode: "242" },
  { code: "CD", name: "Congo DR", callingCode: "243" },
  { code: "CR", name: "Costa Rica", callingCode: "506" },
  { code: "CI", name: "Cote d'Ivoire", callingCode: "225" },
  { code: "HR", name: "Croatia", callingCode: "385" },
  { code: "CU", name: "Cuba", callingCode: "53" },
  { code: "CW", name: "Curacao", callingCode: "599" },
  { code: "CY", name: "Cyprus", callingCode: "357" },
  { code: "CZ", name: "Czechia", callingCode: "420" },
  { code: "DK", name: "Denmark", callingCode: "45" },
  { code: "DJ", name: "Djibouti", callingCode: "253" },
  { code: "DM", name: "Dominica", callingCode: "1" },
  { code: "DO", name: "Dominican Republic", callingCode: "1" },
  { code: "EC", name: "Ecuador", callingCode: "593" },
  { code: "EG", name: "Egypt", callingCode: "20" },
  { code: "SV", name: "El Salvador", callingCode: "503" },
  { code: "GQ", name: "Equatorial Guinea", callingCode: "240" },
  { code: "ER", name: "Eritrea", callingCode: "291" },
  { code: "EE", name: "Estonia", callingCode: "372" },
  { code: "ET", name: "Ethiopia", callingCode: "251" },
  { code: "FK", name: "Falkland Islands", callingCode: "500" },
  { code: "FO", name: "Faroe Islands", callingCode: "298" },
  { code: "FJ", name: "Fiji", callingCode: "679" },
  { code: "FI", name: "Finland", callingCode: "358" },
  { code: "FR", name: "France", callingCode: "33" },
  { code: "GF", name: "French Guiana", callingCode: "594" },
  { code: "PF", name: "French Polynesia", callingCode: "689" },
  { code: "GA", name: "Gabon", callingCode: "241" },
  { code: "GM", name: "Gambia", callingCode: "220" },
  { code: "GE", name: "Georgia", callingCode: "995" },
  { code: "DE", name: "Germany", callingCode: "49" },
  { code: "GH", name: "Ghana", callingCode: "233" },
  { code: "GI", name: "Gibraltar", callingCode: "350" },
  { code: "GR", name: "Greece", callingCode: "30" },
  { code: "GL", name: "Greenland", callingCode: "299" },
  { code: "GD", name: "Grenada", callingCode: "1" },
  { code: "GP", name: "Guadeloupe", callingCode: "590" },
  { code: "GU", name: "Guam", callingCode: "1" },
  { code: "GT", name: "Guatemala", callingCode: "502" },
  { code: "GG", name: "Guernsey", callingCode: "44" },
  { code: "GN", name: "Guinea", callingCode: "224" },
  { code: "GW", name: "Guinea-Bissau", callingCode: "245" },
  { code: "GY", name: "Guyana", callingCode: "592" },
  { code: "HT", name: "Haiti", callingCode: "509" },
  { code: "HN", name: "Honduras", callingCode: "504" },
  { code: "HK", name: "Hong Kong", callingCode: "852" },
  { code: "HU", name: "Hungary", callingCode: "36" },
  { code: "IS", name: "Iceland", callingCode: "354" },
  { code: "IN", name: "India", callingCode: "91" },
  { code: "ID", name: "Indonesia", callingCode: "62" },
  { code: "IM", name: "Isle of Man", callingCode: "44" },
  { code: "IR", name: "Iran", callingCode: "98" },
  { code: "IQ", name: "Iraq", callingCode: "964" },
  { code: "IL", name: "Israel", callingCode: "972" },
  { code: "IT", name: "Italy", callingCode: "39" },
  { code: "JM", name: "Jamaica", callingCode: "1" },
  { code: "JP", name: "Japan", callingCode: "81" },
  { code: "JE", name: "Jersey", callingCode: "44" },
  { code: "JO", name: "Jordan", callingCode: "962" },
  { code: "KZ", name: "Kazakhstan", callingCode: "7" },
  { code: "KE", name: "Kenya", callingCode: "254" },
  { code: "KI", name: "Kiribati", callingCode: "686" },
  { code: "KP", name: "North Korea", callingCode: "850" },
  { code: "XK", name: "Kosovo", callingCode: "383" },
  { code: "KW", name: "Kuwait", callingCode: "965" },
  { code: "KG", name: "Kyrgyzstan", callingCode: "996" },
  { code: "LA", name: "Laos", callingCode: "856" },
  { code: "LV", name: "Latvia", callingCode: "371" },
  { code: "LB", name: "Lebanon", callingCode: "961" },
  { code: "LR", name: "Liberia", callingCode: "231" },
  { code: "LY", name: "Libya", callingCode: "218" },
  { code: "LI", name: "Liechtenstein", callingCode: "423" },
  { code: "LT", name: "Lithuania", callingCode: "370" },
  { code: "LU", name: "Luxembourg", callingCode: "352" },
  { code: "MO", name: "Macao", callingCode: "853" },
  { code: "MG", name: "Madagascar", callingCode: "261" },
  { code: "MH", name: "Marshall Islands", callingCode: "692" },
  { code: "MY", name: "Malaysia", callingCode: "60" },
  { code: "MV", name: "Maldives", callingCode: "960" },
  { code: "ML", name: "Mali", callingCode: "223" },
  { code: "MT", name: "Malta", callingCode: "356" },
  { code: "MQ", name: "Martinique", callingCode: "596" },
  { code: "MR", name: "Mauritania", callingCode: "222" },
  { code: "MU", name: "Mauritius", callingCode: "230" },
  { code: "MX", name: "Mexico", callingCode: "52" },
  { code: "FM", name: "Micronesia", callingCode: "691" },
  { code: "MD", name: "Moldova", callingCode: "373" },
  { code: "MC", name: "Monaco", callingCode: "377" },
  { code: "MN", name: "Mongolia", callingCode: "976" },
  { code: "ME", name: "Montenegro", callingCode: "382" },
  { code: "MS", name: "Montserrat", callingCode: "1" },
  { code: "MA", name: "Morocco", callingCode: "212" },
  { code: "MM", name: "Myanmar", callingCode: "95" },
  { code: "NR", name: "Nauru", callingCode: "674" },
  { code: "NP", name: "Nepal", callingCode: "977" },
  { code: "NL", name: "Netherlands", callingCode: "31" },
  { code: "NC", name: "New Caledonia", callingCode: "687" },
  { code: "NI", name: "Nicaragua", callingCode: "505" },
  { code: "NE", name: "Niger", callingCode: "227" },
  { code: "NG", name: "Nigeria", callingCode: "234" },
  { code: "NU", name: "Niue", callingCode: "683" },
  { code: "NF", name: "Norfolk Island", callingCode: "672" },
  { code: "MK", name: "North Macedonia", callingCode: "389" },
  { code: "MP", name: "Northern Mariana Islands", callingCode: "1" },
  { code: "NO", name: "Norway", callingCode: "47" },
  { code: "OM", name: "Oman", callingCode: "968" },
  { code: "PK", name: "Pakistan", callingCode: "92" },
  { code: "PW", name: "Palau", callingCode: "680" },
  { code: "PS", name: "Palestine", callingCode: "970" },
  { code: "PA", name: "Panama", callingCode: "507" },
  { code: "PG", name: "Papua New Guinea", callingCode: "675" },
  { code: "PY", name: "Paraguay", callingCode: "595" },
  { code: "PE", name: "Peru", callingCode: "51" },
  { code: "PH", name: "Philippines", callingCode: "63" },
  { code: "PL", name: "Poland", callingCode: "48" },
  { code: "PT", name: "Portugal", callingCode: "351" },
  { code: "PR", name: "Puerto Rico", callingCode: "1" },
  { code: "QA", name: "Qatar", callingCode: "974" },
  { code: "RE", name: "Reunion", callingCode: "262" },
  { code: "RO", name: "Romania", callingCode: "40" },
  { code: "RU", name: "Russia", callingCode: "7" },
  { code: "RW", name: "Rwanda", callingCode: "250" },
  { code: "BL", name: "Saint Barthelemy", callingCode: "590" },
  { code: "SH", name: "Saint Helena", callingCode: "290" },
  { code: "KN", name: "Saint Kitts and Nevis", callingCode: "1" },
  { code: "LC", name: "Saint Lucia", callingCode: "1" },
  { code: "MF", name: "Saint Martin", callingCode: "590" },
  { code: "PM", name: "Saint Pierre and Miquelon", callingCode: "508" },
  { code: "VC", name: "Saint Vincent and the Grenadines", callingCode: "1" },
  { code: "WS", name: "Samoa", callingCode: "685" },
  { code: "SM", name: "San Marino", callingCode: "378" },
  { code: "ST", name: "Sao Tome and Principe", callingCode: "239" },
  { code: "SA", name: "Saudi Arabia", callingCode: "966" },
  { code: "SN", name: "Senegal", callingCode: "221" },
  { code: "RS", name: "Serbia", callingCode: "381" },
  { code: "SC", name: "Seychelles", callingCode: "248" },
  { code: "SL", name: "Sierra Leone", callingCode: "232" },
  { code: "SG", name: "Singapore", callingCode: "65" },
  { code: "SX", name: "Sint Maarten", callingCode: "1" },
  { code: "SK", name: "Slovakia", callingCode: "421" },
  { code: "SI", name: "Slovenia", callingCode: "386" },
  { code: "SB", name: "Solomon Islands", callingCode: "677" },
  { code: "SO", name: "Somalia", callingCode: "252" },
  { code: "KR", name: "South Korea", callingCode: "82" },
  { code: "SS", name: "South Sudan", callingCode: "211" },
  { code: "ES", name: "Spain", callingCode: "34" },
  { code: "LK", name: "Sri Lanka", callingCode: "94" },
  { code: "SD", name: "Sudan", callingCode: "249" },
  { code: "SR", name: "Suriname", callingCode: "597" },
  { code: "SE", name: "Sweden", callingCode: "46" },
  { code: "CH", name: "Switzerland", callingCode: "41" },
  { code: "SY", name: "Syria", callingCode: "963" },
  { code: "TW", name: "Taiwan", callingCode: "886" },
  { code: "TJ", name: "Tajikistan", callingCode: "992" },
  { code: "TZ", name: "Tanzania", callingCode: "255" },
  { code: "TH", name: "Thailand", callingCode: "66" },
  { code: "TL", name: "Timor-Leste", callingCode: "670" },
  { code: "TG", name: "Togo", callingCode: "228" },
  { code: "TO", name: "Tonga", callingCode: "676" },
  { code: "TT", name: "Trinidad and Tobago", callingCode: "1" },
  { code: "TN", name: "Tunisia", callingCode: "216" },
  { code: "TR", name: "Turkey", callingCode: "90" },
  { code: "TM", name: "Turkmenistan", callingCode: "993" },
  { code: "TC", name: "Turks and Caicos Islands", callingCode: "1" },
  { code: "TV", name: "Tuvalu", callingCode: "688" },
  { code: "UG", name: "Uganda", callingCode: "256" },
  { code: "UA", name: "Ukraine", callingCode: "380" },
  { code: "AE", name: "United Arab Emirates", callingCode: "971" },
  { code: "UY", name: "Uruguay", callingCode: "598" },
  { code: "UZ", name: "Uzbekistan", callingCode: "998" },
  { code: "VU", name: "Vanuatu", callingCode: "678" },
  { code: "VA", name: "Vatican City", callingCode: "39" },
  { code: "VE", name: "Venezuela", callingCode: "58" },
  { code: "VN", name: "Vietnam", callingCode: "84" },
  { code: "VI", name: "US Virgin Islands", callingCode: "1" },
  { code: "WF", name: "Wallis and Futuna", callingCode: "681" },
  { code: "YT", name: "Mayotte", callingCode: "262" },
  { code: "YE", name: "Yemen", callingCode: "967" },
] as const satisfies readonly PhoneCountryOptionConfig[];

export type PhoneCountryCode = (typeof phoneCountryOptions)[number]["code"];
export type PhoneCountryOption = PhoneCountryOptionConfig & {
  code: PhoneCountryCode;
};

export const defaultPhoneCountryCode: PhoneCountryCode = "ZA";
export const phoneCountryCodes = phoneCountryOptions.map(
  (option) => option.code,
) as [PhoneCountryCode, ...PhoneCountryCode[]];

const significantLeadingZeroCountries = new Set<PhoneCountryCode>([
  "IT",
  "SM",
  "VA",
]);
const phoneCountryOptionsByCode = new Map(
  phoneCountryOptions.map((option) => [
    option.code,
    option as PhoneCountryOption,
  ]),
);
const phoneCountryOptionsByCallingCode = phoneCountryOptions
  .map((option) => option as PhoneCountryOption)
  .sort((first, second) => second.callingCode.length - first.callingCode.length);

type PhoneNumberOptions = {
  defaultCountryCode?: PhoneCountryCode;
};

export function isPhoneCountryCode(value: unknown): value is PhoneCountryCode {
  return (
    typeof value === "string" &&
    phoneCountryOptionsByCode.has(value as PhoneCountryCode)
  );
}

export function getPhoneCountryOption(
  value: PhoneCountryCode | string | null | undefined,
) {
  return (
    (isPhoneCountryCode(value) ? phoneCountryOptionsByCode.get(value) : null) ??
    phoneCountryOptionsByCode.get(defaultPhoneCountryCode)!
  );
}

export function normalizeInternationalPhoneNumber(value: string) {
  const digits = value.trim().replace(/^00/, "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  const countryRule = phoneCountryOptionsByCallingCode.find((option) =>
    digits.startsWith(option.callingCode),
  );

  if (countryRule) {
    const nationalNumber = stripNationalTrunkPrefix(
      digits.slice(countryRule.callingCode.length),
      countryRule,
    );

    if (!isValidNationalNumber(nationalNumber, countryRule)) {
      return null;
    }

    const normalized = `+${countryRule.callingCode}${nationalNumber}`;

    return e164Pattern.test(normalized) ? normalized : null;
  }

  const normalized = `+${digits}`;

  return e164Pattern.test(normalized) ? normalized : null;
}

export function normalizePhoneNumber(
  value: string,
  options: PhoneNumberOptions = {},
) {
  const countryRule = getPhoneCountryOption(
    options.defaultCountryCode ?? defaultPhoneCountryCode,
  );
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    return normalizeInternationalPhoneNumber(trimmed);
  }

  let nationalNumber = trimmed.replace(/\D/g, "");

  if (!nationalNumber) {
    return null;
  }

  if (nationalNumber.startsWith(countryRule.callingCode)) {
    const numberWithoutCallingCode = nationalNumber.slice(
      countryRule.callingCode.length,
    );
    const normalizedWithoutCallingCode = stripNationalTrunkPrefix(
      numberWithoutCallingCode,
      countryRule,
    );

    if (isValidNationalNumber(normalizedWithoutCallingCode, countryRule)) {
      nationalNumber = normalizedWithoutCallingCode;
    }
  }

  nationalNumber = stripNationalTrunkPrefix(nationalNumber, countryRule);

  if (!isValidNationalNumber(nationalNumber, countryRule)) {
    return null;
  }

  const normalized = `+${countryRule.callingCode}${nationalNumber}`;

  return e164Pattern.test(normalized) ? normalized : null;
}

export function requireNormalizedPhoneNumber(
  value: string,
  options: PhoneNumberOptions & { message?: string } = {},
) {
  const normalized = normalizePhoneNumber(value, {
    defaultCountryCode: options.defaultCountryCode,
  });

  if (!normalized) {
    throw new Error(options.message ?? "Enter a valid phone number.");
  }

  return normalized;
}

export function normalizeNationalPhoneInputValue(
  value: string,
  countryCode: PhoneCountryCode = defaultPhoneCountryCode,
) {
  const country = getPhoneCountryOption(countryCode);
  const normalized = normalizePhoneNumber(value, {
    defaultCountryCode: country.code,
  });
  const callingCodePrefix = `+${country.callingCode}`;

  if (!normalized?.startsWith(callingCodePrefix)) {
    return null;
  }

  return normalized.slice(callingCodePrefix.length);
}

export function getPhoneInputParts(
  value: string | null | undefined,
  fallbackCountryCode: PhoneCountryCode = defaultPhoneCountryCode,
) {
  const fallbackCountry = getPhoneCountryOption(fallbackCountryCode);

  if (!value) {
    return {
      countryCode: fallbackCountry.code,
      nationalNumber: "",
    };
  }

  const normalized = normalizePhoneNumber(value, {
    defaultCountryCode: fallbackCountry.code,
  });
  const digits = (normalized ?? value).replace(/^00/, "").replace(/\D/g, "");
  const country =
    phoneCountryOptionsByCallingCode.find((option) =>
      digits.startsWith(option.callingCode),
    ) ?? fallbackCountry;
  const nationalNumber = digits.startsWith(country.callingCode)
    ? digits.slice(country.callingCode.length)
    : digits;

  return {
    countryCode: country.code,
    nationalNumber,
  };
}

function stripNationalTrunkPrefix(
  value: string,
  rule: PhoneCountryOption,
) {
  if (significantLeadingZeroCountries.has(rule.code)) {
    return value;
  }

  return value.replace(/^0+/, "");
}

function isValidNationalNumber(value: string, rule: PhoneCountryOption) {
  const minLength =
    rule.nationalMin ?? (rule.callingCode === "1" ? 10 : 4);
  const maxLength = Math.min(
    rule.nationalMax ?? (rule.callingCode === "1" ? 10 : 14),
    15 - rule.callingCode.length,
  );

  return (
    /^\d+$/.test(value) &&
    value.length >= minLength &&
    value.length <= maxLength
  );
}
