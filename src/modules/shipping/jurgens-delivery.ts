import { asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  jurgensDeliveryZoneRates,
  jurgensDeliveryZones,
  shippingRateQuotes,
} from "@/src/db/schema";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";
import {
  findJurgensDeliveryPostalCodeConflicts,
  normalizeJurgensDeliveryPostalCode,
  normalizeJurgensDeliveryPostalCodeRules,
  resolveJurgensDeliveryPostalZone,
} from "@/src/modules/shipping/jurgens-delivery-postal-rules";
import { getJurgensImplicitFreeDeliveryThreshold } from "@/src/modules/shipping/jurgens-delivery-pricing";

const JURGENS_DELIVERY_ZONE_WRITE_LOCK_ID = 719_202_607;

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

export const jurgensDeliveryAvailabilityInputSchema = z.object({
  declaredValue: z.coerce.number().finite().nonnegative(),
  postalCode: z.string().trim().min(1),
});

export type JurgensDeliveryAvailabilityInput = z.infer<
  typeof jurgensDeliveryAvailabilityInputSchema
>;

export type JurgensDeliveryAvailabilityUnavailableCode =
  | "shipping_disabled"
  | "postal_code_unavailable"
  | "zone_configuration_conflict"
  | "minimum_order_not_met"
  | "rate_not_configured";

export type JurgensDeliveryAvailabilityZone = {
  deliveryInformation: string | null;
  id: string;
  minimumOrderAmount: number;
  name: string;
};

export type JurgensDeliveryAvailabilityResult =
  | {
      currency: "ZAR";
      deliveryFee: number;
      eligible: true;
      mode: "jurgens_delivery";
      postalCode: string;
      unavailableCode: null;
      unavailableReason: null;
      zone: JurgensDeliveryAvailabilityZone;
    }
  | {
      currency: "ZAR";
      deliveryFee: null;
      eligible: false;
      mode: "jurgens_delivery";
      postalCode: string;
      unavailableCode: JurgensDeliveryAvailabilityUnavailableCode;
      unavailableReason: string;
      zone: JurgensDeliveryAvailabilityZone | null;
    };

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
    .orderBy(
      asc(jurgensDeliveryZones.sortOrder),
      asc(jurgensDeliveryZones.name),
      asc(jurgensDeliveryZones.id),
    );

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
    postalCodes: normalizeJurgensDeliveryPostalCodeRules(zone.postalCodes),
    rates: ratesByZoneId.get(zone.id) ?? [],
    sortOrder: zone.sortOrder,
    updatedAt: zone.updatedAt,
  }));
}

export async function upsertJurgensDeliveryZone(
  input: UpsertJurgensDeliveryZoneInput,
) {
  const now = new Date();
  const postalCodes = normalizeJurgensDeliveryPostalCodeRules(input.postalCodes);
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

  return db.transaction(async (tx) => {
    await lockJurgensDeliveryZoneWrites(tx);

    if (input.isActive) {
      const activeZones = await tx
        .select({
          id: jurgensDeliveryZones.id,
          name: jurgensDeliveryZones.name,
          postalCodes: jurgensDeliveryZones.postalCodes,
        })
        .from(jurgensDeliveryZones)
        .where(eq(jurgensDeliveryZones.isActive, true))
        .orderBy(asc(jurgensDeliveryZones.name), asc(jurgensDeliveryZones.id));
      const conflicts = findJurgensDeliveryPostalCodeConflicts({
        candidatePostalCodes: postalCodes,
        existingZones: activeZones
          .filter((zone) => zone.id !== input.id)
          .map((zone) => ({
            ...zone,
            postalCodes: normalizeJurgensDeliveryPostalCodeRules(
              zone.postalCodes,
            ),
          })),
      });

      if (conflicts.length > 0) {
        return {
          ok: false as const,
          message: formatPostalCodeConflictMessage(conflicts),
        };
      }
    }

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

    return { ok: true as const, message: "Jurgens delivery zone saved." };
  });
}

