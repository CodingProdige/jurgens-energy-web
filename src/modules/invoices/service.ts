import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { env } from "@/src/config/env";
import {
  businessInformation,
  auditLogs,
  invoiceJobs,
  invoiceLines,
  invoiceNumberSequences,
  invoices,
  orderItems,
  orders,
  payments,
} from "@/src/db/schema";
import type {
  InvoiceAddressSnapshot,
  InvoiceCustomerSnapshot,
  InvoiceIssuerSnapshot,
} from "@/src/db/schema/invoices";
import { isInvoiceBusinessInformationReady } from "@/src/modules/business-information";
import {
  parseInvoiceDocumentData,
  type InvoiceDocumentData,
} from "@/src/modules/invoices/document-data";

const STANDARD_VAT_RATE_BPS = 1_500;

type InvoiceLineDraft = {
  description: string;
  grossCents: number;
  kind: "product" | "shipping";
  orderItemId: string | null;
  position: number;
  quantity: number;
  sku: string | null;
  taxCents: number;
  taxRateBps: number;
  unitGrossCents: number;
  netCents: number;
};

function moneyToCents(value: string | number) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new Error("Invoice source contains an invalid money amount.");
  }

  return Math.round(amount * 100);
}

function centsToMoney(value: number) {
  return (value / 100).toFixed(2);
}

function nullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function calculateVatInclusiveAmounts(grossCents: number, taxRateBps: number) {
  if (
    !Number.isInteger(grossCents) ||
    grossCents < 0 ||
    !Number.isInteger(taxRateBps) ||
    taxRateBps < 0
  ) {
    throw new Error("Invoice tax calculation received invalid input.");
  }

  const netCents = Math.round(
    (grossCents * 10_000) / (10_000 + taxRateBps),
  );

  return {
    netCents,
    taxCents: grossCents - netCents,
  };
}

function toAddressSnapshot(address: {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  countryCode: string;
  postalCode: string;
  province: string;
  suburb?: string | null;
}): InvoiceAddressSnapshot {
  return {
    addressLine1: address.addressLine1.trim(),
    addressLine2: nullableText(address.addressLine2),
    city: address.city.trim(),
    countryCode: address.countryCode.trim().toUpperCase(),
    postalCode: address.postalCode.trim(),
    province: address.province.trim(),
    suburb: nullableText(address.suburb),
  };
}

