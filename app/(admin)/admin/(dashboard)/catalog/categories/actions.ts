"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/src/db";
import { categories } from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export type CategoryMutationState = {
  message?: string;
  ok?: boolean;
};

const categoryStatusValues = ["active", "hidden", "archived"] as const;

const createCategorySchema = z.object({
  commissionRateBps: z.coerce.number().int().min(0).max(9999).optional(),
  description: z.string().trim().max(500).optional(),
  name: z.string().trim().min(2).max(160),
  parentId: z.string().uuid().optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
});

const updateCategorySchema = z.object({
  commissionRateBps: z.coerce.number().int().min(0).max(9999).optional(),
  description: z.string().trim().max(500).optional(),
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
  status: z.enum(categoryStatusValues),
});

const deleteCategorySchema = z.object({
  id: z.string().uuid(),
});

const moveCategorySchema = z.object({
  direction: z.enum(["up", "down"]),
  id: z.string().uuid(),
});

const categoryAvailabilitySchema = z.object({
  currentCategoryId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  parentId: z.string().uuid().optional(),
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

function optionalNumber(value: FormDataEntryValue | null) {
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

async function getCategoryBranchIds(categoryPath: string, categoryId: string) {
  const branch = await db.query.categories.findMany({
    where: (category, { or, eq, like }) =>
      or(eq(category.id, categoryId), like(category.path, `${categoryPath}/%`)),
    orderBy: (category) => desc(category.depth),
  });

  return branch.map((category) => category.id);
}

async function categoryBranchHasActiveProducts(branchIds: string[]) {
  if (branchIds.length === 0) {
    return false;
  }

  const linkedProduct = await db.query.products.findFirst({
    where: (product, { and, eq, inArray }) =>
      and(inArray(product.categoryId, branchIds), eq(product.status, "active")),
  });

  return Boolean(linkedProduct);
}

async function getCategorySiblings(parentId: string | null) {
  return db.query.categories.findMany({
    where: (category) =>
      parentId ? eq(category.parentId, parentId) : isNull(category.parentId),
    orderBy: (category) => [asc(category.sortOrder), asc(category.name)],
  });
}

export async function checkCategoryNameAvailability(input: {
  currentCategoryId?: string;
  name: string;
  parentId?: string | null;
}) {
  await requireCatalogManageAccess();

  const parsed = categoryAvailabilitySchema.safeParse({
    currentCategoryId: input.currentCategoryId,
    name: input.name,
    parentId: input.parentId || undefined,
  });

  if (!parsed.success) {
    return {
      available: false,
      message: "Enter at least 2 characters.",
    };
  }

  const parent = parsed.data.parentId
    ? await db.query.categories.findFirst({
        where: (category, { eq }) => eq(category.id, parsed.data.parentId!),
      })
    : null;

  if (parsed.data.parentId && !parent) {
    return {
      available: false,
      message: "Parent category was not found.",
    };
  }

  const slug = slugify(parsed.data.name);

  if (!slug) {
    return {
      available: false,
      message: "Use a category name with letters or numbers.",
    };
  }

  const path = parent ? `${parent.path}/${slug}` : slug;
  const existing = await db.query.categories.findFirst({
    where: (category, { eq }) => eq(category.path, path),
  });

  if (existing && existing.id !== parsed.data.currentCategoryId) {
    return {
      available: false,
      message: "A category with that name already exists in this branch.",
    };
  }

  return {
    available: true,
    message: "This category name is available.",
  };
}

export async function createCategory(
  _state: CategoryMutationState,
  formData: FormData,
): Promise<CategoryMutationState> {
  await requireCatalogManageAccess();

  const parsed = createCategorySchema.safeParse({
    commissionRateBps: optionalNumber(formData.get("commissionRateBps")),
    description: optionalString(formData.get("description")),
    name: formData.get("name"),
    parentId: optionalString(formData.get("parentId")),
    sortOrder: optionalNumber(formData.get("sortOrder")) ?? 0,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the category fields.",
    };
  }

  const parent = parsed.data.parentId
    ? await db.query.categories.findFirst({
        where: (category, { eq }) => eq(category.id, parsed.data.parentId!),
      })
    : null;

  if (parsed.data.parentId && !parent) {
    return { ok: false, message: "Parent category was not found." };
  }

  if (parent?.isLocked) {
    return {
      ok: false,
      message: "Unlock the parent category before adding a subcategory.",
    };
  }

  const slug = slugify(parsed.data.name);
  const path = parent ? `${parent.path}/${slug}` : slug;

  if (!slug) {
    return { ok: false, message: "Use a category name with letters or numbers." };
  }

  try {
    await db.insert(categories).values({
      commissionRateBps: parent ? null : (parsed.data.commissionRateBps ?? 0),
      depth: parent ? parent.depth + 1 : 0,
      description: parsed.data.description,
      name: parsed.data.name,
      parentId: parent?.id,
      path,
      slug,
      sortOrder: parsed.data.sortOrder,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message: "A category with that name already exists in this branch.",
      };
    }

    throw error;
  }

  revalidatePath("/catalog/categories");

  return { ok: true, message: "Category created." };
}

export async function updateCategory(
  _state: CategoryMutationState,
  formData: FormData,
): Promise<CategoryMutationState> {
  await requireCatalogManageAccess();

  const parsed = updateCategorySchema.safeParse({
    commissionRateBps: optionalNumber(formData.get("commissionRateBps")),
    description: optionalString(formData.get("description")),
    id: formData.get("id"),
    name: formData.get("name"),
    sortOrder: optionalNumber(formData.get("sortOrder")) ?? 0,
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the category fields.",
    };
  }

  const existing = await db.query.categories.findFirst({
    where: (category, { eq }) => eq(category.id, parsed.data.id),
  });

  if (!existing) {
    return { ok: false, message: "Category was not found." };
  }

  if (existing.isLocked) {
    return {
      ok: false,
      message: "Unlock this category before updating it.",
    };
  }

  if (parsed.data.status !== "active") {
    const branchIds = await getCategoryBranchIds(existing.path, existing.id);
    const hasActiveProducts = await categoryBranchHasActiveProducts(branchIds);

    if (hasActiveProducts) {
      return {
        ok: false,
        message:
          "This category cannot be hidden or archived while active products use it or one of its subcategories.",
      };
    }
  }

  const parent = existing.parentId
    ? await db.query.categories.findFirst({
        where: (category, { eq }) => eq(category.id, existing.parentId!),
      })
    : null;

  if (existing.parentId && !parent) {
    return { ok: false, message: "Parent category was not found." };
  }

  const nextSlug = slugify(parsed.data.name);

  if (!nextSlug) {
    return { ok: false, message: "Use a category name with letters or numbers." };
  }

  const nextPath = parent ? `${parent.path}/${nextSlug}` : nextSlug;
  const pathChanged = nextPath !== existing.path;
  const descendants = pathChanged
    ? await db.query.categories.findMany({
        where: (category, { like }) => like(category.path, `${existing.path}/%`),
        orderBy: (category) => asc(category.depth),
      })
    : [];
  const updateValues = {
    commissionRateBps:
      existing.depth === 0 ? (parsed.data.commissionRateBps ?? 0) : null,
    description: parsed.data.description,
    name: parsed.data.name,
    path: nextPath,
    slug: nextSlug,
    status: parsed.data.status,
    updatedAt: new Date(),
  };
  const siblings = await getCategorySiblings(existing.parentId);
  const currentIndex = siblings.findIndex((category) => category.id === existing.id);
  const nextIndex =
    currentIndex === -1
      ? 0
      : Math.min(
          Math.max(parsed.data.sortOrder, 1),
          Math.max(siblings.length, 1),
        ) - 1;

  try {
    if (currentIndex !== -1 && currentIndex !== nextIndex) {
      const reordered = siblings.filter((category) => category.id !== existing.id);
      reordered.splice(nextIndex, 0, existing);

      await db.transaction(async (tx) => {
        await tx
          .update(categories)
          .set(updateValues)
          .where(eq(categories.id, parsed.data.id));

        for (const descendant of descendants) {
          await tx
            .update(categories)
            .set({
              path: `${nextPath}${descendant.path.slice(existing.path.length)}`,
              updatedAt: new Date(),
            })
            .where(eq(categories.id, descendant.id));
        }

        for (const [index, category] of reordered.entries()) {
          await tx
            .update(categories)
            .set({
              sortOrder: index + 1,
              updatedAt: new Date(),
            })
            .where(eq(categories.id, category.id));
        }
      });
    } else {
      await db.transaction(async (tx) => {
        await tx
          .update(categories)
          .set({
            ...updateValues,
            sortOrder: nextIndex + 1,
          })
          .where(eq(categories.id, parsed.data.id));

        for (const descendant of descendants) {
          await tx
            .update(categories)
            .set({
              path: `${nextPath}${descendant.path.slice(existing.path.length)}`,
              updatedAt: new Date(),
            })
            .where(eq(categories.id, descendant.id));
        }
      });
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message: "A category with that name already exists in this branch.",
      };
    }

    throw error;
  }

  revalidatePath("/catalog/categories");

  return { ok: true, message: "Category updated." };
}

export async function deleteCategory(
  _state: CategoryMutationState,
  formData: FormData,
): Promise<CategoryMutationState> {
  await requireCatalogManageAccess();

  const parsed = deleteCategorySchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Category was not found." };
  }

  const existing = await db.query.categories.findFirst({
    where: (category, { eq }) => eq(category.id, parsed.data.id),
  });

  if (!existing) {
    return { ok: false, message: "Category was not found." };
  }

  if (existing.isLocked) {
    return {
      ok: false,
      message: "Unlock this category before deleting it.",
    };
  }

  const branch = await db.query.categories.findMany({
    where: (category, { or, eq, like }) =>
      or(eq(category.id, existing.id), like(category.path, `${existing.path}/%`)),
    orderBy: (category) => desc(category.depth),
  });
  const branchIds = branch.map((category) => category.id);

  const linkedProduct = await db.query.products.findFirst({
    where: (product, { inArray }) => inArray(product.categoryId, branchIds),
  });

  if (linkedProduct) {
    return {
      ok: false,
      message:
        "This category cannot be deleted because products already use it or one of its subcategories.",
    };
  }

  for (const category of branch) {
    await db.delete(categories).where(eq(categories.id, category.id));
  }

  revalidatePath("/catalog/categories");

  return { ok: true, message: "Category deleted." };
}

export async function toggleCategoryLock(categoryId: string) {
  await requireCatalogManageAccess();

  const parsed = z.string().uuid().safeParse(categoryId);

  if (!parsed.success) {
    return { ok: false, message: "Category was not found." };
  }

  const existing = await db.query.categories.findFirst({
    where: (category, { eq }) => eq(category.id, parsed.data),
  });

  if (!existing) {
    return { ok: false, message: "Category was not found." };
  }

  await db
    .update(categories)
    .set({
      isLocked: !existing.isLocked,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, parsed.data));

  revalidatePath("/catalog/categories");

  return {
    ok: true,
    message: existing.isLocked ? "Category unlocked." : "Category locked.",
  };
}

export async function moveCategory(categoryId: string, direction: "up" | "down") {
  await requireCatalogManageAccess();

  const parsed = moveCategorySchema.safeParse({
    direction,
    id: categoryId,
  });

  if (!parsed.success) {
    return { ok: false, message: "Category was not found." };
  }

  const existing = await db.query.categories.findFirst({
    where: (category, { eq }) => eq(category.id, parsed.data.id),
  });

  if (!existing) {
    return { ok: false, message: "Category was not found." };
  }

  if (existing.isLocked) {
    return {
      ok: false,
      message: "Unlock this category before moving it.",
    };
  }

  const siblings = await getCategorySiblings(existing.parentId);
  const currentIndex = siblings.findIndex((category) => category.id === existing.id);
  const targetIndex =
    parsed.data.direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const target = siblings[targetIndex];

  if (currentIndex === -1 || !target) {
    return {
      ok: false,
      message:
        parsed.data.direction === "up"
          ? "This category is already first in this level."
          : "This category is already last in this level.",
    };
  }

  if (target.isLocked) {
    return {
      ok: false,
      message: "Unlock the adjacent category before swapping order.",
    };
  }

  const reordered = [...siblings];
  [reordered[currentIndex], reordered[targetIndex]] = [
    reordered[targetIndex],
    reordered[currentIndex],
  ];

  await db.transaction(async (tx) => {
    for (const [index, category] of reordered.entries()) {
      await tx
        .update(categories)
        .set({
          sortOrder: index + 1,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, category.id));
    }
  });

  revalidatePath("/catalog/categories");

  return { ok: true, message: "Category order updated." };
}
