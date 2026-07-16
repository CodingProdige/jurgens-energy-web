import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  orderItems,
  orders,
  payments,
  shipments,
  users,
} from "@/src/db/schema";

export type AdminOrderStatus =
  | "cancelled"
  | "fulfilled"
  | "paid"
  | "pending"
  | "refunded";

export type AdminOrderPayment = {
  amount: string;
  createdAt: Date;
  provider: string;
  status: string;
};

export type AdminOrderShipmentSummary = {
  provider: string;
  status: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  waybillNumber: string | null;
};

export type AdminOrderRow = {
  createdAt: Date;
  customerEmail: string | null;
  customerName: string | null;
  grandTotal: string;
  id: string;
  itemCount: number;
  itemTitles: string[];
  orderNumber: string;
  payments: AdminOrderPayment[];
  shippingTotal: string;
  shipments: AdminOrderShipmentSummary[];
  status: AdminOrderStatus;
  subtotal: string;
  totalQuantity: number;
};

export type AdminOrdersData = {
  metrics: {
    cancelled: number;
    fulfilled: number;
    paid: number;
    pending: number;
    refunded: number;
    revenue: number;
    shippingCollected: number;
    total: number;
  };
  orders: AdminOrderRow[];
};

function toMoneyNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getAdminOrders(): Promise<AdminOrdersData> {
  const orderRows = await db
    .select({
      createdAt: orders.createdAt,
      customerEmail: users.email,
      customerName: users.name,
      grandTotal: orders.grandTotal,
      id: orders.id,
      orderNumber: orders.orderNumber,
      shippingTotal: orders.shippingTotal,
      status: orders.status,
      subtotal: orders.subtotal,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.userId))
    .orderBy(desc(orders.createdAt));

  const orderIds = orderRows.map((order) => order.id);

  if (orderIds.length === 0) {
    return {
      metrics: {
        cancelled: 0,
        fulfilled: 0,
        paid: 0,
        pending: 0,
        refunded: 0,
        revenue: 0,
        shippingCollected: 0,
        total: 0,
      },
      orders: [],
    };
  }

  const [itemRows, paymentRows, shipmentRows] = await Promise.all([
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
        amount: payments.amount,
        createdAt: payments.createdAt,
        orderId: payments.orderId,
        provider: payments.provider,
        status: payments.status,
      })
      .from(payments)
      .where(inArray(payments.orderId, orderIds))
      .orderBy(desc(payments.createdAt)),
    db
      .select({
        orderId: shipments.orderId,
        provider: shipments.provider,
        status: shipments.status,
        trackingNumber: shipments.trackingNumber,
        trackingUrl: shipments.trackingUrl,
        waybillNumber: shipments.waybillNumber,
      })
      .from(shipments)
      .where(inArray(shipments.orderId, orderIds))
      .orderBy(desc(shipments.createdAt)),
  ]);

  const itemsByOrderId = new Map<
    string,
    { itemCount: number; itemTitles: string[]; totalQuantity: number }
  >();

  for (const item of itemRows) {
    const current = itemsByOrderId.get(item.orderId) ?? {
      itemCount: 0,
      itemTitles: [],
      totalQuantity: 0,
    };

    current.itemCount += 1;
    current.totalQuantity += item.quantity;

    if (current.itemTitles.length < 3) {
      current.itemTitles.push(item.title);
    }

    itemsByOrderId.set(item.orderId, current);
  }

  const paymentsByOrderId = new Map<string, AdminOrderPayment[]>();

  for (const payment of paymentRows) {
    const current = paymentsByOrderId.get(payment.orderId) ?? [];

    current.push({
      amount: payment.amount,
      createdAt: payment.createdAt,
      provider: payment.provider,
      status: payment.status,
    });
    paymentsByOrderId.set(payment.orderId, current);
  }

  const shipmentsByOrderId = new Map<string, AdminOrderShipmentSummary[]>();

  for (const shipment of shipmentRows) {
    const current = shipmentsByOrderId.get(shipment.orderId) ?? [];

    current.push({
      provider: shipment.provider,
      status: shipment.status,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      waybillNumber: shipment.waybillNumber,
    });
    shipmentsByOrderId.set(shipment.orderId, current);
  }

  const adminOrders = orderRows.map((order) => {
    const itemSummary = itemsByOrderId.get(order.id) ?? {
      itemCount: 0,
      itemTitles: [],
      totalQuantity: 0,
    };

    return {
      ...order,
      itemCount: itemSummary.itemCount,
      itemTitles: itemSummary.itemTitles,
      payments: paymentsByOrderId.get(order.id) ?? [],
      shipments: shipmentsByOrderId.get(order.id) ?? [],
      totalQuantity: itemSummary.totalQuantity,
    };
  });

  return {
    metrics: {
      cancelled: adminOrders.filter((order) => order.status === "cancelled").length,
      fulfilled: adminOrders.filter((order) => order.status === "fulfilled").length,
      paid: adminOrders.filter((order) => order.status === "paid").length,
      pending: adminOrders.filter((order) => order.status === "pending").length,
      refunded: adminOrders.filter((order) => order.status === "refunded").length,
      revenue: adminOrders.reduce(
        (total, order) => total + toMoneyNumber(order.grandTotal),
        0,
      ),
      shippingCollected: adminOrders.reduce(
        (total, order) => total + toMoneyNumber(order.shippingTotal),
        0,
      ),
      total: adminOrders.length,
    },
    orders: adminOrders,
  };
}
