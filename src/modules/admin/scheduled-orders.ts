import { asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  jurgensDeliverySchedules,
  jurgensDeliveryZones,
  orderItems,
  orders,
  shipments,
  type JurgensDeliveryScheduleStatus,
} from "@/src/db/schema";

export type AdminScheduledOrderRow = {
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  deliveryInstructions: string | null;
  grandTotal: string;
  itemSummary: string;
  orderId: string;
  orderNumber: string;
  scheduledDate: string;
  scheduleId: string;
  shipmentId: string | null;
  shipmentStatus: string | null;
  status: JurgensDeliveryScheduleStatus;
  updatedAt: Date;
  windowEnd: string;
  windowLabel: string;
  windowStart: string;
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

export async function getAdminScheduledOrders(): Promise<AdminScheduledOrdersData> {
  const scheduleRows = await db
    .select({
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      deliveryInstructions: jurgensDeliverySchedules.deliveryInstructions,
      grandTotal: orders.grandTotal,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      scheduledDate: jurgensDeliverySchedules.scheduledDate,
      scheduleId: jurgensDeliverySchedules.id,
      shipmentId: jurgensDeliverySchedules.shipmentId,
      shipmentStatus: shipments.status,
      status: jurgensDeliverySchedules.status,
      updatedAt: jurgensDeliverySchedules.updatedAt,
      windowEnd: jurgensDeliverySchedules.windowEnd,
      windowLabel: jurgensDeliverySchedules.windowLabel,
      windowStart: jurgensDeliverySchedules.windowStart,
      zoneName: jurgensDeliveryZones.name,
    })
    .from(jurgensDeliverySchedules)
    .innerJoin(orders, eq(orders.id, jurgensDeliverySchedules.orderId))
    .leftJoin(shipments, eq(shipments.id, jurgensDeliverySchedules.shipmentId))
    .leftJoin(
      jurgensDeliveryZones,
      eq(jurgensDeliveryZones.id, jurgensDeliverySchedules.zoneId),
    )
    .orderBy(
      asc(jurgensDeliverySchedules.scheduledDate),
      asc(jurgensDeliverySchedules.windowStart),
      desc(jurgensDeliverySchedules.updatedAt),
    );

  if (scheduleRows.length === 0) {
    return {
      metrics: {
        cancelled: 0,
        completed: 0,
        outForDelivery: 0,
        scheduled: 0,
        today: 0,
        total: 0,
      },
      rows: [],
    };
  }

  const orderIds = scheduleRows.map((row) => row.orderId);
  const itemRows = await db
    .select({
      orderId: orderItems.orderId,
      quantity: orderItems.quantity,
      title: orderItems.title,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));
  const itemSummaryByOrderId = new Map<string, string>();

  for (const item of itemRows) {
    const current = itemSummaryByOrderId.get(item.orderId);
    const next = `${item.quantity} x ${item.title}`;
    itemSummaryByOrderId.set(
      item.orderId,
      current ? `${current}; ${next}` : next,
    );
  }

  const rows = scheduleRows.map((row) => ({
    ...row,
    itemSummary: itemSummaryByOrderId.get(row.orderId) ?? "No item rows",
  }));
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
    },
    rows,
  };
}
