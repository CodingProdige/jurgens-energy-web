import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  calculateCourierGuyOrderCostProjection,
  centsToMoney,
  createCourierGuyBookingQuoteFingerprint,
  evaluateCourierGuyBookingQuoteSafety,
  evaluateCourierGuyOrderBookingSafety,
  findCourierGuyRateForStoredService,
  moneyToCents,
  selectCourierGuyRate,
} from "../src/modules/shipping/courier-guy-booking-quote-rules.ts";

const packingActionSource = readFileSync(
  new URL(
    "../app/(admin)/admin/(dashboard)/shipping/orders/[orderId]/actions.ts",
    import.meta.url,
  ),
  "utf8",
);
const packingManagerSource = readFileSync(
  new URL(
    "../app/(admin)/admin/(dashboard)/shipping/orders/[orderId]/packing-manager.tsx",
    import.meta.url,
  ),
  "utf8",
);
const bookingQuoteServiceSource = readFileSync(
  new URL(
    "../src/modules/shipping/courier-guy-booking-quotes.ts",
    import.meta.url,
  ),
  "utf8",
);
const shipmentServiceSource = readFileSync(
  new URL(
    "../src/modules/shipping/courier-guy-shipments.ts",
    import.meta.url,
  ),
  "utf8",
);
const orderBookingServiceSource = readFileSync(
  new URL(
    "../src/modules/shipping/courier-guy-order-booking.ts",
    import.meta.url,
  ),
  "utf8",
);

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);

  return source.slice(startIndex, endIndex);
}

function createRate({
  amount,
  code,
  id,
  name = code,
}) {
  return {
    currency: "ZAR",
    estimatedDeliveryFrom: null,
    estimatedDeliveryTo: null,
    providerAmount: amount,
    providerAmountExcludingVat: null,
    serviceCode: code,
    serviceDescription: null,
    serviceLevelId: id,
    serviceName: name,
  };
}

const economyRate = createRate({
  amount: 119.95,
  code: "ECO",
  id: "2",
  name: "Economy",
});
const overnightRate = createRate({
  amount: 189.5,
  code: "OVN",
  id: "1",
  name: "Overnight",
});

const quoteSnapshot = {
  collectionContact: {
    mobileNumber: "+27211234567",
    name: "Jurgens Dispatch",
  },
  customerContact: {
    email: "customer@example.test",
    mobileNumber: "+27821234567",
    name: "Customer",
  },
  deliveryAddress: {
    city: "Cape Town",
    postalCode: "8001",
    streetAddress: "1 Long Street",
  },
  environment: "live",
  parcel: {
    heightMm: 50,
    lengthMm: 425,
    weightGrams: 3_000,
    widthMm: 385,
  },
  pickupPoint: {
    id: "K120",
    provider: "tcg-locker",
  },
  providerAccountCode: "JUR082",
  orderId: "00000000-0000-4000-8000-000000000002",
  service: {
    serviceCode: "ECO",
    serviceLevelId: "2",
  },
  shipmentId: "00000000-0000-4000-8000-000000000001",
};

