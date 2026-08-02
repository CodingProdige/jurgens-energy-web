import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  jurgensDeliveryZoneRates,
  jurgensDeliveryZones,
} from "@/src/db/schema";
import {
  findJurgensDeliveryPostalCodeConflicts,
  normalizeJurgensDeliveryPostalCode,
  normalizeJurgensDeliveryPostalCodeRules,
  resolveJurgensDeliveryPostalZone,
} from "@/src/modules/shipping/jurgens-delivery-postal-rules";

const JURGENS_DELIVERY_ZONE_WRITE_LOCK_ID = 719_202_607;

export const jurgensDeliveryAvailabilityInputSchema = z.object({
  postalCode: z.string().trim().min(1),
});

export type JurgensDeliveryAvailabilityInput = z.infer<
  typeof jurgensDeliveryAvailabilityInputSchema
>;

export type JurgensDeliveryAvailabilityUnavailableCode =
  | "postal_code_unavailable"
  | "zone_configuration_conflict";

export type JurgensDeliveryAvailabilityZone = {
  deliveryInformation: string | null;
  id: string;
  name: string;
};

export type JurgensDeliveryAvailabilityResult =
  | {
      eligible: true;
      postalCode: string;
      unavailableCode: null;
      unavailableReason: null;
      zone: JurgensDeliveryAvailabilityZone;
    }
  | {
      eligible: false;
      postalCode: string;
      unavailableCode: JurgensDeliveryAvailabilityUnavailableCode;
      unavailableReason: string;
      zone: JurgensDeliveryAvailabilityZone | null;
    };

export type JurgensDeliveryZone = {
  createdAt: Date;
  deliveryInformation: string | null;
  id: string;
  isActive: boolean;
  name: string;
  postalCodes: string[];
  sortOrder: number;
  updatedAt: Date;
};

export type UpsertJurgensDeliveryZoneInput = {
  deliveryInformation?: string | null;
  id?: string | null;
  isActive: boolean;
  name: string;
  postalCodes: string[];
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

  return zoneRows.map((zone) => ({
    createdAt: zone.createdAt,
    deliveryInformation: zone.deliveryInformation,
    id: zone.id,
    isActive: zone.isActive,
    name: zone.name,
    postalCodes: normalizeJurgensDeliveryPostalCodeRules(zone.postalCodes),
    sortOrder: zone.sortOrder,
    updatedAt: zone.updatedAt,
  }));
}

export async function upsertJurgensDeliveryZone(
  input: UpsertJurgensDeliveryZoneInput,
) {
  const now = new Date();
  const postalCodes = normalizeJurgensDeliveryPostalCodeRules(input.postalCodes);

  if (postalCodes.length === 0) {
    return {
      ok: false,
      message: "Add at least one postal code, wildcard, or range.",
    };
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
      minimumOrderAmount: 0,
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

    return {
      ok: true as const,
      message: "Jurgens delivery service area saved.",
    };
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
      eligible: false,
      postalCode: evaluation.postalCode,
      unavailableCode: evaluation.unavailableCode,
      unavailableReason: evaluation.unavailableReason,
      zone,
    };
  }

  return {
    eligible: true,
    postalCode: evaluation.postalCode,
    unavailableCode: null,
    unavailableReason: null,
    zone: toCheckoutZone(evaluation.zone),
  };
}

type JurgensDeliveryAvailabilityEvaluation =
  | {
      eligible: true;
      postalCode: string;
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
  postalCode: postalCodeInput,
}: z.infer<
  typeof jurgensDeliveryAvailabilityInputSchema
>): Promise<JurgensDeliveryAvailabilityEvaluation> {
  const postalCode = normalizeJurgensDeliveryPostalCode(postalCodeInput);

  if (!postalCode) {
    throw new Error("A complete delivery address is required.");
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
        "Jurgens Energy delivery availability needs confirmation for this address. Please contact support so we can confirm delivery without guessing.",
      zone: null,
    };
  }

  const matchingZone = zoneResolution.zone;

  return {
    eligible: true,
    postalCode,
    zone: matchingZone,
  };
}


function toCheckoutZone(zone: JurgensDeliveryZone) {
  return {
    deliveryInformation: zone.deliveryInformation,
    id: zone.id,
    name: zone.name,
  };
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
