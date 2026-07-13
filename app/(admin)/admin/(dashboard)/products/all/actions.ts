"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { auditLogs, productReviewEvents, products } from "@/src/db/schema";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

const productStatusUpdateSchema = z.object({
  productId: z.string().uuid(),
  status: z.enum(["active", "draft"]),
});

export type ProductStatusUpdateResult = {
  message?: string;
  ok: boolean;
};

export async function updateAdminProductStatus(
  input: unknown,
): Promise<ProductStatusUpdateResult> {
  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    return {
      ok: false,
      message: "Catalog access could not be confirmed.",
    };
  }

  const parsed = productStatusUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "This product could not be confirmed.",
    };
  }

  const [product] = await db
    .select({
      id: products.id,
      slug: products.slug,
      status: products.status,
      title: products.title,
    })
    .from(products)
    .where(eq(products.id, parsed.data.productId))
    .limit(1);

  if (!product) {
    return {
      ok: false,
      message: "Product was not found.",
    };
  }

  if (["archived", "admin_suspended"].includes(product.status)) {
    return {
      ok: false,
      message: "Archived or suspended products cannot be changed from this menu.",
    };
  }

  if (product.status === parsed.data.status) {
    return {
      ok: true,
      message:
        parsed.data.status === "draft"
          ? "Product is already a draft."
          : "Product is already active.",
    };
  }

  const now = new Date();
  const action =
    parsed.data.status === "draft" ? "set_as_draft" : "set_as_active";

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        status: parsed.data.status,
        updatedAt: now,
      })
      .where(and(eq(products.id, product.id), eq(products.status, product.status)));

    await tx.insert(productReviewEvents).values({
      action,
      actorUserId: access.session.user.id,
      fromStatus: product.status,
      note:
        parsed.data.status === "draft"
          ? "Admin moved product back to draft from the product table."
          : "Admin made product active from the product table.",
      productId: product.id,
      toStatus: parsed.data.status,
    });

    await tx.insert(auditLogs).values({
      action: `product.${action}`,
      actorUserId: access.session.user.id,
      entityId: product.id,
      entityType: "product",
      metadata: JSON.stringify({
        fromStatus: product.status,
        title: product.title,
        toStatus: parsed.data.status,
      }),
    });
  });

  revalidatePath("/admin/products/all");
  revalidatePath("/products");
  revalidatePath("/products/all");
  revalidatePath(`/products/${product.slug}`);

  return {
    ok: true,
    message:
      parsed.data.status === "draft"
        ? "Product set as draft."
        : "Product set as active.",
  };
}
