"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import {
  rememberedEmailCookieName,
  surfaceAccessRememberSeconds,
} from "@/src/modules/auth/constants";
import {
  canAccessCapability,
  type AccessCapability,
  findUserByEmail,
  getUserRoles,
  verifyPassword,
} from "@/src/modules/auth/service";
import {
  createSurfaceAccessToken,
  getSurfaceAccessCookieName,
} from "@/src/modules/auth/surface-access";
import { signInSchema } from "@/src/modules/auth/validation";

export type SignInState = {
  error?: string;
};

type SignInOptions = {
  requiredCapability: AccessCapability;
  redirectTo: string;
  capabilityError: string;
  rememberByDefault?: boolean;
};

async function getRequestRedirectUrl(pathname: string) {
  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");
  const protocol = forwardedProto ?? "http";

  if (!host) {
    return pathname;
  }

  return new URL(pathname, `${protocol}://${host}`).toString();
}

async function signInWithPasswordForSurface(
  _state: SignInState,
  formData: FormData,
  options: SignInOptions,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const user = await findUserByEmail(parsed.data.email);

  if (!user?.passwordHash || !user.isActive) {
    return { error: "The email or password is incorrect." };
  }

  const passwordMatches = await verifyPassword(
    parsed.data.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    return { error: "The email or password is incorrect." };
  }

  const roles = await getUserRoles(user.id);

  if (!canAccessCapability({ roles }, options.requiredCapability)) {
    return { error: options.capabilityError };
  }

  const cookieStore = await cookies();
  const shouldRememberEmail =
    options.rememberByDefault || formData.get("remember") === "on";

  if (shouldRememberEmail) {
    cookieStore.set(rememberedEmailCookieName, parsed.data.email, {
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
      sameSite: "lax",
    });
  } else {
    cookieStore.delete(rememberedEmailCookieName);
  }

  if (
    options.requiredCapability === "admin" ||
    options.requiredCapability === "seller"
  ) {
    const surfaceAccessToken = createSurfaceAccessToken({
      remember: shouldRememberEmail,
      surface: options.requiredCapability,
      userId: user.id,
    });

    cookieStore.set(
      getSurfaceAccessCookieName(options.requiredCapability),
      surfaceAccessToken,
      {
        httpOnly: true,
        maxAge: shouldRememberEmail ? surfaceAccessRememberSeconds : undefined,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    );
  }

  try {
    const redirectTo = await getRequestRedirectUrl(options.redirectTo);

    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "The email or password is incorrect." };
    }

    throw error;
  }

  redirect(await getRequestRedirectUrl(options.redirectTo));
}

export async function signInCustomerWithPassword(
  state: SignInState,
  formData: FormData,
) {
  return signInWithPasswordForSurface(state, formData, {
    requiredCapability: "marketplace",
    redirectTo: "/",
    capabilityError: "This account cannot access the marketplace.",
    rememberByDefault: true,
  });
}

export async function signInAdminWithPassword(
  state: SignInState,
  formData: FormData,
) {
  return signInWithPasswordForSurface(state, formData, {
    requiredCapability: "admin",
    redirectTo: "/",
    capabilityError: "This sign-in is only for admin accounts.",
  });
}

export async function signInSellerWithPassword(
  state: SignInState,
  formData: FormData,
) {
  return signInWithPasswordForSurface(state, formData, {
    requiredCapability: "seller",
    redirectTo: "/",
    capabilityError: "This sign-in is only for seller workspace accounts.",
  });
}