test("creates a stable quote fingerprint and detects booking-input drift", () => {
  const reorderedSnapshot = {
    shipmentId: quoteSnapshot.shipmentId,
    service: {
      serviceLevelId: quoteSnapshot.service.serviceLevelId,
      serviceCode: quoteSnapshot.service.serviceCode,
    },
    providerAccountCode: quoteSnapshot.providerAccountCode,
    orderId: quoteSnapshot.orderId,
    pickupPoint: {
      provider: quoteSnapshot.pickupPoint.provider,
      id: quoteSnapshot.pickupPoint.id,
    },
    parcel: {
      widthMm: quoteSnapshot.parcel.widthMm,
      weightGrams: quoteSnapshot.parcel.weightGrams,
      lengthMm: quoteSnapshot.parcel.lengthMm,
      heightMm: quoteSnapshot.parcel.heightMm,
    },
    environment: quoteSnapshot.environment,
    deliveryAddress: {
      streetAddress: quoteSnapshot.deliveryAddress.streetAddress,
      postalCode: quoteSnapshot.deliveryAddress.postalCode,
      city: quoteSnapshot.deliveryAddress.city,
    },
    customerContact: {
      name: quoteSnapshot.customerContact.name,
      mobileNumber: quoteSnapshot.customerContact.mobileNumber,
      email: quoteSnapshot.customerContact.email,
    },
    collectionContact: {
      name: quoteSnapshot.collectionContact.name,
      mobileNumber: quoteSnapshot.collectionContact.mobileNumber,
    },
  };
  const fingerprint = createCourierGuyBookingQuoteFingerprint(quoteSnapshot);

  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(
    createCourierGuyBookingQuoteFingerprint(reorderedSnapshot),
    fingerprint,
  );

  for (const changedSnapshot of [
    {
      ...quoteSnapshot,
      parcel: { ...quoteSnapshot.parcel, weightGrams: 3_001 },
    },
    {
      ...quoteSnapshot,
      deliveryAddress: {
        ...quoteSnapshot.deliveryAddress,
        postalCode: "8002",
      },
    },
    {
      ...quoteSnapshot,
      pickupPoint: { ...quoteSnapshot.pickupPoint, id: "K121" },
    },
    { ...quoteSnapshot, environment: "sandbox" },
    { ...quoteSnapshot, providerAccountCode: "JUR083" },
    {
      ...quoteSnapshot,
      customerContact: {
        ...quoteSnapshot.customerContact,
        mobileNumber: "+27821234568",
      },
    },
    {
      ...quoteSnapshot,
      service: { serviceCode: "OVN", serviceLevelId: "1" },
    },
  ]) {
    assert.notEqual(
      createCourierGuyBookingQuoteFingerprint(changedSnapshot),
      fingerprint,
    );
  }
});

test("uses the preferred service or the cheapest available service", () => {
  const rates = [overnightRate, economyRate];

  assert.strictEqual(selectCourierGuyRate(rates, "eco"), economyRate);
  assert.strictEqual(selectCourierGuyRate(rates, null), economyRate);
  assert.equal(selectCourierGuyRate(rates, "SAMEDAY"), null);
  assert.equal(selectCourierGuyRate([], null), null);
  assert.deepEqual(rates, [overnightRate, economyRate]);
});

