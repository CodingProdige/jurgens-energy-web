"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAccess } from "@/src/modules/auth/permissions";
import {
  updateMarketplaceComingSoonSettings,
  updateMarketplaceSocialLinks,
} from "@/src/modules/marketplace/settings";

export type AdminSettingsState = {
  message?: string;
  ok?: boolean;
};

export async function updateMarketplaceGateSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireAdminAccess();

  const password = String(formData.get("password") ?? "").trim();
  const enabled = formData.get("enabled") === "on";

  const result = await updateMarketplaceComingSoonSettings({
    enabled,
    password: password || undefined,
  });

  revalidatePath("/");
  revalidatePath("/sign-in");
  revalidatePath("/register");
  revalidatePath("/forgot-password");
  revalidatePath("/reset-password");
  revalidatePath("/settings");

  return result;
}

const optionalUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine(
    (value) => !value || value.startsWith("https://"),
    "Use a full https:// URL.",
  )
  .refine((value) => !value || value.length <= 500, "URL is too long.");

const socialLinksSchema = z.object({
  facebookUrl: optionalUrlSchema,
  instagramUrl: optionalUrlSchema,
  twitterUrl: optionalUrlSchema,
});

export async function updateMarketplaceSocialLinkSettings(
  _state: AdminSettingsState,
  formData: FormData,
): Promise<AdminSettingsState> {
  await requireAdminAccess();

  const parsed = socialLinksSchema.safeParse({
    facebookUrl: String(formData.get("facebookUrl") ?? ""),
    instagramUrl: String(formData.get("instagramUrl") ?? ""),
    twitterUrl: String(formData.get("twitterUrl") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the social links.",
    };
  }

  const result = await updateMarketplaceSocialLinks(parsed.data);

  revalidatePath("/");
  revalidatePath("/settings");

  return result;
}
