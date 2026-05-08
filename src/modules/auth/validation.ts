import { z } from "zod";

export const signInSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email().trim().toLowerCase(),
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
