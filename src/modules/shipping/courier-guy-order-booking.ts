import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
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
  shipmentParcelItems,
  shipmentParcels,
  shipments,
  shippingRateQuotes,
} from "@/src/db/schema";
import {
  calculateCourierGuyOrderCostProjection,
  centsToMoney,
  createCourierGuyBookingQuoteFingerprint,
  evaluateCourierGuyOrderBookingSafety,
  moneyToCents,
} from "@/src/modules/shipping/courier-guy-booking-quote-rules";
import {
  createCourierGuyBookingQuote,
  expireCourierGuyBookingQuote,
  prepareCourierGuyQuotedBooking,
  type CourierGuyBookingQuoteView,
} from "@/src/modules/shipping/courier-guy-booking-quotes";
import { bookCourierGuyShipment } from "@/src/modules/shipping/courier-guy-shipments";

const idSchema = z.string().uuid();
const committedShipmentStatuses = [
  "booking",
  "booked",
  "waybill_ready",
  "ready_for_collection",
  "cancelling",
  "collected",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed_delivery",
  "returned",
  "undeliverable",
  "cancelled",
] as const;
const providerCreatedShipmentStatuses = [
  "booked",
  "waybill_ready",
  "ready_for_collection",
  "cancelling",
  "collected",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed_delivery",
  "returned",
  "undeliverable",
  "cancelled",
] as const;

export type CourierGuyOrderBookingQuoteView = {
  allowed: boolean;
  batchId: string;
  expiresAt: string;
  maxAbsorbedAmount: number | null;
  maxBookingCostAmount: number | null;
  orderId: string;
  orderNumber: string;
  packages: Array<{
    items: Array<{
      orderItemId: string;
      quantity: number;
      sku: string | null;
      title: string;
    }>;
    parcel: CourierGuyBookingQuoteView["parcel"];
    providerAmount: number;
    quoteId: string;
    sequence: number;
    serviceCode: string;
    serviceName: string;
    shipmentId: string;
  }>;
  packingRevision: number;
  safetyReasons: string[];
  totals: {
    alreadyCommittedProviderAmount: number;
    customerShippingAmount: number;
    deliveryMarginRemaining: number;
    projectedAbsorbedAmount: number;
    projectedProviderSpend: number;
    quotedProviderAmount: number;
  };
};

export type CourierGuyOrderBookingResult = {
  results: Array<{
    message: string | null;
    sequence: number;
    shipmentId: string;
    status: "booked" | "failed" | "needs_reconciliation" | "not_attempted";
    trackingReference: string | null;
  }>;
  status:
    | "booked"
    | "failed"
    | "partially_booked"
    | "needs_reconciliation";
};

type PackedShipmentSnapshot = {
  bookingQuoteId: string | null;
  packageSequence: number;
  packingPlanRevision: number;
  parcel: {
    heightMm: number;
    id: string;
    lengthMm: number;
    weightGrams: number;
    widthMm: number;
  };
  providerCostAmount: number | null;
  sellerId: string | null;
  shipmentId: string;
  status: (typeof shipments.$inferSelect)["status"];
};

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function money(value: number) {
  return centsToMoney(moneyToCents(value));
}

function sameStringSet(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false;
  }

  const expected = new Set(second);
  return first.every((value) => expected.has(value));
}

async function lockCourierGuyOrderBatch(
  tx: DatabaseTransaction,
  {
    batchId,
    orderId,
    packingRevision,
  }: { batchId: string; orderId: string; packingRevision: number },
) {
  const [order] = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
    .for("update");
  const [plan] = await tx
    .select({ revision: courierGuyPackingPlans.revision })
    .from(courierGuyPackingPlans)
    .where(eq(courierGuyPackingPlans.orderId, orderId))
    .limit(1)
    .for("update");

  await tx
    .select({ id: shipments.id })
    .from(shipments)
    .where(
      and(
        eq(shipments.orderId, orderId),
        eq(shipments.provider, "courier_guy"),
      ),
    )
    .orderBy(asc(shipments.id))
    .for("update");
  const [batch] = await tx
    .select({ id: courierGuyBookingBatches.id })
    .from(courierGuyBookingBatches)
    .where(
      and(
        eq(courierGuyBookingBatches.id, batchId),
        eq(courierGuyBookingBatches.orderId, orderId),
      ),
    )
    .limit(1)
    .for("update");

  await tx
    .select({ id: courierGuyBookingBatchItems.id })
    .from(courierGuyBookingBatchItems)
    .where(eq(courierGuyBookingBatchItems.batchId, batchId))
    .orderBy(asc(courierGuyBookingBatchItems.packageSequence))
    .for("update");

  if (!order || !plan || plan.revision !== packingRevision || !batch) {
    throw new Error("The Courier Guy order booking state changed. Refresh.");
  }
}

async function loadPackingSnapshot(orderId: string) {
  const parsedOrderId = idSchema.safeParse(orderId);

  if (!parsedOrderId.success) {
    throw new Error("The order is invalid.");
  }

  const [order, plan, refund] = await Promise.all([
    db
      .select({
        currency: orders.currency,
        id: orders.id,
        orderNumber: orders.orderNumber,
        shippingTotal: orders.shippingTotal,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, parsedOrderId.data))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(courierGuyPackingPlans)
      .where(eq(courierGuyPackingPlans.orderId, parsedOrderId.data))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ id: paymentRefunds.id })
      .from(paymentRefunds)
      .where(eq(paymentRefunds.orderId, parsedOrderId.data))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  if (!order || !plan || plan.revision < 1) {
    throw new Error("Save and confirm the manual packing plan first.");
  }

  if (order.status !== "paid" || refund) {
    throw new Error(
      refund
        ? "This order has a refund record and cannot be booked with Courier Guy."
        : "Only paid orders can be booked with Courier Guy.",
    );
  }

  if (order.currency !== "ZAR") {
    throw new Error("Courier Guy order booking currently requires a ZAR order.");
  }

  if (!["confirmed", "booking"].includes(plan.status)) {
    throw new Error(
      plan.status === "reconciliation_required"
        ? "Resolve the uncertain Courier Guy package before continuing."
        : "This packing plan is not available for quoting or booking.",
    );
  }

  const rows = await db
    .select({
      bookingQuoteId: shipments.bookingQuoteId,
      heightMm: shipmentParcels.heightMm,
      lengthMm: shipmentParcels.lengthMm,
      packageSequence: shipments.packageSequence,
      packingPlanRevision: shipments.packingPlanRevision,
      parcelId: shipmentParcels.id,
      providerCostAmount: shipments.providerCostAmount,
      sellerId: shipments.sellerId,
      shipmentId: shipments.id,
      status: shipments.status,
      weightGrams: shipmentParcels.weightGrams,
      widthMm: shipmentParcels.widthMm,
    })
    .from(shipments)
    .leftJoin(shipmentParcels, eq(shipmentParcels.shipmentId, shipments.id))
    .where(
      and(
        eq(shipments.orderId, order.id),
        eq(shipments.provider, "courier_guy"),
      ),
    )
    .orderBy(asc(shipments.id), asc(shipmentParcels.id));
  const byShipmentId = new Map<string, typeof rows>();

  for (const row of rows) {
    byShipmentId.set(row.shipmentId, [
      ...(byShipmentId.get(row.shipmentId) ?? []),
      row,
    ]);
  }

  const packages: PackedShipmentSnapshot[] = [];

  for (const shipmentRows of byShipmentId.values()) {
    if (
      shipmentRows.length !== 1 ||
      shipmentRows[0]?.parcelId === null ||
      shipmentRows[0]?.packageSequence === null ||
      shipmentRows[0]?.packingPlanRevision !== plan.revision
    ) {
      throw new Error(
        "Every manual Courier Guy package must map to exactly one shipment and parcel.",
      );
    }

    const row = shipmentRows[0]!;
    packages.push({
      bookingQuoteId: row.bookingQuoteId,
      packageSequence: row.packageSequence!,
      packingPlanRevision: row.packingPlanRevision!,
      parcel: {
        heightMm: Number(row.heightMm),
        id: row.parcelId!,
        lengthMm: Number(row.lengthMm),
        weightGrams: Number(row.weightGrams),
        widthMm: Number(row.widthMm),
      },
      providerCostAmount:
        row.providerCostAmount === null ? null : Number(row.providerCostAmount),
      sellerId: row.sellerId,
      shipmentId: row.shipmentId,
      status: row.status,
    });
  }

  packages.sort(
    (first, second) => first.packageSequence - second.packageSequence,
  );

  if (packages.length === 0) {
    throw new Error("The confirmed packing plan has no physical packages.");
  }

  const parcelIds = packages.map((item) => item.parcel.id);
  const [allocationRows, requiredItemRows] = await Promise.all([
    db
      .select({
        orderId: orderItems.orderId,
        orderItemId: orderItems.id,
        parcelId: shipmentParcelItems.parcelId,
        quantity: shipmentParcelItems.quantity,
        sellerId: orderItems.sellerId,
        sku: orderItems.skuSnapshot,
        title: orderItems.title,
      })
      .from(shipmentParcelItems)
      .innerJoin(orderItems, eq(orderItems.id, shipmentParcelItems.orderItemId))
      .where(inArray(shipmentParcelItems.parcelId, parcelIds)),
    db
      .select({ id: orderItems.id, quantity: orderItems.quantity })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, order.id),
          eq(orderItems.deliveryMethodSnapshot, "courier_guy"),
        ),
      ),
  ]);
  const allocatedByItemId = new Map<string, number>();
  const packageByParcelId = new Map(
    packages.map((packingPackage) => [
      packingPackage.parcel.id,
      packingPackage,
    ]),
  );

  for (const allocation of allocationRows) {
    if (allocation.orderId !== order.id) {
      throw new Error("A package contains an item from a different order.");
    }

    if (
      packageByParcelId.get(allocation.parcelId)?.sellerId !==
      allocation.sellerId
    ) {
      throw new Error(
        "A package contains an item that does not match its fulfillment seller.",
      );
    }

    allocatedByItemId.set(
      allocation.orderItemId,
      (allocatedByItemId.get(allocation.orderItemId) ?? 0) + allocation.quantity,
    );
  }

  if (
    requiredItemRows.length === 0 ||
    requiredItemRows.some(
      (item) => allocatedByItemId.get(item.id) !== item.quantity,
    ) ||
    [...allocatedByItemId.keys()].some(
      (itemId) => !requiredItemRows.some((item) => item.id === itemId),
    )
  ) {
    throw new Error(
      "The packing plan no longer allocates every Courier Guy order unit exactly once.",
    );
  }

  return { allocationRows, order, packages, plan };
}

