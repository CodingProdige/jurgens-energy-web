import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  jurgensDeliveryZoneRates,
  jurgensDeliveryZones,
  shippingRateQuotes,
} from "@/src/db/schema";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";

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
  heightMm: z.coerce.number().finite().positive().optional(),
  lengthMm: z.coerce.number().finite().positive().optional(),
  price: z.coerce.number().finite().nonnegative(),
  quantity: z.coerce.number().int().positive().default(1),
  weightGrams: z.coerce.number().finite().positive().optional(),
  widthMm: z.coerce.number().finite().positive().optional(),
});

export const jurgensDeliveryCheckoutRatesInputSchema = z.object({
  checkoutFingerprint: z.string().length(64).optional(),
  declaredValue: z.coerce.number().finite().nonnegative(),
  deliveryAddress: addressSchema,
  items: z.array(itemSchema).min(1).optional().default([]),
  orderId: z.string().uuid().optional(),
  sellerId: z.string().uuid().nullable().optional(),
});

export type JurgensDeliveryZoneRate = {
  fromAmount: number;
  id: string;
  price: number;
  sortOrder: number;
  upToAmount: number | null;
};

export type JurgensDeliveryZone = {
  createdAt: Date;
  deliveryInformation: string | null;
  id: string;
  isActive: boolean;
  minimumOrderAmount: number;
  name: string;
  postalCodes: string[];
  rates: JurgensDeliveryZoneRate[];
  sortOrder: number;
  updatedAt: Date;
};

export type UpsertJurgensDeliveryZoneInput = {
  deliveryInformation?: string | null;
  id?: string | null;
  isActive: boolean;
  minimumOrderAmount: number;
  name: string;
  postalCodes: string[];
  rates: Array<{
    fromAmount: number;
    price: number;
    upToAmount?: number | null;
  }>;
};

export async function getJurgensDeliveryZones({
  activeOnly = false,
}: {
  activeOnly?: boolean;
} = {}): Promise<JurgensDeliveryZone[]> {
  const zoneRows = await db
    .select()
    .from(jurgensDeliveryZones)
    .where(activeOnly ? eq(jurgensDeliveryZones.isActive, true) : undefined)
    .orderBy(asc(jurgensDeliveryZones.sortOrder), asc(jurgensDeliveryZones.name));

  if (zoneRows.length === 0) {
    return [];
  }

  const rateRows = await db
    .select()
    .from(jurgensDeliveryZoneRates)
    .where(
      inArray(
        jurgensDeliveryZoneRates.zoneId,
        zoneRows.map((zone) => zone.id),
      ),
    )
    .orderBy(
      asc(jurgensDeliveryZoneRates.zoneId),
      asc(jurgensDeliveryZoneRates.sortOrder),
      asc(jurgensDeliveryZoneRates.fromAmount),
    );
  const ratesByZoneId = new Map<string, JurgensDeliveryZoneRate[]>();

  for (const rate of rateRows) {
    const rates = ratesByZoneId.get(rate.zoneId) ?? [];

    rates.push({
      fromAmount: Number(rate.fromAmount),
      id: rate.id,
      price: Number(rate.price),
      sortOrder: rate.sortOrder,
      upToAmount:
        rate.upToAmount === null || rate.upToAmount === undefined
          ? null
          : Number(rate.upToAmount),
    });
    ratesByZoneId.set(rate.zoneId, rates);
  }

  return zoneRows.map((zone) => ({
    createdAt: zone.createdAt,
    deliveryInformation: zone.deliveryInformation,
    id: zone.id,
    isActive: zone.isActive,
    minimumOrderAmount: Number(zone.minimumOrderAmount),
    name: zone.name,
    postalCodes: normalizePostalCodes(zone.postalCodes),
    rates: ratesByZoneId.get(zone.id) ?? [],
    sortOrder: zone.sortOrder,
    updatedAt: zone.updatedAt,
  }));
}

