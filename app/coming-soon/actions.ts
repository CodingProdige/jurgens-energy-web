"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { addEmailSubscriber } from "@/src/modules/marketing/email-subscribers";
import {
  createMarketplacePreviewToken,
  marketplaceComingSoonCookieName,
  verifyMarketplaceComingSoonPassword,
  getMarketplaceSettings,
} from "@/src/modules/marketplace/settings";
import { checkRateLimit, getClientIp } from "@/src/modules/security/rate-limit";

export type ComingSoonState = {
  error?: string;
};

export type WaitlistState = {
  message?: string;
  ok?: boolean;
};

const waitlistSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
});

export async function joinMarketplaceWaitlist(
  _state: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit({
    key: `rate:coming-soon:email:${clientIp}`,
    limit: 5,
    windowSeconds: 60 * 60,
  });

  if (!rateLimit.allowed) {
    return {
      ok: false,
      message: `Too many signup attempts. Try again in ${Math.ceil(
        rateLimit.retryAfterSeconds / 60,
      )} minutes.`,
    };
  }

  const parsed = waitlistSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter a valid email address.",
    };
  }

  await addEmailSubscriber({
    email: parsed.data.email,
    source: "coming_soon",
  });

  return {
    ok: true,
    message: "You're on the list. We'll let you know when Piessang opens.",
  };
}

export async function unlockMarketplacePreview(
  _state: ComingSoonState,
  formData: FormData,
): Promise<ComingSoonState> {
  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit({
    key: `rate:coming-soon:password:${clientIp}`,
    limit: 10,
    windowSeconds: 15 * 60,
  });

  if (!rateLimit.allowed) {
    return {
      error: `Too many access attempts. Try again in ${Math.ceil(
        rateLimit.retryAfterSeconds / 60,
      )} minutes.`,
    };
  }

  const password = String(formData.get("password") ?? "");

  if (!password) {
    return { error: "Enter the preview password." };
  }

  const isValid = await verifyMarketplaceComingSoonPassword(password);

  if (!isValid) {
    return { error: "That password is not correct." };
  }

  const settings = await getMarketplaceSettings();

  if (!settings.comingSoonPasswordHash) {
    return { error: "The preview password is not configured." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    marketplaceComingSoonCookieName,
    createMarketplacePreviewToken(settings.comingSoonPasswordHash),
    {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );

  revalidatePath("/");

  redirect("/");
}
