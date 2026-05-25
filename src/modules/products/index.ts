import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { productVariants } from "@/src/db/schema";
import {
  getMissingParcelFields,
  isShippingParcelComplete,
} from "@/src/modules/shipping";

export type ProductVariantShippingReadiness = {
  heightMm: number | null;
  isReadyForShippingRates: boolean;
  lengthMm: number | null;
  missingFields: string[];
  shipsAlone: boolean;
  variantId: string;
  weightGrams: number | null;
  widthMm: number | null;
};

export async function getProductVariantShippingReadiness(
  variantId: string,
): Promise<ProductVariantShippingReadiness | null> {
  const [variant] = await db
    .select({
      heightMm: productVariants.heightMm,
      lengthMm: productVariants.lengthMm,
      shipsAlone: productVariants.shipsAlone,
      weightGrams: productVariants.weightGrams,
      widthMm: productVariants.widthMm,
    })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!variant) {
    return null;
  }

  const missingFields = getMissingParcelFields(variant);

  return {
    ...variant,
    isReadyForShippingRates: isShippingParcelComplete(variant),
    missingFields,
    variantId,
  };
}
