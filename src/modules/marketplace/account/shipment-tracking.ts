export type CustomerShipmentPackageContent = {
  orderItemId: string;
  quantity: number;
  title: string;
};

type CustomerShipmentPackageContentRow = CustomerShipmentPackageContent & {
  shipmentId: string;
};

type CustomerShipmentPackageIdentity = {
  packageSequence: number | null;
  provider: string;
};

function isSequencedCourierGuyPackage(
  shipment: CustomerShipmentPackageIdentity,
) {
  return (
    shipment.provider === "courier_guy" &&
    Number.isInteger(shipment.packageSequence) &&
    (shipment.packageSequence ?? 0) > 0
  );
}

export function getCustomerCourierGuyPackageNumber(
  shipment: CustomerShipmentPackageIdentity,
) {
  return isSequencedCourierGuyPackage(shipment)
    ? shipment.packageSequence
    : null;
}

export function getCustomerCourierGuyPackageCount(
  shipments: CustomerShipmentPackageIdentity[],
) {
  const packageSequences = shipments
    .filter(isSequencedCourierGuyPackage)
    .map((shipment) => shipment.packageSequence!);

  if (packageSequences.length === 0) {
    return null;
  }

  return Math.max(packageSequences.length, ...packageSequences);
}

export function groupCustomerShipmentPackageContents(
  rows: CustomerShipmentPackageContentRow[],
) {
  const contentsByShipmentId = new Map<
    string,
    CustomerShipmentPackageContent[]
  >();

  for (const row of rows) {
    const contents = contentsByShipmentId.get(row.shipmentId) ?? [];
    const existing = contents.find(
      (item) => item.orderItemId === row.orderItemId,
    );

    if (existing) {
      existing.quantity += row.quantity;
    } else {
      contents.push({
        orderItemId: row.orderItemId,
        quantity: row.quantity,
        title: row.title,
      });
    }

    contentsByShipmentId.set(row.shipmentId, contents);
  }

  return contentsByShipmentId;
}