async function getCommittedProviderAmount({
  excludedShipmentIds,
  orderId,
}: {
  excludedShipmentIds: string[];
  orderId: string;
}) {
  const rows = await db
    .select({
      bookingQuoteAmount: shippingRateQuotes.providerAmount,
      bookingQuoteStatus: shippingRateQuotes.status,
      id: shipments.id,
      provider: shipments.provider,
      providerCostAmount: shipments.providerCostAmount,
      status: shipments.status,
    })
    .from(shipments)
    .leftJoin(
      shippingRateQuotes,
      eq(shippingRateQuotes.id, shipments.bookingQuoteId),
    )
    .where(eq(shipments.orderId, orderId));
  let unresolvedCommitted = 0;
  const amount = rows.reduce((total, row) => {
    if (excludedShipmentIds.includes(row.id)) {
      return total;
    }

    if (row.providerCostAmount !== null) {
      const providerCostAmount = Number(row.providerCostAmount);

      if (!Number.isFinite(providerCostAmount) || providerCostAmount < 0) {
        throw new Error(
          "A stored carrier cost is invalid. Correct it before booking more packages.",
        );
      }

      return total + providerCostAmount;
    }

    const committed =
      row.provider === "courier_guy" &&
      committedShipmentStatuses.includes(
        row.status as (typeof committedShipmentStatuses)[number],
      );
    const reserved =
      committed &&
      (row.bookingQuoteStatus === "selected" ||
        row.bookingQuoteStatus === "booked") &&
      row.bookingQuoteAmount !== null;

    if (reserved) {
      const bookingQuoteAmount = Number(row.bookingQuoteAmount);

      if (!Number.isFinite(bookingQuoteAmount) || bookingQuoteAmount < 0) {
        throw new Error(
          "A reserved Courier Guy quote is invalid. Resolve it before booking more packages.",
        );
      }

      return total + bookingQuoteAmount;
    }

    if (committed) {
      unresolvedCommitted += 1;
    }

    return total;
  }, 0);

  if (unresolvedCommitted > 0) {
    throw new Error(
      "An existing Courier Guy booking has no auditable cost. Reconcile it before booking more packages.",
    );
  }

  return money(amount);
}

function buildQuoteView({
  alreadyCommittedProviderAmount,
  batchId,
  createdQuotes,
  snapshot,
}: {
  alreadyCommittedProviderAmount: number;
  batchId: string;
  createdQuotes: CourierGuyBookingQuoteView[];
  snapshot: Awaited<ReturnType<typeof loadPackingSnapshot>>;
}): Omit<CourierGuyOrderBookingQuoteView, "allowed" | "safetyReasons"> & {
  safetyReasons: string[];
} {
  const quoteByShipmentId = new Map(
    createdQuotes.map((quote) => [quote.shipmentId, quote]),
  );
  const quotedProviderAmount = money(
    createdQuotes.reduce((total, quote) => total + quote.providerAmount, 0),
  );
  const customerShippingAmount = Number(snapshot.order.shippingTotal);
  const projection = calculateCourierGuyOrderCostProjection({
    customerShippingAmount,
    otherProviderCosts: alreadyCommittedProviderAmount,
    selectedProviderAmount: quotedProviderAmount,
  });
  const maxBookingCostAmount = createdQuotes[0]?.maxBookingCostAmount ?? null;
  const maxAbsorbedAmount = createdQuotes[0]?.maxAbsorbedAmount ?? null;
  const safetyReasons: string[] = [];
  const safety = evaluateCourierGuyOrderBookingSafety({
    approvedPackageAmounts: createdQuotes.map((quote) => quote.providerAmount),
    customerShippingAmount,
    freshPackageAmounts: createdQuotes.map((quote) => quote.providerAmount),
    maxAbsorbedAmount,
    maxBookingCostAmount,
    otherProviderCosts: alreadyCommittedProviderAmount,
  });

  for (const reason of safety.reasons) {
    if (reason.reason === "booking_cost_limit_exceeded") {
      const quote = createdQuotes[reason.packageIndex ?? -1];
      const packedPackage = quote
        ? snapshot.packages.find(
            (item) => item.shipmentId === quote.shipmentId,
          )
        : null;
      safetyReasons.push(
        `Package ${packedPackage?.packageSequence ?? "?"} costs R ${quote?.providerAmount.toFixed(2) ?? "—"}, above the R ${maxBookingCostAmount?.toFixed(2) ?? "—"} per-package limit.`,
      );
    } else if (reason.reason === "absorbed_cost_limit_exceeded") {
      safetyReasons.push(
        `The order would make Jurgens absorb R ${centsToMoney(projection.projectedAbsorbedAmountCents).toFixed(2)}, above the R ${maxAbsorbedAmount?.toFixed(2) ?? "—"} order limit.`,
      );
    }
  }

  return {
    batchId,
    expiresAt: new Date(
      Math.min(...createdQuotes.map((quote) => Date.parse(quote.expiresAt))),
    ).toISOString(),
    maxAbsorbedAmount,
    maxBookingCostAmount,
    orderId: snapshot.order.id,
    orderNumber: snapshot.order.orderNumber,
    packages: snapshot.packages
      .filter((item) => quoteByShipmentId.has(item.shipmentId))
      .map((item) => {
        const quote = quoteByShipmentId.get(item.shipmentId)!;

        return {
          items: snapshot.allocationRows
            .filter((allocation) => allocation.parcelId === item.parcel.id)
            .map((allocation) => ({
              orderItemId: allocation.orderItemId,
              quantity: allocation.quantity,
              sku: allocation.sku,
              title: allocation.title,
            })),
          parcel: quote.parcel,
          providerAmount: money(quote.providerAmount),
          quoteId: quote.quoteId,
          sequence: item.packageSequence,
          serviceCode: quote.serviceCode,
          serviceName: quote.serviceName,
          shipmentId: item.shipmentId,
        };
      }),
    packingRevision: snapshot.plan.revision,
    safetyReasons,
    totals: {
      alreadyCommittedProviderAmount,
      customerShippingAmount,
      deliveryMarginRemaining: centsToMoney(
        projection.deliveryMarginRemainingCents,
      ),
      projectedAbsorbedAmount: centsToMoney(
        projection.projectedAbsorbedAmountCents,
      ),
      projectedProviderSpend: centsToMoney(
        projection.projectedProviderSpendCents,
      ),
      quotedProviderAmount,
    },
  };
}

