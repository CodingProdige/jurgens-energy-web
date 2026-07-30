import { createHash } from "node:crypto";

export const courierGuyTrackingStatuses = [
  "submitted",
  "deposit-pending",
  "awaiting-dropoff",
  "collection-assigned",
  "collection-unassigned",
  "collection-rejected",
  "collection-exception",
  "collection-failed-attempt",
  "collected",
  "at-hub",
  "on-hold",
  "on-hold-internal",
  "swad-dimensions",
  "swad-imaging",
  "returned-to-hub",
  "manifested",
  "ready-for-dispatch",
  "in-transit",
  "at-destination-hub",
  "delivery-assigned",
  "delivery-unassigned",
  "delivery-rejected",
  "out-for-delivery",
  "delivery-exception",
  "delivery-failed-attempt",
  "in-locker",
  "ready-for-pickup",
  "collect-and-return-to-hub",
  "collected-from-locker",
  "collected-from-counter",
  "delivered",
  "returned-to-sender",
  "undeliverable",
  "cancelled",
  "floor-check",
] as const;

export type CourierGuyTrackingStatus =
  (typeof courierGuyTrackingStatuses)[number];

export type CourierShipmentStatus =
  | "pending_booking"
  | "booking"
  | "booked"
  | "waybill_ready"
  | "ready_for_collection"
  | "cancelling"
  | "collected"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed_delivery"
  | "returned"
  | "undeliverable"
  | "cancelled";

const courierGuyTrackingStatusSet = new Set<string>(
  courierGuyTrackingStatuses,
);

const localStatusByCourierGuyStatus: Record<
  CourierGuyTrackingStatus,
  CourierShipmentStatus | null
> = {
  "at-destination-hub": "in_transit",
  "at-hub": "in_transit",
  "awaiting-dropoff": "waybill_ready",
  cancelled: "cancelled",
  "collect-and-return-to-hub": "in_transit",
  collected: "collected",
  "collection-assigned": "booked",
  "collection-rejected": "booked",
  "collection-unassigned": "booked",
  "collected-from-counter": "collected",
  "collected-from-locker": "collected",
  "collection-exception": null,
  "collection-failed-attempt": null,
  delivered: "delivered",
  "delivery-exception": "failed_delivery",
  "delivery-assigned": "in_transit",
  "delivery-failed-attempt": "failed_delivery",
  "delivery-rejected": "in_transit",
  "delivery-unassigned": "in_transit",
  "deposit-pending": "waybill_ready",
  "floor-check": "in_transit",
  "in-locker": "waybill_ready",
  "in-transit": "in_transit",
  manifested: "in_transit",
  "on-hold": "in_transit",
  "on-hold-internal": "in_transit",
  "out-for-delivery": "out_for_delivery",
  "ready-for-pickup": "ready_for_collection",
  "ready-for-dispatch": "in_transit",
  "returned-to-sender": "returned",
  "returned-to-hub": "in_transit",
  submitted: "booked",
  "swad-dimensions": "in_transit",
  "swad-imaging": "in_transit",
  undeliverable: "undeliverable",
};

const localStatusProgress: Record<CourierShipmentStatus, number> = {
  pending_booking: 0,
  booking: 1,
  booked: 2,
  waybill_ready: 3,
  cancelling: 3,
  collected: 4,
  in_transit: 5,
  out_for_delivery: 6,
  ready_for_collection: 6,
  failed_delivery: 7,
  delivered: 8,
  returned: 8,
  undeliverable: 8,
  cancelled: 8,
};

const terminalStatuses = new Set<CourierShipmentStatus>([
  "cancelled",
  "delivered",
  "returned",
  "undeliverable",
]);

export function normalizeCourierGuyTrackingStatus(
  status: string,
): CourierGuyTrackingStatus | null {
  const normalized = status
    .trim()
    .toLowerCase()
    .replaceAll(/[\s_]+/g, "-")
    .replaceAll(/-+/g, "-");

  return courierGuyTrackingStatusSet.has(normalized)
    ? (normalized as CourierGuyTrackingStatus)
    : null;
}

export function mapCourierGuyStatus(
  status: string,
): CourierShipmentStatus | null {
  const normalized = normalizeCourierGuyTrackingStatus(status);

  return normalized ? localStatusByCourierGuyStatus[normalized] : null;
}

export function resolveCourierGuyShipmentStatus(
  currentStatus: CourierShipmentStatus,
  providerStatus: string,
): CourierShipmentStatus {
  const candidate = mapCourierGuyStatus(providerStatus);

  if (!candidate || candidate === currentStatus) {
    return currentStatus;
  }

  if (terminalStatuses.has(currentStatus)) {
    return currentStatus;
  }

  if (
    currentStatus === "failed_delivery" &&
    candidate === "out_for_delivery"
  ) {
    return candidate;
  }

  return localStatusProgress[candidate] > localStatusProgress[currentStatus]
    ? candidate
    : currentStatus;
}

export function resolveCourierGuyMilestones({
  currentCollectedAt,
  currentDeliveredAt,
  nextStatus,
  occurredAt,
  providerCollectedAt,
  providerDeliveredAt,
}: {
  currentCollectedAt: Date | null;
  currentDeliveredAt: Date | null;
  nextStatus: CourierShipmentStatus;
  occurredAt: Date;
  providerCollectedAt?: Date | null;
  providerDeliveredAt?: Date | null;
}) {
  return {
    collectedAt:
      currentCollectedAt ??
      providerCollectedAt ??
      (nextStatus === "collected" ? occurredAt : null),
    deliveredAt:
      currentDeliveredAt ??
      providerDeliveredAt ??
      (nextStatus === "delivered" ? occurredAt : null),
  };
}

export function createCourierGuyTrackingEventId({
  data,
  location,
  message,
  occurredAt,
  parcelId,
  providerEventId,
  shipmentIdentity,
  source,
  status,
}: {
  data?: unknown;
  location?: string | null;
  message?: string | null;
  occurredAt?: string | null;
  parcelId?: string | null;
  providerEventId?: string | null;
  shipmentIdentity: string;
  source?: string | null;
  status: string;
}) {
  const normalizedProviderEventId = normalizeProviderEventId(
    providerEventId,
  );

  if (normalizedProviderEventId) {
    return normalizedProviderEventId;
  }

  return `tracking:sha256:${hashCanonicalValue({
    data: data ?? null,
    location: normalizeOptionalString(location),
    message: normalizeOptionalString(message),
    occurredAt: normalizeEventDate(occurredAt),
    parcelId: normalizeOptionalString(parcelId),
    shipmentIdentity: shipmentIdentity.trim(),
    source: normalizeOptionalString(source),
    status: normalizeCourierGuyTrackingStatus(status) ?? status.trim(),
  })}`;
}

export function createCourierGuyWebhookEventId(
  payload: Record<string, unknown>,
) {
  return `webhook:sha256:${hashCanonicalValue(payload)}`;
}

function hashCanonicalValue(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown) {
  return JSON.stringify(toCanonicalValue(value)) ?? "null";
}

function toCanonicalValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined ? null : toCanonicalValue(item),
    );
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const item = (value as Record<string, unknown>)[key];

        if (
          item !== undefined &&
          typeof item !== "function" &&
          typeof item !== "symbol"
        ) {
          result[key] = toCanonicalValue(item);
        }

        return result;
      }, {});
  }

  return String(value);
}

function normalizeProviderEventId(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized && normalized !== "0" ? normalized : null;
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized || null;
}

function normalizeEventDate(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? normalized : date.toISOString();
}
