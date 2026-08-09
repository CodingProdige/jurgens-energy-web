"use server";

import { revalidatePath } from "next/cache";

import {
  supportAgentIdSchema,
  supportAgentInputSchema,
  supportAgentOrderSchema,
} from "@/src/modules/support-agents/contracts";
import {
  createSupportAgent,
  deleteSupportAgent,
  reorderSupportAgents,
  SupportAgentInputError,
  updateSupportAgent,
} from "@/src/modules/support-agents/server";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export type SupportAgentMutationState = {
  message?: string;
  ok?: boolean;
};

function isChecked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function revalidateSupportAgentSurfaces() {
  revalidatePath("/about");
  revalidatePath("/support");
  revalidatePath("/settings/platform");
  revalidatePath("/", "layout");
}

function errorMessage(error: unknown) {
  if (error instanceof SupportAgentInputError) {
    return error.message;
  }

  console.error("Support-agent mutation failed", error);
  return "The support-team change could not be saved. Please try again.";
}

export async function saveSupportAgentAction(
  _state: SupportAgentMutationState,
  formData: FormData,
): Promise<SupportAgentMutationState> {
  const access = await requireAdminCapability("admin.settings.manage");

  if (!access.ok) {
    return {
      message: "You do not have permission to manage the public support team.",
      ok: false,
    };
  }

  const idValue = String(formData.get("id") ?? "").trim();
  const id = idValue ? supportAgentIdSchema.safeParse(idValue) : null;
  const parsed = supportAgentInputSchema.safeParse({
    availability: formData.get("availability"),
    bio: formData.get("bio"),
    displayName: formData.get("displayName"),
    isPublished: isChecked(formData, "isPublished"),
    photoMediaId: formData.get("photoMediaId"),
    publicEmail: formData.get("publicEmail"),
    publicPhone: formData.get("publicPhone"),
    publicWhatsapp: formData.get("publicWhatsapp"),
    roleTitle: formData.get("roleTitle"),
    showInFooter: isChecked(formData, "showInFooter"),
    showOnAbout: isChecked(formData, "showOnAbout"),
    showOnSupport: isChecked(formData, "showOnSupport"),
  });

  if ((id && !id.success) || !parsed.success) {
    return {
      message:
        (id && !id.success ? id.error.issues[0]?.message : null) ??
        (!parsed.success ? parsed.error.issues[0]?.message : null) ??
        "Check the support-agent details.",
      ok: false,
    };
  }

  try {
    if (id?.success) {
      await updateSupportAgent({
        actorUserId: access.session.user.id,
        id: id.data,
        input: parsed.data,
      });
    } else {
      await createSupportAgent({
        actorUserId: access.session.user.id,
        input: parsed.data,
      });
    }

    revalidateSupportAgentSurfaces();

    return {
      message: id?.success ? "Support agent updated." : "Support agent added.",
      ok: true,
    };
  } catch (error) {
    return { message: errorMessage(error), ok: false };
  }
}

export async function deleteSupportAgentAction(
  _state: SupportAgentMutationState,
  formData: FormData,
): Promise<SupportAgentMutationState> {
  const access = await requireAdminCapability("admin.settings.manage");

  if (!access.ok) {
    return {
      message: "You do not have permission to manage the public support team.",
      ok: false,
    };
  }

  const id = supportAgentIdSchema.safeParse(formData.get("id"));

  if (!id.success) {
    return { message: "Support agent was not found.", ok: false };
  }

  try {
    await deleteSupportAgent({
      actorUserId: access.session.user.id,
      id: id.data,
    });
    revalidateSupportAgentSurfaces();
    return { message: "Support agent removed.", ok: true };
  } catch (error) {
    return { message: errorMessage(error), ok: false };
  }
}

export async function reorderSupportAgentsAction(
  orderedIds: string[],
): Promise<SupportAgentMutationState> {
  const access = await requireAdminCapability("admin.settings.manage");

  if (!access.ok) {
    return {
      message: "You do not have permission to reorder the public support team.",
      ok: false,
    };
  }

  const parsed = supportAgentOrderSchema.safeParse(orderedIds);

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Check the support-team order.",
      ok: false,
    };
  }

  try {
    await reorderSupportAgents({
      actorUserId: access.session.user.id,
      orderedIds: parsed.data,
    });
    revalidateSupportAgentSurfaces();
    return { message: "Support-team order updated.", ok: true };
  } catch (error) {
    return { message: errorMessage(error), ok: false };
  }
}
