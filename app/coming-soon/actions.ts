"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createMarketplacePreviewToken,
  marketplaceComingSoonCookieName,
  verifyMarketplaceComingSoonPassword,
  getMarketplaceSettings,
} from "@/src/modules/marketplace/settings";

export type ComingSoonState = {
  error?: string;
};

export async function unlockMarketplacePreview(
  _state: ComingSoonState,
  formData: FormData,
): Promise<ComingSoonState> {
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
