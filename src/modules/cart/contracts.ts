import { z } from "zod";

export const cartLineInputSchema = z.object({
  exchangeEmptyConfirmed: z.boolean().optional().default(false),
  purchaseType: z.enum(["standard", "exchange"]).optional().default("standard"),
  quantity: z.coerce.number().int().min(1).max(99),
  variantId: z.string().uuid(),
});

export const cartValidationRequestSchema = z.object({
  items: z.array(cartLineInputSchema).max(100),
});

export type CartLineInput = z.infer<typeof cartLineInputSchema>;
export type CartValidationRequest = z.infer<typeof cartValidationRequestSchema>;

export type ValidatedCartItem = {
  available: boolean;
  brandId: string | null;
  brandName: string | null;
  categoryId: string | null;
  checkoutEligible: boolean;
  compareAtPriceZar: number | null;
  continueSellingOutOfStock: boolean;
  displayLineTotal: number;
  displayUnitPrice: number;
  exchangeAcceptedReturnBrands: string[];
  exchangeConfirmationMissing: boolean;
  exchangeConfirmationText: string | null;
  exchangeEmptyConfirmed: boolean;
  exchangeRequiredEmptyCylinderSize: string | null;
  fulfillmentMode: "seller_fulfilled" | "piessang_fulfilled";
  heightMm: number | null;
  imageUrl: string | null;
  inStock: boolean;
  isFragile: boolean;
  lengthMm: number | null;
  lineTotalLabel: string;
  lineTotalZar: number;
  maxQuantity: number;
  productId: string;
  productSlug: string;
  productTitle: string;
  purchaseType: "standard" | "exchange";
  quantity: number;
  sellerId: string | null;
  sellerName: string | null;
  shipsAlone: boolean;
  sku: string;
  unitPriceLabel: string;
  unitPriceZar: number;
  variantId: string;
  variantTitle: string;
  weightGrams: number | null;
  widthMm: number | null;
};

export type CartValidationResponse = {
  currencyCode: string;
  currencyLocale: string;
  invalidVariantIds: string[];
  items: ValidatedCartItem[];
  subtotalDisplay: number;
  subtotalZar: number;
};
