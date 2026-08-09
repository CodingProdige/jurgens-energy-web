import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  auditLogs,
  courierGuyBookingBatchItems,
  courierGuyBookingBatches,
  courierGuyPackingPlans,
  orderItems,
  orders,
  paymentRefunds,
  productVariants,
  refundShipmentCancellationJobs,
  shipmentEvents,
  shipmentParcelItems,
  shipmentParcels,
  shipments,
  shippingRateQuotes,
} from "@/src/db/schema";
import {
  inspectCourierGuyManualPackingPlan,
  manualPackingPackagesInputSchema,
  type ManualPackingPackageInput,
} from "@/src/modules/shipping/courier-guy-manual-packing-rules";

const orderIdSchema = z.string().uuid();
const saveManualPackingPlanInputSchema = z
  .object({
    actorUserId: z.string().uuid(),
    orderId: orderIdSchema,
    packages: manualPackingPackagesInputSchema,
  })
  .strict();

type PackingPlanStatus =
  | "draft"
  | "confirmed"
  | "booking"
  | "reconciliation_required"
  | "booked";

type ExistingCourierShipment = {
  bookedAt: Date | null;
  bookingQuoteId: string | null;
  collectedAt: Date | null;
  deliveredAt: Date | null;
  id: string;
  providerAccountCode: string | null;
  providerCostAmount: string | null;
  providerCostCurrency: string | null;
  providerEnvironment: "live" | "sandbox" | null;
  providerShipmentId: string | null;
  quoteId: string | null;
  sellerId: string | null;
  serviceCode: string | null;
  serviceName: string | null;
  status: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  waybillNumber: string | null;
  waybillUrl: string | null;
};

type BookingQuoteState = {
  id: string;
  status: string;
};

type BookingBatchState = {
  id: string;
  status: string;
};

function sellerKey(sellerId: string | null) {
  return sellerId ?? "__platform__";
}

function hasProviderState(shipment: ExistingCourierShipment) {
  return Boolean(
    shipment.providerAccountCode ||
      shipment.providerCostAmount !== null ||
      shipment.providerCostCurrency ||
      shipment.providerEnvironment ||
      shipment.providerShipmentId ||
      shipment.serviceCode ||
      shipment.serviceName ||
      shipment.trackingNumber ||
      shipment.trackingUrl ||
      shipment.waybillNumber ||
      shipment.waybillUrl ||
      shipment.bookedAt ||
      shipment.collectedAt ||
      shipment.deliveredAt,
  );
}

function getManualPackingBlockReason({
  batchStates,
  bookingQuoteStates,
  courierItemCount,
  eventCount,
  hasRefund,
  jobCount,
  orderStatus,
  packingPlanStatus,
  shipments: courierShipments,
}: {
  batchStates: readonly BookingBatchState[];
  bookingQuoteStates: readonly BookingQuoteState[];
  courierItemCount: number;
  eventCount: number;
  hasRefund: boolean;
  jobCount: number;
  orderStatus: string;
  packingPlanStatus: PackingPlanStatus;
  shipments: readonly ExistingCourierShipment[];
}) {
  if (orderStatus !== "paid") {
    return "Only paid orders can be packed for Courier Guy.";
  }

  if (hasRefund) {
    return "This order has a refund record and its courier packing plan cannot be changed.";
  }

  if (courierItemCount === 0) {
    return "This order has no Courier Guy items to pack.";
  }

  if (
    packingPlanStatus === "booking" ||
    packingPlanStatus === "reconciliation_required" ||
    packingPlanStatus === "booked"
  ) {
    return packingPlanStatus === "reconciliation_required"
      ? "Resolve the uncertain Courier Guy booking before changing this packing plan."
      : "This packing plan has entered booking and can no longer be changed.";
  }

  const blockingBatch = batchStates.find((batch) =>
    ["booking", "partially_booked", "needs_reconciliation", "booked"].includes(
      batch.status,
    ),
  );

  if (blockingBatch) {
    return "A Courier Guy booking batch has already started for this order.";
  }

  if (jobCount > 0) {
    return "A refund shipment-cancellation job exists for this order.";
  }

  if (eventCount > 0) {
    return "Courier activity has already been recorded for this order.";
  }

  const unsafeShipment = courierShipments.find(
    (shipment) =>
      shipment.status !== "pending_booking" || hasProviderState(shipment),
  );

  if (unsafeShipment) {
    return "Courier packages can only be changed while every shipment is an untouched pending draft.";
  }

  const unsafeQuote = bookingQuoteStates.find(
    (quote) => quote.status === "selected" || quote.status === "booked",
  );

  if (unsafeQuote) {
    return "A Courier Guy quote has already been committed for booking.";
  }

  return null;
}

