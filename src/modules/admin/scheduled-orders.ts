import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  jurgensDeliverySchedules,
  jurgensDeliveryZones,
  orderItems,
  orders,
  payments,
  shipments,
  type JurgensDeliveryScheduleStatus,
} from "@/src/db/schema";

export type AdminLocalDeliveryStatus =
  | JurgensDeliveryScheduleStatus
  | "unscheduled";

export type AdminScheduledOrderRow = {
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  deliveryInstructions: string | null;
  grandTotal: string;
  itemSummary: string;
  lastNotifiedAt: Date | null;
  lastNotifiedStatus: string | null;
  orderId: string;
  orderNumber: string;
  scheduledDate: string | null;
  scheduleId: string | null;
  shipmentId: string;
  shipmentStatus: string;
  status: AdminLocalDeliveryStatus;
  updatedAt: Date;
  windowEnd: string | null;
  windowLabel: string | null;
  windowStart: string | null;
  zoneName: string | null;
};

export type AdminScheduledOrdersData = {
  metrics: {
    cancelled: number;
    completed: number;
    outForDelivery: number;
    scheduled: number;
    today: number;
    total: number;
    unscheduled: number;
  };
  rows: AdminScheduledOrderRow[];
};

function todayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Johannesburg",
    year: "numeric",
  }).format(new Date());
}

function emptyData(): AdminScheduledOrdersData {
  return {
    metrics: {
      cancelled: 0,
      completed: 0,
      outForDelivery: 0,
      scheduled: 0,
      today: 0,
      total: 0,
      unscheduled: 0,
    },
    rows: [],
  };
}

export async function getAdminScheduledOrders(): Promise<AdminScheduledOrdersData> {
  const capturedOrderRows = await db
    .select({ orderId: payments.orderId })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(
      and(
        eq(payments.status, "captured"),
        inArray(orders.status, ["paid", "fulfilled"]),
      ),
    );
  const paidOrderIds = [
    ...new Set(capturedOrderRows.map((row) => row.orderId)),
  ];

  if (paidOrderIds.length === 0) {
    return emptyData();
  }

  const [localShipmentRows, scheduleRows] = await Promise.all([
    db
      .select({
        customerEmail: orders.customerEmail,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        grandTotal: orders.grandTotal,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        shipmentId: shipments.id,
        shipmentStatus: shipments.status,
        updatedAt: shipments.updatedAt,
      })
      .from(shipments)
      .innerJoin(orders, eq(orders.id, shipments.orderId))
      .where(
        and(
          eq(shipments.provider, "jurgens_local"),
          inArray(shipments.orderId, paidOrderIds),
        ),
      )
      .orderBy(desc(shipments.updatedAt)),
    db
      .select({
        customerEmail: orders.customerEmail,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        deliveryInstructions: jurgensDeliverySchedules.deliveryInstructions,
        grandTotal: orders.grandTotal,
        lastNotifiedAt: jurgensDeliverySchedules.lastNotifiedAt,
        lastNotifiedStatus: jurgensDeliverySchedules.lastNotifiedStatus,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        scheduledDate: jurgensDeliverySchedules.scheduledDate,
        scheduleId: jurgensDeliverySchedules.id,
        shipmentId: jurgensDeliverySchedules.shipmentId,
        status: jurgensDeliverySchedules.status,
        updatedAt: jurgensDeliverySchedules.updatedAt,
        windowEnd: jurgensDeliverySchedules.windowEnd,
        windowLabel: jurgensDeliverySchedules.windowLabel,
        windowStart: jurgensDeliverySchedules.windowStart,
        zoneName: jurgensDeliveryZones.name,
      })
      .from(jurgensDeliverySchedules)
      .innerJoin(orders, eq(orders.id, jurgensDeliverySchedules.orderId))
      .leftJoin(
        jurgensDeliveryZones,
        eq(jurgensDeliveryZones.id, jurgensDeliverySchedules.zoneId),
      )
      .where(inArray(jurgensDeliverySchedules.orderId, paidOrderIds))
      .orderBy(
        asc(jurgensDeliverySchedules.scheduledDate),
        asc(jurgensDeliverySchedules.windowStart),
        desc(jurgensDeliverySchedules.updatedAt),
      ),
  ]);

  if (localShipmentRows.length === 0) {
    return emptyData();
  }

  const localShipmentByOrderId = new Map(
    localShipmentRows.map((shipment) => [shipment.orderId, shipment]),
  );
  const scheduledOrderIds = new Set(
    scheduleRows.map((schedule) => schedule.orderId),
  );
  const relevantOrderIds = [
    ...new Set(localShipmentRows.map((shipment) => shipment.orderId)),
  ];
  const itemRows = await db
    .select({
      orderId: orderItems.orderId,
      quantity: orderItems.quantity,
      title: orderItems.title,
    })
    .from(orderItems)
    .where(
      and(
        inArray(orderItems.orderId, relevantOrderIds),
        eq(orderItems.deliveryMethodSnapshot, "jurgens_local"),
      ),
    );
  const itemSummaryByOrderId = new Map<string, string>();

  for (const item of itemRows) {
    const current = itemSummaryByOrderId.get(item.orderId);
    const next = `${item.quantity} x ${item.title}`;
    itemSummaryByOrderId.set(
      item.orderId,
      current ? `${current}; ${next}` : next,
    );
  }

  const scheduledRows: AdminScheduledOrderRow[] = scheduleRows.flatMap(
    (schedule) => {
      const shipment = localShipmentByOrderId.get(schedule.orderId);

      if (!shipment) {
        return [];
      }

      return [
        {
          ...schedule,
          itemSummary:
            itemSummaryByOrderId.get(schedule.orderId) ??
            "Jurgens local-delivery items",
          shipmentId: shipment.shipmentId,
          shipmentStatus: shipment.shipmentStatus,
        },
      ];
    },
  );
  const unscheduledRows: AdminScheduledOrderRow[] = localShipmentRows
    .filter((shipment) => !scheduledOrderIds.has(shipment.orderId))
    .map((shipment) => ({
      customerEmail: shipment.customerEmail,
      customerName: shipment.customerName,
      customerPhone: shipment.customerPhone,
      deliveryInstructions: null,
      grandTotal: shipment.grandTotal,
      itemSummary:
        itemSummaryByOrderId.get(shipment.orderId) ??
        "Jurgens local-delivery items",
      lastNotifiedAt: null,
      lastNotifiedStatus: null,
      orderId: shipment.orderId,
      orderNumber: shipment.orderNumber,
      scheduledDate: null,
      scheduleId: null,
      shipmentId: shipment.shipmentId,
      shipmentStatus: shipment.shipmentStatus,
      status: "unscheduled",
      updatedAt: shipment.updatedAt,
      windowEnd: null,
      windowLabel: null,
      windowStart: null,
      zoneName: null,
    }));
  const rows = [...unscheduledRows, ...scheduledRows];
  const today = todayIsoDate();

  return {
    metrics: {
      cancelled: rows.filter((row) => row.status === "cancelled").length,
      completed: rows.filter((row) => row.status === "completed").length,
      outForDelivery: rows.filter((row) => row.status === "out_for_delivery")
        .length,
      scheduled: rows.filter((row) =>
        ["scheduled", "preparing", "rescheduled"].includes(row.status),
      ).length,
      today: rows.filter((row) => row.scheduledDate === today).length,
      total: rows.length,
      unscheduled: unscheduledRows.length,
    },
    rows,
  };
}
