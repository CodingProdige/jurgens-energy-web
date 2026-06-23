"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { db } from "@/src/db";
import {
  sellerFulfillmentProfiles,
  sellerParcelPresets,
} from "@/src/db/schema";
import { normalizePhoneNumber } from "@/src/modules/phone";
import { getPrimarySellerForUser } from "@/src/modules/sellers/dashboard";

export type SellerShippingActionState = {
  message?: string;
  ok?: boolean;
};

const metricSchema = z.coerce.number().positive().max(1_000_000);
const parcelPresetSchema = z.object({
  heightMm: metricSchema,
  id: z.string().uuid().optional(),
  isDefault: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  lengthMm: metricSchema,
  name: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(500).optional(),
  weightGrams: metricSchema,
  widthMm: metricSchema,
});
const collectionProfileSchema = z.object({
  addressLine1: z.string().trim().min(2).max(240),
  addressLine2: z.string().trim().max(240).optional(),
  addressType: z.enum(["business", "residential"]).default("business"),
  city: z.string().trim().min(2).max(120),
  collectionInstructions: z.string().trim().max(1000).optional(),
  contactEmail: z.string().trim().email().max(254),
  contactName: z.string().trim().min(2).max(160),
  contactPhone: z
    .string()
    .trim()
    .min(6)
    .max(40)
    .transform((value, context) => {
      const normalized = normalizePhoneNumber(value, { defaultCountryCode: "ZA" });

      if (!normalized) {
        context.addIssue({
          code: "custom",
          message: "Enter a valid South African phone number.",
        });

        return z.NEVER;
      }

      return normalized;
    }),
  postalCode: z.string().trim().min(2).max(40),
  province: z.string().trim().min(2).max(120),
  suburb: z.string().trim().min(2).max(120),
});

function normalizePresetName(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

async function requireSeller() {
  const session = await requireSellerDashboardAccess();
  const seller = await getPrimarySellerForUser(session.user.id);

  if (!seller) {
    throw new Error("Seller access could not be confirmed.");
  }

  return seller;
}

export async function saveParcelPreset(
  _state: SellerShippingActionState,
  formData: FormData,
): Promise<SellerShippingActionState> {
  const seller = await requireSeller();
  const parsed = parcelPresetSchema.safeParse({
    heightMm: formData.get("heightMm"),
    id: String(formData.get("id") ?? "") || undefined,
    isActive: formData.get("isActive") === "on",
    isDefault: formData.get("isDefault") === "on",
    lengthMm: formData.get("lengthMm"),
    name: String(formData.get("name") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    weightGrams: formData.get("weightGrams"),
    widthMm: formData.get("widthMm"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the parcel preset.",
    };
  }

  const normalizedName = normalizePresetName(parsed.data.name);

  if (!normalizedName) {
    return { ok: false, message: "Use a clearer parcel preset name." };
  }

  const conflictingPreset = await db
    .select({ id: sellerParcelPresets.id })
    .from(sellerParcelPresets)
    .where(
      and(
        eq(sellerParcelPresets.sellerId, seller.id),
        eq(sellerParcelPresets.normalizedName, normalizedName),
      ),
    )
    .limit(1);

  if (
    conflictingPreset[0] &&
    (!parsed.data.id || conflictingPreset[0].id !== parsed.data.id)
  ) {
    return { ok: false, message: "A preset with this name already exists." };
  }

  await db.transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx
        .update(sellerParcelPresets)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(sellerParcelPresets.sellerId, seller.id));
    }

    if (parsed.data.id) {
      await tx
        .update(sellerParcelPresets)
        .set({
          heightMm: parsed.data.heightMm,
          isActive: parsed.data.isActive,
          isDefault: parsed.data.isDefault,
          lengthMm: parsed.data.lengthMm,
          name: parsed.data.name,
          normalizedName,
          notes: parsed.data.notes || null,
          updatedAt: new Date(),
          weightGrams: parsed.data.weightGrams,
          widthMm: parsed.data.widthMm,
        })
        .where(
          and(
            eq(sellerParcelPresets.id, parsed.data.id),
            eq(sellerParcelPresets.sellerId, seller.id),
          ),
        );
      return;
    }

    await tx.insert(sellerParcelPresets).values({
      heightMm: parsed.data.heightMm,
      isActive: parsed.data.isActive,
      isDefault: parsed.data.isDefault,
      lengthMm: parsed.data.lengthMm,
      name: parsed.data.name,
      normalizedName,
      notes: parsed.data.notes || null,
      sellerId: seller.id,
      weightGrams: parsed.data.weightGrams,
      widthMm: parsed.data.widthMm,
    });
  });

  revalidatePath("/shipping/parcel-presets");
  revalidatePath("/products/new");

  return { ok: true, message: "Parcel preset saved." };
}

export async function disableParcelPreset(
  _state: SellerShippingActionState,
  formData: FormData,
): Promise<SellerShippingActionState> {
  const seller = await requireSeller();
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return { ok: false, message: "Choose a preset first." };
  }

  await db
    .update(sellerParcelPresets)
    .set({ isActive: false, isDefault: false, updatedAt: new Date() })
    .where(
      and(eq(sellerParcelPresets.id, id), eq(sellerParcelPresets.sellerId, seller.id)),
    );

  revalidatePath("/shipping/parcel-presets");
  revalidatePath("/products/new");

  return { ok: true, message: "Parcel preset disabled." };
}

export async function saveCollectionProfile(
  _state: SellerShippingActionState,
  formData: FormData,
): Promise<SellerShippingActionState> {
  const seller = await requireSeller();
  const parsed = collectionProfileSchema.safeParse({
    addressLine1: String(formData.get("addressLine1") ?? ""),
    addressLine2: String(formData.get("addressLine2") ?? ""),
    addressType: String(formData.get("addressType") ?? "business"),
    city: String(formData.get("city") ?? ""),
    collectionInstructions: String(formData.get("collectionInstructions") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    province: String(formData.get("province") ?? ""),
    suburb: String(formData.get("suburb") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the collection profile.",
    };
  }

  await db
    .insert(sellerFulfillmentProfiles)
    .values({
      ...parsed.data,
      addressLine2: parsed.data.addressLine2 || null,
      collectionInstructions: parsed.data.collectionInstructions || null,
      countryCode: "ZA",
      isVerified: false,
      sellerId: seller.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: sellerFulfillmentProfiles.sellerId,
      set: {
        ...parsed.data,
        addressLine2: parsed.data.addressLine2 || null,
        collectionInstructions: parsed.data.collectionInstructions || null,
        isVerified: false,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/shipping/collection-profile");
  revalidatePath("/shipping/overview");

  return { ok: true, message: "Collection profile saved." };
}
