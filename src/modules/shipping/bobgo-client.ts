import { z } from "zod";

import { db } from "@/src/db";
import { shippingRateQuotes } from "@/src/db/schema";
import { getBobGoIntegrationConfig } from "@/src/modules/marketplace/settings";

const addressSchema = z.object({
  code: z.string().trim().min(1),
  company: z.string().trim().optional(),
  country: z.string().trim().length(2).default("ZA"),
  city: z.string().trim().min(1),
  lat: z.coerce.number().finite().optional(),
  lng: z.coerce.number().finite().optional(),
  local_area: z.string().trim().min(1),
  street_address: z.string().trim().min(1),
  zone: z.string().trim().min(1),
});

const itemSchema = z.object({
  description: z.string().trim().min(1),
  heightMm: z.coerce.number().finite().positive(),
  lengthMm: z.coerce.number().finite().positive(),
  price: z.coerce.number().finite().nonnegative(),
  quantity: z.coerce.number().int().positive().default(1),
  weightGrams: z.coerce.number().finite().positive(),
  widthMm: z.coerce.number().finite().positive(),
});

export const bobGoCheckoutRatesInputSchema = z.object({
  checkoutFingerprint: z.string().length(64).optional(),
  collectionAddress: addressSchema,
  declaredValue: z.coerce.number().finite().nonnegative(),
  deliveryAddress: addressSchema,
  handlingTime: z.coerce.number().int().min(0).default(2),
  items: z.array(itemSchema).min(1),
  orderId: z.string().uuid().optional(),
  sellerId: z.string().uuid().nullable().optional(),
});

export type BobGoCheckoutRatesInput = z.infer<
  typeof bobGoCheckoutRatesInputSchema
>;

export type BobGoCheckoutRate = {
  bufferAmount: number;
  currency: "ZAR";
  customerAmount: number;
  marginAmount: number;
  providerAmount: number;
  providerRateId: string | null;
  quoteId?: string;
  serviceLevel: string | null;
  serviceName: string;
};

type ProviderCheckoutRate = Omit<
  BobGoCheckoutRate,
  "bufferAmount" | "customerAmount" | "marginAmount"
>;

