import { cookies } from "next/headers";

import {
  countryPreferenceCookieName,
  currencyPreferenceCookieName,
  getCurrencyForCountry,
  getLatestZarRates,
  supportedCountries,
  supportedCurrencies,
  type CurrencyContext,
  type CurrencyPreference,
  type SupportedCountryCode,
  type SupportedCurrencyCode,
} from "@/src/modules/currency";

function isSupportedCurrency(value: string | undefined): value is SupportedCurrencyCode {
  return supportedCurrencies.some((currency) => currency.code === value);
}

function isSupportedCountry(value: string | undefined): value is SupportedCountryCode {
  return supportedCountries.some((country) => country.code === value);
}

export async function getCurrencyPreference(): Promise<CurrencyPreference> {
  const cookieStore = await cookies();
  const rawCountry = cookieStore.get(countryPreferenceCookieName)?.value;
  const country = isSupportedCountry(rawCountry) ? rawCountry : "ZA";
  const rawCurrency = cookieStore.get(currencyPreferenceCookieName)?.value;
  const currency = isSupportedCurrency(rawCurrency)
    ? rawCurrency
    : getCurrencyForCountry(country);

  return { country, currency };
}

export async function getCurrencyContext(): Promise<CurrencyContext> {
  const preference = await getCurrencyPreference();
  const currency = supportedCurrencies.find(
    (item) => item.code === preference.currency,
  );
  const rates = await getLatestZarRates();

  return {
    ...preference,
    locale: currency?.locale ?? "en-ZA",
    rate: rates.rates[preference.currency] ?? 1,
    rateUpdatedAt: rates.updatedAt,
  };
}
