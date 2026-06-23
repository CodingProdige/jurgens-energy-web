import { isoCountryCodes } from "@/src/modules/currency/country-codes";

export const currencyPreferenceCookieName = "piessang_currency";
export const countryPreferenceCookieName = "piessang_country";
export const baseCurrency = "ZAR";

export type SupportedCurrencyCode = string;
export type SupportedCountryCode = string;

export type CurrencyPreference = {
  country: SupportedCountryCode;
  currency: SupportedCurrencyCode;
};

export type CurrencyContext = CurrencyPreference & {
  locale: string;
  rate: number;
  rateUpdatedAt: string | null;
};

type SupportedCurrency = {
  code: string;
  flag: string;
  label: string;
  locale: string;
  symbol: string;
};

type SupportedCountry = {
  code: string;
  currency: string;
  flag: string;
  label: string;
};

const countryCurrencyMap: Record<string, string> = {
  AD: "EUR",
  AE: "AED",
  AF: "AFN",
  AG: "XCD",
  AI: "XCD",
  AL: "ALL",
  AM: "AMD",
  AO: "AOA",
  AQ: "USD",
  AR: "ARS",
  AS: "USD",
  AT: "EUR",
  AU: "AUD",
  AW: "AWG",
  AX: "EUR",
  AZ: "AZN",
  BA: "BAM",
  BB: "BBD",
  BD: "BDT",
  BE: "EUR",
  BF: "XOF",
  BG: "BGN",
  BH: "BHD",
  BI: "BIF",
  BJ: "XOF",
  BL: "EUR",
  BM: "BMD",
  BN: "BND",
  BO: "BOB",
  BQ: "USD",
  BR: "BRL",
  BS: "BSD",
  BT: "BTN",
  BV: "NOK",
  BW: "BWP",
  BY: "BYN",
  BZ: "BZD",
  CA: "CAD",
  CC: "AUD",
  CD: "CDF",
  CF: "XAF",
  CG: "XAF",
  CH: "CHF",
  CI: "XOF",
  CK: "NZD",
  CL: "CLP",
  CM: "XAF",
  CN: "CNY",
  CO: "COP",
  CR: "CRC",
  CU: "CUP",
  CV: "CVE",
  CW: "ANG",
  CX: "AUD",
  CY: "EUR",
  CZ: "CZK",
  DE: "EUR",
  DJ: "DJF",
  DK: "DKK",
  DM: "XCD",
  DO: "DOP",
  DZ: "DZD",
  EC: "USD",
  EE: "EUR",
  EG: "EGP",
  EH: "MAD",
  ER: "ERN",
  ES: "EUR",
  ET: "ETB",
  FI: "EUR",
  FJ: "FJD",
  FK: "FKP",
  FM: "USD",
  FO: "DKK",
  FR: "EUR",
  GA: "XAF",
  GB: "GBP",
  GD: "XCD",
  GE: "GEL",
  GF: "EUR",
  GG: "GBP",
  GH: "GHS",
  GI: "GIP",
  GL: "DKK",
  GM: "GMD",
  GN: "GNF",
  GP: "EUR",
  GQ: "XAF",
  GR: "EUR",
  GS: "GBP",
  GT: "GTQ",
  GU: "USD",
  GW: "XOF",
  GY: "GYD",
  HK: "HKD",
  HM: "AUD",
  HN: "HNL",
  HR: "EUR",
  HT: "HTG",
  HU: "HUF",
  ID: "IDR",
  IE: "EUR",
  IL: "ILS",
  IM: "GBP",
  IN: "INR",
  IO: "USD",
  IQ: "IQD",
  IR: "IRR",
  IS: "ISK",
  IT: "EUR",
  JE: "GBP",
  JM: "JMD",
  JO: "JOD",
  JP: "JPY",
  KE: "KES",
  KG: "KGS",
  KH: "KHR",
  KI: "AUD",
  KM: "KMF",
  KN: "XCD",
  KP: "KPW",
  KR: "KRW",
  KW: "KWD",
  KY: "KYD",
  KZ: "KZT",
  LA: "LAK",
  LB: "LBP",
  LC: "XCD",
  LI: "CHF",
  LK: "LKR",
  LR: "LRD",
  LS: "LSL",
  LT: "EUR",
  LU: "EUR",
  LV: "EUR",
  LY: "LYD",
  MA: "MAD",
  MC: "EUR",
  MD: "MDL",
  ME: "EUR",
  MF: "EUR",
  MG: "MGA",
  MH: "USD",
  MK: "MKD",
  ML: "XOF",
  MM: "MMK",
  MN: "MNT",
  MO: "MOP",
  MP: "USD",
  MQ: "EUR",
  MR: "MRU",
  MS: "XCD",
  MT: "EUR",
  MU: "MUR",
  MV: "MVR",
  MW: "MWK",
  MX: "MXN",
  MY: "MYR",
  MZ: "MZN",
  NA: "NAD",
  NC: "XPF",
  NE: "XOF",
  NF: "AUD",
  NG: "NGN",
  NI: "NIO",
  NL: "EUR",
  NO: "NOK",
  NP: "NPR",
  NR: "AUD",
  NU: "NZD",
  NZ: "NZD",
  OM: "OMR",
  PA: "PAB",
  PE: "PEN",
  PF: "XPF",
  PG: "PGK",
  PH: "PHP",
  PK: "PKR",
  PL: "PLN",
  PM: "EUR",
  PN: "NZD",
  PR: "USD",
  PS: "ILS",
  PT: "EUR",
  PW: "USD",
  PY: "PYG",
  QA: "QAR",
  RE: "EUR",
  RO: "RON",
  RS: "RSD",
  RU: "RUB",
  RW: "RWF",
  SA: "SAR",
  SB: "SBD",
  SC: "SCR",
  SD: "SDG",
  SE: "SEK",
  SG: "SGD",
  SH: "SHP",
  SI: "EUR",
  SJ: "NOK",
  SK: "EUR",
  SL: "SLE",
  SM: "EUR",
  SN: "XOF",
  SO: "SOS",
  SR: "SRD",
  SS: "SSP",
  ST: "STN",
  SV: "USD",
  SX: "ANG",
  SY: "SYP",
  SZ: "SZL",
  TC: "USD",
  TD: "XAF",
  TF: "EUR",
  TG: "XOF",
  TH: "THB",
  TJ: "TJS",
  TK: "NZD",
  TL: "USD",
  TM: "TMT",
  TN: "TND",
  TO: "TOP",
  TR: "TRY",
  TT: "TTD",
  TV: "AUD",
  TW: "TWD",
  TZ: "TZS",
  UA: "UAH",
  UG: "UGX",
  UM: "USD",
  US: "USD",
  UY: "UYU",
  UZ: "UZS",
  VA: "EUR",
  VC: "XCD",
  VE: "VES",
  VG: "USD",
  VI: "USD",
  VN: "VND",
  VU: "VUV",
  WF: "XPF",
  WS: "WST",
  YE: "YER",
  YT: "EUR",
  ZA: "ZAR",
  ZM: "ZMW",
  ZW: "ZWL",
};

