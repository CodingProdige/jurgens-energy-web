import { z } from "zod";

import type { ValidatedCartItem } from "@/src/modules/cart/contracts";

const shippingSnapshotItemSchema = z.object({
  fulfillmentMode: z.enum(["courier_guy", "jurgens_local"]),
  heightMm: z.coerce.number().finite().positive().optional(),
  lengthMm: z.coerce.number().finite().positive().optional(),
  price: z.coerce.number().finite().nonnegative(),
  quantity: z.coerce.number().int().positive(),
  sellerId: z.string().uuid().nullable(),
  variantId: z.string().uuid(),
  weightGrams: z.coerce.number().finite().positive().optional(),
  widthMm: z.coerce.number().finite().positive().optional(),
});

function sameNumber(first: number | null | undefined, second: number | undefined) {
  return first === null || first === undefined
    ? second === undefined
    : Number(first) === second;
}

export function customerShippingSnapshotMatchesCart(
  snapshot: unknown,
  cartItems: ValidatedCartItem[],
) {
  const parsed = z.array(shippingSnapshotItemSchema).safeParse(snapshot);

  if (!parsed.success || parsed.data.length !== cartItems.length) {
    return false;
  }

  const snapshotByVariantId = new Map(
    parsed.data.map((item) => [item.variantId, item]),
  );

  return cartItems.every((cartItem) => {
    const snapshotItem = snapshotByVariantId.get(cartItem.variantId);
    const fulfillmentMode =
      cartItem.fulfillmentMode === "jurgens_fulfilled"
        ? "jurgens_local"
        : "courier_guy";

    if (
      !snapshotItem ||
      snapshotItem.quantity !== cartItem.quantity ||
      snapshotItem.fulfillmentMode !== fulfillmentMode ||
      snapshotItem.price !== cartItem.unitPriceZar ||
      snapshotItem.sellerId !== cartItem.sellerId
    ) {
      return false;
    }

    if (fulfillmentMode === "jurgens_local") {
      return true;
    }

    return (
      sameNumber(cartItem.heightMm, snapshotItem.heightMm) &&
      sameNumber(cartItem.lengthMm, snapshotItem.lengthMm) &&
      sameNumber(cartItem.weightGrams, snapshotItem.weightGrams) &&
      sameNumber(cartItem.widthMm, snapshotItem.widthMm)
    );
  });
}
