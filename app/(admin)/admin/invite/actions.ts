"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { acceptAdminStaffInvitation } from "@/src/modules/admin/staff";

export type AcceptAdminInviteState = {
  error?: string;
};

const acceptInviteSchema = z
  .object({
    confirmPassword: z.string().min(12),
    name: z.string().trim().max(160).optional(),
    password: z.string().min(12),
    token: z.string().min(20),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function acceptAdminInvite(
  _state: AcceptAdminInviteState,
  formData: FormData,
): Promise<AcceptAdminInviteState> {
  const parsed = acceptInviteSchema.safeParse({
    confirmPassword: formData.get("confirmPassword"),
    name: String(formData.get("name") ?? "").trim() || undefined,
    password: formData.get("password"),
    token: formData.get("token"),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Enter your name and a password with at least 12 characters.",
    };
  }

  const user = await acceptAdminStaffInvitation(parsed.data);

  if (!user) {
    return { error: "This invitation link is invalid or has expired." };
  }

  redirect("/sign-in");
}
