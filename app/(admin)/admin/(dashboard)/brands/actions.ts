"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { brands } from "@/src/db/schema";
import { env } from "@/src/config/env";
import { requireAdminAccess } from "@/src/modules/auth/permissions";

export type BrandMutationState = {
  message?: string;
  ok?: boolean;
};

const brandStatusValues = ["active", "hidden", "archived"] as const;

const brandSchema = z.object({
  description: z
    .string()
    .trim()
    .max(500, "Brand description must be 500 characters or less.")
    .optional(),
  id: z.string().uuid().optional(),
  logoMediaId: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .pipe(z.string().uuid().optional()),
  name: z.string().trim().min(2).max(160),
  status: z.enum(brandStatusValues).default("active"),
  websiteUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .refine((value) => !value || URL.canParse(value), {
      message: "Enter a valid website URL.",
    }),
});

const brandAvailabilitySchema = z.object({
  currentBrandId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
});

const brandDescriptionGenerationSchema = z.object({
  name: z.string().trim().min(2).max(160),
  websiteUrl: z.string().trim().max(300).optional(),
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

function clampBrandDescription(value: string) {
  return value.trim().replace(/^["']|["']$/g, "").slice(0, 500);
}

function getResponseText(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    for (const item of payload.output) {
      if (
        typeof item === "object" &&
        item !== null &&
        "content" in item &&
        Array.isArray(item.content)
      ) {
        const text = item.content
          .map((contentItem: unknown) =>
            typeof contentItem === "object" &&
            contentItem !== null &&
            "text" in contentItem &&
            typeof contentItem.text === "string"
              ? contentItem.text
              : "",
          )
          .join("")
          .trim();

        if (text) {
          return text;
        }
      }
    }
  }

  return "";
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function brandHasProducts(brandId: string, activeOnly = false) {
  const product = await db.query.products.findFirst({
    where: (table, { and, eq }) =>
      activeOnly
        ? and(eq(table.brandId, brandId), eq(table.status, "active"))
        : eq(table.brandId, brandId),
  });

  return Boolean(product);
}

export async function checkBrandNameAvailability(input: {
  currentBrandId?: string;
  name: string;
}) {
  await requireAdminAccess();

  const parsed = brandAvailabilitySchema.safeParse(input);

  if (!parsed.success) {
    return {
      available: false,
      message: "Enter at least 2 characters.",
    };
  }

  const slug = slugify(parsed.data.name);

  if (!slug) {
    return {
      available: false,
      message: "Use a brand name with letters or numbers.",
    };
  }

  const existing = await db.query.brands.findFirst({
    where: (brand, { eq }) => eq(brand.slug, slug),
  });

  if (existing && existing.id !== parsed.data.currentBrandId) {
    return {
      available: false,
      message: "A brand with that name already exists.",
    };
  }

  return {
    available: true,
    message: "This brand name is available.",
  };
}

export async function generateBrandDescription(input: {
  name: string;
  websiteUrl?: string;
}) {
  await requireAdminAccess();

  const parsed = brandDescriptionGenerationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter a brand name before generating a description.",
    };
  }

  if (!env.OPENAI_API_KEY) {
    return {
      ok: false,
      message: "OPENAI_API_KEY is not configured.",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          `Brand name: ${parsed.data.name}`,
          parsed.data.websiteUrl
            ? `Website URL: ${parsed.data.websiteUrl}`
            : null,
          "Write a polished marketplace brand description in 45-70 words.",
          "Keep it neutral, specific, buyer-friendly, and do not invent awards, certifications, official claims, shipping promises, prices, or availability.",
        ]
          .filter(Boolean)
          .join("\n"),
        instructions:
          "You write concise marketplace catalog copy for brand profile pages. Return only the description text.",
        max_output_tokens: 140,
        model: env.OPENAI_MODEL,
      }),
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        message: "The description generator is unavailable right now.",
      };
    }

    const description = clampBrandDescription(
      getResponseText(await response.json()),
    );

    if (!description) {
      return {
        ok: false,
        message: "The description generator did not return usable text.",
      };
    }

    return { ok: true, description };
  } catch {
    return {
      ok: false,
      message: "The description generator timed out. Try again.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function createBrand(
  _state: BrandMutationState,
  formData: FormData,
): Promise<BrandMutationState> {
  const session = await requireAdminAccess();

  const parsed = brandSchema.safeParse({
    description: optionalString(formData.get("description")),
    logoMediaId: optionalString(formData.get("logoMediaId")),
    name: formData.get("name"),
    status: formData.get("status") || "active",
    websiteUrl: optionalString(formData.get("websiteUrl")),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the brand fields.",
    };
  }

  const slug = slugify(parsed.data.name);

  if (!slug) {
    return { ok: false, message: "Use a brand name with letters or numbers." };
  }

  try {
    if (parsed.data.logoMediaId) {
      const logo = await db.query.media.findFirst({
        where: (asset, { and, eq }) =>
          and(
            eq(asset.id, parsed.data.logoMediaId!),
            eq(asset.ownerUserId, session.user.id),
          ),
      });

      if (!logo) {
        return { ok: false, message: "Selected brand image was not found." };
      }
    }

    await db.insert(brands).values({
      description: parsed.data.description,
      logoMediaId: parsed.data.logoMediaId,
      name: parsed.data.name,
      slug,
      status: parsed.data.status,
      websiteUrl: parsed.data.websiteUrl,
      updatedAt: new Date(),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: "A brand with that name already exists." };
    }

    throw error;
  }

  revalidatePath("/brands");

  return { ok: true, message: "Brand created." };
}

export async function updateBrand(
  _state: BrandMutationState,
  formData: FormData,
): Promise<BrandMutationState> {
  const session = await requireAdminAccess();

  const parsed = brandSchema.safeParse({
    description: optionalString(formData.get("description")),
    id: formData.get("id"),
    logoMediaId: optionalString(formData.get("logoMediaId")),
    name: formData.get("name"),
    status: formData.get("status"),
    websiteUrl: optionalString(formData.get("websiteUrl")),
  });

  if (!parsed.success || !parsed.data.id) {
    return {
      ok: false,
      message: parsed.success
        ? "Brand was not found."
        : parsed.error.issues[0]?.message ?? "Check the brand fields.",
    };
  }

  const existing = await db.query.brands.findFirst({
    where: (brand, { eq }) => eq(brand.id, parsed.data.id!),
  });

  if (!existing) {
    return { ok: false, message: "Brand was not found." };
  }

  if (
    parsed.data.status !== "active" &&
    (await brandHasProducts(existing.id, true))
  ) {
    return {
      ok: false,
      message:
        "This brand cannot be hidden or archived while active products use it.",
    };
  }

  const slug = slugify(parsed.data.name);

  if (!slug) {
    return { ok: false, message: "Use a brand name with letters or numbers." };
  }

  try {
    if (
      parsed.data.logoMediaId &&
      parsed.data.logoMediaId !== existing.logoMediaId
    ) {
      const logo = await db.query.media.findFirst({
        where: (asset, { and, eq }) =>
          and(
            eq(asset.id, parsed.data.logoMediaId!),
            eq(asset.ownerUserId, session.user.id),
          ),
      });

      if (!logo) {
        return { ok: false, message: "Selected brand image was not found." };
      }
    }

    await db
      .update(brands)
      .set({
        description: parsed.data.description,
        logoMediaId: parsed.data.logoMediaId ?? null,
        name: parsed.data.name,
        slug,
        status: parsed.data.status,
        updatedAt: new Date(),
        websiteUrl: parsed.data.websiteUrl,
      })
      .where(eq(brands.id, existing.id));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: "A brand with that name already exists." };
    }

    throw error;
  }

  revalidatePath("/brands");

  return { ok: true, message: "Brand updated." };
}

export async function deleteBrand(
  _state: BrandMutationState,
  formData: FormData,
): Promise<BrandMutationState> {
  await requireAdminAccess();

  const parsed = z
    .object({
      id: z.string().uuid(),
    })
    .safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    return { ok: false, message: "Brand was not found." };
  }

  const existing = await db.query.brands.findFirst({
    where: (brand, { eq }) => eq(brand.id, parsed.data.id),
  });

  if (!existing) {
    return { ok: false, message: "Brand was not found." };
  }

  if (await brandHasProducts(existing.id)) {
    return {
      ok: false,
      message: "This brand cannot be deleted because products already use it.",
    };
  }

  await db.delete(brands).where(eq(brands.id, existing.id));

  revalidatePath("/brands");

  return { ok: true, message: "Brand deleted." };
}
