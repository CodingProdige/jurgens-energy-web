import "server-only";

import { cache } from "react";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/src/db";
import {
  jurgensDeliverySchedules,
  orderItems,
  orders,
  payments,
  shipmentEvents,
  shipments,
  users,
} from "@/src/db/schema";

const orderIdSchema = z.string().uuid();
const activeShipmentStatuses = [
  "pending_booking",
  "booked",
  "waybill_ready",
  "ready_for_collection",
  "collected",
  "in_transit",
  "out_for_delivery",
] as const;

export type CustomerOrderStatus =
  | "cancelled"
  | "fulfilled"
  | "paid"
  | "pending"
  | "refunded";

export type CustomerOrderSummary = {
  createdAt: Date;
  currency: string;
  grandTotal: number;
  id: string;
  itemCount: number;
  itemTitles: string[];
  orderNumber: string;
  shipmentStatus: string | null;
  status: CustomerOrderStatus;
  totalQuantity: number;
};

export type CustomerOrderDetail = {
  createdAt: Date;
  currency: string;
  customer: {
    email: string;
    name: string;
    phone: string;
  };
  deliveryAddress: {
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    countryCode: string;
    postalCode: string;
    province: string;
    suburb: string;
  };
  grandTotal: number;
  id: string;
  items: Array<{
    deliveryLabel: string | null;
    exchangeEmptyConfirmed: boolean;
    id: string;
    lineTotal: number;
    purchaseType: string;
    quantity: number;
    title: string;
    unitPrice: number;
  }>;
  orderNumber: string;
  paidAt: Date | null;
  payments: Array<{
    amount: number;
    completedAt: Date | null;
    createdAt: Date;
    provider: string;
    status: string;
  }>;
  schedules: Array<{
    deliveryInstructions: string | null;
    scheduledDate: string;
    status: string;
    windowLabel: string;
  }>;
  shipments: Array<{
    deliveredAt: Date | null;
    events: Array<{
      id: string;
      location: string | null;
      message: string | null;
      occurredAt: Date;
      status: string;
    }>;
    id: string;
    provider: string;
    status: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    waybillNumber: string | null;
  }>;
  shipmentStatus: string | null;
  shippingTotal: number;
  status: CustomerOrderStatus;
  subtotal: number;
};

export const requireCustomerAccount = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [user] = await db
    .select({
      email: users.email,
      id: users.id,
      isActive: users.isActive,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.isActive) {
    redirect("/");
  }

  return {
    email: user.email,
    id: user.id,
    name: user.name,
  };
});