async function allocateInvoiceNumber(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  await transaction
    .insert(invoiceNumberSequences)
    .values({ key: "invoice", nextValue: BigInt(1) })
    .onConflictDoNothing({ target: invoiceNumberSequences.key });

  const [sequence] = await transaction
    .update(invoiceNumberSequences)
    .set({
      nextValue: sql`${invoiceNumberSequences.nextValue} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(invoiceNumberSequences.key, "invoice"))
    .returning({ nextValue: invoiceNumberSequences.nextValue });

  if (!sequence) {
    throw new Error("Could not allocate an invoice number.");
  }

  const allocatedValue = sequence.nextValue - BigInt(1);

  if (allocatedValue < BigInt(1)) {
    throw new Error("The invoice sequence is invalid.");
  }

  return `INV${allocatedValue.toString()}`;
}

function createInvoiceLines({
  itemRows,
  shippingTotalCents,
}: {
  itemRows: Array<{
    id: string;
    quantity: number;
    skuSnapshot: string | null;
    taxRateBps: number;
    title: string;
    unitPrice: string;
  }>;
  shippingTotalCents: number;
}) {
  const lines: InvoiceLineDraft[] = itemRows.map((item, index) => {
    const unitGrossCents = moneyToCents(item.unitPrice);
    const grossCents = unitGrossCents * item.quantity;
    const amounts = calculateVatInclusiveAmounts(grossCents, item.taxRateBps);

    return {
      description: item.title,
      grossCents,
      kind: "product",
      netCents: amounts.netCents,
      orderItemId: item.id,
      position: index + 1,
      quantity: item.quantity,
      sku: nullableText(item.skuSnapshot),
      taxCents: amounts.taxCents,
      taxRateBps: item.taxRateBps,
      unitGrossCents,
    };
  });

  if (shippingTotalCents > 0) {
    const amounts = calculateVatInclusiveAmounts(
      shippingTotalCents,
      STANDARD_VAT_RATE_BPS,
    );

    lines.push({
      description: "Delivery",
      grossCents: shippingTotalCents,
      kind: "shipping",
      netCents: amounts.netCents,
      orderItemId: null,
      position: lines.length + 1,
      quantity: 1,
      sku: null,
      taxCents: amounts.taxCents,
      taxRateBps: STANDARD_VAT_RATE_BPS,
      unitGrossCents: shippingTotalCents,
    });
  }

  return lines;
}

export type EnsureInvoiceResult =
  | { status: "business_information_incomplete" }
  | { status: "not_paid" }
  | { invoiceId: string; invoiceNumber: string; status: "created" | "exists" };

export async function ensureInvoiceForPaidOrder(
  orderId: string,
): Promise<EnsureInvoiceResult> {
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select ${orders.id} from ${orders} where ${orders.id} = ${orderId} for update`,
    );

    const [existing] = await transaction
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.orderId, orderId))
      .limit(1);

    if (existing) {
      return {
        invoiceId: existing.id,
        invoiceNumber: existing.invoiceNumber,
        status: "exists",
      };
    }

    const [order] = await transaction
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || !["paid", "fulfilled"].includes(order.status)) {
      return { status: "not_paid" };
    }

    const [payment] = await transaction
      .select()
      .from(payments)
      .where(
        and(eq(payments.orderId, order.id), eq(payments.status, "captured")),
      )
      .limit(1);

    if (!payment?.completedAt || moneyToCents(payment.amount) !== moneyToCents(order.grandTotal)) {
      return { status: "not_paid" };
    }

    const [information] = await transaction
      .select()
      .from(businessInformation)
      .where(eq(businessInformation.id, 1))
      .limit(1);

    if (!information || !isInvoiceBusinessInformationReady(information)) {
      return { status: "business_information_incomplete" };
    }

    const itemRows = await transaction
      .select({
        id: orderItems.id,
        quantity: orderItems.quantity,
        skuSnapshot: orderItems.skuSnapshot,
        taxRateBps: orderItems.taxRateBps,
        title: orderItems.title,
        unitPrice: orderItems.unitPrice,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    if (itemRows.length === 0) {
      throw new Error("A paid order cannot be invoiced without order lines.");
    }

    const lines = createInvoiceLines({
      itemRows,
      shippingTotalCents: moneyToCents(order.shippingTotal),
    });
    const grossCents = lines.reduce((total, line) => total + line.grossCents, 0);
    const netCents = lines.reduce((total, line) => total + line.netCents, 0);
    const taxCents = lines.reduce((total, line) => total + line.taxCents, 0);

    if (grossCents !== moneyToCents(order.grandTotal)) {
      throw new Error("The paid order total does not match its invoice lines.");
    }

    const billingAddress = toAddressSnapshot(
      order.billingDetailsSnapshot ?? order.deliveryAddressSnapshot,
    );
    const issuerAddress = toAddressSnapshot(information);
    const issuerSnapshot: InvoiceIssuerSnapshot = {
      ...issuerAddress,
      companyRegistrationNumber: nullableText(
        information.companyRegistrationNumber,
      ),
      email: information.invoiceEmail.trim().toLowerCase(),
      legalName: information.legalName.trim(),
      phone: information.invoicePhone.trim(),
      tradingName: information.tradingName.trim(),
      vatRegistrationNumber: information.vatRegistrationNumber.trim(),
    };
    const customerSnapshot: InvoiceCustomerSnapshot = {
      ...billingAddress,
      businessName: nullableText(order.billingDetailsSnapshot?.businessName),
      email: order.customerEmail.trim().toLowerCase(),
      name:
        order.billingDetailsSnapshot?.name.trim() || order.customerName.trim(),
      phone: order.customerPhone.trim(),
      vatRegistrationNumber: nullableText(
        order.billingDetailsSnapshot?.vatRegistrationNumber,
      ),
    };
    const invoiceNumber = await allocateInvoiceNumber(transaction);
    const [invoice] = await transaction
      .insert(invoices)
      .values({
        amountPaid: centsToMoney(grossCents),
        currency: order.currency,
        customerSnapshot,
        invoiceNumber,
        issuedAt: payment.completedAt,
        issuerSnapshot,
        orderId: order.id,
        paymentReference: payment.providerPaymentId ?? payment.id,
        subtotalExcludingTax: centsToMoney(netCents),
        supplyDate: payment.completedAt,
        taxTotal: centsToMoney(taxCents),
        totalIncludingTax: centsToMoney(grossCents),
      })
      .returning({ id: invoices.id });

    await transaction.insert(invoiceLines).values(
      lines.map((line) => ({
        description: line.description,
        invoiceId: invoice.id,
        kind: line.kind,
        lineTotalExcludingTax: centsToMoney(line.netCents),
        lineTotalIncludingTax: centsToMoney(line.grossCents),
        orderItemId: line.orderItemId,
        position: line.position,
        quantity: line.quantity.toFixed(3),
        sku: line.sku,
        taxAmount: centsToMoney(line.taxCents),
        taxRateBps: line.taxRateBps,
        unitPriceIncludingTax: centsToMoney(line.unitGrossCents),
      })),
    );

    await transaction.insert(invoiceJobs).values({
      idempotencyKey: `invoice:${invoice.id}:render-and-deliver:v1`,
      invoiceId: invoice.id,
      jobType: "render_and_deliver",
    });

    await transaction.insert(auditLogs).values({
      action: "invoice.issued",
      entityId: invoice.id,
      entityType: "invoice",
      metadata: JSON.stringify({
        invoiceNumber,
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalIncludingTax: centsToMoney(grossCents),
      }),
    });

    return {
      invoiceId: invoice.id,
      invoiceNumber,
      status: "created",
    };
  });
}

