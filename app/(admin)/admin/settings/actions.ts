"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/src/modules/auth/permissions";
import { updateMarketplaceComingSoonSettings } from "@/src/modules/marketplace/settings";

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
