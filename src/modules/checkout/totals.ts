import {
  calculateVatInclusiveAmounts,
  SOUTH_AFRICAN_STANDARD_VAT_RATE_BPS,
} from "../tax/vat-inclusive.ts";

type CheckoutVatItem = {
  quantity: number;
  taxRateBps: number;
  unitPriceZar: number;
};

function zarToCents(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Checkout VAT calculation received an invalid amount.");
  }

  return Math.round(value * 100);
}

export function calculateCheckoutIncludedVatCents({
  items,
  shippingTotalZar,
}: {
  items: readonly CheckoutVatItem[];
  shippingTotalZar: number;
}) {
  const productVatCents = items.reduce((total, item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error("Checkout VAT calculation received an invalid quantity.");
    }

    const grossCents = zarToCents(item.unitPriceZar) * item.quantity;

    return (
      total +
      calculateVatInclusiveAmounts(grossCents, item.taxRateBps).taxCents
    );
  }, 0);
  const shippingGrossCents = zarToCents(shippingTotalZar);
  const shippingVatCents =
    shippingGrossCents === 0
      ? 0
      : calculateVatInclusiveAmounts(
          shippingGrossCents,
          SOUTH_AFRICAN_STANDARD_VAT_RATE_BPS,
        ).taxCents;

  return productVatCents + shippingVatCents;
}