export async function createCourierGuyOrderBookingQuote({
  actorUserId,
  orderId,
}: {
  actorUserId: string;
  orderId: string;
}): Promise<CourierGuyOrderBookingQuoteView> {
  const snapshot = await loadPackingSnapshot(orderId);
  const pendingPackages = snapshot.packages.filter(
    (item) => item.status === "pending_booking",
  );

  if (snapshot.packages.some((item) => item.status === "booking")) {
    throw new Error(
      "One package has an uncertain Courier Guy outcome. Reconcile it first.",
    );
  }

  if (pendingPackages.length === 0) {
    throw new Error("Every package in this packing plan is already booked.");
  }

  const createdQuotes: CourierGuyBookingQuoteView[] = [];

  try {
    for (const packedPackage of pendingPackages) {
      createdQuotes.push(
        await createCourierGuyBookingQuote(packedPackage.shipmentId),
      );
    }
  } catch (error) {
    await Promise.allSettled(
      createdQuotes.map((quote) =>
        expireCourierGuyBookingQuote(quote.shipmentId, quote.quoteId),
      ),
    );
    throw error;
  }

  const alreadyCommittedProviderAmount = await getCommittedProviderAmount({
    excludedShipmentIds: pendingPackages.map((item) => item.shipmentId),
    orderId: snapshot.order.id,
  });
  const draftView = buildQuoteView({
    alreadyCommittedProviderAmount,
    batchId: "00000000-0000-4000-8000-000000000000",
    createdQuotes,
    snapshot,
  });
  const fingerprint = createCourierGuyBookingQuoteFingerprint({
    orderId: snapshot.order.id,
    packingRevision: snapshot.plan.revision,
    packages: draftView.packages.map((item) => ({
      providerAmount: item.providerAmount,
      quoteId: item.quoteId,
      sequence: item.sequence,
      shipmentId: item.shipmentId,
    })),
    totals: draftView.totals,
  });

  try {
    const batch = await db.transaction(async (tx) => {
      const [lockedOrder] = await tx
        .select({ id: orders.id, status: orders.status })
        .from(orders)
        .where(eq(orders.id, snapshot.order.id))
        .limit(1)
        .for("update");
      const [lockedRefund] = await tx
        .select({ id: paymentRefunds.id })
        .from(paymentRefunds)
        .where(eq(paymentRefunds.orderId, snapshot.order.id))
        .limit(1);
      const [lockedPlan] = await tx
        .select()
        .from(courierGuyPackingPlans)
        .where(eq(courierGuyPackingPlans.orderId, snapshot.order.id))
        .limit(1)
        .for("update");

      if (
        !lockedOrder ||
        lockedOrder.status !== "paid" ||
        lockedRefund ||
        !lockedPlan ||
        lockedPlan.revision !== snapshot.plan.revision ||
        !["confirmed", "booking"].includes(lockedPlan.status)
      ) {
        throw new Error(
          "The order or packing plan changed while live rates were being prepared. Start again.",
        );
      }

      const currentShipments = await tx
        .select({
          bookingQuoteId: shipments.bookingQuoteId,
          id: shipments.id,
          packingPlanRevision: shipments.packingPlanRevision,
          status: shipments.status,
        })
        .from(shipments)
        .where(inArray(shipments.id, pendingPackages.map((item) => item.shipmentId)))
        .for("update");

      if (
        !sameStringSet(
          currentShipments.map((item) => item.id),
          pendingPackages.map((item) => item.shipmentId),
        ) ||
        currentShipments.some((item) => {
          const quote = createdQuotes.find(
            (candidate) => candidate.shipmentId === item.id,
          );

          return (
            item.status !== "pending_booking" ||
            item.packingPlanRevision !== snapshot.plan.revision ||
            item.bookingQuoteId !== quote?.quoteId
          );
        })
      ) {
        throw new Error(
          "A package changed while the complete quote was being saved. Start again.",
        );
      }

      const quotedBatches = await tx
        .select({ id: courierGuyBookingBatches.id })
        .from(courierGuyBookingBatches)
        .where(
          and(
            eq(courierGuyBookingBatches.orderId, snapshot.order.id),
            eq(courierGuyBookingBatches.status, "quoted"),
          ),
        )
        .for("update");
      const quotedBatchIds = quotedBatches.map((batch) => batch.id);

      await tx
        .update(courierGuyBookingBatches)
        .set({ status: "expired", updatedAt: new Date() })
        .where(
          and(
            eq(courierGuyBookingBatches.orderId, snapshot.order.id),
            eq(courierGuyBookingBatches.status, "quoted"),
          ),
        );

      if (quotedBatchIds.length > 0) {
        await tx
          .update(courierGuyBookingBatchItems)
          .set({ status: "released", updatedAt: new Date() })
          .where(
            and(
              inArray(courierGuyBookingBatchItems.batchId, quotedBatchIds),
              eq(courierGuyBookingBatchItems.status, "quoted"),
            ),
          );
      }

      const [createdBatch] = await tx
        .insert(courierGuyBookingBatches)
        .values({
          alreadyCommittedProviderAmount:
            draftView.totals.alreadyCommittedProviderAmount.toFixed(2),
          approvedProviderAmount:
            draftView.totals.quotedProviderAmount.toFixed(2),
          createdByUserId: actorUserId,
          currency: "ZAR",
          customerShippingAmount:
            draftView.totals.customerShippingAmount.toFixed(2),
          expiresAt: new Date(draftView.expiresAt),
          fingerprint,
          orderId: snapshot.order.id,
          packingRevision: snapshot.plan.revision,
          projectedAbsorbedAmount:
            draftView.totals.projectedAbsorbedAmount.toFixed(2),
          projectedProviderSpend:
            draftView.totals.projectedProviderSpend.toFixed(2),
          status: "quoted",
        })
        .returning({ id: courierGuyBookingBatches.id });

      await tx.insert(courierGuyBookingBatchItems).values(
        draftView.packages.map((item) => ({
          approvedProviderAmount: item.providerAmount.toFixed(2),
          batchId: createdBatch.id,
          packageSequence: item.sequence,
          quoteId: item.quoteId,
          shipmentId: item.shipmentId,
          status: "quoted" as const,
        })),
      );
      await tx.insert(auditLogs).values({
        action: "shipping.courier_guy.order_quote_created",
        actorUserId,
        entityId: snapshot.order.id,
        entityType: "order",
        metadata: JSON.stringify({
          allowed: draftView.safetyReasons.length === 0,
          batchId: createdBatch.id,
          packageCount: draftView.packages.length,
          packingRevision: snapshot.plan.revision,
          projectedAbsorbedAmount:
            draftView.totals.projectedAbsorbedAmount,
          projectedProviderSpend: draftView.totals.projectedProviderSpend,
        }),
      });

      return createdBatch;
    });

    return {
      ...draftView,
      allowed: draftView.safetyReasons.length === 0,
      batchId: batch.id,
    };
  } catch (error) {
    await Promise.allSettled(
      createdQuotes.map((quote) =>
        expireCourierGuyBookingQuote(quote.shipmentId, quote.quoteId),
      ),
    );
    throw error;
  }
}