function toMoney(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function safeTrackingUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function summarizeShipmentStatus(statuses: string[]) {
  if (statuses.length === 0) {
    return null;
  }

  for (const status of activeShipmentStatuses) {
    if (statuses.includes(status)) {
      return status;
    }
  }

  if (statuses.every((status) => status === "delivered")) {
    return "delivered";
  }

  if (statuses.includes("delivered")) {
    return "partially_delivered";
  }

  for (const status of ["failed_delivery", "returned", "cancelled"]) {
    if (statuses.includes(status)) {
      return status;
    }
  }

  return statuses[0] ?? null;
}

export const getCustomerOrders = cache(
  async (): Promise<CustomerOrderSummary[]> => {
    const account = await requireCustomerAccount();
    const orderRows = await db
      .select({
        createdAt: orders.createdAt,
        currency: orders.currency,
        grandTotal: orders.grandTotal,
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.userId, account.id))
      .orderBy(desc(orders.createdAt));

    if (orderRows.length === 0) {
      return [];
    }

    const orderIds = orderRows.map((order) => order.id);
    const [itemRows, shipmentRows] = await Promise.all([
      db
        .select({
          orderId: orderItems.orderId,
          quantity: orderItems.quantity,
          title: orderItems.title,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds)),
      db
        .select({
          orderId: shipments.orderId,
          status: shipments.status,
        })
        .from(shipments)
        .where(inArray(shipments.orderId, orderIds)),
    ]);

    const itemsByOrderId = new Map<
      string,
      { itemCount: number; itemTitles: string[]; totalQuantity: number }
    >();

    for (const item of itemRows) {
      const summary = itemsByOrderId.get(item.orderId) ?? {
        itemCount: 0,
        itemTitles: [],
        totalQuantity: 0,
      };

      summary.itemCount += 1;
      summary.totalQuantity += item.quantity;

      if (summary.itemTitles.length < 2) {
        summary.itemTitles.push(item.title);
      }

      itemsByOrderId.set(item.orderId, summary);
    }

    const shipmentStatusesByOrderId = new Map<string, string[]>();

    for (const shipment of shipmentRows) {
      const statuses = shipmentStatusesByOrderId.get(shipment.orderId) ?? [];

      statuses.push(shipment.status);
      shipmentStatusesByOrderId.set(shipment.orderId, statuses);
    }

    return orderRows.map((order) => {
      const itemSummary = itemsByOrderId.get(order.id) ?? {
        itemCount: 0,
        itemTitles: [],
        totalQuantity: 0,
      };
      return {
        ...order,
        grandTotal: toMoney(order.grandTotal),
        itemCount: itemSummary.itemCount,
        itemTitles: itemSummary.itemTitles,
        shipmentStatus: summarizeShipmentStatus(
          shipmentStatusesByOrderId.get(order.id) ?? [],
        ),
        totalQuantity: itemSummary.totalQuantity,
      };
    });
  },
);

export const getCustomerAccountOverview = cache(async () => {
  const [account, customerOrders] = await Promise.all([
    requireCustomerAccount(),
    getCustomerOrders(),
  ]);

  return {
    account,
    activeDeliveries: customerOrders.filter((order) =>
      activeShipmentStatuses.includes(
        order.shipmentStatus as (typeof activeShipmentStatuses)[number],
      ),
    ).length,
    orderCount: customerOrders.length,
    recentOrders: customerOrders.slice(0, 3),
  };
});

export const getCustomerOrderDetail = cache(
  async (orderId: string): Promise<CustomerOrderDetail | null> => {
    const account = await requireCustomerAccount();
    const parsedOrderId = orderIdSchema.safeParse(orderId);

    if (!parsedOrderId.success) {
      return null;
    }

    const [order] = await db
      .select({
        createdAt: orders.createdAt,
        currency: orders.currency,
        customerEmail: orders.customerEmail,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        deliveryAddress: orders.deliveryAddressSnapshot,
        grandTotal: orders.grandTotal,
        id: orders.id,
        orderNumber: orders.orderNumber,
        paidAt: orders.paidAt,
        shippingTotal: orders.shippingTotal,
        status: orders.status,
        subtotal: orders.subtotal,
      })
      .from(orders)
      .where(
        and(
          eq(orders.id, parsedOrderId.data),
          eq(orders.userId, account.id),
        ),
      )
      .limit(1);

    if (!order) {
      return null;
    }

    const [itemRows, paymentRows, shipmentRows, scheduleRows] =
      await Promise.all([
        db
          .select({
            deliveryLabel: orderItems.deliveryLabelSnapshot,
            exchangeEmptyConfirmed: orderItems.exchangeEmptyConfirmed,
            id: orderItems.id,
            purchaseType: orderItems.purchaseType,
            quantity: orderItems.quantity,
            title: orderItems.title,
            unitPrice: orderItems.unitPrice,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id)),
        db
          .select({
            amount: payments.amount,
            completedAt: payments.completedAt,
            createdAt: payments.createdAt,
            provider: payments.provider,
            status: payments.status,
          })
          .from(payments)
          .where(eq(payments.orderId, order.id))
          .orderBy(desc(payments.createdAt)),
        db
          .select({
            deliveredAt: shipments.deliveredAt,
            id: shipments.id,
            provider: shipments.provider,
            status: shipments.status,
            trackingNumber: shipments.trackingNumber,
            trackingUrl: shipments.trackingUrl,
            waybillNumber: shipments.waybillNumber,
          })
          .from(shipments)
          .where(eq(shipments.orderId, order.id))
          .orderBy(desc(shipments.createdAt)),
        db
          .select({
            deliveryInstructions:
              jurgensDeliverySchedules.deliveryInstructions,
            scheduledDate: jurgensDeliverySchedules.scheduledDate,
            status: jurgensDeliverySchedules.status,
            windowLabel: jurgensDeliverySchedules.windowLabel,
          })
          .from(jurgensDeliverySchedules)
          .where(eq(jurgensDeliverySchedules.orderId, order.id))
          .orderBy(desc(jurgensDeliverySchedules.createdAt)),
      ]);

    const shipmentIds = shipmentRows.map((shipment) => shipment.id);
    const eventRows =
      shipmentIds.length > 0
        ? await db
            .select({
              id: shipmentEvents.id,
              location: shipmentEvents.location,
              message: shipmentEvents.message,
              occurredAt: shipmentEvents.occurredAt,
              shipmentId: shipmentEvents.shipmentId,
              status: shipmentEvents.status,
            })
            .from(shipmentEvents)
            .where(inArray(shipmentEvents.shipmentId, shipmentIds))
            .orderBy(asc(shipmentEvents.occurredAt))
        : [];
    const eventsByShipmentId = new Map<
      string,
      CustomerOrderDetail["shipments"][number]["events"]
    >();

    for (const event of eventRows) {
      const current = eventsByShipmentId.get(event.shipmentId) ?? [];

      current.push({
        id: event.id,
        location: event.location,
        message: event.message,
        occurredAt: event.occurredAt,
        status: event.status,
      });
      eventsByShipmentId.set(event.shipmentId, current);
    }

    return {
      createdAt: order.createdAt,
      currency: order.currency,
      customer: {
        email: order.customerEmail,
        name: order.customerName,
        phone: order.customerPhone,
      },
      deliveryAddress: order.deliveryAddress,
      grandTotal: toMoney(order.grandTotal),
      id: order.id,
      items: itemRows.map((item) => ({
        ...item,
        lineTotal: toMoney(item.unitPrice) * item.quantity,
        unitPrice: toMoney(item.unitPrice),
      })),
      orderNumber: order.orderNumber,
      paidAt: order.paidAt,
      payments: paymentRows.map((payment) => ({
        ...payment,
        amount: toMoney(payment.amount),
      })),
      schedules: scheduleRows,
      shipments: shipmentRows.map((shipment) => ({
        ...shipment,
        events: eventsByShipmentId.get(shipment.id) ?? [],
        trackingUrl: safeTrackingUrl(shipment.trackingUrl),
      })),
      shipmentStatus: summarizeShipmentStatus(
        shipmentRows.map((shipment) => shipment.status),
      ),
      shippingTotal: toMoney(order.shippingTotal),
      status: order.status,
      subtotal: toMoney(order.subtotal),
    };
  },
);
