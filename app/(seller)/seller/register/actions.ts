"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { findUserByEmail } from "@/src/modules/auth/service";
import { verifySsoHandoffToken } from "@/src/modules/auth/sso-handoff";
import {
  createSellerApplicationForExistingUser,
  createSellerApplicationForNewUser,
  createSellerStoreSlug,
  findSellerApplicationByUserId,
  getSellerStoreNameAvailability,
  getSellerAccessState,
  isSellerStoreSlugAvailable,
} from "@/src/modules/sellers/applications";
import { getAdminNotificationRecipientIds } from "@/src/modules/notifications/in-app";
import { notify } from "@/src/modules/notifications/templates";

export type SellerApplicationStatus = "pending" | "approved" | "rejected";

export type SellerEmailCheckState = {
  applicationStatus?: SellerApplicationStatus;
  email?: string;
  error?: string;
  mode?:
    | "new_user"
    | "existing_signed_in"
    | "sign_in_required"
    | "already_seller"
    | "existing_application"
    | "email_mismatch";
  userName?: string | null;
};

export type SellerApplicationSubmitState = {
  error?: string;
  ok?: boolean;
};

export type SellerStoreNameAvailabilityState = {
  available?: boolean;
  error?: string;
  storeSlug?: string;
  suggestions?: string[];
};

const emailCheckSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
});

const sellerApplicationSchema = z.object({
  addressLine1: z.string().trim().min(3).max(240),
  addressLine2: z.string().trim().max(240).optional(),
  businessType: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(120),
  countryRegion: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase().max(254),
  fullName: z.string().trim().max(160).optional(),
  password: z.string().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "Enter a valid mobile number."),
  postalCode: z.string().trim().min(2).max(40),
  ssoHandoffToken: z.string().optional(),
  stateProvince: z.string().trim().min(2).max(120),
  storeName: z.string().trim().min(2).max(160),
});

const storeNameAvailabilitySchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(2, "Enter at least 2 characters.")
    .max(160),
});

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function notifySellerApplicationSubmitted({
  applicantUserId,
  storeName,
}: {
  applicantUserId: string;
  storeName: string;
}) {
  const adminRecipientIds = await getAdminNotificationRecipientIds();

  await Promise.all([
    notify({
      data: { storeName },
      event: "seller.application.submitted",
      recipientUserId: applicantUserId,
    }),
    ...adminRecipientIds.map((recipientUserId) =>
      notify({
        data: { storeName },
        event: "admin.seller_application.submitted",
        recipientUserId,
      }),
    ),
  ]);
}

export async function checkSellerRegistrationEmail(
  _state: SellerEmailCheckState,
  formData: FormData,
): Promise<SellerEmailCheckState> {
  const parsed = emailCheckSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const session = await auth();
  const sessionEmail = session?.user.email?.toLowerCase();
  const email = parsed.data.email;

  if (sessionEmail && sessionEmail !== email) {
    return {
      email,
      mode: "email_mismatch",
      error:
        "You are signed in with a different account. Use your signed-in email or sign out first.",
    };
  }

  const existingUser = await findUserByEmail(email);

  if (!existingUser) {
    return { email, mode: "new_user" };
  }

  const accessState = await getSellerAccessState(existingUser.id);

  if (accessState.hasSellerAccess) {
    return {
      email,
      mode: "already_seller",
      userName: existingUser.name,
    };
  }

  const application = await findSellerApplicationByUserId(existingUser.id);

  if (application) {
    return {
      applicationStatus: application.status,
      email,
      mode: "existing_application",
      userName: existingUser.name,
    };
  }

  if (!session?.user || session.user.id !== existingUser.id) {
    return {
      email,
      mode: "sign_in_required",
      userName: existingUser.name,
    };
  }

  return {
    email,
    mode: "existing_signed_in",
    userName: existingUser.name,
  };
}

export async function checkSellerStoreNameAvailability(
  storeName: string,
): Promise<SellerStoreNameAvailabilityState> {
  const parsed = storeNameAvailabilitySchema.safeParse({ storeName });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Enter a valid store name.",
    };
  }

  return getSellerStoreNameAvailability(parsed.data.storeName);
}

export async function submitSellerApplication(
  _state: SellerApplicationSubmitState,
  formData: FormData,
): Promise<SellerApplicationSubmitState> {
  const parsed = sellerApplicationSchema.safeParse({
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    businessType: formData.get("businessType"),
    city: formData.get("city"),
    countryRegion: formData.get("countryRegion"),
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
    phone: formData.get("phone"),
    postalCode: formData.get("postalCode"),
    ssoHandoffToken: formData.get("ssoHandoffToken"),
    stateProvince: formData.get("stateProvince"),
    storeName: formData.get("storeName"),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Check the seller application fields.",
    };
  }

  const session = await auth();
  const existingUser = await findUserByEmail(parsed.data.email);
  const handoff = verifySsoHandoffToken(parsed.data.ssoHandoffToken);
  let applicantUserId: string | null = null;

  if (existingUser) {
    const hasMatchingSession = session?.user?.id === existingUser.id;
    const hasMatchingHandoff =
      handoff?.userId === existingUser.id &&
      handoff.email.toLowerCase() === existingUser.email.toLowerCase();

    if (!hasMatchingSession && !hasMatchingHandoff) {
      return {
        error: "Please sign in with this account before continuing.",
      };
    }

    const accessState = await getSellerAccessState(existingUser.id);

    if (accessState.hasSellerAccess) {
      return { error: "This account already has seller access." };
    }

    const existingApplication = await findSellerApplicationByUserId(
      existingUser.id,
    );

    if (existingApplication) {
      return { ok: true };
    }

    const storeSlug = createSellerStoreSlug(parsed.data.storeName);
    const isStoreSlugAvailable = await isSellerStoreSlugAvailable(storeSlug);

    if (!isStoreSlugAvailable) {
      return {
        error:
          "That store name is already in use. Please choose a unique store name.",
      };
    }

    try {
      const applicant = await createSellerApplicationForExistingUser(
        existingUser.id,
        parsed.data,
      );
      applicantUserId = applicant.id;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          error:
            "This account or store name already has a seller application.",
        };
      }

      throw error;
    }
  } else {
    if (session?.user) {
      return {
        error:
          "You are signed in with a different account. Use your signed-in email or sign out first.",
      };
    }

    if (!parsed.data.fullName || parsed.data.fullName.length < 2) {
      return { error: "Enter your full name." };
    }

    if (!parsed.data.password || parsed.data.password.length < 8) {
      return { error: "Use a password with at least 8 characters." };
    }

    const storeSlug = createSellerStoreSlug(parsed.data.storeName);
    const isStoreSlugAvailable = await isSellerStoreSlugAvailable(storeSlug);

    if (!isStoreSlugAvailable) {
      return {
        error:
          "That store name is already in use. Please choose a unique store name.",
      };
    }

    try {
      const applicant = await createSellerApplicationForNewUser({
        ...parsed.data,
        fullName: parsed.data.fullName,
        password: parsed.data.password,
      });
      applicantUserId = applicant.id;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          error:
            "This email or store name already exists. Please sign in or choose another store name.",
        };
      }

      throw error;
    }
  }

  if (applicantUserId) {
    try {
      await notifySellerApplicationSubmitted({
        applicantUserId,
        storeName: parsed.data.storeName,
      });
    } catch (error) {
      console.error("Failed to create seller application notifications", error);
    }
  }

  revalidatePath("/register");

  return { ok: true };
}
