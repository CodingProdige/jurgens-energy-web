import { z } from "zod";

import { normalizePhoneNumber, phoneCountryCodes } from "@/src/modules/phone";

const phoneCountryCodeSchema = z.enum(phoneCountryCodes);

export const whatsappPhoneSchema = z
  .object({
    countryCode: phoneCountryCodeSchema.default("ZA"),
    phone: z.string().trim().min(1, "WhatsApp number is required.").max(40),
  })
  .refine(
    (value) =>
      Boolean(
        normalizePhoneNumber(value.phone, {
          defaultCountryCode: value.countryCode,
        }),
      ),
    "Enter a valid WhatsApp number.",
  )
  .transform((value) =>
    normalizePhoneNumber(value.phone, {
      defaultCountryCode: value.countryCode,
    })!,
  );

export const signInSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email().trim().toLowerCase(),
  whatsappPhone: whatsappPhoneSchema,
  password: z.string().min(8),
});

export const forgotPasswordSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32),
    password: z.string().min(12),
    confirmPassword: z.string().min(12),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
