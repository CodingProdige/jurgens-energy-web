import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { db } from "@/src/db";
import { productVariants } from "@/src/db/schema";

const querySchema = z.object({
  sku: z.string().trim().min(1).max(120),
});

export async function GET(request: Request) {
  await requireSellerDashboardAccess();

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    sku: url.searchParams.get("sku") ?? "",
  });

  if (!parsed.success) {
    return Response.json({ available: false, ok: false });
  }

  const [existingVariant] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.sku, parsed.data.sku))
    .limit(1);

  return Response.json({
    available: !existingVariant,
    ok: true,
  });
}
