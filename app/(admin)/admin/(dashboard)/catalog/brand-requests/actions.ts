"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { brandRequests, brands } from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export type BrandRequestMutationState = {
  message?: string;
  ok?: boolean;
};

const requestIdSchema = z.object({
  id: z.string().uuid(),
});

const rejectRequestSchema = requestIdSchema.extend({
  rejectionReason: z.string().trim().min(2).max(500),
});

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  return stringValue || undefined;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function requireCatalogManageAccess() {
  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    throw new Error("You do not have permission to manage catalog.");
  }

  return access.session;
}

export async function approveBrandRequest(
  _state: BrandRequestMutationState,
  formData: FormData,
): Promise<BrandRequestMutationState> {
  const session = await requireCatalogManageAccess();
  const parsed = requestIdSchema.safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    return { ok: false, message: "Brand request was not found." };
  }

  const request = await db.query.brandRequests.findFirst({
    where: (table, { eq }) => eq(table.id, parsed.data.id),
  });

  if (!request) {
    return { ok: false, message: "Brand request was not found." };
  }

  if (request.status !== "pending") {
    return { ok: false, message: "Only pending brand requests can be approved." };
  }

  const slug = slugify(request.brandName);

  if (!slug) {
    return { ok: false, message: "The requested brand name is invalid." };
  }

  try {
    await db.transaction(async (tx) => {
      const existingBrand = await tx.query.brands.findFirst({
        where: (table, { eq }) => eq(table.slug, slug),
      });
      let approvedBrandId = existingBrand?.id;

      if (!approvedBrandId) {
        const [brand] = await tx
          .insert(brands)
          .values({
            description: request.notes,
            name: request.brandName,
            slug,
            status: "active",
            updatedAt: new Date(),
            websiteUrl: request.websiteUrl,
          })
          .returning({ id: brands.id });

        approvedBrandId = brand.id;
      }

      await tx
        .update(brandRequests)
        .set({
          brandId: approvedBrandId,
          reviewedAt: new Date(),
          reviewedByUserId: session.user.id,
          status: "approved",
          updatedAt: new Date(),
        })
        .where(eq(brandRequests.id, request.id));
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message: "An approved brand with this name already exists.",
      };
    }

    throw error;
  }

  revalidatePath("/catalog/brand-requests");
  revalidatePath("/catalog/brands");

  return { ok: true, message: "Brand request approved." };
}

export async function rejectBrandRequest(
  _state: BrandRequestMutationState,
  formData: FormData,
): Promise<BrandRequestMutationState> {
  const session = await requireCatalogManageAccess();
  const parsed = rejectRequestSchema.safeParse({
    id: formData.get("id"),
    rejectionReason: formData.get("rejectionReason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the rejection reason.",
    };
  }

  const request = await db.query.brandRequests.findFirst({
    where: (table, { eq }) => eq(table.id, parsed.data.id),
  });

  if (!request) {
    return { ok: false, message: "Brand request was not found." };
  }

  if (request.status !== "pending") {
    return { ok: false, message: "Only pending brand requests can be rejected." };
  }

  await db
    .update(brandRequests)
    .set({
      rejectionReason: parsed.data.rejectionReason,
      reviewedAt: new Date(),
      reviewedByUserId: session.user.id,
      status: "rejected",
      updatedAt: new Date(),
    })
    .where(eq(brandRequests.id, request.id));

  revalidatePath("/catalog/brand-requests");

  return { ok: true, message: "Brand request rejected." };
}

export async function deleteBrandRequest(
  _state: BrandRequestMutationState,
  formData: FormData,
): Promise<BrandRequestMutationState> {
  await requireCatalogManageAccess();
  const parsed = requestIdSchema.safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    return { ok: false, message: "Brand request was not found." };
  }

  await db.delete(brandRequests).where(eq(brandRequests.id, parsed.data.id));
  revalidatePath("/catalog/brand-requests");

  return { ok: true, message: "Brand request deleted." };
}

export async function createBrandRequestForTesting(
  _state: BrandRequestMutationState,
  formData: FormData,
): Promise<BrandRequestMutationState> {
  await requireCatalogManageAccess();

  const parsed = z
    .object({
      brandName: z.string().trim().min(2).max(160),
      notes: z.string().trim().max(500).optional(),
      websiteUrl: z
        .string()
        .trim()
        .max(300)
        .optional()
        .refine((value) => !value || URL.canParse(value), {
          message: "Enter a valid website URL.",
        }),
    })
    .safeParse({
      brandName: formData.get("brandName"),
      notes: optionalString(formData.get("notes")),
      websiteUrl: optionalString(formData.get("websiteUrl")),
    });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the request fields.",
    };
  }

  const slug = slugify(parsed.data.brandName);

  if (!slug) {
    return { ok: false, message: "Use a brand name with letters or numbers." };
  }

  try {
    await db.insert(brandRequests).values({
      brandName: parsed.data.brandName,
      notes: parsed.data.notes,
      slug,
      websiteUrl: parsed.data.websiteUrl,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: "This brand request already exists." };
    }

    throw error;
  }

  revalidatePath("/catalog/brand-requests");

  return { ok: true, message: "Brand request created." };
}