const fallbackCurrencyCodes = [
  "AED",
  "AUD",
  "BWP",
  "CAD",
  "CHF",
  "CNY",
  "EUR",
  "GBP",
  "INR",
  "JPY",
  "NAD",
  "NZD",
  "USD",
  "ZAR",
] as const;

const fallbackRates: Record<string, number> = {
  AED: 0.19,
  AUD: 0.083,
  BWP: 0.73,
  CAD: 0.072,
  CHF: 0.047,
  CNY: 0.38,
  EUR: 0.049,
  GBP: 0.042,
  INR: 4.43,
  JPY: 8.35,
  NAD: 1,
  NZD: 0.091,
  USD: 0.053,
  ZAR: 1,
};

const intlWithSupportedValues = Intl as typeof Intl & {
  supportedValuesOf?: (key: "currency") => string[];
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });

function getFlagEmoji(countryCode: string) {
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return "🌐";
  }

  return countryCode
    .split("")
    .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + 127397))
    .join("");
}

function getCurrencySymbol(currencyCode: string) {
  const parts = new Intl.NumberFormat("en", {
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    style: "currency",
  }).formatToParts(1);

  return (
    parts.find((part) => part.type === "currency")?.value ??
    currencyCode
  );
}

function getCurrencyLocale(currencyCode: string) {
  const country = isoCountryCodes.find(
    (countryCode) => countryCurrencyMap[countryCode] === currencyCode,
  );

  return country ? `en-${country}` : "en-ZA";
}

function getCurrencyFlag(currencyCode: string) {
  const country = isoCountryCodes.find(
    (countryCode) => countryCurrencyMap[countryCode] === currencyCode,
  );

  if (country) {
    return getFlagEmoji(country);
  }

  if (currencyCode === "EUR") {
    return "🇪🇺";
  }

  return "🌐";
}

export const supportedCountries: SupportedCountry[] = isoCountryCodes
  .map((code) => ({
    code,
    currency: countryCurrencyMap[code] ?? baseCurrency,
    flag: getFlagEmoji(code),
    label: regionNames.of(code) ?? code,
  }))
  .sort((first, second) => first.label.localeCompare(second.label));

export const supportedCurrencies: SupportedCurrency[] = (
  intlWithSupportedValues.supportedValuesOf?.("currency") ?? [...fallbackCurrencyCodes]
)
  .map((code) => ({
    code,
    flag: getCurrencyFlag(code),
    label: currencyNames.of(code) ?? code,
    locale: getCurrencyLocale(code),
    symbol: getCurrencySymbol(code),
  }))
  .sort((first, second) => first.code.localeCompare(second.code));

export function getCurrencyForCountry(countryCode: SupportedCountryCode) {
  return countryCurrencyMap[countryCode] ?? baseCurrency;
}

export function convertFromZar(
  amount: string | number | null | undefined,
  context: Pick<CurrencyContext, "rate">,
) {
  const parsed = Number(amount ?? 0);

  return (Number.isFinite(parsed) ? parsed : 0) * context.rate;
}

export function formatFromZar(
  amount: string | number | null | undefined,
  context: Pick<CurrencyContext, "currency" | "locale" | "rate">,
) {
  return new Intl.NumberFormat(context.locale, {
    currency: context.currency,
    style: "currency",
  }).format(convertFromZar(amount, context));
}

export function formatRangeFromZar(
  values: Array<string | number>,
  context: Pick<CurrencyContext, "currency" | "locale" | "rate">,
) {
  const parsedValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (parsedValues.length === 0) {
    return "Unavailable";
  }

  const minimum = Math.min(...parsedValues);
  const maximum = Math.max(...parsedValues);
  const label = formatFromZar(minimum, context);

  return minimum === maximum ? label : `From ${label}`;
}

export async function getLatestZarRates(): Promise<{
  rates: Record<string, number>;
  updatedAt: string | null;
}> {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/ZAR", {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error("Currency rate provider returned an error.");
    }

    const payload = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };

    if (payload.result === "error" || !payload.rates) {
      throw new Error("Currency rate provider returned an invalid payload.");
    }

    return {
      rates: {
        ...fallbackRates,
        ...payload.rates,
        ZAR: 1,
      },
      updatedAt: payload.time_last_update_utc ?? null,
    };
  } catch {
    return {
      rates: fallbackRates,
      updatedAt: null,
    };
  }
}
