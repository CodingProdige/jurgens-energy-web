"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { db } from "@/src/db";
import { productVariants, products } from "@/src/db/schema";
import {
  fulfillmentModeSchema,
  shippingParcelSchema,
} from "@/src/modules/shipping";
import { getPrimarySellerForUser } from "@/src/modules/sellers/dashboard";

export type SellerProductMutationState = {
  error?: string;
  success?: string;
};

const updateProductShippingSchema = z.object({
  fulfillmentMode: fulfillmentModeSchema,
  productId: z.string().uuid(),
  variants: z
    .array(
      z.object({
        id: z.string().uuid(),
        parcel: shippingParcelSchema,
      }),
    )
    .min(1, "At least one variant is required."),
});

export async function updateSellerProductShipping(
  _state: SellerProductMutationState,
  formData: FormData,
): Promise<SellerProductMutationState> {
  const session = await requireSellerDashboardAccess();
  const seller = await getPrimarySellerForUser(session.user.id);

  if (!seller) {
    return { error: "Seller access could not be confirmed." };
  }

  const variantIds = formData.getAll("variantId").map(String);
  const parsed = updateProductShippingSchema.safeParse({
    fulfillmentMode: formData.get("fulfillmentMode"),
    productId: formData.get("productId"),
    variants: variantIds.map((variantId) => ({
      id: variantId,
      parcel: {
        heightMm: formData.get(`heightMm:${variantId}`),
        isFragile: formData.get(`isFragile:${variantId}`) === "on",
        lengthMm: formData.get(`lengthMm:${variantId}`),
        shipsAlone: formData.get(`shipsAlone:${variantId}`) === "on",
        weightGrams: formData.get(`weightGrams:${variantId}`),
        widthMm: formData.get(`widthMm:${variantId}`),
      },
    })),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the product shipping details.",
    };
  }

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.id, parsed.data.productId),
        eq(products.sellerId, seller.id),
      ),
    )
    .limit(1);

  if (!product) {
    return { error: "This product does not belong to your seller account." };
  }

  const existingVariants = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, parsed.data.productId),
        inArray(
          productVariants.id,
          parsed.data.variants.map((variant) => variant.id),
        ),
      ),
    );

  if (existingVariants.length !== parsed.data.variants.length) {
    return { error: "One or more variants could not be confirmed." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        fulfillmentMode: parsed.data.fulfillmentMode,
        updatedAt: new Date(),
      })
      .where(eq(products.id, parsed.data.productId));

    for (const variant of parsed.data.variants) {
      await tx
        .update(productVariants)
        .set({
          heightMm: variant.parcel.heightMm,
          isFragile: variant.parcel.isFragile,
          lengthMm: variant.parcel.lengthMm,
          shipsAlone: variant.parcel.shipsAlone,
          weightGrams: variant.parcel.weightGrams,
          widthMm: variant.parcel.widthMm,
        })
        .where(eq(productVariants.id, variant.id));
    }
  });

  revalidatePath("/seller/products");

  return { success: "Product shipping details saved." };
}
