"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, useMemo, useState } from "react";

import {
  countryPreferenceCookieName,
  currencyPreferenceCookieName,
  getCurrencyForCountry,
  supportedCountries,
  supportedCurrencies,
  type CurrencyPreference,
  type SupportedCountryCode,
  type SupportedCurrencyCode,
} from "@/src/modules/currency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CurrencySelectorProps = {
  className?: string;
  initialPreference: CurrencyPreference;
  variant?: "dashboard" | "marketplace";
};

const selectContentStyle: CSSProperties = {
  maxHeight: "min(22rem, calc(100dvh - 1rem))",
  maxWidth: "calc(100vw - 1rem)",
  width: "17.5rem",
};

function writePreferenceCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export function CurrencySelector({
  className,
  initialPreference,
  variant = "marketplace",
}: CurrencySelectorProps) {
  const router = useRouter();
  const [country, setCountry] = useState(initialPreference.country);
  const [currency, setCurrency] = useState(initialPreference.currency);
  const selectedCountry = supportedCountries.find((item) => item.code === country);
  const selectedCurrency = supportedCurrencies.find((item) => item.code === currency);
  const triggerClass = useMemo(
    () =>
      variant === "marketplace"
        ? "h-9 rounded-md border-transparent bg-transparent px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
        : "h-9 rounded-lg border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-white/12 dark:bg-[#151719] dark:text-zinc-300",
    [variant],
  );

  function refresh(nextCountry: SupportedCountryCode, nextCurrency: SupportedCurrencyCode) {
    writePreferenceCookie(countryPreferenceCookieName, nextCountry);
    writePreferenceCookie(currencyPreferenceCookieName, nextCurrency);
    router.refresh();
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Select
        value={country}
        onValueChange={(value) => {
          const nextCountry = value as SupportedCountryCode;
          const nextCurrency = getCurrencyForCountry(nextCountry);

          setCountry(nextCountry);
          setCurrency(nextCurrency);
          refresh(nextCountry, nextCurrency);
        }}
      >
        <SelectTrigger className={cn(triggerClass, "w-[5.75rem]")}>
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true">{selectedCountry?.flag ?? "🌍"}</span>
              <span>{selectedCountry?.code ?? country}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="z-[90] overflow-y-auto border border-slate-200 bg-white text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white"
          collisionPadding={8}
          style={selectContentStyle}
        >
          {supportedCountries.map((item) => (
            <SelectItem key={item.code} value={item.code} className="min-w-0">
              <span aria-hidden="true" className="shrink-0">
                {item.flag}
              </span>
              <span className="shrink-0">{item.code}</span>
              <span className="min-w-0 truncate text-xs text-slate-500 dark:text-zinc-400">
                {item.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currency}
        onValueChange={(value) => {
          const nextCurrency = value as SupportedCurrencyCode;

          setCurrency(nextCurrency);
          refresh(country, nextCurrency);
        }}
      >
        <SelectTrigger className={cn(triggerClass, "w-[6.25rem]")}>
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true">{selectedCurrency?.flag ?? "💱"}</span>
              <span>{selectedCurrency?.code ?? currency}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="z-[90] overflow-y-auto border border-slate-200 bg-white text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white"
          collisionPadding={8}
          style={selectContentStyle}
        >
          {supportedCurrencies.map((item) => (
            <SelectItem key={item.code} value={item.code} className="min-w-0">
              <span aria-hidden="true" className="shrink-0">
                {item.flag}
              </span>
              <span className="shrink-0">{item.code}</span>
              <span className="min-w-0 truncate text-xs text-slate-500 dark:text-zinc-400">
                {item.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
