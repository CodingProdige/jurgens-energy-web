"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import {
  createCustomerAccount,
  findUserByEmail,
} from "@/src/modules/auth/service";
import { registerSchema } from "@/src/modules/auth/validation";

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
    password: formData.get("password"),
  });

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
        "This email already has a Piessang account. Please sign in to continue.",
    };
  }

  try {
    await createCustomerAccount(parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "An account already exists for this email address." };
    }

    throw error;
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
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

  redirect("/");
}