test("allows the approved amount or a lower fresh amount", () => {
  for (const freshProviderAmount of [123.45, 123.44]) {
    const result = evaluateCourierGuyBookingQuoteSafety({
      approvedProviderAmount: 123.45,
      customerShippingAmount: 100,
      freshProviderAmount,
      maxAbsorbedAmount: null,
      maxBookingCostAmount: null,
      otherProviderCosts: 10,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.reason, null);
    assert.equal(result.freshAmountCents, moneyToCents(freshProviderAmount));
  }
});

test("blocks a fresh provider amount that is one cent above approval", () => {
  const result = evaluateCourierGuyBookingQuoteSafety({
    approvedProviderAmount: 123.45,
    customerShippingAmount: 100,
    freshProviderAmount: 123.46,
    maxAbsorbedAmount: null,
    maxBookingCostAmount: null,
    otherProviderCosts: 0,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.approvedAmountCents, 12_345);
  assert.equal(result.freshAmountCents, 12_346);
  assert.equal(result.reason, "approved_quote_exceeded");
});

test("allows the maximum booking cost boundary and blocks one cent over", () => {
  const common = {
    approvedProviderAmount: 300,
    customerShippingAmount: 250,
    maxAbsorbedAmount: null,
    maxBookingCostAmount: 200,
    otherProviderCosts: 0,
  };

  assert.deepEqual(
    evaluateCourierGuyBookingQuoteSafety({
      ...common,
      freshProviderAmount: 200,
    }),
    {
      allowed: true,
      approvedAmountCents: 30_000,
      freshAmountCents: 20_000,
      projectedAbsorbedAmountCents: 0,
      projectedProviderSpendCents: 20_000,
      reason: null,
    },
  );

  const overLimit = evaluateCourierGuyBookingQuoteSafety({
    ...common,
    freshProviderAmount: 200.01,
  });

  assert.equal(overLimit.allowed, false);
  assert.equal(overLimit.reason, "booking_cost_limit_exceeded");
});

test("counts the customer delivery fee once across all order shipment costs", () => {
  const projection = calculateCourierGuyOrderCostProjection({
    customerShippingAmount: 150,
    otherProviderCosts: 80,
    selectedProviderAmount: 90,
  });

  assert.deepEqual(projection, {
    customerShippingAmountCents: 15_000,
    deliveryMarginRemainingCents: 0,
    otherProviderCostsCents: 8_000,
    projectedAbsorbedAmountCents: 2_000,
    projectedProviderSpendCents: 17_000,
    selectedProviderAmountCents: 9_000,
  });

  const atLimit = evaluateCourierGuyBookingQuoteSafety({
    approvedProviderAmount: 90,
    customerShippingAmount: 150,
    freshProviderAmount: 90,
    maxAbsorbedAmount: 20,
    maxBookingCostAmount: null,
    otherProviderCosts: 80,
  });
  const overLimit = evaluateCourierGuyBookingQuoteSafety({
    approvedProviderAmount: 90,
    customerShippingAmount: 150,
    freshProviderAmount: 90,
    maxAbsorbedAmount: 19.99,
    maxBookingCostAmount: null,
    otherProviderCosts: 80,
  });

  assert.equal(atLimit.allowed, true);
  assert.equal(overLimit.allowed, false);
  assert.equal(overLimit.reason, "absorbed_cost_limit_exceeded");
});

test("evaluates a complete multi-package order against one delivery fee", () => {
  const safe = evaluateCourierGuyOrderBookingSafety({
    approvedPackageAmounts: [80, 90],
    customerShippingAmount: 150,
    freshPackageAmounts: [80, 90],
    maxAbsorbedAmount: 20,
    maxBookingCostAmount: 100,
    otherProviderCosts: 0,
  });
  const overAggregateLimit = evaluateCourierGuyOrderBookingSafety({
    approvedPackageAmounts: [80, 90.01],
    customerShippingAmount: 150,
    freshPackageAmounts: [80, 90.01],
    maxAbsorbedAmount: 20,
    maxBookingCostAmount: 100,
    otherProviderCosts: 0,
  });

  assert.equal(safe.allowed, true);
  assert.equal(safe.projection.projectedProviderSpendCents, 17_000);
  assert.equal(safe.projection.projectedAbsorbedAmountCents, 2_000);
  assert.equal(overAggregateLimit.allowed, false);
  assert.deepEqual(overAggregateLimit.reasons, [
    { packageIndex: null, reason: "absorbed_cost_limit_exceeded" },
  ]);
});

test("blocks one increased package before a multi-package booking starts", () => {
  const result = evaluateCourierGuyOrderBookingSafety({
    approvedPackageAmounts: [80, 90],
    customerShippingAmount: 200,
    freshPackageAmounts: [80, 90.01],
    maxAbsorbedAmount: null,
    maxBookingCostAmount: null,
    otherProviderCosts: 0,
  });

  assert.equal(result.allowed, false);
  assert.deepEqual(result.reasons, [
    { packageIndex: 1, reason: "approved_quote_exceeded" },
  ]);
});

test("preserves unused order-level delivery margin without reporting absorbed cost", () => {
  assert.deepEqual(
    calculateCourierGuyOrderCostProjection({
      customerShippingAmount: 200,
      otherProviderCosts: 40,
      selectedProviderAmount: 60,
    }),
    {
      customerShippingAmountCents: 20_000,
      deliveryMarginRemainingCents: 10_000,
      otherProviderCostsCents: 4_000,
      projectedAbsorbedAmountCents: 0,
      projectedProviderSpendCents: 10_000,
      selectedProviderAmountCents: 6_000,
    },
  );
});

test("treats zero safety limits as real limits", () => {
  const noAbsorbedCost = evaluateCourierGuyBookingQuoteSafety({
    approvedProviderAmount: 100,
    customerShippingAmount: 100,
    freshProviderAmount: 100,
    maxAbsorbedAmount: 0,
    maxBookingCostAmount: 100,
    otherProviderCosts: 0,
  });
  const oneCentAbsorbed = evaluateCourierGuyBookingQuoteSafety({
    approvedProviderAmount: 100.01,
    customerShippingAmount: 100,
    freshProviderAmount: 100.01,
    maxAbsorbedAmount: 0,
    maxBookingCostAmount: null,
    otherProviderCosts: 0,
  });

  assert.equal(noAbsorbedCost.allowed, true);
  assert.equal(oneCentAbsorbed.allowed, false);
  assert.equal(oneCentAbsorbed.reason, "absorbed_cost_limit_exceeded");
});

test("looks up the stored service by provider ID before falling back to code", () => {
  assert.strictEqual(
    findCourierGuyRateForStoredService(
      [overnightRate, economyRate],
      { serviceCode: "OVN", serviceLevelId: "2" },
    ),
    economyRate,
  );
  assert.strictEqual(
    findCourierGuyRateForStoredService(
      [overnightRate, economyRate],
      { serviceCode: "ovn", serviceLevelId: null },
    ),
    overnightRate,
  );
  assert.strictEqual(
    findCourierGuyRateForStoredService(
      [overnightRate, economyRate],
      { serviceCode: "eco", serviceLevelId: "missing-provider-id" },
    ),
    economyRate,
  );
  assert.equal(
    findCourierGuyRateForStoredService(
      [overnightRate, economyRate],
      { serviceCode: "SAMEDAY", serviceLevelId: "99" },
    ),
    null,
  );
});

test("converts shipping money through integer cents safely", () => {
  assert.equal(moneyToCents(0.1 + 0.2), 30);
  assert.equal(moneyToCents(1.005), 101);
  assert.equal(moneyToCents(2.675), 268);
  assert.equal(moneyToCents(200.01), 20_001);
  assert.equal(centsToMoney(20_001), 200.01);

  assert.throws(() => moneyToCents(-0.01), /non-negative/);
  assert.throws(() => moneyToCents(Number.POSITIVE_INFINITY), /non-negative/);
  assert.throws(() => centsToMoney(1.5), /whole number/);
});

test("books only the exact stored order quote batch reviewed by the admin", () => {
  const bookingSchema = sourceBetween(
    packingActionSource,
    "const bookingActionSchema",
    "async function requireShippingManageAccess",
  );
  const confirmationUi = sourceBetween(
    packingManagerSource,
    "function BookingResultPanel",
    "function QuoteReview",
  );
  const storedBatchLookup = sourceBetween(
    orderBookingServiceSource,
    "async function loadBatchForConfirmation",
    "export async function confirmCourierGuyOrderBooking",
  );
  const confirmationService = orderBookingServiceSource.slice(
    orderBookingServiceSource.indexOf(
      "export async function confirmCourierGuyOrderBooking",
    ),
  );

  assert.match(bookingSchema, /batchId:\s*uuidSchema/);
  assert.match(bookingSchema, /orderId:\s*uuidSchema/);
  assert.doesNotMatch(
    bookingSchema,
    /quoteId|shipmentId|providerAmount|serviceCode|maxBookingCostAmount/,
  );

  assert.match(
    confirmationUi,
    /<input name="batchId" type="hidden" value=\{quote\.batchId\} \/>/,
  );
  assert.match(
    confirmationUi,
    /<input name="orderId" type="hidden" value=\{orderId\} \/>/,
  );
  assert.doesNotMatch(
    confirmationUi,
    /name="(?:quoteId|shipmentId|providerAmount|serviceCode|maxBookingCostAmount)"/,
  );

  assert.match(
    packingActionSource,
    /confirmCourierGuyOrderBooking\(\{\s*actorUserId:\s*session\.user\.id,\s*batchId:\s*parsed\.data\.batchId,\s*orderId:\s*parsed\.data\.orderId,?\s*\}\)/,
  );
  assert.match(
    storedBatchLookup,
    /eq\(courierGuyBookingBatches\.id, parsed\.data\.batchId\)/,
  );
  assert.match(
    storedBatchLookup,
    /eq\(courierGuyBookingBatches\.orderId, parsed\.data\.orderId\)/,
  );
  assert.match(
    storedBatchLookup,
    /quoteId:\s*courierGuyBookingBatchItems\.quoteId/,
  );
  assert.match(
    storedBatchLookup,
    /shipmentBookingQuoteId:\s*shipments\.bookingQuoteId/,
  );
  assert.match(
    confirmationService,
    /item\.shipmentBookingQuoteId !== item\.quoteId/,
  );
  assert.match(
    confirmationService,
    /prepareCourierGuyQuotedBooking\(\s*item\.shipmentId,\s*item\.quoteId,?\s*\)/,
  );
  assert.match(
    bookingQuoteServiceSource,
    /context\.record\.bookingQuoteId !== quoteId\.data/,
  );
});

test("serializes and reserves order carrier spend before provider booking", () => {
  const claimFlow = sourceBetween(
    shipmentServiceSource,
    "const claimed = await db.transaction",
    "if (!claimed)",
  );
  const lockIndex = claimFlow.indexOf('.for("update")');
  const safetyIndex = claimFlow.indexOf(
    "evaluateCourierGuyBookingQuoteSafety",
  );
  const claimIndex = claimFlow.indexOf(".update(shipments)");

  assert.ok(lockIndex >= 0, "the order row must be locked");
  assert.match(claimFlow, /\.from\(orders\)/);
  assert.match(
    claimFlow,
    /\.leftJoin\(\s*shippingRateQuotes,\s*eq\(shippingRateQuotes\.id, shipments\.bookingQuoteId\)/,
  );
  assert.match(claimFlow, /shipment\.bookingQuoteStatus === "selected"/);
  assert.match(claimFlow, /shipment\.bookingQuoteStatus === "booked"/);
  assert.match(
    claimFlow,
    /const bookingQuoteAmount = Number\(shipment\.bookingQuoteAmount\)/,
  );
  assert.match(claimFlow, /return total \+ bookingQuoteAmount/);
  assert.ok(
    lockIndex < safetyIndex && safetyIndex < claimIndex,
    "the serialized cap check must happen after the order lock and before claiming the shipment",
  );
  assert.match(
    claimFlow,
    /gt\(shippingRateQuotes\.expiresAt, new Date\(\)\)/,
  );

  const providerMutationIndex = shipmentServiceSource.indexOf(
    "context.client.createShipment",
  );
  const claimTransactionIndex = shipmentServiceSource.indexOf(
    "const claimed = await db.transaction",
  );

  assert.ok(
    claimTransactionIndex >= 0 && claimTransactionIndex < providerMutationIndex,
    "the local quote and cost reservation must be claimed before the provider mutation",
  );
});

test("serializes fresh quote attachment so concurrent previews cannot replace each other silently", () => {
  const createQuoteFlow = sourceBetween(
    bookingQuoteServiceSource,
    "const quote = await db.transaction",
    "return quoteViewFromRate",
  );

  assert.match(createQuoteFlow, /\.from\(shipments\)/);
  assert.match(createQuoteFlow, /\.for\("update"\)/);
  assert.match(
    createQuoteFlow,
    /currentShipment\.bookingQuoteId !== context\.record\.bookingQuoteId/,
  );
  assert.match(
    createQuoteFlow,
    /currentShipment\.updatedAt\.getTime\(\) !==\s*context\.record\.updatedAt\.getTime\(\)/,
  );
});