async function expireQuotedOrderBookingBatch({
  actorUserId,
  batchId,
  orderId,
}: {
  actorUserId: string;
  batchId: string;
  orderId: string;
}) {
  await db.transaction(async (tx) => {
    await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
      .for("update");
    await tx
      .select({ orderId: courierGuyPackingPlans.orderId })
      .from(courierGuyPackingPlans)
      .where(eq(courierGuyPackingPlans.orderId, orderId))
      .limit(1)
      .for("update");
    await tx
      .select({ id: shipments.id })
      .from(shipments)
      .where(
        and(
          eq(shipments.orderId, orderId),
          eq(shipments.provider, "courier_guy"),
        ),
      )
      .orderBy(asc(shipments.id))
      .for("update");
    const [batch] = await tx
      .select({ status: courierGuyBookingBatches.status })
      .from(courierGuyBookingBatches)
      .where(
        and(
          eq(courierGuyBookingBatches.id, batchId),
          eq(courierGuyBookingBatches.orderId, orderId),
        ),
      )
      .limit(1)
      .for("update");

    if (batch?.status !== "quoted") {
      return;
    }

    const items = await tx
      .select({ quoteId: courierGuyBookingBatchItems.quoteId })
      .from(courierGuyBookingBatchItems)
      .where(eq(courierGuyBookingBatchItems.batchId, batchId))
      .orderBy(asc(courierGuyBookingBatchItems.packageSequence))
      .for("update");
    const quoteIds = items.map((item) => item.quoteId);
    const now = new Date();

    if (quoteIds.length > 0) {
      await tx
        .update(shippingRateQuotes)
        .set({ status: "expired" })
        .where(
          and(
            inArray(shippingRateQuotes.id, quoteIds),
            eq(shippingRateQuotes.status, "quoted"),
          ),
        );
      await tx
        .update(shipments)
        .set({ bookingQuoteId: null, updatedAt: now })
        .where(
          and(
            eq(shipments.orderId, orderId),
            eq(shipments.provider, "courier_guy"),
            eq(shipments.status, "pending_booking"),
            inArray(shipments.bookingQuoteId, quoteIds),
          ),
        );
    }

    await tx
      .update(courierGuyBookingBatchItems)
      .set({ status: "released", updatedAt: now })
      .where(
        and(
          eq(courierGuyBookingBatchItems.batchId, batchId),
          eq(courierGuyBookingBatchItems.status, "quoted"),
        ),
      );
    await tx
      .update(courierGuyBookingBatches)
      .set({ status: "expired", updatedAt: now })
      .where(eq(courierGuyBookingBatches.id, batchId));
    await tx.insert(auditLogs).values({
      action: "shipping.courier_guy.order_quote_expired",
      actorUserId,
      entityId: orderId,
      entityType: "order",
      metadata: JSON.stringify({ batchId }),
    });
  });
}

