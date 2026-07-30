export const courierGuyCancellableShipmentStatuses = [
  "booked",
  "waybill_ready",
] as const;

export function hasCourierGuyCredentialsForIdentity({
  configuredAccountCode,
  hasApiKey,
  shipmentIdentity,
}: {
  configuredAccountCode: string | null | undefined;
  hasApiKey: boolean;
  shipmentIdentity?: {
    accountCode: string | null;
    mode: "live" | "sandbox" | null;
  };
}) {
  const normalizedConfiguredAccountCode =
    configuredAccountCode?.trim() || null;

  if (!normalizedConfiguredAccountCode || !hasApiKey) {
    return false;
  }

  if (shipmentIdentity === undefined) {
    return true;
  }

  return (
    shipmentIdentity.mode !== null &&
    (shipmentIdentity.accountCode?.trim() || null) ===
      normalizedConfiguredAccountCode
  );
}

export function createCourierGuyBookingReference(
  orderNumber: string,
  shipmentId: string,
) {
  const suffix = shipmentId.trim();
  const availableOrderNumberLength = Math.max(1, 254 - suffix.length);
  const normalizedOrderNumber =
    orderNumber.trim().slice(0, availableOrderNumberLength) || "ORDER";

  return `${normalizedOrderNumber}-${suffix}`.slice(0, 255);
}

export function createCourierGuyCustomerTrackingUrl(
  trackingReference: string,
) {
  const url = new URL("https://portal.thecourierguy.co.za/track");

  url.searchParams.set("ref", trackingReference.trim());

  return url.toString();
}
