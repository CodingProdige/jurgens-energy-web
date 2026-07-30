import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryReservations,
  orderItems,
  productVariants,
} from "@/src/db/schema";
import { getStockReservationDecision } from "@/src/modules/inventory/lifecycle";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type InventoryLine = Readonly<{
  quantity: number;
  variantId: string;
}>;

export type InventoryReservationErrorCode =
  | "insufficient_stock"
  | "invalid_reservation"
  | "reservation_not_found";

export class InventoryReservationError extends Error {
  readonly code: InventoryReservationErrorCode;

  constructor(code: InventoryReservationErrorCode, message: string) {
    super(message);
    this.name = "InventoryReservationError";
    this.code = code;
  }
}

function aggregateLines(lines: readonly InventoryLine[]) {
  const quantities = new Map<string, number>();

  for (const line of lines) {
    quantities.set(
      line.variantId,
      (quantities.get(line.variantId) ?? 0) + line.quantity,
    );
  }

  return Array.from(quantities, ([variantId, quantity]) => ({
    quantity,
    variantId,
  })).sort((first, second) => first.variantId.localeCompare(second.variantId));
}

async function lockVariants(
  transaction: DatabaseTransaction,
  variantIds: string[],
) {
  if (variantIds.length === 0) {
    return [];
  }

  return transaction
    .select({
      continueSellingOutOfStock:
        productVariants.continueSellingOutOfStock,
      id: productVariants.id,
      stockOnHand: productVariants.stockOnHand,
    })
    .from(productVariants)
    .where(inArray(productVariants.id, variantIds))
    .orderBy(asc(productVariants.id))
    .for("update");
}

function createReservationPlan({
  lines,
  variants,
}: {
  lines: ReturnType<typeof aggregateLines>;
  variants: Awaited<ReturnType<typeof lockVariants>>;
}) {
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  return lines.map((line) => {
    const variant = variantById.get(line.variantId);
    const decision = variant
      ? getStockReservationDecision({
          continueSellingOutOfStock: variant.continueSellingOutOfStock,
          quantity: line.quantity,
          stockOnHand: variant.stockOnHand,
        })
      : null;

    if (!variant || !decision) {
      throw new InventoryReservationError(
        "insufficient_stock",
        "One or more products no longer have enough stock. Return to your cart and review the quantities.",
      );
    }

    return {
      ...decision,
      quantity: line.quantity,
      variantId: line.variantId,
    };
  });
}

export async function reserveOrderInventory({
  expiresAt,
  lines,
  orderId,
  transaction,
}: {
  expiresAt: Date;
  lines: readonly InventoryLine[];
  orderId: string;
  transaction: DatabaseTransaction;
}) {
  const aggregatedLines = aggregateLines(lines);
  const variants = await lockVariants(
    transaction,
    aggregatedLines.map((line) => line.variantId),
  );
  const plan = createReservationPlan({
    lines: aggregatedLines,
    variants,
  });

  for (const item of plan) {
    if (item.stockQuantity > 0) {
      await transaction
        .update(productVariants)
        .set({ stockOnHand: item.nextStockOnHand })
        .where(eq(productVariants.id, item.variantId));
    }
  }

  await transaction.insert(inventoryReservations).values(
    plan.map((item) => ({
      expiresAt,
      orderId,
      quantity: item.quantity,
      stockQuantity: item.stockQuantity,
      variantId: item.variantId,
    })),
  );

  return plan;
}

async function lockOrderReservations(
  transaction: DatabaseTransaction,
  orderId: string,
) {
  return transaction
    .select()
    .from(inventoryReservations)
    .where(eq(inventoryReservations.orderId, orderId))
    .orderBy(asc(inventoryReservations.variantId))
    .for("update");
}

function assertUniformReservationStatus(
  reservations: Awaited<ReturnType<typeof lockOrderReservations>>,
) {
  if (reservations.length === 0) {
    throw new InventoryReservationError(
      "reservation_not_found",
      "This order does not have an active inventory reservation.",
    );
  }

  const statuses = new Set(
    reservations.map((reservation) => reservation.status),
  );

  if (statuses.size !== 1) {
    throw new InventoryReservationError(
      "invalid_reservation",
      "The order inventory reservation is inconsistent and requires review.",
    );
  }

  return reservations[0].status;
}

async function consumeLegacyOrderInventory({
  now,
  orderId,
  transaction,
}: {
  now: Date;
  orderId: string;
  transaction: DatabaseTransaction;
}) {
  const legacyOrderLines = aggregateLines(
    await transaction
      .select({
        quantity: orderItems.quantity,
        variantId: orderItems.variantId,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId)),
  );

  if (legacyOrderLines.length === 0) {
    throw new InventoryReservationError(
      "reservation_not_found",
      "This order does not have inventory lines that can be reserved.",
    );
  }

  const variants = await lockVariants(
    transaction,
    legacyOrderLines.map((line) => line.variantId),
  );
  const plan = createReservationPlan({
    lines: legacyOrderLines,
    variants,
  });

  for (const item of plan) {
    if (item.stockQuantity > 0) {
      await transaction
        .update(productVariants)
        .set({ stockOnHand: item.nextStockOnHand })
        .where(eq(productVariants.id, item.variantId));
    }
  }

  await transaction.insert(inventoryReservations).values(
    plan.map((item) => ({
      consumedAt: now,
      expiresAt: now,
      orderId,
      quantity: item.quantity,
      status: "consumed" as const,
      stockQuantity: item.stockQuantity,
      variantId: item.variantId,
    })),
  );

  return { alreadyConsumed: false, legacyAcquired: true, reacquired: false };
}