export async function getBobGoCheckoutRates(input: BobGoCheckoutRatesInput) {
  const parsed = bobGoCheckoutRatesInputSchema.parse(input);
  const config = await getBobGoIntegrationConfig();

  if (!config.shippingEnabled) {
    throw new Error("Shipping rates are disabled.");
  }

  if (!config.bobgoEnabled) {
    throw new Error("Bob Go provider integration is disabled.");
  }

  if (config.bookingMode === "disabled") {
    throw new Error("Bob Go booking mode is disabled.");
  }

  if (!config.apiKey) {
    throw new Error("Bob Go API key is not configured.");
  }

  const payload = toBobGoCheckoutRatesPayload(parsed);
  const response = await fetch(`${config.apiBaseUrl}/v2/rates-at-checkout`, {
    body: JSON.stringify(payload),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const responseText = await response.text();
  const providerPayload = parseJsonSafely(responseText);

  if (!response.ok) {
    throw new Error(
      `Bob Go checkout rates request failed with status ${response.status}.`,
    );
  }

  const normalizedRates = normalizeRates(providerPayload).map((rate) =>
    applyShippingPricing({
      bufferBps: config.shippingBufferBps,
      marginBps: config.shippingMarginBps,
      rate,
    }),
  );

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  let quoteRows: Array<{ id: string; providerRateId: string | null }> = [];

  if (normalizedRates.length > 0) {
    quoteRows = await db
      .insert(shippingRateQuotes)
      .values(
      normalizedRates.map((rate) => ({
        bufferBps: config.shippingBufferBps,
        checkoutFingerprint: parsed.checkoutFingerprint,
        collectionAddressSnapshot: parsed.collectionAddress,
        customerAmount: rate.customerAmount.toFixed(2),
        deliveryAddressSnapshot: parsed.deliveryAddress,
        expiresAt,
        marginAmount: rate.marginAmount.toFixed(2),
        marginBps: config.shippingMarginBps,
        orderId: parsed.orderId,
        parcelSnapshot: parsed.items,
        provider: "bobgo" as const,
        providerAmount: rate.providerAmount.toFixed(2),
        providerPayload,
        providerRateId: rate.providerRateId,
        sellerId: parsed.sellerId ?? null,
        serviceLevel: rate.serviceLevel,
        serviceName: rate.serviceName,
      })),
      )
      .returning({
        id: shippingRateQuotes.id,
        providerRateId: shippingRateQuotes.providerRateId,
      });
  }

  const quoteIdByProviderRateId = new Map(
    quoteRows.map((quote) => [quote.providerRateId, quote.id]),
  );
  const rates = normalizedRates.map((rate) => ({
    ...rate,
    quoteId: quoteIdByProviderRateId.get(rate.providerRateId),
  }));

  return {
    expiresAt,
    mode: config.mode,
    rates,
  };
}

function toBobGoCheckoutRatesPayload(input: BobGoCheckoutRatesInput) {
  return {
    collection_address: input.collectionAddress,
    declared_value: roundMoney(input.declaredValue),
    delivery_address: input.deliveryAddress,
    handling_time: input.handlingTime,
    items: input.items.map((item) => ({
      description: item.description,
      height_cm: roundMetric(item.heightMm / 10),
      length_cm: roundMetric(item.lengthMm / 10),
      price: roundMoney(item.price),
      quantity: item.quantity,
      weight_kg: roundMetric(item.weightGrams / 1000),
      width_cm: roundMetric(item.widthMm / 10),
    })),
  };
}

function normalizeRates(payload: unknown): ProviderCheckoutRate[] {
  const rateValues = extractRateArray(payload);

  return rateValues.reduce<ProviderCheckoutRate[]>((rates, rate, index) => {
    if (!isRecord(rate)) {
      return rates;
    }

    const providerAmount = getNumberValue(rate, [
      "amount",
      "cost",
      "price",
      "rate",
      "total",
      "total_amount",
    ]);

    if (providerAmount === null) {
      return rates;
    }

    rates.push({
      currency: "ZAR",
      providerAmount,
      providerRateId:
        getStringValue(rate, [
          "id",
          "rate_id",
          "rateId",
          "service_id",
          "serviceId",
        ]) ?? `bobgo-rate-${index + 1}`,
      serviceLevel: getStringValue(rate, [
        "service_level",
        "serviceLevel",
        "service_code",
        "serviceCode",
      ]),
      serviceName:
        getStringValue(rate, [
          "service_name",
          "serviceName",
          "name",
          "courier",
          "description",
        ]) ?? `Bob Go rate ${index + 1}`,
    });

    return rates;
  }, []);
}

function applyShippingPricing({
  bufferBps,
  marginBps,
  rate,
}: {
  bufferBps: number;
  marginBps: number;
  rate: ProviderCheckoutRate;
}): BobGoCheckoutRate {
  const bufferAmount = roundMoney(rate.providerAmount * (bufferBps / 10000));
  const subtotal = rate.providerAmount + bufferAmount;
  const marginAmount = roundMoney(subtotal * (marginBps / 10000));
  const customerAmount = roundMoney(subtotal + marginAmount);

  return {
    ...rate,
    bufferAmount,
    customerAmount,
    marginAmount,
  };
}

function extractRateArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const key of ["rates", "data", "shipping_rates", "shippingRates"]) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value;
    }

    if (isRecord(value)) {
      const nestedRates = extractRateArray(value);

      if (nestedRates.length > 0) {
        return nestedRates;
      }
    }
  }

  return [];
}

function parseJsonSafely(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { raw: value };
  }
}

function getNumberValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const normalized = Number(value.replace(/[^\d.-]/g, ""));

      if (Number.isFinite(normalized)) {
        return normalized;
      }
    }
  }

  return null;
}

function getStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function roundMetric(value: number) {
  return Number(value.toFixed(3));
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}