export async function deleteJurgensDeliveryZone(id: string) {
  await db.transaction(async (tx) => {
    await lockJurgensDeliveryZoneWrites(tx);
    await tx.delete(jurgensDeliveryZones).where(eq(jurgensDeliveryZones.id, id));
  });

  return { ok: true, message: "Jurgens delivery zone deleted." };
}

export async function checkJurgensDeliveryAvailability(
  input: JurgensDeliveryAvailabilityInput,
): Promise<JurgensDeliveryAvailabilityResult> {
  const parsed = jurgensDeliveryAvailabilityInputSchema.parse(input);
  const evaluation = await evaluateJurgensDeliveryAvailability(parsed);
  const zone = evaluation.zone ? toCheckoutZone(evaluation.zone) : null;

  if (!evaluation.eligible) {
    return {
      currency: "ZAR",
      deliveryFee: null,
      eligible: false,
      mode: "jurgens_delivery",
      postalCode: evaluation.postalCode,
      unavailableCode: evaluation.unavailableCode,
      unavailableReason: evaluation.unavailableReason,
      zone,
    };
  }

  return {
    currency: "ZAR",
    deliveryFee: roundMoney(evaluation.deliveryFee),
    eligible: true,
    mode: "jurgens_delivery",
    postalCode: evaluation.postalCode,
    unavailableCode: null,
    unavailableReason: null,
    zone: toCheckoutZone(evaluation.zone),
  };
}

export async function getJurgensDeliveryCheckoutRates(
  input: z.infer<typeof jurgensDeliveryCheckoutRatesInputSchema>,
) {
  const parsed = jurgensDeliveryCheckoutRatesInputSchema.parse(input);
  const evaluation = await evaluateJurgensDeliveryAvailability({
    declaredValue: parsed.declaredValue,
    postalCode: parsed.deliveryAddress.code,
  });

  if (
    !evaluation.eligible &&
    evaluation.unavailableCode === "shipping_disabled"
  ) {
    throw new Error(evaluation.unavailableReason);
  }

  if (!evaluation.eligible) {
    return {
      eligible: false as const,
      mode: "jurgens_delivery" as const,
      rates: [],
      unavailableReason: evaluation.unavailableReason,
    };
  }

  const matchingRate = evaluation.rate;
  const matchingZone = evaluation.zone;
  const postalCode = evaluation.postalCode;

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const rateReference = matchingRate
    ? matchingRate.id
    : `zone-cap-free-${evaluation.freeDeliveryThreshold?.toFixed(2).replace(".", "-")}`;
  const providerRateId = `jurgens-${matchingZone.id}-${rateReference}`;
  const providerPayload = {
    deliveryInformation: matchingZone.deliveryInformation,
    deliveryMethod: "jurgens_energy_delivery",
    freeDeliveryThreshold: evaluation.freeDeliveryThreshold,
    postalCode,
    pricingRule: evaluation.pricingRule,
    rateId: matchingRate?.id ?? null,
    zoneId: matchingZone.id,
    zoneName: matchingZone.name,
  };
  const rate = {
    bufferAmount: 0,
    currency: "ZAR" as const,
    customerAmount: roundMoney(evaluation.deliveryFee),
    deliveryInformation:
      "Handling takes 0–1 business day after payment confirmation, with a 2:00 PM SAST order cut-off. Shipping takes 1–3 business days after dispatch; estimated total delivery is 1–4 business days.",
    marginAmount: 0,
    providerAmount: roundMoney(evaluation.deliveryFee),
    providerRateId,
    serviceLevel: "local_delivery",
    serviceName: "Jurgens Energy delivery",
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
    eligible: true as const,
    expiresAt,
    mode: "jurgens_delivery" as const,
    rates: [{ ...rate, quoteId: quote.id }],
  };
}

type JurgensDeliveryAvailabilityEvaluation =
  | {
      deliveryFee: number;
      eligible: true;
      freeDeliveryThreshold: number | null;
      postalCode: string;
      pricingRule: "configured_rate" | "zone_cap_free";
      rate: JurgensDeliveryZoneRate | null;
      zone: JurgensDeliveryZone;
    }
  | {
      eligible: false;
      postalCode: string;
      unavailableCode: JurgensDeliveryAvailabilityUnavailableCode;
      unavailableReason: string;
      zone: JurgensDeliveryZone | null;
    };

