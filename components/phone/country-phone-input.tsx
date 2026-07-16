"use client";

import { useState, type ChangeEventHandler } from "react";

import {
  defaultPhoneCountryCode,
  getPhoneInputParts,
  isPhoneCountryCode,
  normalizeNationalPhoneInputValue,
  phoneCountryOptions,
  type PhoneCountryCode,
} from "@/src/modules/phone";
import { cn } from "@/lib/utils";

type CountryPhoneInputProps = {
  autoComplete?: string;
  className?: string;
  countryCode?: PhoneCountryCode;
  defaultCountryCode?: PhoneCountryCode;
  defaultValue?: string | null;
  disabled?: boolean;
  id?: string;
  inputClassName?: string;
  name: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onCountryCodeChange?: (countryCode: PhoneCountryCode) => void;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  selectClassName?: string;
  value?: string;
};

export function CountryPhoneInput({
  autoComplete = "tel-national",
  className,
  countryCode,
  defaultCountryCode = defaultPhoneCountryCode,
  defaultValue,
  disabled = false,
  id,
  inputClassName,
  name,
  onChange,
  onCountryCodeChange,
  placeholder = "Phone number",
  readOnly = false,
  required = false,
  selectClassName,
  value,
}: CountryPhoneInputProps) {
  const fieldId = id ?? name;
  const countryFieldName = `${name}CountryCode`;
  const parts = getPhoneInputParts(defaultValue, defaultCountryCode);
  const [uncontrolledCountryCode, setUncontrolledCountryCode] =
    useState<PhoneCountryCode>(parts.countryCode);
  const selectedCountryCode = countryCode ?? uncontrolledCountryCode;
  const lockCountry = disabled || readOnly;

  return (
    <span
      className={cn(
        "grid min-w-0 grid-cols-[7.75rem_minmax(0,1fr)] gap-2",
        className,
      )}
    >
      {lockCountry ? (
        <input
          name={countryFieldName}
          type="hidden"
          value={selectedCountryCode}
        />
      ) : null}
      <select
        aria-label="Phone country code"
        className={cn(
          "h-11 min-w-0 rounded-md border border-[#d8d8d1] bg-white px-3 text-sm font-semibold text-[#070b16] outline-none transition focus:border-[#ff5a1f] focus:ring-4 focus:ring-[#ff5a1f]/15 disabled:pointer-events-none disabled:bg-[#f7f7f2] disabled:text-[#596176] dark:border-white/12 dark:bg-white/[0.04] dark:text-white dark:disabled:bg-white/[0.06]",
          selectClassName,
        )}
        disabled={lockCountry}
        name={countryFieldName}
        onChange={(event) => {
          if (isPhoneCountryCode(event.target.value)) {
            if (countryCode === undefined) {
              setUncontrolledCountryCode(event.target.value);
            }
            onCountryCodeChange?.(event.target.value);
          }
        }}
        value={selectedCountryCode}
      >
        {phoneCountryOptions.map((country) => (
          <option key={country.code} value={country.code}>
            {country.code} +{country.callingCode}
          </option>
        ))}
      </select>
      <input
        autoComplete={autoComplete}
        className={cn(
          "h-11 min-w-0 rounded-md border border-[#d8d8d1] bg-white px-3 text-sm font-medium text-[#070b16] outline-none transition placeholder:text-[#7a8297] focus:border-[#ff5a1f] focus:ring-4 focus:ring-[#ff5a1f]/15 disabled:pointer-events-none disabled:bg-[#f7f7f2] disabled:text-[#596176] dark:border-white/12 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-zinc-500 dark:disabled:bg-white/[0.06]",
          inputClassName,
        )}
        disabled={disabled}
        id={fieldId}
        inputMode="tel"
        name={name}
        onChange={(event) => {
          const normalizedNationalNumber = normalizeNationalPhoneInputValue(
            event.currentTarget.value,
            selectedCountryCode,
          );

          if (
            normalizedNationalNumber !== null &&
            normalizedNationalNumber !== event.currentTarget.value
          ) {
            event.currentTarget.value = normalizedNationalNumber;
          }

          onChange?.(event);
        }}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        type="tel"
        {...(value === undefined
          ? { defaultValue: parts.nationalNumber }
          : { value })}
      />
    </span>
  );
}
