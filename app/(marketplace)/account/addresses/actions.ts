"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import {
  SOUTH_AFRICAN_ADDRESS_COUNTRY_CODE,
  isSouthAfricanProvince,
} from "@/src/modules/marketplace/account/address-options";
import {
  CustomerAddressLimitError,
  CustomerAddressNotFoundError,
  createCustomerAddress,
  customerAddressInputSchema,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  updateCustomerAddress,
} from "@/src/modules/marketplace/account/addresses";
import {
  isPhoneCountryCode,
  normalizePhoneNumber,
} from "@/src/modules/phone";

export type CustomerAddressActionState = {
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  status?: "error" | "success";
};

const addressIdSchema = z.string().uuid();

function getString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

async function requireCustomerId() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return session.user.id;
}

function getAddressInput(formData: FormData) {
  const province = getString(formData, "province");

  if (!isSouthAfricanProvince(province)) {
    return {
      state: {
        fieldErrors: {
          province: ["Select a South African province."],
        },
        message: "Check the highlighted address details and try again.",
        status: "error" as const,
      },
      success: false as const,
    };
  }

  const countryCodeValue = getString(
    formData,
    "recipientPhoneCountryCode",
  );
  const phoneCountryCode = isPhoneCountryCode(countryCodeValue)
    ? countryCodeValue
    : "ZA";
  const rawPhone = getString(formData, "recipientPhone");
  const normalizedPhone = normalizePhoneNumber(rawPhone, {
    defaultCountryCode: phoneCountryCode,
  });
  const parsed = customerAddressInputSchema.safeParse({
    addressLine1: getString(formData, "addressLine1"),
    addressLine2: getString(formData, "addressLine2"),
    city: getString(formData, "city"),
    countryCode: SOUTH_AFRICAN_ADDRESS_COUNTRY_CODE,
    isDefault: formData.get("isDefault") === "on",
    label: getString(formData, "label"),
    postalCode: getString(formData, "postalCode"),
    province,
    recipientName: getString(formData, "recipientName"),
    recipientPhone: normalizedPhone ?? rawPhone,
    suburb: getString(formData, "suburb"),
  });

  if (!parsed.success) {
    return {
      state: {
        fieldErrors: parsed.error.flatten().fieldErrors,
        message:
          parsed.error.issues[0]?.message ??
          "Check the highlighted address details and try again.",
        status: "error" as const,
      },
      success: false as const,
    };
  }

  return { data: parsed.data, success: true as const };
}

function revalidateAddressPages() {
  revalidatePath("/account");
  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
}

function mutationFailure(message: string, error: unknown) {
  if (
    error instanceof CustomerAddressLimitError ||
    error instanceof CustomerAddressNotFoundError
  ) {
    return { message: error.message, status: "error" as const };
  }

  console.error(message, error);

  return {
    message: "We could not update your saved addresses. Please try again.",
    status: "error" as const,
  };
}

export async function saveCustomerAddress(
  _state: CustomerAddressActionState,
  formData: FormData,
): Promise<CustomerAddressActionState> {
  const customerId = await requireCustomerId();
  const addressIdValue = getString(formData, "addressId");
  const addressId = addressIdValue
    ? addressIdSchema.safeParse(addressIdValue)
    : null;

  if (addressId && !addressId.success) {
    return {
      message: "That saved address could not be found.",
      status: "error",
    };
  }

  const input = getAddressInput(formData);

  if (!input.success) {
    return input.state;
  }

  try {
    if (addressId?.success) {
      await updateCustomerAddress(customerId, addressId.data, input.data);
    } else {
      await createCustomerAddress(customerId, input.data);
    }

    revalidateAddressPages();

    return {
      message: addressId?.success
        ? "Saved address updated."
        : "Address saved.",
      status: "success",
    };
  } catch (error) {
    return mutationFailure("Failed to save a customer address.", error);
  }
}

export async function removeCustomerAddress(
  _state: CustomerAddressActionState,
  formData: FormData,
): Promise<CustomerAddressActionState> {
  const customerId = await requireCustomerId();
  const addressId = addressIdSchema.safeParse(
    getString(formData, "addressId"),
  );

  if (!addressId.success) {
    return {
      message: "That saved address could not be found.",
      status: "error",
    };
  }

  try {
    await deleteCustomerAddress(customerId, addressId.data);
    revalidateAddressPages();

    return { message: "Address deleted.", status: "success" };
  } catch (error) {
    return mutationFailure("Failed to delete a customer address.", error);
  }
}

export async function makeCustomerAddressDefault(
  _state: CustomerAddressActionState,
  formData: FormData,
): Promise<CustomerAddressActionState> {
  const customerId = await requireCustomerId();
  const addressId = addressIdSchema.safeParse(
    getString(formData, "addressId"),
  );

  if (!addressId.success) {
    return {
      message: "That saved address could not be found.",
      status: "error",
    };
  }

  try {
    await setDefaultCustomerAddress(customerId, addressId.data);
    revalidateAddressPages();

    return { message: "Default address updated.", status: "success" };
  } catch (error) {
    return mutationFailure("Failed to set a default customer address.", error);
  }
}
