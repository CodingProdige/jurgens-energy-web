"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  auditLogs,
  orderItems,
  productReviewEvents,
  products,
  productVariants,
} from "@/src/db/schema";
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
  revalidatePath("/feeds/google-merchant.xml");

  return {
    ok: true,
    message:
      parsed.data.status === "draft"
        ? "Product set as draft."
        : "Product set as active.",
  };
}

export async function deleteOrArchiveAdminProduct(
  input: unknown,
): Promise<ProductStatusUpdateResult> {
  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    return {
      ok: false,
      message: "Catalog access could not be confirmed.",
    };
  }

  const parsed = productStatusUpdateSchema
    .pick({ productId: true })
    .safeParse(input);

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

  const [historyTotal] = await db
    .select({ value: count() })
    .from(orderItems)
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(eq(productVariants.productId, product.id));
  const hasOrderHistory = (historyTotal?.value ?? 0) > 0;
  const now = new Date();

  if (!hasOrderHistory) {
    await db.transaction(async (tx) => {
      await tx.insert(auditLogs).values({
        action: "product.deleted",
        actorUserId: access.session.user.id,
        entityId: product.id,
        entityType: "product",
        metadata: JSON.stringify({
          fromStatus: product.status,
          slug: product.slug,
          title: product.title,
        }),
      });

      await tx.delete(products).where(eq(products.id, product.id));
    });

    revalidatePath("/admin/products");
    revalidatePath("/admin/products/all");
    revalidatePath("/products");
    revalidatePath("/products/all");
    revalidatePath(`/products/${product.slug}`);
    revalidatePath("/feeds/google-merchant.xml");

    return {
      ok: true,
      message: "Product deleted.",
    };
  }

  if (product.status === "archived") {
    return {
      ok: true,
      message: "Product already has order history and is archived.",
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ status: "archived", updatedAt: now })
      .where(eq(products.id, product.id));

    await tx.insert(productReviewEvents).values({
      action: "archived",
      actorUserId: access.session.user.id,
      fromStatus: product.status,
      note: "Admin archived this product because it has order history.",
      productId: product.id,
      toStatus: "archived",
    });

    await tx.insert(auditLogs).values({
      action: "product.archived",
      actorUserId: access.session.user.id,
      entityId: product.id,
      entityType: "product",
      metadata: JSON.stringify({
        fromStatus: product.status,
        title: product.title,
        toStatus: "archived",
      }),
    });
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/all");
  revalidatePath(`/admin/products/${product.id}/edit`);
  revalidatePath("/products");
  revalidatePath("/products/all");
  revalidatePath(`/products/${product.slug}`);
  revalidatePath("/feeds/google-merchant.xml");

  return {
    ok: true,
    message: "Product has order history, so it was archived.",
  };
}