async function loadBatchForConfirmation(
  orderId: string,
  batchId: string,
  actorUserId: string,
) {
  const parsed = z
    .object({ batchId: idSchema, orderId: idSchema })
    .safeParse({ batchId, orderId });

  if (!parsed.success) {
    throw new Error("The reviewed Courier Guy quote is invalid.");
  }

  const [batch, plan] = await Promise.all([
    db
      .select()
      .from(courierGuyBookingBatches)
      .where(
        and(
          eq(courierGuyBookingBatches.id, parsed.data.batchId),
          eq(courierGuyBookingBatches.orderId, parsed.data.orderId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(courierGuyPackingPlans)
      .where(eq(courierGuyPackingPlans.orderId, parsed.data.orderId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  if (
    !batch ||
    !plan ||
    batch.packingRevision !== plan.revision ||
    !["quoted", "booking"].includes(batch.status) ||
    !["confirmed", "booking"].includes(plan.status)
  ) {
    throw new Error(
      "The reviewed quote set no longer matches the current packing plan.",
    );
  }

  if (
    batch.status === "quoted" &&
    batch.expiresAt.getTime() <= Date.now()
  ) {
    await expireQuotedOrderBookingBatch({ actorUserId, batchId, orderId });
    throw new Error("The complete Courier Guy quote expired. Get fresh quotes.");
  }

  const items = await db
    .select({
      approvedProviderAmount: courierGuyBookingBatchItems.approvedProviderAmount,
      id: courierGuyBookingBatchItems.id,
      packageSequence: courierGuyBookingBatchItems.packageSequence,
      providerCostAmount: courierGuyBookingBatchItems.providerCostAmount,
      quoteId: courierGuyBookingBatchItems.quoteId,
      shipmentBookingQuoteId: shipments.bookingQuoteId,
      shipmentId: courierGuyBookingBatchItems.shipmentId,
      shipmentProviderId: shipments.providerShipmentId,
      shipmentProviderCostAmount: shipments.providerCostAmount,
      shipmentStatus: shipments.status,
      shipmentTrackingNumber: shipments.trackingNumber,
      status: courierGuyBookingBatchItems.status,
    })
    .from(courierGuyBookingBatchItems)
    .innerJoin(shipments, eq(shipments.id, courierGuyBookingBatchItems.shipmentId))
    .where(eq(courierGuyBookingBatchItems.batchId, batch.id))
    .orderBy(asc(courierGuyBookingBatchItems.packageSequence));

  if (items.length === 0) {
    throw new Error("The complete Courier Guy quote has no packages.");
  }

  const approvedProviderAmount = money(
    items.reduce(
      (total, item) => total + Number(item.approvedProviderAmount),
      0,
    ),
  );
  const projection = calculateCourierGuyOrderCostProjection({
    customerShippingAmount: Number(batch.customerShippingAmount),
    otherProviderCosts: Number(batch.alreadyCommittedProviderAmount),
    selectedProviderAmount: approvedProviderAmount,
  });
  const fingerprint = createCourierGuyBookingQuoteFingerprint({
    orderId: batch.orderId,
    packages: items.map((item) => ({
      providerAmount: Number(item.approvedProviderAmount),
      quoteId: item.quoteId,
      sequence: item.packageSequence,
      shipmentId: item.shipmentId,
    })),
    packingRevision: batch.packingRevision,
    totals: {
      alreadyCommittedProviderAmount: Number(
        batch.alreadyCommittedProviderAmount,
      ),
      customerShippingAmount: Number(batch.customerShippingAmount),
      deliveryMarginRemaining: centsToMoney(
        projection.deliveryMarginRemainingCents,
      ),
      projectedAbsorbedAmount: Number(batch.projectedAbsorbedAmount),
      projectedProviderSpend: Number(batch.projectedProviderSpend),
      quotedProviderAmount: Number(batch.approvedProviderAmount),
    },
  });

  if (
    moneyToCents(approvedProviderAmount) !==
      moneyToCents(Number(batch.approvedProviderAmount)) ||
    projection.projectedProviderSpendCents !==
      moneyToCents(Number(batch.projectedProviderSpend)) ||
    projection.projectedAbsorbedAmountCents !==
      moneyToCents(Number(batch.projectedAbsorbedAmount)) ||
    fingerprint !== batch.fingerprint
  ) {
    throw new Error(
      "The stored Courier Guy quote batch failed its integrity check. Get fresh quotes.",
    );
  }

  return { batch, items, plan };
}

type LoadedOrderBookingBatch = Awaited<
  ReturnType<typeof loadBatchForConfirmation>
>;

async function finalizeCourierGuyOrderBookingBatch({
  actorUserId,
  state,
}: {
  actorUserId: string;
  state: LoadedOrderBookingBatch;
}) {
  await db.transaction(async (tx) => {
    await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, state.batch.orderId))
      .limit(1)
      .for("update");
    const [plan] = await tx
      .select({
        revision: courierGuyPackingPlans.revision,
        status: courierGuyPackingPlans.status,
      })
      .from(courierGuyPackingPlans)
      .where(eq(courierGuyPackingPlans.orderId, state.batch.orderId))
      .limit(1)
      .for("update");
    await tx
      .select({ id: shipments.id })
      .from(shipments)
      .where(
        and(
          eq(shipments.orderId, state.batch.orderId),
          eq(shipments.provider, "courier_guy"),
        ),
      )
      .orderBy(asc(shipments.id))
      .for("update");
    const [batch] = await tx
      .select({ status: courierGuyBookingBatches.status })
      .from(courierGuyBookingBatches)
      .where(eq(courierGuyBookingBatches.id, state.batch.id))
      .limit(1)
      .for("update");
    const items = await tx
      .select({ status: courierGuyBookingBatchItems.status })
      .from(courierGuyBookingBatchItems)
      .where(eq(courierGuyBookingBatchItems.batchId, state.batch.id))
      .orderBy(asc(courierGuyBookingBatchItems.packageSequence))
      .for("update");

    if (
      !plan ||
      plan.revision !== state.batch.packingRevision ||
      !batch ||
      !["booking", "booked"].includes(batch.status) ||
      items.length === 0 ||
      items.some((item) => item.status !== "booked")
    ) {
      throw new Error(
        "The Courier Guy booking batch cannot be finalized until every package is booked.",
      );
    }

    const now = new Date();

    await tx
      .update(courierGuyBookingBatches)
      .set({ completedAt: now, status: "booked", updatedAt: now })
      .where(eq(courierGuyBookingBatches.id, state.batch.id));
    await tx
      .update(courierGuyPackingPlans)
      .set({ status: "booked", updatedAt: now })
      .where(
        and(
          eq(courierGuyPackingPlans.orderId, state.batch.orderId),
          eq(
            courierGuyPackingPlans.revision,
            state.batch.packingRevision,
          ),
        ),
      );

    if (batch.status !== "booked") {
      await tx.insert(auditLogs).values({
        action: "shipping.courier_guy.order_booking_completed",
        actorUserId,
        entityId: state.batch.orderId,
        entityType: "order",
        metadata: JSON.stringify({
          batchId: state.batch.id,
          packageCount: items.length,
          packingRevision: state.batch.packingRevision,
        }),
      });
    }
  });
}

async function releaseExpiredBookingBatchRemainder({
  actorUserId,
  state,
}: {
  actorUserId: string;
  state: LoadedOrderBookingBatch;
}) {
  await db.transaction(async (tx) => {
    await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, state.batch.orderId))
      .limit(1)
      .for("update");
    await tx
      .select({ orderId: courierGuyPackingPlans.orderId })
      .from(courierGuyPackingPlans)
      .where(eq(courierGuyPackingPlans.orderId, state.batch.orderId))
      .limit(1)
      .for("update");
    await tx
      .select({ id: shipments.id })
      .from(shipments)
      .where(
        and(
          eq(shipments.orderId, state.batch.orderId),
          eq(shipments.provider, "courier_guy"),
        ),
      )
      .orderBy(asc(shipments.id))
      .for("update");
    const [batch] = await tx
      .select({ status: courierGuyBookingBatches.status })
      .from(courierGuyBookingBatches)
      .where(eq(courierGuyBookingBatches.id, state.batch.id))
      .limit(1)
      .for("update");
    const items = await tx
      .select({
        quoteId: courierGuyBookingBatchItems.quoteId,
        status: courierGuyBookingBatchItems.status,
      })
      .from(courierGuyBookingBatchItems)
      .where(eq(courierGuyBookingBatchItems.batchId, state.batch.id))
      .orderBy(asc(courierGuyBookingBatchItems.packageSequence))
      .for("update");

    if (batch?.status !== "booking") {
      return;
    }

    if (items.some((item) => item.status === "attempting")) {
      throw new Error(
        "A Courier Guy package is still awaiting reconciliation and cannot be released.",
      );
    }

    const releasableItems = items.filter((item) =>
      ["quoted", "queued"].includes(item.status),
    );
    const quoteIds = releasableItems.map((item) => item.quoteId);
    const anyBooked = items.some((item) => item.status === "booked");
    const now = new Date();

    if (quoteIds.length > 0) {
      await tx
        .update(shippingRateQuotes)
        .set({ status: "expired" })
        .where(
          and(
            inArray(shippingRateQuotes.id, quoteIds),
            eq(shippingRateQuotes.status, "quoted"),
          ),
        );
      await tx
        .update(shipments)
        .set({ bookingQuoteId: null, updatedAt: now })
        .where(
          and(
            eq(shipments.orderId, state.batch.orderId),
            eq(shipments.status, "pending_booking"),
            inArray(shipments.bookingQuoteId, quoteIds),
          ),
        );
      await tx
        .update(courierGuyBookingBatchItems)
        .set({ status: "released", updatedAt: now })
        .where(
          and(
            eq(courierGuyBookingBatchItems.batchId, state.batch.id),
            inArray(courierGuyBookingBatchItems.status, ["quoted", "queued"]),
          ),
        );
    }

    await tx
      .update(courierGuyBookingBatches)
      .set({
        status: anyBooked ? "partially_booked" : "expired",
        updatedAt: now,
      })
      .where(eq(courierGuyBookingBatches.id, state.batch.id));
    await tx
      .update(courierGuyPackingPlans)
      .set({ status: anyBooked ? "booking" : "confirmed", updatedAt: now })
      .where(
        and(
          eq(courierGuyPackingPlans.orderId, state.batch.orderId),
          eq(
            courierGuyPackingPlans.revision,
            state.batch.packingRevision,
          ),
        ),
      );
    await tx.insert(auditLogs).values({
      action: "shipping.courier_guy.order_booking_remainder_expired",
      actorUserId,
      entityId: state.batch.orderId,
      entityType: "order",
      metadata: JSON.stringify({
        batchId: state.batch.id,
        bookedPackageCount: items.filter((item) => item.status === "booked")
          .length,
        releasedPackageCount: releasableItems.length,
      }),
    });
  });
}

export async function confirmCourierGuyOrderBooking({
  actorUserId,
  batchId,
  orderId,
}: {
  actorUserId: string;
  batchId: string;
  orderId: string;
}): Promise<CourierGuyOrderBookingResult> {
  const state = await loadBatchForConfirmation(
    orderId,
    batchId,
    actorUserId,
  );
  const attempting = state.items.find((item) => item.status === "attempting");

  if (attempting) {
    if (attempting.shipmentStatus === "pending_booking") {
      await db
        .update(courierGuyBookingBatchItems)
        .set({ status: "queued", updatedAt: new Date() })
        .where(eq(courierGuyBookingBatchItems.id, attempting.id));
      attempting.status = "queued";
    } else if (
      attempting.shipmentProviderId ||
      attempting.shipmentTrackingNumber ||
      providerCreatedShipmentStatuses.includes(
        attempting.shipmentStatus as (typeof providerCreatedShipmentStatuses)[number],
      )
    ) {
      await db
        .update(courierGuyBookingBatchItems)
        .set({
          completedAt: new Date(),
          providerCostAmount: attempting.shipmentProviderCostAmount,
          status: "booked",
          updatedAt: new Date(),
        })
        .where(eq(courierGuyBookingBatchItems.id, attempting.id));
      attempting.status = "booked";
    } else {
      await db.transaction(async (tx) => {
        await tx
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1)
          .for("update");
        await tx
          .select({ orderId: courierGuyPackingPlans.orderId })
          .from(courierGuyPackingPlans)
          .where(eq(courierGuyPackingPlans.orderId, orderId))
          .limit(1)
          .for("update");
        await tx
          .select({ id: shipments.id })
          .from(shipments)
          .where(
            and(
              eq(shipments.orderId, orderId),
              eq(shipments.provider, "courier_guy"),
            ),
          )
          .orderBy(asc(shipments.id))
          .for("update");
        await tx
          .select({ id: courierGuyBookingBatches.id })
          .from(courierGuyBookingBatches)
          .where(eq(courierGuyBookingBatches.id, state.batch.id))
          .limit(1)
          .for("update");
        await tx
          .select({ id: courierGuyBookingBatchItems.id })
          .from(courierGuyBookingBatchItems)
          .where(eq(courierGuyBookingBatchItems.batchId, state.batch.id))
          .orderBy(asc(courierGuyBookingBatchItems.packageSequence))
          .for("update");
        await tx
          .update(courierGuyBookingBatchItems)
          .set({ status: "needs_reconciliation", updatedAt: new Date() })
          .where(eq(courierGuyBookingBatchItems.id, attempting.id));
        await tx
          .update(courierGuyBookingBatchItems)
          .set({ status: "released", updatedAt: new Date() })
          .where(
            and(
              eq(courierGuyBookingBatchItems.batchId, state.batch.id),
              eq(courierGuyBookingBatchItems.status, "queued"),
            ),
          );
        await tx
          .update(courierGuyBookingBatches)
          .set({ status: "needs_reconciliation", updatedAt: new Date() })
          .where(eq(courierGuyBookingBatches.id, state.batch.id));
        await tx
          .update(courierGuyPackingPlans)
          .set({ status: "reconciliation_required", updatedAt: new Date() })
          .where(
            and(
              eq(courierGuyPackingPlans.orderId, orderId),
              eq(
                courierGuyPackingPlans.revision,
                state.batch.packingRevision,
              ),
            ),
          );
        await tx.insert(auditLogs).values({
          action:
            "shipping.courier_guy.order_booking_reconciliation_required",
          actorUserId,
          entityId: orderId,
          entityType: "order",
          metadata: JSON.stringify({
            batchId: state.batch.id,
            packageSequence: attempting.packageSequence,
            recoveredAttempt: true,
            shipmentId: attempting.shipmentId,
          }),
        });
      });
      throw new Error(
        "A package may already exist at Courier Guy. Reconcile that package before retrying.",
      );
    }
  }

  if (state.items.every((item) => item.status === "booked")) {
    await finalizeCourierGuyOrderBookingBatch({ actorUserId, state });

    return {
      results: state.items.map((item) => ({
        message: "Booking recovered from the saved Courier Guy shipment.",
        sequence: item.packageSequence,
        shipmentId: item.shipmentId,
        status: "booked" as const,
        trackingReference: item.shipmentTrackingNumber,
      })),
      status: "booked",
    };
  }

  const remaining = state.items.filter((item) =>
    ["quoted", "queued"].includes(item.status),
  );

  if (remaining.length === 0) {
    throw new Error(
      "This booking batch has no safely resumable packages. Get fresh quotes for any pending packages.",
    );
  }

  if (
    state.batch.status === "booking" &&
    state.batch.expiresAt.getTime() <= Date.now()
  ) {
    await releaseExpiredBookingBatchRemainder({ actorUserId, state });
    throw new Error(
      "The remaining Courier Guy package quotes expired. Get fresh quotes for the unbooked packages.",
    );
  }

  const pendingShipmentIds = state.items
    .filter((item) => item.shipmentStatus === "pending_booking")
    .map((item) => item.shipmentId);
  const currentPending = await db
    .select({ id: shipments.id })
    .from(shipments)
    .where(
      and(
        eq(shipments.orderId, orderId),
        eq(shipments.provider, "courier_guy"),
        eq(shipments.packingPlanRevision, state.plan.revision),
        eq(shipments.status, "pending_booking"),
      ),
    );

  if (
    !sameStringSet(
      currentPending.map((item) => item.id),
      pendingShipmentIds,
    ) ||
    remaining.some(
      (item) =>
        item.shipmentStatus !== "pending_booking" ||
        item.shipmentBookingQuoteId !== item.quoteId,
    )
  ) {
    throw new Error(
      "A package or quote changed after review. Get fresh quotes for the remaining packages.",
    );
  }

  const prepared: Array<{
    item: (typeof remaining)[number];
    prepared: Awaited<ReturnType<typeof prepareCourierGuyQuotedBooking>>;
  }> = [];

  for (const item of remaining) {
    prepared.push({
      item,
      prepared: await prepareCourierGuyQuotedBooking(
        item.shipmentId,
        item.quoteId,
      ),
    });
  }

  const alreadyCommittedProviderAmount = await getCommittedProviderAmount({
    excludedShipmentIds: remaining.map((entry) => entry.shipmentId),
    orderId,
  });
  const freshProviderAmount = money(
    prepared.reduce(
      (total, entry) => total + entry.prepared.freshRate.providerAmount,
      0,
    ),
  );
  const projection = calculateCourierGuyOrderCostProjection({
    customerShippingAmount: Number(state.batch.customerShippingAmount),
    otherProviderCosts: alreadyCommittedProviderAmount,
    selectedProviderAmount: freshProviderAmount,
  });
  const config = prepared[0]?.prepared.context.config;
  const preflightSafety = evaluateCourierGuyOrderBookingSafety({
    approvedPackageAmounts: prepared.map((entry) =>
      Number(entry.item.approvedProviderAmount),
    ),
    customerShippingAmount: Number(state.batch.customerShippingAmount),
    freshPackageAmounts: prepared.map(
      (entry) => entry.prepared.freshRate.providerAmount,
    ),
    maxAbsorbedAmount: config?.maxAbsorbedAmount ?? null,
    maxBookingCostAmount: config?.maxBookingCostAmount ?? null,
    otherProviderCosts: alreadyCommittedProviderAmount,
  });

  if (!preflightSafety.allowed) {
    const firstReason = preflightSafety.reasons[0];

    if (firstReason?.reason === "approved_quote_exceeded") {
      throw new Error(
        "At least one Courier Guy package price increased. Get fresh quotes before booking.",
      );
    }

    if (firstReason?.reason === "booking_cost_limit_exceeded") {
      throw new Error(
        "At least one fresh Courier Guy package rate exceeds the configured per-package limit.",
      );
    }

    throw new Error(
      `Fresh rates would make Jurgens absorb R ${centsToMoney(projection.projectedAbsorbedAmountCents).toFixed(2)}, above the configured order limit. Get fresh quotes.`,
    );
  }

  await db.transaction(async (tx) => {
    const [lockedOrder] = await tx
      .select({ currency: orders.currency, id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
      .for("update");
    const [lockedRefund] = await tx
      .select({ id: paymentRefunds.id })
      .from(paymentRefunds)
      .where(eq(paymentRefunds.orderId, orderId))
      .limit(1);
    const [lockedPlan] = await tx
      .select({
        revision: courierGuyPackingPlans.revision,
        status: courierGuyPackingPlans.status,
      })
      .from(courierGuyPackingPlans)
      .where(eq(courierGuyPackingPlans.orderId, orderId))
      .limit(1)
      .for("update");
    const lockedShipments = await tx
      .select({
        bookingQuoteId: shipments.bookingQuoteId,
        id: shipments.id,
        packingPlanRevision: shipments.packingPlanRevision,
        status: shipments.status,
      })
      .from(shipments)
      .where(
        and(
          eq(shipments.orderId, orderId),
          eq(shipments.provider, "courier_guy"),
          eq(shipments.packingPlanRevision, state.batch.packingRevision),
        ),
      )
      .orderBy(asc(shipments.id))
      .for("update");
    const [lockedBatch] = await tx
      .select({ status: courierGuyBookingBatches.status })
      .from(courierGuyBookingBatches)
      .where(
        and(
          eq(courierGuyBookingBatches.id, state.batch.id),
          eq(courierGuyBookingBatches.orderId, orderId),
        ),
      )
      .limit(1)
      .for("update");
    const lockedBatchItems = await tx
      .select({
        quoteId: courierGuyBookingBatchItems.quoteId,
        shipmentId: courierGuyBookingBatchItems.shipmentId,
        status: courierGuyBookingBatchItems.status,
      })
      .from(courierGuyBookingBatchItems)
      .where(eq(courierGuyBookingBatchItems.batchId, state.batch.id))
      .orderBy(asc(courierGuyBookingBatchItems.packageSequence))
      .for("update");

    if (
      !lockedOrder ||
      lockedOrder.status !== "paid" ||
      lockedOrder.currency !== "ZAR" ||
      lockedRefund ||
      !lockedBatch ||
      !lockedPlan ||
      !["quoted", "booking"].includes(lockedBatch.status) ||
      lockedPlan.revision !== state.batch.packingRevision ||
      !["confirmed", "booking"].includes(lockedPlan.status)
    ) {
      throw new Error(
        "The packing plan or booking batch changed before confirmation.",
      );
    }

    const shipmentById = new Map(
      lockedShipments.map((shipment) => [shipment.id, shipment]),
    );
    const pendingShipmentIds = lockedShipments
      .filter((shipment) => shipment.status === "pending_booking")
      .map((shipment) => shipment.id);
    const expectedPendingShipmentIds = lockedBatchItems
      .filter((item) => item.status !== "booked")
      .map((item) => item.shipmentId);

    if (
      !sameStringSet(
        pendingShipmentIds,
        expectedPendingShipmentIds,
      ) ||
      lockedBatchItems.length !== state.items.length ||
      lockedBatchItems.some((batchItem) => {
        const shipment = shipmentById.get(batchItem.shipmentId);

        if (!shipment) {
          return true;
        }

        return (
          shipment.packingPlanRevision !== state.batch.packingRevision ||
          shipment.bookingQuoteId !== batchItem.quoteId ||
          (batchItem.status === "booked"
            ? !providerCreatedShipmentStatuses.includes(
                shipment.status as (typeof providerCreatedShipmentStatuses)[number],
              )
            : shipment.status !== "pending_booking")
        );
      })
    ) {
      throw new Error(
        "A package or quote changed before confirmation. Get fresh quotes.",
      );
    }

    await tx
      .update(courierGuyBookingBatches)
      .set({
        startedAt: state.batch.startedAt ?? new Date(),
        status: "booking",
        updatedAt: new Date(),
      })
      .where(eq(courierGuyBookingBatches.id, state.batch.id));
    await tx
      .update(courierGuyPackingPlans)
      .set({ status: "booking", updatedAt: new Date() })
      .where(
        and(
          eq(courierGuyPackingPlans.orderId, orderId),
          eq(
            courierGuyPackingPlans.revision,
            state.batch.packingRevision,
          ),
        ),
      );
    await tx
      .update(courierGuyBookingBatchItems)
      .set({ status: "queued", updatedAt: new Date() })
      .where(
        and(
          eq(courierGuyBookingBatchItems.batchId, state.batch.id),
          eq(courierGuyBookingBatchItems.status, "quoted"),
        ),
      );
    if (lockedBatch.status === "quoted") {
      await tx.insert(auditLogs).values({
        action: "shipping.courier_guy.order_booking_started",
        actorUserId,
        entityId: orderId,
        entityType: "order",
        metadata: JSON.stringify({
          batchId: state.batch.id,
          packageCount: remaining.length,
          packingRevision: state.batch.packingRevision,
        }),
      });
    }
  });

  const results: CourierGuyOrderBookingResult["results"] = [];

  for (let index = 0; index < remaining.length; index += 1) {
    const item = remaining[index]!;
    const [claimedItem] = await db
      .update(courierGuyBookingBatchItems)
      .set({ attemptedAt: new Date(), status: "attempting", updatedAt: new Date() })
      .where(
        and(
          eq(courierGuyBookingBatchItems.id, item.id),
          eq(courierGuyBookingBatchItems.status, "queued"),
        ),
      )
      .returning({ id: courierGuyBookingBatchItems.id });

    if (!claimedItem) {
      throw new Error("The package booking queue changed. Refresh before retrying.");
    }

    try {
      const booked = await bookCourierGuyShipment(item.shipmentId, item.quoteId);
      const [shipment] = await db
        .select({ providerCostAmount: shipments.providerCostAmount })
        .from(shipments)
        .where(eq(shipments.id, item.shipmentId))
        .limit(1);

      const [completedBatchItem] = await db
        .update(courierGuyBookingBatchItems)
        .set({
          completedAt: new Date(),
          lastError: null,
          providerCostAmount: shipment?.providerCostAmount ?? null,
          status: "booked",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(courierGuyBookingBatchItems.id, item.id),
            eq(courierGuyBookingBatchItems.status, "attempting"),
          ),
        )
        .returning({ id: courierGuyBookingBatchItems.id });

      if (!completedBatchItem) {
        throw new Error(
          "Courier Guy created the package, but its booking batch state changed before completion.",
        );
      }

      const finalCostExceededApproval = Boolean(
        !booked.alreadyBooked &&
          "actualCostExceededApprovedQuote" in booked &&
          booked.actualCostExceededApprovedQuote,
      );
      results.push({
        message: booked.alreadyBooked
          ? "Already booked."
          : finalCostExceededApproval
            ? "Courier Guy returned a final cost above the approved quote."
            : null,
        sequence: item.packageSequence,
        shipmentId: item.shipmentId,
        status: "booked",
        trackingReference: booked.trackingReference,
      });

      const futureItems = remaining.slice(index + 1);
      const finalProviderAmount = Number(shipment?.providerCostAmount ?? 0);
      const finalCostExceededPackageLimit = Boolean(
        config?.maxBookingCostAmount !== null &&
          config?.maxBookingCostAmount !== undefined &&
          Number.isFinite(finalProviderAmount) &&
          moneyToCents(finalProviderAmount) >
            moneyToCents(config.maxBookingCostAmount),
      );

      if (
        futureItems.length > 0 &&
        (finalCostExceededApproval || finalCostExceededPackageLimit)
      ) {
        const message = finalCostExceededPackageLimit
          ? `Courier Guy's final cost for package ${item.packageSequence} was R ${finalProviderAmount.toFixed(2)}, above the configured per-package limit. The remaining packages were not booked.`
          : `Courier Guy's final cost for package ${item.packageSequence} exceeded the exact approved quote. The remaining packages were not booked.`;

        await db.transaction(async (tx) => {
          await lockCourierGuyOrderBatch(tx, {
            batchId: state.batch.id,
            orderId,
            packingRevision: state.batch.packingRevision,
          });
          await tx
            .update(courierGuyBookingBatchItems)
            .set({ status: "released", updatedAt: new Date() })
            .where(
              and(
                eq(courierGuyBookingBatchItems.batchId, state.batch.id),
                eq(courierGuyBookingBatchItems.status, "queued"),
              ),
            );
          await tx
            .update(courierGuyBookingBatches)
            .set({ status: "partially_booked", updatedAt: new Date() })
            .where(eq(courierGuyBookingBatches.id, state.batch.id));
          await tx
            .update(courierGuyPackingPlans)
            .set({ status: "booking", updatedAt: new Date() })
            .where(
              and(
                eq(courierGuyPackingPlans.orderId, orderId),
                eq(
                  courierGuyPackingPlans.revision,
                  state.batch.packingRevision,
                ),
              ),
            );
          await tx.insert(auditLogs).values({
            action: "shipping.courier_guy.order_booking_final_cost_stop",
            actorUserId,
            entityId: orderId,
            entityType: "order",
            metadata: JSON.stringify({
              batchId: state.batch.id,
              finalProviderAmount,
              message,
              packageSequence: item.packageSequence,
            }),
          });
        });

        for (const notAttempted of futureItems) {
          results.push({
            message,
            sequence: notAttempted.packageSequence,
            shipmentId: notAttempted.shipmentId,
            status: "not_attempted",
            trackingReference: null,
          });
        }

        return { results, status: "partially_booked" };
      }

      if (
        futureItems.length > 0 &&
        config?.maxAbsorbedAmount !== null &&
        config?.maxAbsorbedAmount !== undefined
      ) {
        const committedAfterBooking = await getCommittedProviderAmount({
          excludedShipmentIds: futureItems.map((entry) => entry.shipmentId),
          orderId,
        });
        const futureApprovedAmount = money(
          futureItems.reduce((total, futureItem) => {
            const futurePrepared = prepared.find(
              (entry) => entry.item.id === futureItem.id,
            );

            return (
              total + (futurePrepared?.prepared.freshRate.providerAmount ?? 0)
            );
          }, 0),
        );
        const afterBookingProjection = calculateCourierGuyOrderCostProjection({
          customerShippingAmount: Number(state.batch.customerShippingAmount),
          otherProviderCosts: committedAfterBooking,
          selectedProviderAmount: futureApprovedAmount,
        });

        if (
          afterBookingProjection.projectedAbsorbedAmountCents >
          moneyToCents(config.maxAbsorbedAmount)
        ) {
          const message = `Courier Guy's final cost for package ${item.packageSequence} changed the order exposure. The remaining packages were not booked because the projected absorbed amount is now R ${centsToMoney(afterBookingProjection.projectedAbsorbedAmountCents).toFixed(2)}.`;

          await db.transaction(async (tx) => {
            await lockCourierGuyOrderBatch(tx, {
              batchId: state.batch.id,
              orderId,
              packingRevision: state.batch.packingRevision,
            });
            await tx
              .update(courierGuyBookingBatchItems)
              .set({ status: "released", updatedAt: new Date() })
              .where(
                and(
                  eq(courierGuyBookingBatchItems.batchId, state.batch.id),
                  eq(courierGuyBookingBatchItems.status, "queued"),
                ),
              );
            await tx
              .update(courierGuyBookingBatches)
              .set({ status: "partially_booked", updatedAt: new Date() })
              .where(eq(courierGuyBookingBatches.id, state.batch.id));
            await tx
              .update(courierGuyPackingPlans)
              .set({ status: "booking", updatedAt: new Date() })
              .where(
                and(
                  eq(courierGuyPackingPlans.orderId, orderId),
                  eq(
                    courierGuyPackingPlans.revision,
                    state.batch.packingRevision,
                  ),
                ),
              );
            await tx.insert(auditLogs).values({
              action: "shipping.courier_guy.order_booking_cost_stop",
              actorUserId,
              entityId: orderId,
              entityType: "order",
              metadata: JSON.stringify({
                batchId: state.batch.id,
                message,
                packageSequence: item.packageSequence,
              }),
            });
          });

          for (const notAttempted of futureItems) {
            results.push({
              message,
              sequence: notAttempted.packageSequence,
              shipmentId: notAttempted.shipmentId,
              status: "not_attempted",
              trackingReference: null,
            });
          }

          return { results, status: "partially_booked" };
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Courier Guy booking failed.";
      const [shipment] = await db
        .select({
          providerCostAmount: shipments.providerCostAmount,
          providerShipmentId: shipments.providerShipmentId,
          status: shipments.status,
          trackingNumber: shipments.trackingNumber,
        })
        .from(shipments)
        .where(eq(shipments.id, item.shipmentId))
        .limit(1);
      const providerCreated = Boolean(
        shipment &&
          (shipment.providerShipmentId ||
            shipment.trackingNumber ||
            providerCreatedShipmentStatuses.includes(
              shipment.status as (typeof providerCreatedShipmentStatuses)[number],
            )),
      );

      if (providerCreated) {
        const futureItems = remaining.slice(index + 1);

        await db.transaction(async (tx) => {
          await lockCourierGuyOrderBatch(tx, {
            batchId: state.batch.id,
            orderId,
            packingRevision: state.batch.packingRevision,
          });
          await tx
            .update(courierGuyBookingBatchItems)
            .set({
              completedAt: new Date(),
              lastError: null,
              providerCostAmount: shipment?.providerCostAmount ?? null,
              status: "booked",
              updatedAt: new Date(),
            })
            .where(eq(courierGuyBookingBatchItems.id, item.id));

          if (futureItems.length > 0) {
            await tx
              .update(courierGuyBookingBatchItems)
              .set({ status: "released", updatedAt: new Date() })
              .where(
                and(
                  eq(courierGuyBookingBatchItems.batchId, state.batch.id),
                  eq(courierGuyBookingBatchItems.status, "queued"),
                ),
              );
            await tx
              .update(courierGuyBookingBatches)
              .set({ status: "partially_booked", updatedAt: new Date() })
              .where(eq(courierGuyBookingBatches.id, state.batch.id));
            await tx
              .update(courierGuyPackingPlans)
              .set({ status: "booking", updatedAt: new Date() })
              .where(
                and(
                  eq(courierGuyPackingPlans.orderId, orderId),
                  eq(
                    courierGuyPackingPlans.revision,
                    state.batch.packingRevision,
                  ),
                ),
              );
          }

          await tx.insert(auditLogs).values({
            action:
              "shipping.courier_guy.order_booking_local_recovery",
            actorUserId,
            entityId: orderId,
            entityType: "order",
            metadata: JSON.stringify({
              batchId: state.batch.id,
              originalError: message,
              packageSequence: item.packageSequence,
              shipmentId: item.shipmentId,
              stoppedRemainingPackages: futureItems.length,
            }),
          });
        });

        results.push({
          message:
            "Courier Guy created this package; its saved shipment was recovered locally.",
          sequence: item.packageSequence,
          shipmentId: item.shipmentId,
          status: "booked",
          trackingReference: shipment?.trackingNumber ?? null,
        });

        if (futureItems.length > 0) {
          for (const notAttempted of futureItems) {
            results.push({
              message:
                "Not attempted after recovering the previous provider booking. Get fresh quotes for the remaining packages.",
              sequence: notAttempted.packageSequence,
              shipmentId: notAttempted.shipmentId,
              status: "not_attempted",
              trackingReference: null,
            });
          }

          return { results, status: "partially_booked" };
        }

        continue;
      }

      const needsReconciliation = shipment?.status === "booking";
      const bookedCount =
        state.items.filter((batchItem) => batchItem.status === "booked").length +
        results.filter((result) => result.status === "booked").length;
      const batchStatus = needsReconciliation
        ? "needs_reconciliation"
        : bookedCount > 0
          ? "partially_booked"
          : "failed";

      await db.transaction(async (tx) => {
        await lockCourierGuyOrderBatch(tx, {
          batchId: state.batch.id,
          orderId,
          packingRevision: state.batch.packingRevision,
        });
        await tx
          .update(courierGuyBookingBatchItems)
          .set({
            lastError: message,
            status: needsReconciliation ? "needs_reconciliation" : "failed",
            updatedAt: new Date(),
          })
          .where(eq(courierGuyBookingBatchItems.id, item.id));
        await tx
          .update(courierGuyBookingBatchItems)
          .set({ status: "released", updatedAt: new Date() })
          .where(
            and(
              eq(courierGuyBookingBatchItems.batchId, state.batch.id),
              eq(courierGuyBookingBatchItems.status, "queued"),
            ),
          );
        await tx
          .update(courierGuyBookingBatches)
          .set({ status: batchStatus, updatedAt: new Date() })
          .where(eq(courierGuyBookingBatches.id, state.batch.id));
        await tx
          .update(courierGuyPackingPlans)
          .set({
            status: needsReconciliation
              ? "reconciliation_required"
              : bookedCount > 0
                ? "booking"
                : "confirmed",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(courierGuyPackingPlans.orderId, orderId),
              eq(
                courierGuyPackingPlans.revision,
                state.batch.packingRevision,
              ),
            ),
          );
        await tx.insert(auditLogs).values({
          action: needsReconciliation
            ? "shipping.courier_guy.order_booking_reconciliation_required"
            : "shipping.courier_guy.order_booking_stopped",
          actorUserId,
          entityId: orderId,
          entityType: "order",
          metadata: JSON.stringify({
            batchId: state.batch.id,
            failedShipmentId: item.shipmentId,
            message,
            packageSequence: item.packageSequence,
          }),
        });
      });

      results.push({
        message,
        sequence: item.packageSequence,
        shipmentId: item.shipmentId,
        status: needsReconciliation ? "needs_reconciliation" : "failed",
        trackingReference: null,
      });
      for (const notAttempted of remaining.slice(index + 1)) {
        results.push({
          message: "Not attempted after an earlier package stopped the batch.",
          sequence: notAttempted.packageSequence,
          shipmentId: notAttempted.shipmentId,
          status: "not_attempted",
          trackingReference: null,
        });
      }

      return { results, status: batchStatus };
    }
  }

  await finalizeCourierGuyOrderBookingBatch({ actorUserId, state });

  return { results, status: "booked" };
}
