"use server";

import { headers } from "next/headers";

import {
  canAccessCapability,
  createPasswordResetToken,
  findUserByEmail,
  getUserRoles,
  resetPasswordWithToken,
} from "@/src/modules/auth/service";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/src/modules/auth/validation";
import type {
  ForgotPasswordState,
  ResetPasswordState,
} from "@/src/modules/auth/password-reset-types";
import { sendPasswordResetEmail } from "@/src/modules/auth/password-reset-email";
import type { AccessCapability } from "@/src/modules/auth/service";

function getRequestOrigin(headerStore: Headers) {
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");

  if (!host) {
    return "http://localhost:3000";
  }

  return `${forwardedProto ?? "http"}://${host}`;
}

async function requestPasswordReset(
  _state: ForgotPasswordState,
  formData: FormData,
  capability: AccessCapability,
) {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const genericSuccess =
    "If that account exists, a reset link has been prepared.";
  const user = await findUserByEmail(parsed.data.email);

  if (!user?.isActive) {
    return { success: genericSuccess };
  }

  const roles = await getUserRoles(user.id);

  if (!canAccessCapability({ roles }, capability)) {
    return { success: genericSuccess };
  }

  const { token, expiresAt } = await createPasswordResetToken(user.id);
  const origin = getRequestOrigin(await headers());
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

  console.info(
    `[password-reset] ${parsed.data.email} reset link expires at ${expiresAt.toISOString()}: ${resetUrl}`,
  );

  const emailResult = await sendPasswordResetEmail({
    to: parsed.data.email,
    resetUrl,
    surface:
      capability === "admin"
        ? "admin"
        : capability === "seller"
          ? "seller"
          : "marketplace",
    expiresAt,
  });

  return {
    success:
      emailResult.delivered || process.env.NODE_ENV === "production"
        ? "If that account exists, a reset link has been sent."
        : genericSuccess,
    devResetUrl:
      process.env.NODE_ENV === "production" || emailResult.delivered
        ? undefined
        : resetUrl,
  };
}

export async function requestAdminPasswordReset(
  state: ForgotPasswordState,
  formData: FormData,
) {
  return requestPasswordReset(state, formData, "admin");
}

export async function requestSellerPasswordReset(
  state: ForgotPasswordState,
  formData: FormData,
) {
  return requestPasswordReset(state, formData, "seller");
}

export async function requestCustomerPasswordReset(
  state: ForgotPasswordState,
  formData: FormData,
) {
  return requestPasswordReset(state, formData, "marketplace");
}

export async function resetPassword(
  _state: ResetPasswordState,
  formData: FormData,
) {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Enter a new password with at least 12 characters.",
    };
  }

  const didReset = await resetPasswordWithToken(
    parsed.data.token,
    parsed.data.password,
  );

  if (!didReset) {
    return { error: "This reset link is invalid or has expired." };
  }

  return { success: "Your password has been updated. You can sign in now." };
}