export async function upsertJurgensDeliveryZone(
  input: UpsertJurgensDeliveryZoneInput,
) {
  const now = new Date();
  const postalCodes = normalizePostalCodes(input.postalCodes);
  const rates = normalizeRates(input.rates);

  if (postalCodes.length === 0) {
    return {
      ok: false,
      message: "Add at least one postal code, wildcard, or range.",
    };
  }

  if (rates.length === 0) {
    return { ok: false, message: "Add at least one delivery price tier." };
  }

  await db.transaction(async (tx) => {
    const zoneValues = {
      deliveryInformation: input.deliveryInformation?.trim() || null,
      isActive: input.isActive,
      minimumOrderAmount: roundMoney(input.minimumOrderAmount),
      name: input.name.trim(),
      postalCodes,
      updatedAt: now,
    };

    const zoneId = input.id
      ? await updateExistingZone(tx, input.id, zoneValues)
      : await insertNewZone(tx, { ...zoneValues, createdAt: now });

    await tx
      .delete(jurgensDeliveryZoneRates)
      .where(eq(jurgensDeliveryZoneRates.zoneId, zoneId));

    await tx.insert(jurgensDeliveryZoneRates).values(
      rates.map((rate, index) => ({
        fromAmount: rate.fromAmount,
        price: rate.price,
        sortOrder: index,
        upToAmount: rate.upToAmount,
        updatedAt: now,
        zoneId,
      })),
    );
  });

  return { ok: true, message: "Jurgens delivery zone saved." };
}

export async function deleteJurgensDeliveryZone(id: string) {
  await db.delete(jurgensDeliveryZones).where(eq(jurgensDeliveryZones.id, id));

  return { ok: true, message: "Jurgens delivery zone deleted." };
}

export async function getJurgensDeliveryCheckoutRates(
  input: z.infer<typeof jurgensDeliveryCheckoutRatesInputSchema>,
) {
  const parsed = jurgensDeliveryCheckoutRatesInputSchema.parse(input);
  const settings = await getMarketplaceSettings();

  if (!settings.shippingEnabled) {
    throw new Error("Shipping rates are disabled.");
  }

  const postalCode = normalizePostalCode(parsed.deliveryAddress.code);

  if (!postalCode) {
    throw new Error("A delivery postal code is required.");
  }

  const zones = await getJurgensDeliveryZones({ activeOnly: true });
  const matchingZone = zones.find((zone) =>
    zone.postalCodes.some((rule) => postalCodeMatchesRule(postalCode, rule)),
  );

  if (!matchingZone) {
    return {
      eligible: false,
      mode: "jurgens_delivery" as const,
      rates: [],
      unavailableReason:
        "Jurgens Energy delivery is not available for this postal code.",
    };
  }

  const subtotal = roundMoney(parsed.declaredValue);

  if (subtotal < matchingZone.minimumOrderAmount) {
    return {
      eligible: false,
      mode: "jurgens_delivery" as const,
      rates: [],
      unavailableReason: `Jurgens Energy delivery for ${matchingZone.name} requires a minimum order of R ${formatMoney(matchingZone.minimumOrderAmount)}.`,
      zone: toCheckoutZone(matchingZone),
    };
  }

  const matchingRate = matchingZone.rates.find((rate) =>
    subtotalMatchesRate(subtotal, rate),
  );

  if (!matchingRate) {
    return {
      eligible: false,
      mode: "jurgens_delivery" as const,
      rates: [],
      unavailableReason:
        "No Jurgens Energy delivery price is configured for this order value.",
      zone: toCheckoutZone(matchingZone),
    };
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const providerRateId = `jurgens-${matchingZone.id}-${matchingRate.id}`;
  const providerPayload = {
    deliveryInformation: matchingZone.deliveryInformation,
    deliveryMethod: "jurgens_energy_delivery",
    postalCode,
    rateId: matchingRate.id,
    zoneId: matchingZone.id,
    zoneName: matchingZone.name,
  };
  const rate = {
    bufferAmount: 0,
    currency: "ZAR" as const,
    customerAmount: roundMoney(matchingRate.price),
    deliveryInformation: matchingZone.deliveryInformation,
    marginAmount: 0,
    providerAmount: roundMoney(matchingRate.price),
    providerRateId,
    serviceLevel: "local_delivery",
    serviceName: `Jurgens Energy delivery - ${matchingZone.name}`,
    zone: toCheckoutZone(matchingZone),
  };

  const [quote] = await db
    .insert(shippingRateQuotes)
    .values({
      bufferBps: 0,
      checkoutFingerprint: parsed.checkoutFingerprint,
      collectionAddressSnapshot: {
        deliveryMethod: "jurgens_energy_delivery",
        provider: "jurgens_energy",
      },
      customerAmount: rate.customerAmount.toFixed(2),
      deliveryAddressSnapshot: parsed.deliveryAddress,
      expiresAt,
      marginAmount: "0.00",
      marginBps: 0,
      orderId: parsed.orderId,
      parcelSnapshot: parsed.items,
      provider: "piessang_local",
      providerAmount: rate.providerAmount.toFixed(2),
      providerPayload,
      providerRateId,
      sellerId: parsed.sellerId ?? null,
      serviceLevel: rate.serviceLevel,
      serviceName: rate.serviceName,
    })
    .returning({ id: shippingRateQuotes.id });

  return {
    eligible: true,
    expiresAt,
    mode: "jurgens_delivery" as const,
    rates: [{ ...rate, quoteId: quote.id }],
    zone: toCheckoutZone(matchingZone),
  };
}

function normalizeRates(rates: UpsertJurgensDeliveryZoneInput["rates"]) {
  return rates
    .map((rate) => ({
      fromAmount: roundMoney(Math.max(0, Number(rate.fromAmount) || 0)),
      price: roundMoney(Math.max(0, Number(rate.price) || 0)),
      upToAmount:
        rate.upToAmount === null || rate.upToAmount === undefined
          ? null
          : roundMoney(Math.max(0, Number(rate.upToAmount) || 0)),
    }))
    .filter((rate) => rate.upToAmount === null || rate.upToAmount > rate.fromAmount)
    .sort((left, right) => left.fromAmount - right.fromAmount);
}

function normalizePostalCodes(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => normalizePostalCode(String(value)))
        .filter(Boolean),
    ),
  );
}

function normalizePostalCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function postalCodeMatchesRule(postalCode: string, rule: string) {
  const normalizedRule = normalizePostalCode(rule);

  if (!normalizedRule) {
    return false;
  }

  if (normalizedRule.endsWith("*")) {
    return postalCode.startsWith(normalizedRule.slice(0, -1));
  }

  const rangeMatch = normalizedRule.match(/^(\d+)-(\d+)$/);

  if (rangeMatch) {
    const current = Number(postalCode);
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);

    return (
      Number.isFinite(current) &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      current >= Math.min(start, end) &&
      current <= Math.max(start, end)
    );
  }

  return postalCode === normalizedRule;
}

function subtotalMatchesRate(subtotal: number, rate: JurgensDeliveryZoneRate) {
  return (
    subtotal >= rate.fromAmount &&
    (rate.upToAmount === null || subtotal < rate.upToAmount)
  );
}

function toCheckoutZone(zone: JurgensDeliveryZone) {
  return {
    deliveryInformation: zone.deliveryInformation,
    id: zone.id,
    minimumOrderAmount: zone.minimumOrderAmount,
    name: zone.name,
  };
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function formatMoney(value: number) {
  return value.toFixed(2).replace(".", ",");
}

async function updateExistingZone(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  id: string,
  values: {
    deliveryInformation: string | null;
    isActive: boolean;
    minimumOrderAmount: number;
    name: string;
    postalCodes: string[];
    updatedAt: Date;
  },
) {
  await tx
    .update(jurgensDeliveryZones)
    .set(values)
    .where(eq(jurgensDeliveryZones.id, id));

  return id;
}

async function insertNewZone(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  values: {
    createdAt: Date;
    deliveryInformation: string | null;
    isActive: boolean;
    minimumOrderAmount: number;
    name: string;
    postalCodes: string[];
    updatedAt: Date;
  },
) {
  const [zone] = await tx
    .insert(jurgensDeliveryZones)
    .values(values)
    .returning({ id: jurgensDeliveryZones.id });

  return zone.id;
}
