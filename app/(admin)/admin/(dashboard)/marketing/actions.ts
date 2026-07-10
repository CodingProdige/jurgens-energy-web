"use server";

import { revalidatePath } from "next/cache";

import { requireAdminCapability } from "@/src/modules/auth/permissions";
import {
  publishStorefrontDraft,
  saveStorefrontDraft,
  validateStorefrontSections,
} from "@/src/modules/marketplace/storefront";
import type { StorefrontSection } from "@/src/modules/marketplace/storefront-types";

export type StorefrontBuilderActionState = {
  message: string;
  ok: boolean;
};

async function requireStorefrontManageAccess() {
  const access = await requireAdminCapability("admin.marketing.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to manage storefront content.");
  }
}

export async function saveStorefrontDraftAction(
  sections: StorefrontSection[],
): Promise<StorefrontBuilderActionState> {
  await requireStorefrontManageAccess();

  const parsed = validateStorefrontSections(sections);

  if (!parsed.ok) {
    return {
      ok: false,
      message: parsed.message,
    };
  }

  await saveStorefrontDraft({ sections: parsed.sections });

  revalidatePath("/marketing");
  revalidatePath("/site-builder");

  return {
    ok: true,
    message: "Draft saved.",
  };
}

export async function publishStorefrontDraftAction(
  sections: StorefrontSection[],
): Promise<StorefrontBuilderActionState> {
  await requireStorefrontManageAccess();

  const parsed = validateStorefrontSections(sections);

  if (!parsed.ok) {
    return {
      ok: false,
      message: parsed.message,
    };
  }

  await publishStorefrontDraft({ sections: parsed.sections });

  revalidatePath("/");
  revalidatePath("/marketing");
  revalidatePath("/site-builder");

  return {
    ok: true,
    message: "Storefront published.",
  };
}
