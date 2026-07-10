import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { db } from "@/src/db";
import { productVariants, products } from "@/src/db/schema";

const querySchema = z.object({
  productId: z.string().uuid().optional(),
  sku: z.string().trim().min(1).max(120),
});

export async function GET(request: Request) {
  const access = await requireAdminCapability("admin.catalog.manage");

  if (!access.ok) {
    return Response.json({ available: false, ok: false }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    productId: url.searchParams.get("productId") ?? undefined,
    sku: url.searchParams.get("sku") ?? "",
  });

  if (!parsed.success) {
    return Response.json({ available: false, ok: false });
  }

  const [existingVariant] = await db
    .select({
      productId: productVariants.productId,
    })
    .from(productVariants)
    .where(eq(productVariants.sku, parsed.data.sku))
    .limit(1);
  const productId = parsed.data.productId;
  const [editableProduct] = productId
    ? await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1)
    : [];

  return Response.json({
    available:
      !existingVariant ||
      Boolean(editableProduct && existingVariant.productId === editableProduct.id),
    ok: true,
  });
}