export async function ensureMissingPaidInvoices(limit = 20) {
  const candidates = await db
    .select({ id: orders.id })
    .from(orders)
    .leftJoin(invoices, eq(invoices.orderId, orders.id))
    .where(
      and(
        inArray(orders.status, ["paid", "fulfilled"]),
        isNull(invoices.id),
      ),
    )
    .limit(Math.max(1, Math.min(limit, 100)));

  const results: EnsureInvoiceResult[] = [];

  for (const candidate of candidates) {
    results.push(await ensureInvoiceForPaidOrder(candidate.id));
  }

  return results;
}

function countryName(countryCode: string) {
  return countryCode.toUpperCase() === "ZA" ? "South Africa" : countryCode;
}

function toDocumentAddress(address: InvoiceAddressSnapshot) {
  return {
    city: address.city,
    countryCode: address.countryCode,
    countryName: countryName(address.countryCode),
    line1: address.addressLine1,
    line2: address.addressLine2 ?? undefined,
    postalCode: address.postalCode,
    province: address.province,
    suburb: address.suburb ?? undefined,
  };
}

export async function getInvoiceDocumentData(
  invoiceId: string,
): Promise<InvoiceDocumentData> {
  const [invoice] = await db
    .select({
      amountPaid: invoices.amountPaid,
      currency: invoices.currency,
      customerSnapshot: invoices.customerSnapshot,
      deliveryAddressSnapshot: orders.deliveryAddressSnapshot,
      invoiceNumber: invoices.invoiceNumber,
      issuedAt: invoices.issuedAt,
      issuerSnapshot: invoices.issuerSnapshot,
      orderNumber: orders.orderNumber,
      paymentReference: invoices.paymentReference,
      supplyDate: invoices.supplyDate,
      subtotalExcludingTax: invoices.subtotalExcludingTax,
      taxTotal: invoices.taxTotal,
      totalIncludingTax: invoices.totalIncludingTax,
    })
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId))
    .orderBy(invoiceLines.position);

  const issuer = invoice.issuerSnapshot;
  const customer = invoice.customerSnapshot;
  const deliveryAddress = toAddressSnapshot(invoice.deliveryAddressSnapshot);
  const hasDifferentDeliveryAddress = (
    [
      "addressLine1",
      "addressLine2",
      "city",
      "countryCode",
      "postalCode",
      "province",
      "suburb",
    ] as const
  ).some((field) => customer[field] !== deliveryAddress[field]);

  return parseInvoiceDocumentData({
    currency: invoice.currency,
    customer: {
      billingAddress: toDocumentAddress(customer),
      companyName: customer.businessName ?? undefined,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      vatNumber: customer.vatRegistrationNumber ?? undefined,
      deliveryAddress: hasDifferentDeliveryAddress
        ? toDocumentAddress(deliveryAddress)
        : undefined,
    },
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt.toISOString(),
    issuer: {
      address: toDocumentAddress(issuer),
      email: issuer.email,
      legalName: issuer.legalName,
      phone: issuer.phone,
      registrationNumber: issuer.companyRegistrationNumber ?? undefined,
      tradingName: issuer.tradingName,
      vatNumber: issuer.vatRegistrationNumber,
      website: env.APP_URL,
    },
    lines: lines.map((line) => ({
      description: line.description,
      discountGrossCents: 0,
      grossAmountCents: moneyToCents(line.lineTotalIncludingTax),
      kind: line.kind,
      quantity: Math.round(Number(line.quantity)),
      sku: line.sku ?? undefined,
      unitPriceGrossCents: moneyToCents(line.unitPriceIncludingTax),
      vatAmountCents: moneyToCents(line.taxAmount),
      vatRateBasisPoints: line.taxRateBps,
      netAmountCents: moneyToCents(line.lineTotalExcludingTax),
    })),
    notes: ["All prices are VAT inclusive."],
    orderNumber: invoice.orderNumber,
    payment: {
      amountPaidCents: moneyToCents(invoice.amountPaid),
      paidAt: invoice.issuedAt.toISOString(),
      provider: "PayFast",
      transactionReference:
        invoice.paymentReference ?? invoice.orderNumber,
    },
    supplyDate: invoice.supplyDate.toISOString().slice(0, 10),
    totals: {
      grossAmountCents: moneyToCents(invoice.totalIncludingTax),
      netAmountCents: moneyToCents(invoice.subtotalExcludingTax),
      vatAmountCents: moneyToCents(invoice.taxTotal),
    },
  });
}