async function reacquireLockedReservations({
  reservations,
  transaction,
}: {
  reservations: Awaited<ReturnType<typeof lockOrderReservations>>;
  transaction: DatabaseTransaction;
}) {
  const variants = await lockVariants(
    transaction,
    reservations.map((reservation) => reservation.variantId),
  );
  const plan = createReservationPlan({
    lines: reservations.map((reservation) => ({
      quantity: reservation.quantity,
      variantId: reservation.variantId,
    })),
    variants,
  });
  const now = new Date();

  for (const item of plan) {
    if (item.stockQuantity > 0) {
      await transaction
        .update(productVariants)
        .set({ stockOnHand: item.nextStockOnHand })
        .where(eq(productVariants.id, item.variantId));
    }

    await transaction
      .update(inventoryReservations)
      .set({
        releasedAt: null,
        releaseReason: null,
        status: "reserved",
        stockQuantity: item.stockQuantity,
        updatedAt: now,
      })
      .where(
        and(
          eq(inventoryReservations.id, reservations.find(
            (reservation) => reservation.variantId === item.variantId,
          )!.id),
          eq(inventoryReservations.status, "released"),
        ),
      );
  }
}

export async function reacquireOrderInventory({
  orderId,
  transaction,
}: {
  orderId: string;
  transaction: DatabaseTransaction;
}) {
  const reservations = await lockOrderReservations(transaction, orderId);
  const status = assertUniformReservationStatus(reservations);

  if (status === "consumed") {
    throw new InventoryReservationError(
      "invalid_reservation",
      "Paid inventory cannot be reserved for another payment attempt.",
    );
  }

  if (status === "reserved") {
    return { reacquired: false };
  }

  await reacquireLockedReservations({ reservations, transaction });

  return { reacquired: true };
}

export async function consumeOrderInventory({
  now = new Date(),
  orderId,
  transaction,
}: {
  now?: Date;
  orderId: string;
  transaction: DatabaseTransaction;
}) {
  const reservations = await lockOrderReservations(transaction, orderId);

  // Orders created before inventory holds were introduced have no reservation
  // rows. They are still safe to complete: acquire today's stock under the same
  // variant locks used by checkout, then persist a consumed reservation in the
  // payment transaction. Insufficient stock aborts the capture.
  if (reservations.length === 0) {
    return consumeLegacyOrderInventory({
      now,
      orderId,
      transaction,
    });
  }

  const status = assertUniformReservationStatus(reservations);

  if (status === "consumed") {
    return {
      alreadyConsumed: true,
      legacyAcquired: false,
      reacquired: false,
    };
  }

  let reacquired = false;

  if (status === "released") {
    await reacquireLockedReservations({ reservations, transaction });
    reacquired = true;
  }

  const consumed = await transaction
    .update(inventoryReservations)
    .set({
      consumedAt: now,
      status: "consumed",
      updatedAt: now,
    })
    .where(
      and(
        eq(inventoryReservations.orderId, orderId),
        eq(inventoryReservations.status, "reserved"),
      ),
    )
    .returning({ id: inventoryReservations.id });

  if (consumed.length !== reservations.length) {
    throw new InventoryReservationError(
      "invalid_reservation",
      "The order inventory reservation changed while payment was completing.",
    );
  }

  return {
    alreadyConsumed: false,
    legacyAcquired: false,
    reacquired,
  };
}

export async function releaseOrderInventory({
  now = new Date(),
  orderId,
  reason,
  transaction,
}: {
  now?: Date;
  orderId: string;
  reason: "expired" | "payment_failed";
  transaction: DatabaseTransaction;
}) {
  const reservations = await lockOrderReservations(transaction, orderId);

  if (reservations.length === 0) {
    return { released: false };
  }

  const reserved = reservations.filter(
    (reservation) => reservation.status === "reserved",
  );

  if (reserved.length === 0) {
    return { released: false };
  }

  if (reserved.length !== reservations.length) {
    throw new InventoryReservationError(
      "invalid_reservation",
      "The order inventory reservation is inconsistent and requires review.",
    );
  }

  for (const reservation of reserved) {
    if (reservation.stockQuantity > 0) {
      await transaction
        .update(productVariants)
        .set({
          stockOnHand: sql<number>`${productVariants.stockOnHand} + ${reservation.stockQuantity}`,
        })
        .where(eq(productVariants.id, reservation.variantId));
    }
  }

  const released = await transaction
    .update(inventoryReservations)
    .set({
      releasedAt: now,
      releaseReason: reason,
      status: "released",
      updatedAt: now,
    })
    .where(
      and(
        eq(inventoryReservations.orderId, orderId),
        eq(inventoryReservations.status, "reserved"),
      ),
    )
    .returning({ id: inventoryReservations.id });

  if (released.length !== reserved.length) {
    throw new InventoryReservationError(
      "invalid_reservation",
      "The order inventory reservation changed while stock was being released.",
    );
  }

  return { released: true };
}