async function evaluateJurgensDeliveryAvailability({
  declaredValue,
  postalCode: postalCodeInput,
}: z.infer<
  typeof jurgensDeliveryAvailabilityInputSchema
>): Promise<JurgensDeliveryAvailabilityEvaluation> {
  const postalCode = normalizeJurgensDeliveryPostalCode(postalCodeInput);

  if (!postalCode) {
    throw new Error("A complete delivery address is required.");
  }

  const settings = await getMarketplaceSettings();

  if (!settings.shippingEnabled) {
    return {
      eligible: false,
      postalCode,
      unavailableCode: "shipping_disabled",
      unavailableReason: "Shipping rates are disabled.",
      zone: null,
    };
  }

  const zones = await getJurgensDeliveryZones({ activeOnly: true });
  const zoneResolution = resolveJurgensDeliveryPostalZone(postalCode, zones);

  if (zoneResolution.status === "none") {
    return {
      eligible: false,
      postalCode,
      unavailableCode: "postal_code_unavailable",
      unavailableReason:
        "Jurgens Energy delivery is not available for this address.",
      zone: null,
    };
  }

  if (zoneResolution.status === "conflict") {
    console.error("Conflicting active Jurgens delivery zones", {
      postalCode,
      zones: zoneResolution.zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
      })),
    });

    return {
      eligible: false,
      postalCode,
      unavailableCode: "zone_configuration_conflict",
      unavailableReason:
        "Jurgens Energy delivery pricing needs confirmation for this address. Please contact support so we can confirm delivery without guessing.",
      zone: null,
    };
  }

  const matchingZone = zoneResolution.zone;

  const subtotal = roundMoney(declaredValue);

  if (subtotal < matchingZone.minimumOrderAmount) {
    return {
      eligible: false,
      postalCode,
      unavailableCode: "minimum_order_not_met",
      unavailableReason: `Jurgens Energy delivery requires a minimum order of R ${formatMoney(matchingZone.minimumOrderAmount)} for this address.`,
      zone: matchingZone,
    };
  }

  const configuredRate = matchingZone.rates.find((rate) =>
    subtotalMatchesRate(subtotal, rate),
  );
  const freeDeliveryThreshold = configuredRate
    ? null
    : getZoneCapFreeDeliveryThreshold(subtotal, matchingZone);

  if (!configuredRate && freeDeliveryThreshold === null) {
    return {
      eligible: false,
      postalCode,
      unavailableCode: "rate_not_configured",
      unavailableReason: `No Jurgens Energy delivery price is available for this address at an order total of R ${formatMoney(subtotal)}.`,
      zone: matchingZone,
    };
  }

  return {
    deliveryFee: configuredRate?.price ?? 0,
    eligible: true,
    freeDeliveryThreshold,
    postalCode,
    pricingRule: configuredRate ? "configured_rate" : "zone_cap_free",
    rate: configuredRate ?? null,
    zone: matchingZone,
  };
}

function getZoneCapFreeDeliveryThreshold(
  subtotal: number,
  zone: JurgensDeliveryZone,
): number | null {
  const terminalCap = getJurgensImplicitFreeDeliveryThreshold(zone.rates);

  if (terminalCap === null || subtotal < terminalCap) {
    return null;
  }

  return terminalCap;
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

async function lockJurgensDeliveryZoneWrites(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(${JURGENS_DELIVERY_ZONE_WRITE_LOCK_ID})`,
  );
}

function formatPostalCodeConflictMessage(
  conflicts: ReturnType<typeof findJurgensDeliveryPostalCodeConflicts>,
) {
  const first = conflicts[0]!;
  const additionalCount = conflicts.length - 1;
  const additionalMessage = additionalCount > 0
    ? ` ${additionalCount} additional overlap${additionalCount === 1 ? " was" : "s were"} also found.`
    : "";

  return `Postal code ${first.postalCode} overlaps active zone “${first.existingZoneName}” (new rule “${first.candidateRule}”; existing rule “${first.existingRule}”). Active delivery zones cannot share postal codes.${additionalMessage} Remove the overlap or deactivate one zone before saving.`;
}
