"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import {
  createCustomerAccount,
  findUserByEmail,
} from "@/src/modules/auth/service";
import { registerSchema } from "@/src/modules/auth/validation";
import { WhatsappNumberLinkedToAnotherUserError } from "@/src/modules/whatsapp-ordering/customer-links";
import {
  getWhatsappDraftResumePath,
  parseWhatsappDraftToken,
} from "@/src/modules/whatsapp-ordering/draft-tokens";

export type RegisterState = {
  error?: string;
};

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function registerCustomerWithPassword(
  _state: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    whatsappPhone: {
      countryCode: formData.get("whatsappPhoneCountryCode"),
      phone: formData.get("whatsappPhone"),
    },
    password: formData.get("password"),
  });
  const whatsappDraftToken = parseWhatsappDraftToken(
    formData.get("whatsappDraft"),
  );

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Enter your name, a valid email, and a password.",
    };
  }

  const existingUser = await findUserByEmail(parsed.data.email);

  if (existingUser) {
    return {
      error:
        "This email already has a Jurgens Energy account. Please sign in to continue.",
    };
  }

  try {
    await createCustomerAccount({
      ...parsed.data,
      whatsappDraftToken,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "An account already exists for this email address." };
    }

    if (error instanceof WhatsappNumberLinkedToAnotherUserError) {
      return {
        error:
          "That WhatsApp number is already linked to another account. Sign in with that account or use a different number.",
      };
    }

    throw error;
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: whatsappDraftToken
        ? getWhatsappDraftResumePath(whatsappDraftToken)
        : "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          "Your account was created, but automatic sign-in failed. Please sign in.",
      };
    }

    throw error;
  }

  redirect(
    whatsappDraftToken ? getWhatsappDraftResumePath(whatsappDraftToken) : "/",
  );
}