function buildExistingShipmentSelection() {
  return {
    bookedAt: shipments.bookedAt,
    bookingQuoteId: shipments.bookingQuoteId,
    collectedAt: shipments.collectedAt,
    deliveredAt: shipments.deliveredAt,
    id: shipments.id,
    providerAccountCode: shipments.providerAccountCode,
    providerCostAmount: shipments.providerCostAmount,
    providerCostCurrency: shipments.providerCostCurrency,
    providerEnvironment: shipments.providerEnvironment,
    providerShipmentId: shipments.providerShipmentId,
    quoteId: shipments.quoteId,
    sellerId: shipments.sellerId,
    serviceCode: shipments.serviceCode,
    serviceName: shipments.serviceName,
    status: shipments.status,
    trackingNumber: shipments.trackingNumber,
    trackingUrl: shipments.trackingUrl,
    waybillNumber: shipments.waybillNumber,
    waybillUrl: shipments.waybillUrl,
  };
}

async function getCourierOrderItems(
  database: Pick<typeof db, "select">,
  orderId: string,
) {
  return database
    .select({
      currentHeightMm: productVariants.heightMm,
      currentIsFragile: productVariants.isFragile,
      currentLengthMm: productVariants.lengthMm,
      currentShipsAlone: productVariants.shipsAlone,
      currentSku: productVariants.sku,
      currentWeightGrams: productVariants.weightGrams,
      currentWidthMm: productVariants.widthMm,
      id: orderItems.id,
      quantity: orderItems.quantity,
      sellerId: orderItems.sellerId,
      skuSnapshot: orderItems.skuSnapshot,
      title: orderItems.title,
      unitPrice: orderItems.unitPrice,
      variantId: orderItems.variantId,
    })
    .from(orderItems)
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(
      and(
        eq(orderItems.orderId, orderId),
        eq(orderItems.deliveryMethodSnapshot, "courier_guy"),
      ),
    )
    .orderBy(asc(orderItems.id));
}

