"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { whatsappPhoneSchema } from "@/src/modules/auth/validation";
import {
  linkWhatsappNumberToUser,
  WhatsappNumberLinkedToAnotherUserError,
} from "@/src/modules/whatsapp-ordering/customer-links";

export type WhatsappNumberState = {
  error?: string;
  success?: string;
};

const whatsappNumberFormSchema = z.object({
  next: z.string().trim().max(300).optional(),
  whatsappPhone: whatsappPhoneSchema,
});

function getSafeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

export async function saveCustomerWhatsappNumber(
  _state: WhatsappNumberState,
  formData: FormData,
): Promise<WhatsappNumberState> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const parsed = whatsappNumberFormSchema.safeParse({
    next: formData.get("next"),
    whatsappPhone: {
      countryCode: formData.get("whatsappPhoneCountryCode"),
      phone: formData.get("whatsappPhone"),
    },
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Enter a valid WhatsApp number.",
    };
  }

  try {
    await linkWhatsappNumberToUser({
      phone: parsed.data.whatsappPhone,
      source: "account_settings",
      userId: session.user.id,
      verified: false,
    });
  } catch (error) {
    if (error instanceof WhatsappNumberLinkedToAnotherUserError) {
      return {
        error:
          "That WhatsApp number is already linked to another account. Use a different number or contact support.",
      };
    }

    throw error;
  }

  revalidatePath("/account/whatsapp");

  const nextPath = getSafeNextPath(parsed.data.next);

  if (nextPath && nextPath !== "/account/whatsapp") {
    redirect(nextPath);
  }

  return { success: "WhatsApp number saved." };
}
