import "server-only";

import crypto from "node:crypto";

import { z } from "zod";

import { db } from "@/src/db";
import { shippingRateQuotes } from "@/src/db/schema";
import type { CustomerShippingPrice } from "@/src/modules/shipping/customer-shipping-policy";

const addressSchema = z.object({
  city: z.string().trim().min(1),
  code: z.string().trim().min(1),
  country: z.literal("ZA"),
  local_area: z.string().trim().min(1),
  street_address: z.string().trim().min(1),
  zone: z.string().trim().min(1),
});

const parcelItemSchema = z
  .object({
    description: z.string().trim().min(1),
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

const customerShippingQuoteSchema = z.object({
  checkoutFingerprint: z.string().length(64),
  collectionAddress: z.record(z.string(), z.unknown()).optional(),
  deliveryAddress: addressSchema,
  deliveryInformation: z.string().trim().min(1).max(300),
  items: z.array(parcelItemSchema).min(1),
  jurgensZoneId: z.string().uuid().nullable().optional(),
  price: z.object({
    amount: z.number().finite().nonnegative(),
    flatRate: z.number().finite().nonnegative(),
    freeOverAmount: z.number().finite().positive().nullable(),
    rule: z.enum(["flat_rate", "free_shipping_over"]),
  }),
});

export async function createCustomerShippingQuote(input: {
  checkoutFingerprint: string;
  collectionAddress?: Record<string, unknown>;
  deliveryAddress: z.infer<typeof addressSchema>;
  deliveryInformation: string;
  items: z.infer<typeof parcelItemSchema>[];
  jurgensZoneId?: string | null;
  price: CustomerShippingPrice;
}) {
  const parsed = customerShippingQuoteSchema.parse(input);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const serviceName =
    parsed.price.rule === "free_shipping_over"
      ? "Free order delivery"
      : "Standard delivery";
  const [quote] = await db
    .insert(shippingRateQuotes)
    .values({
      bufferBps: 0,
      checkoutFingerprint: parsed.checkoutFingerprint,
      collectionAddressSnapshot: parsed.collectionAddress ?? {
        handoff: "courier_guy_dropoff",
      },
      customerAmount: parsed.price.amount.toFixed(2),
      deliveryAddressSnapshot: parsed.deliveryAddress,
      expiresAt,
      marginAmount: "0.00",
      marginBps: 0,
      parcelSnapshot: parsed.items,
      provider: "manual",
      providerAmount: "0.00",
      providerPayload: {
        costDifferencePolicy: "absorbed_by_jurgens_energy",
        customerPriceRule: parsed.price.rule,
        deliveryInformation: parsed.deliveryInformation,
        flatRate: parsed.price.flatRate,
        freeOverAmount: parsed.price.freeOverAmount,
        merchantCountry: "ZA",
        providerRatesVisibleToCustomer: false,
        zoneId: parsed.jurgensZoneId ?? null,
      },
      providerRateId: `customer-shipping-policy-${parsed.checkoutFingerprint}-${crypto.randomUUID()}`,
      serviceLevel: "standard_delivery",
      serviceName,
    })
    .returning({ id: shippingRateQuotes.id });

  return {
    expiresAt,
    option: {
      amountZar: parsed.price.amount,
      deliveryInformation: parsed.deliveryInformation,
      label: serviceName,
      provider: "manual" as const,
      quoteId: quote.id,
      serviceLevel: "standard_delivery",
    },
  };
}