export async function getCourierGuyManualPackingOrder(orderIdInput: string) {
  const orderId = orderIdSchema.parse(orderIdInput);
  const [order] = await db
    .select({
      currency: orders.currency,
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      deliveryAddress: orders.deliveryAddressSnapshot,
      id: orders.id,
      orderNumber: orders.orderNumber,
      shippingTotal: orders.shippingTotal,
      status: orders.status,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    throw new Error("Order could not be found.");
  }

  const [packingPlan, courierItems, courierShipments, refund, cancellationJobs, batches] =
    await Promise.all([
      db
        .select()
        .from(courierGuyPackingPlans)
        .where(eq(courierGuyPackingPlans.orderId, orderId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      getCourierOrderItems(db, orderId),
      db
        .select({
          ...buildExistingShipmentSelection(),
          bookingQuoteExpiresAt: shippingRateQuotes.expiresAt,
          bookingQuoteProviderAmount: shippingRateQuotes.providerAmount,
          bookingQuoteServiceName: shippingRateQuotes.serviceName,
          bookingQuoteStatus: shippingRateQuotes.status,
          packageSequence: shipments.packageSequence,
          packingPlanRevision: shipments.packingPlanRevision,
        })
        .from(shipments)
        .leftJoin(
          shippingRateQuotes,
          eq(shippingRateQuotes.id, shipments.bookingQuoteId),
        )
        .where(
          and(eq(shipments.orderId, orderId), eq(shipments.provider, "courier_guy")),
        )
        .orderBy(asc(shipments.packageSequence), asc(shipments.createdAt)),
      db
        .select({ id: paymentRefunds.id })
        .from(paymentRefunds)
        .where(eq(paymentRefunds.orderId, orderId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ id: refundShipmentCancellationJobs.id })
        .from(refundShipmentCancellationJobs)
        .innerJoin(
          shipments,
          eq(shipments.id, refundShipmentCancellationJobs.shipmentId),
        )
        .where(eq(shipments.orderId, orderId)),
      db
        .select({
          createdAt: courierGuyBookingBatches.createdAt,
          expiresAt: courierGuyBookingBatches.expiresAt,
          id: courierGuyBookingBatches.id,
          packingRevision: courierGuyBookingBatches.packingRevision,
          status: courierGuyBookingBatches.status,
        })
        .from(courierGuyBookingBatches)
        .where(eq(courierGuyBookingBatches.orderId, orderId))
        .orderBy(desc(courierGuyBookingBatches.createdAt)),
    ]);
  const shipmentIds = courierShipments.map((shipment) => shipment.id);
  const bookingQuoteIds = courierShipments.flatMap((shipment) =>
    shipment.bookingQuoteId ? [shipment.bookingQuoteId] : [],
  );
  const [parcelRows, eventRows, bookingQuoteStates] = await Promise.all([
    shipmentIds.length > 0
      ? db
          .select({
            declaredValue: shipmentParcels.declaredValue,
            heightMm: shipmentParcels.heightMm,
            id: shipmentParcels.id,
            lengthMm: shipmentParcels.lengthMm,
            reference: shipmentParcels.reference,
            shipmentId: shipmentParcels.shipmentId,
            weightGrams: shipmentParcels.weightGrams,
            widthMm: shipmentParcels.widthMm,
          })
          .from(shipmentParcels)
          .where(inArray(shipmentParcels.shipmentId, shipmentIds))
      : Promise.resolve([]),
    shipmentIds.length > 0
      ? db
          .select({ id: shipmentEvents.id })
          .from(shipmentEvents)
          .where(inArray(shipmentEvents.shipmentId, shipmentIds))
      : Promise.resolve([]),
    bookingQuoteIds.length > 0
      ? db
          .select({ id: shippingRateQuotes.id, status: shippingRateQuotes.status })
          .from(shippingRateQuotes)
          .where(inArray(shippingRateQuotes.id, bookingQuoteIds))
      : Promise.resolve([]),
  ]);
  const parcelIds = parcelRows.map((parcel) => parcel.id);
  const allocationRows =
    parcelIds.length > 0
      ? await db
          .select({
            orderItemId: shipmentParcelItems.orderItemId,
            parcelId: shipmentParcelItems.parcelId,
            quantity: shipmentParcelItems.quantity,
            skuSnapshot: orderItems.skuSnapshot,
            title: orderItems.title,
          })
          .from(shipmentParcelItems)
          .innerJoin(orderItems, eq(orderItems.id, shipmentParcelItems.orderItemId))
          .where(inArray(shipmentParcelItems.parcelId, parcelIds))
          .orderBy(asc(shipmentParcelItems.createdAt))
      : [];
  const parcelsByShipmentId = new Map<string, typeof parcelRows>();
  const allocationsByParcelId = new Map<string, typeof allocationRows>();

  for (const parcel of parcelRows) {
    parcelsByShipmentId.set(parcel.shipmentId, [
      ...(parcelsByShipmentId.get(parcel.shipmentId) ?? []),
      parcel,
    ]);
  }

  for (const allocation of allocationRows) {
    allocationsByParcelId.set(allocation.parcelId, [
      ...(allocationsByParcelId.get(allocation.parcelId) ?? []),
      allocation,
    ]);
  }

  const currentRevision = packingPlan?.revision ?? 0;
  const packages = courierShipments.flatMap((shipment) => {
    if (
      shipment.packageSequence === null ||
      shipment.packingPlanRevision !== currentRevision
    ) {
      return [];
    }

    const shipmentParcelsForPlan = parcelsByShipmentId.get(shipment.id) ?? [];

    if (shipmentParcelsForPlan.length !== 1) {
      throw new Error(
        `Manual package ${shipment.packageSequence} does not map to exactly one physical parcel.`,
      );
    }

    const parcel = shipmentParcelsForPlan[0]!;

    return [
      {
        bookingQuote: shipment.bookingQuoteId
          ? {
              expiresAt: shipment.bookingQuoteExpiresAt,
              id: shipment.bookingQuoteId,
              providerAmount: shipment.bookingQuoteProviderAmount,
              serviceName: shipment.bookingQuoteServiceName,
              status: shipment.bookingQuoteStatus,
            }
          : null,
        items: (allocationsByParcelId.get(parcel.id) ?? []).map((allocation) => ({
          orderItemId: allocation.orderItemId,
          quantity: allocation.quantity,
          sku: allocation.skuSnapshot,
          title: allocation.title,
        })),
        heightMm: Number(parcel.heightMm),
        lengthMm: Number(parcel.lengthMm),
        packageSequence: shipment.packageSequence,
        parcel: {
          declaredValue: parcel.declaredValue,
          heightMm: Number(parcel.heightMm),
          id: parcel.id,
          lengthMm: Number(parcel.lengthMm),
          reference: parcel.reference,
          weightGrams: Number(parcel.weightGrams),
          widthMm: Number(parcel.widthMm),
        },
        sellerId: shipment.sellerId,
        shipmentId: shipment.id,
        shipmentStatus: shipment.status,
        weightGrams: Number(parcel.weightGrams),
        widthMm: Number(parcel.widthMm),
      },
    ];
  });
  packages.sort(
    (first, second) => first.packageSequence - second.packageSequence,
  );
  const blockReason = getManualPackingBlockReason({
    batchStates: batches,
    bookingQuoteStates,
    courierItemCount: courierItems.length,
    eventCount: eventRows.length,
    hasRefund: Boolean(refund),
    jobCount: cancellationJobs.length,
    orderStatus: order.status,
    packingPlanStatus: packingPlan?.status ?? "draft",
    shipments: courierShipments,
  });
  const activeBookingBatch = batches.find(
    (batch) =>
      batch.packingRevision === currentRevision && batch.status === "booking",
  );

  return {
    activeBookingBatch: activeBookingBatch
      ? {
          createdAt: activeBookingBatch.createdAt,
          expiresAt: activeBookingBatch.expiresAt,
          id: activeBookingBatch.id,
          status: activeBookingBatch.status,
        }
      : null,
    editable: blockReason === null,
    editBlockedReason: blockReason,
    items: courierItems.map((item) => ({
      currentParcelReference: {
        heightMm: item.currentHeightMm,
        isFragile: item.currentIsFragile,
        lengthMm: item.currentLengthMm,
        shipsAlone: item.currentShipsAlone,
        weightGrams: item.currentWeightGrams,
        widthMm: item.currentWidthMm,
      },
      heightMm: item.currentHeightMm,
      id: item.id,
      isFragile: item.currentIsFragile,
      lengthMm: item.currentLengthMm,
      quantity: item.quantity,
      sellerId: item.sellerId,
      shipsAlone: item.currentShipsAlone,
      sku: item.skuSnapshot ?? item.currentSku,
      title: item.title,
      unitPrice: item.unitPrice,
      variantId: item.variantId,
      weightGrams: item.currentWeightGrams,
      widthMm: item.currentWidthMm,
    })),
    order: {
      currency: order.currency,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
      destination: [
        order.deliveryAddress.suburb,
        order.deliveryAddress.city,
        order.deliveryAddress.postalCode,
      ]
        .filter(Boolean)
        .join(", "),
      id: order.id,
      orderNumber: order.orderNumber,
      shippingTotal: order.shippingTotal,
      status: order.status,
    },
    packages,
    packingPlan: {
      confirmedAt: packingPlan?.confirmedAt ?? null,
      confirmedByUserId: packingPlan?.confirmedByUserId ?? null,
      revision: currentRevision,
      status: packingPlan?.status ?? "draft",
      updatedAt: packingPlan?.updatedAt ?? null,
    },
  };
}

export type CourierGuyManualPackingOrder = Awaited<
  ReturnType<typeof getCourierGuyManualPackingOrder>
>;

export async function saveCourierGuyManualPackingPlan(input: {
  actorUserId: string;
  orderId: string;
  packages: ManualPackingPackageInput[];
}) {
  const parsed = saveManualPackingPlanInputSchema.parse(input);

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, parsed.orderId))
      .limit(1)
      .for("update");

    if (!order) {
      throw new Error("Order could not be found.");
    }

    const [packingPlan] = await tx
      .select()
      .from(courierGuyPackingPlans)
      .where(eq(courierGuyPackingPlans.orderId, order.id))
      .limit(1)
      .for("update");
    const courierShipments = await tx
      .select(buildExistingShipmentSelection())
      .from(shipments)
      .where(
        and(eq(shipments.orderId, order.id), eq(shipments.provider, "courier_guy")),
      )
      .orderBy(asc(shipments.id))
      .for("update");
    const shipmentIds = courierShipments.map((shipment) => shipment.id);
    const bookingQuoteIds = courierShipments.flatMap((shipment) =>
      shipment.bookingQuoteId ? [shipment.bookingQuoteId] : [],
    );
    const courierItems = await getCourierOrderItems(tx, order.id);
    const refundRows = await tx
      .select({ id: paymentRefunds.id })
      .from(paymentRefunds)
      .where(eq(paymentRefunds.orderId, order.id))
      .orderBy(asc(paymentRefunds.id))
      .for("update");
    const cancellationJobs = await tx
      .select({ id: refundShipmentCancellationJobs.id })
      .from(refundShipmentCancellationJobs)
      .innerJoin(
        shipments,
        eq(shipments.id, refundShipmentCancellationJobs.shipmentId),
      )
      .where(eq(shipments.orderId, order.id))
      .orderBy(asc(refundShipmentCancellationJobs.id))
      .for("update");
    const eventRows =
      shipmentIds.length > 0
        ? await tx
            .select({ id: shipmentEvents.id })
            .from(shipmentEvents)
            .where(inArray(shipmentEvents.shipmentId, shipmentIds))
            .orderBy(asc(shipmentEvents.id))
            .for("update")
        : [];
    const batchRows = await tx
      .select({
        id: courierGuyBookingBatches.id,
        status: courierGuyBookingBatches.status,
      })
      .from(courierGuyBookingBatches)
      .where(eq(courierGuyBookingBatches.orderId, order.id))
      .orderBy(asc(courierGuyBookingBatches.id))
      .for("update");
    const bookingQuoteStates =
      bookingQuoteIds.length > 0
        ? await tx
            .select({ id: shippingRateQuotes.id, status: shippingRateQuotes.status })
            .from(shippingRateQuotes)
            .where(inArray(shippingRateQuotes.id, bookingQuoteIds))
            .orderBy(asc(shippingRateQuotes.id))
            .for("update")
        : [];
    const blockReason = getManualPackingBlockReason({
      batchStates: batchRows,
      bookingQuoteStates,
      courierItemCount: courierItems.length,
      eventCount: eventRows.length,
      hasRefund: refundRows.length > 0,
      jobCount: cancellationJobs.length,
      orderStatus: order.status,
      packingPlanStatus: packingPlan?.status ?? "draft",
      shipments: courierShipments,
    });

    if (blockReason) {
      throw new Error(blockReason);
    }

    const inspected = inspectCourierGuyManualPackingPlan(
      courierItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        sellerId: item.sellerId,
      })),
      parsed.packages,
    );
    const quoteIdsBySeller = new Map<string, Set<string>>();
    const allQuoteIds = new Set<string>();

    for (const shipment of courierShipments) {
      if (!shipment.quoteId) {
        continue;
      }

      const key = sellerKey(shipment.sellerId);
      quoteIdsBySeller.set(key, quoteIdsBySeller.get(key) ?? new Set());
      quoteIdsBySeller.get(key)!.add(shipment.quoteId);
      allQuoteIds.add(shipment.quoteId);
    }

    for (const quoteIds of quoteIdsBySeller.values()) {
      if (quoteIds.size > 1) {
        throw new Error(
          "Existing courier drafts have conflicting customer shipping quotes for one seller.",
        );
      }
    }

    const [customerBaseQuote] = await tx
      .select({ id: shippingRateQuotes.id })
      .from(shippingRateQuotes)
      .where(
        and(
          eq(shippingRateQuotes.orderId, order.id),
          eq(shippingRateQuotes.provider, "manual"),
          sql`${shippingRateQuotes.providerRateId} LIKE 'customer-shipping-policy-%'`,
        ),
      )
      .orderBy(desc(shippingRateQuotes.createdAt))
      .limit(1);
    const sharedQuoteId =
      allQuoteIds.size === 1
        ? [...allQuoteIds][0]!
        : customerBaseQuote?.id ?? null;
    const nextRevision = (packingPlan?.revision ?? 0) + 1;
    const now = new Date();
    const expirableBatchIds = batchRows.flatMap((batch) =>
      batch.status === "quoted" || batch.status === "expired" || batch.status === "failed"
        ? [batch.id]
        : [],
    );
    const expirableBatchItems =
      expirableBatchIds.length > 0
        ? await tx
            .select({ quoteId: courierGuyBookingBatchItems.quoteId })
            .from(courierGuyBookingBatchItems)
            .where(inArray(courierGuyBookingBatchItems.batchId, expirableBatchIds))
            .for("update")
        : [];
    const invalidatedBookingQuoteIds = [
      ...new Set([
        ...bookingQuoteIds,
        ...expirableBatchItems.map((item) => item.quoteId),
      ]),
    ];

    if (invalidatedBookingQuoteIds.length > 0) {
      await tx
        .update(shippingRateQuotes)
        .set({ status: "expired" })
        .where(
          and(
            inArray(shippingRateQuotes.id, invalidatedBookingQuoteIds),
            eq(shippingRateQuotes.status, "quoted"),
          ),
        );
    }

    if (expirableBatchIds.length > 0) {
      await tx
        .update(courierGuyBookingBatches)
        .set({ status: "expired", updatedAt: now })
        .where(inArray(courierGuyBookingBatches.id, expirableBatchIds));
      await tx
        .delete(courierGuyBookingBatchItems)
        .where(inArray(courierGuyBookingBatchItems.batchId, expirableBatchIds));
    }

    if (shipmentIds.length > 0) {
      await tx.delete(shipments).where(inArray(shipments.id, shipmentIds));
    }

    const orderItemById = new Map(courierItems.map((item) => [item.id, item]));
    const createdPackages = inspected.packages.map((packingPackage) => {
      const shipmentId = randomUUID();
      const parcelId = randomUUID();
      const packageValueCents = packingPackage.items.reduce((total, allocation) => {
        const item = orderItemById.get(allocation.orderItemId)!;

        return total + Math.round(Number(item.unitPrice) * 100) * allocation.quantity;
      }, 0);
      const sellerQuoteIds = quoteIdsBySeller.get(sellerKey(packingPackage.sellerId));

      return {
        allocations: packingPackage.items.map((allocation) => ({
          id: randomUUID(),
          orderItemId: allocation.orderItemId,
          parcelId,
          quantity: allocation.quantity,
          updatedAt: now,
        })),
        packageSequence: packingPackage.packageSequence,
        parcel: {
          declaredValue: (packageValueCents / 100).toFixed(2),
          heightMm: packingPackage.heightMm,
          id: parcelId,
          lengthMm: packingPackage.lengthMm,
          reference: `${order.orderNumber}-PKG-${packingPackage.packageSequence}`,
          shipmentId,
          weightGrams: packingPackage.weightGrams,
          widthMm: packingPackage.widthMm,
        },
        shipment: {
          id: shipmentId,
          orderId: order.id,
          packageSequence: packingPackage.packageSequence,
          packingPlanRevision: nextRevision,
          provider: "courier_guy" as const,
          quoteId: sellerQuoteIds?.size === 1 ? [...sellerQuoteIds][0]! : sharedQuoteId,
          sellerId: packingPackage.sellerId,
          updatedAt: now,
        },
      };
    });

    await tx.insert(shipments).values(createdPackages.map((entry) => entry.shipment));
    await tx
      .insert(shipmentParcels)
      .values(createdPackages.map((entry) => entry.parcel));
    await tx
      .insert(shipmentParcelItems)
      .values(createdPackages.flatMap((entry) => entry.allocations));
    await tx
      .insert(courierGuyPackingPlans)
      .values({
        confirmedAt: now,
        confirmedByUserId: parsed.actorUserId,
        orderId: order.id,
        revision: nextRevision,
        status: "confirmed",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        set: {
          confirmedAt: now,
          confirmedByUserId: parsed.actorUserId,
          revision: nextRevision,
          status: "confirmed",
          updatedAt: now,
        },
        target: courierGuyPackingPlans.orderId,
      });
    await tx.insert(auditLogs).values({
      action: "shipping.courier_guy.manual_packing_confirmed",
      actorUserId: parsed.actorUserId,
      entityId: order.id,
      entityType: "order",
      metadata: JSON.stringify({
        expiredBatchIds: expirableBatchIds,
        expiredBookingQuoteIds: invalidatedBookingQuoteIds,
        packageCount: createdPackages.length,
        replacedShipmentIds: shipmentIds,
        revision: nextRevision,
        totalItemQuantity: inspected.totalItemQuantity,
      }),
    });

    return {
      orderId: order.id,
      packageCount: createdPackages.length,
      packages: createdPackages.map((entry) => ({
        packageSequence: entry.packageSequence,
        parcelId: entry.parcel.id,
        shipmentId: entry.shipment.id,
      })),
      revision: nextRevision,
      totalItemQuantity: inspected.totalItemQuantity,
    };
  });
}

export type SavedCourierGuyManualPackingPlan = Awaited<
  ReturnType<typeof saveCourierGuyManualPackingPlan>
>;
