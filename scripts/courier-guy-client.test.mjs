import assert from "node:assert/strict";
import test from "node:test";

import {
  COURIER_GUY_LIVE_API_BASE_URL,
  CourierGuyApiError,
  createCourierGuyClient,
  isCourierGuyRequestDefinitelyRejected,
} from "../src/modules/shipping/courier-guy-client.ts";
import {
  courierGuyCancellableShipmentStatuses,
  createCourierGuyBookingReference,
  createCourierGuyCustomerTrackingUrl,
  hasCourierGuyCredentialsForIdentity,
} from "../src/modules/shipping/courier-guy-operations.ts";

const config = {
  apiBaseUrl: COURIER_GUY_LIVE_API_BASE_URL,
  apiKey: "test-token-that-must-not-appear-in-errors",
  timeoutMs: 1_000,
};

const deliveryAddress = {
  addressType: "residential",
  city: "Cape Town",
  countryCode: "ZA",
  latitude: -33.9249,
  localArea: "Cape Town City Centre",
  longitude: 18.4241,
  postalCode: "8001",
  streetAddress: "1 Long Street",
  zone: "Western Cape",
};

const parcel = {
  description: "Solar accessory",
  heightMm: 50,
  lengthMm: 425,
  weightGrams: 3_000,
  widthMm: 385,
};

const pickupPointOrigin = {
  kind: "pickup_point",
  pickupPointId: "TCG-CPT-01",
  provider: "tcg-locker",
};

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", ...init.headers },
    status: init.status ?? 200,
  });
}

test("creates a unique reconciliation reference and safe customer tracking URL", () => {
  const first = createCourierGuyBookingReference(
    "ORDER-1001",
    "00000000-0000-0000-0000-000000000001",
  );
  const second = createCourierGuyBookingReference(
    "ORDER-1001",
    "00000000-0000-0000-0000-000000000002",
  );

  assert.notEqual(first, second);
  assert.match(first, /^ORDER-1001-/);
  assert.ok(first.length <= 255);
  assert.equal(
    createCourierGuyCustomerTrackingUrl("ABC 123"),
    "https://portal.thecourierguy.co.za/track?ref=ABC+123",
  );
});

test("only treats proven pre-creation failures as safe to retry", () => {
  assert.equal(
    isCourierGuyRequestDefinitelyRejected(
      new CourierGuyApiError({
        code: "invalid_request",
        message: "Invalid request.",
        operation: "create Courier Guy shipment",
      }),
    ),
    true,
  );
  assert.equal(
    isCourierGuyRequestDefinitelyRejected(
      new CourierGuyApiError({
        code: "provider_error",
        message: "Bad request.",
        operation: "create Courier Guy shipment",
        status: 400,
      }),
    ),
    true,
  );

  for (const status of [408, 409, 425, 429, 500]) {
    assert.equal(
      isCourierGuyRequestDefinitelyRejected(
        new CourierGuyApiError({
          code: "provider_error",
          message: "Ambiguous request outcome.",
          operation: "create Courier Guy shipment",
          status,
        }),
      ),
      false,
    );
  }

  assert.equal(
    isCourierGuyRequestDefinitelyRejected(
      new CourierGuyApiError({
        code: "timeout",
        message: "Timed out.",
        operation: "create Courier Guy shipment",
      }),
    ),
    false,
  );
});

test("allows normal cancellation only before Courier Guy handover", () => {
  assert.deepEqual(courierGuyCancellableShipmentStatuses, [
    "booked",
    "waybill_ready",
  ]);
});

test("requires a shipment account code to match the configured token identity", () => {
  assert.equal(
    hasCourierGuyCredentialsForIdentity({
      configuredAccountCode: " JUR082 ",
      hasApiKey: true,
    }),
    true,
  );
  assert.equal(
    hasCourierGuyCredentialsForIdentity({
      configuredAccountCode: " JUR082 ",
      hasApiKey: true,
      shipmentIdentity: {
        accountCode: "JUR082",
        mode: "live",
      },
    }),
    true,
  );

  for (const accountCode of ["JUR001", "", "   ", null]) {
    assert.equal(
      hasCourierGuyCredentialsForIdentity({
        configuredAccountCode: "JUR082",
        hasApiKey: true,
        shipmentIdentity: {
          accountCode,
          mode: "live",
        },
      }),
      false,
    );
  }

  assert.equal(
    hasCourierGuyCredentialsForIdentity({
      configuredAccountCode: "JUR082",
      hasApiKey: false,
      shipmentIdentity: {
        accountCode: "JUR082",
        mode: "live",
      },
    }),
    false,
  );
  assert.equal(
    hasCourierGuyCredentialsForIdentity({
      configuredAccountCode: "JUR082",
      hasApiKey: true,
      shipmentIdentity: {
        accountCode: "JUR082",
        mode: null,
      },
    }),
    false,
  );
});

test("gets internal rates from a pickup-point drop-off without requesting collection", async () => {
  let captured;
  const client = createCourierGuyClient(config, {
    fetchImpl: async (url, init) => {
      captured = { init, url: String(url) };
      return jsonResponse({
        message: "Success",
        rates: [
          {
            estimated_delivery_from: "2026-08-01T08:00:00Z",
            estimated_delivery_to: "2026-08-03T17:00:00Z",
            rate: "149.95",
            rate_excluding_vat: "130.39",
            service_level: {
              code: "ECO",
              description: "Economy road",
              id: 42,
              name: "Economy",
            },
          },
        ],
      });
    },
  });

  const result = await client.getRates({
    collectionOrigin: pickupPointOrigin,
    deliveryAddress,
    parcels: [parcel],
  });

  assert.equal(captured.url, `${COURIER_GUY_LIVE_API_BASE_URL}/rates`);
  assert.equal(captured.init.method, "POST");
  assert.equal(
    captured.init.headers.Authorization,
    `Bearer ${config.apiKey}`,
  );

  const body = JSON.parse(captured.init.body);
  assert.equal("account_id" in body, false);
  assert.equal(body.collection_pickup_point_id, "TCG-CPT-01");
  assert.equal(body.collection_pickup_point_provider, "tcg-locker");
  assert.equal("collection_address" in body, false);
  assert.equal("special_instructions_collection" in body, false);
  assert.deepEqual(body.parcels, [
    {
      parcel_description: "Solar accessory",
      submitted_height_cm: 5,
      submitted_length_cm: 42.5,
      submitted_weight_kg: 3,
      submitted_width_cm: 38.5,
    },
  ]);
  assert.deepEqual(result.rates[0], {
    currency: "ZAR",
    estimatedDeliveryFrom: "2026-08-01T08:00:00Z",
    estimatedDeliveryTo: "2026-08-03T17:00:00Z",
    providerAmount: 149.95,
    providerAmountExcludingVat: 130.39,
    serviceCode: "ECO",
    serviceDescription: "Economy road",
    serviceLevelId: "42",
    serviceName: "Economy",
  });
});

test("creates a drop-off shipment with customer reference and no custom tracking reference", async () => {
  let capturedBody;
  const client = createCourierGuyClient(config, {
    fetchImpl: async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      return jsonResponse({
        id: 98765,
        rate: 176.5,
        short_tracking_reference: "ABC123",
        status: "awaiting-dropoff",
      });
    },
  });

  const result = await client.createShipment({
    collectionContact: {
      email: "dispatch@example.test",
      name: "Jurgens Dispatch",
    },
    collectionOrigin: pickupPointOrigin,
    customerReference: "ORDER-1001",
    customerReferenceName: "Order no.",
    deliveryAddress,
    deliveryContact: {
      mobileNumber: "+27821234567",
      name: "Customer",
    },
    parcels: [parcel],
    serviceLevelCode: "ECO",
  });

  assert.equal(capturedBody.customer_reference, "ORDER-1001");
  assert.equal(capturedBody.service_level_code, "ECO");
  assert.equal(
    capturedBody.collection_pickup_point_id,
    pickupPointOrigin.pickupPointId,
  );
  assert.equal("custom_tracking_reference" in capturedBody, false);
  assert.equal("special_instructions_collection" in capturedBody, false);
  assert.equal(result.providerShipmentId, "98765");
  assert.equal(result.providerCostAmount, 176.5);
  assert.equal(result.trackingReference, "ABC123");
});

test("rejects provider-forbidden drop-off fields before making a request", async () => {
  let requestCount = 0;
  const client = createCourierGuyClient(config, {
    fetchImpl: async () => {
      requestCount += 1;
      return jsonResponse({});
    },
  });

  await assert.rejects(
    () =>
      client.createShipment({
        collectionContact: {
          email: "dispatch@example.test",
          name: "Jurgens Dispatch",
        },
        collectionOrigin: pickupPointOrigin,
        customTrackingReference: "ORDER-1001",
        customerReference: "ORDER-1001",
        deliveryAddress,
        deliveryContact: {
          mobileNumber: "+27821234567",
          name: "Customer",
        },
        parcels: [parcel],
        serviceLevelCode: "ECO",
      }),
    (error) => {
      assert.equal(error instanceof CourierGuyApiError, true);
      assert.equal(error.code, "invalid_request");
      return true;
    },
  );
  assert.equal(requestCount, 0);
});

test("retrieves waybills using shipment and tracking identifiers", async () => {
  let capturedUrl;
  const client = createCourierGuyClient(config, {
    fetchImpl: async (url) => {
      capturedUrl = String(url);
      return jsonResponse({
        url: "https://signed-labels.example.test/waybill.pdf?expires=123",
      });
    },
  });

  const result = await client.getLabel({
    collectionEmail: "dispatch@example.test",
    shipmentId: 98765,
    trackingReference: "ABC123",
  });

  const url = new URL(capturedUrl);
  assert.equal(url.pathname, "/v2/shipments/label");
  assert.equal(url.searchParams.get("id"), "98765");
  assert.equal(url.searchParams.get("tracking_reference"), "ABC123");
  assert.equal(
    url.searchParams.get("collection_email"),
    "dispatch@example.test",
  );
  assert.equal(
    result.url,
    "https://signed-labels.example.test/waybill.pdf?expires=123",
  );
});

test("searches and normalizes actual Courier Guy pickup points", async () => {
  let captured;
  const client = createCourierGuyClient(config, {
    fetchImpl: async (url, init) => {
      captured = { init, url: String(url) };
      return jsonResponse({
        count: 4,
        pickup_points: [
          {
            address: {
              city: "Roodepoort",
              code: "2163",
              company: "The Courier Guy Johannesburg Kiosk",
              country: "South Africa",
              entered_address: "37 Malta Rd, Kya Sands, Roodepoort, 2163",
              lat: "-26.0048046",
              lng: "27.9412084",
              type: "counter",
            },
            is_hidden: false,
            name: "The Courier Guy Johannesburg Kiosk",
            pickup_point_id: "K120",
            pickup_point_provider: "tcg-locker",
            status: "online",
            trading_hours: "Monday-Friday 08:00-17:00",
            type: "counter",
          },
          {
            is_hidden: true,
            name: "Hidden point",
            pickup_point_id: "K121",
            pickup_point_provider: "tcg-locker",
          },
          {
            name: "Offline point",
            pickup_point_id: "K122",
            pickup_point_provider: "tcg-locker",
            status: "OFFLINE",
          },
          {
            name: "Unsupported provider point",
            pickup_point_id: "OTHER-1",
            pickup_point_provider: "other-network",
          },
        ],
      });
    },
  });

  const result = await client.getPickupPoints({
    search: " Cape Town ",
    type: "counter",
  });

  assert.equal(
    captured.url,
    `${COURIER_GUY_LIVE_API_BASE_URL}/pickup-points?search=Cape+Town&type=counter&limit=20&offset=0`,
  );
  assert.equal(captured.init.method, "GET");
  assert.equal(captured.init.body, undefined);
  assert.equal(
    captured.init.headers.Authorization,
    `Bearer ${config.apiKey}`,
  );
  assert.equal(captured.url.includes("account_id"), false);
  assert.equal(result.count, 4);
  assert.deepEqual(result.pickupPoints, [
    {
      address: "37 Malta Rd, Kya Sands, Roodepoort, 2163",
      latitude: -26.0048046,
      longitude: 27.9412084,
      name: "The Courier Guy Johannesburg Kiosk",
      pickupPointId: "K120",
      pickupPointProvider: "tcg-locker",
      status: "online",
      tradingHours: "Monday-Friday 08:00-17:00",
      type: "counter",
    },
  ]);
});

test("accepts null pickup-point results and omitted optional fields", async () => {
  const emptyClient = createCourierGuyClient(config, {
    fetchImpl: async () =>
      jsonResponse({
        count: 0,
        pickup_points: null,
      }),
  });
  const minimalClient = createCourierGuyClient(config, {
    fetchImpl: async () =>
      jsonResponse({
        pickup_points: [
          {
            pickup_point_id: 42,
            pickup_point_provider: "tcg-locker",
          },
        ],
      }),
  });

  assert.deepEqual(
    await emptyClient.getPickupPoints({ search: "Cape Town" }),
    { count: 0, pickupPoints: [] },
  );
  assert.deepEqual(
    await minimalClient.getPickupPoints({
      pickupPointId: "42",
      pickupPointProvider: "tcg-locker",
    }),
    {
      count: 1,
      pickupPoints: [
        {
          address: null,
          latitude: null,
          longitude: null,
          name: "Courier Guy pickup point 42",
          pickupPointId: "42",
          pickupPointProvider: "tcg-locker",
          status: null,
          tradingHours: null,
          type: null,
        },
      ],
    },
  );
});

test("requests city pickup-point suggestions ordered by proximity", async () => {
  let capturedUrl;
  const client = createCourierGuyClient(config, {
    fetchImpl: async (url) => {
      capturedUrl = String(url);
      return jsonResponse({
        count: 0,
        pickup_points: null,
      });
    },
  });

  assert.deepEqual(
    await client.getPickupPoints({
      limit: 10,
      orderClosest: true,
      search: "Paarl",
    }),
    {
      count: 0,
      pickupPoints: [],
    },
  );
  assert.equal(
    capturedUrl,
    `${COURIER_GUY_LIVE_API_BASE_URL}/pickup-points?search=Paarl&order_closest=true&limit=10&offset=0`,
  );
});

test("rejects malformed pickup-point response envelopes", async () => {
  const client = createCourierGuyClient(config, {
    fetchImpl: async () => jsonResponse({ pickup_points: "not-an-array" }),
  });

  await assert.rejects(
    () => client.getPickupPoints({ search: "Cape Town" }),
    (error) => {
      assert.equal(error instanceof CourierGuyApiError, true);
      assert.equal(error.code, "invalid_response");
      return true;
    },
  );
});

test("normalizes Courier Guy tracking events", async () => {
  const client = createCourierGuyClient(config, {
    fetchImpl: async () =>
      jsonResponse({
        shipment_id: 98765,
        shipment_collected_date: "2026-07-28T08:00:00Z",
        shipment_delivered_date: null,
        short_tracking_reference: "ABC123",
        status: "in-transit",
        tracking_events: [
          {
            date: "2026-07-29T10:00:00Z",
            id: 321,
            location: "CPT",
            message: "At hub",
            parcel_id: 654,
            source: "scanner",
            status: "at-hub",
          },
        ],
      }),
  });

  const result = await client.trackShipment({
    trackingReference: "ABC123",
  });

  assert.equal(result.providerShipmentId, "98765");
  assert.equal(result.collectedAt, "2026-07-28T08:00:00Z");
  assert.equal(result.deliveredAt, null);
  assert.equal(result.status, "in-transit");
  assert.deepEqual(result.events[0], {
    data: undefined,
    location: "CPT",
    message: "At hub",
    occurredAt: "2026-07-29T10:00:00Z",
    parcelId: "654",
    providerEventId: "321",
    source: "scanner",
    status: "at-hub",
  });
});

test("cancels a shipment by tracking reference through the documented endpoint", async () => {
  let captured;
  const client = createCourierGuyClient(config, {
    fetchImpl: async (url, init) => {
      captured = {
        body: JSON.parse(init.body),
        method: init.method,
        url: String(url),
      };
      return jsonResponse({ status: "cancelled" });
    },
  });

  const result = await client.cancelShipment({
    trackingReference: "ABC123",
  });

  assert.equal(
    captured.url,
    `${COURIER_GUY_LIVE_API_BASE_URL}/shipments/cancel`,
  );
  assert.equal(captured.method, "POST");
  assert.deepEqual(captured.body, { tracking_reference: "ABC123" });
  assert.deepEqual(
    {
      cancelled: result.cancelled,
      trackingReference: result.trackingReference,
    },
    { cancelled: true, trackingReference: "ABC123" },
  );
});

test("accepts the wrapped tracking response returned by ShipLogic", async () => {
  const client = createCourierGuyClient(config, {
    fetchImpl: async () =>
      jsonResponse({
        shipments: [
          {
            shipment_id: 98765,
            short_tracking_reference: "ABC123",
            status: "in-transit",
            tracking_events: [],
          },
        ],
      }),
  });

  const result = await client.trackShipment({
    trackingReference: "ABC123",
  });

  assert.equal(result.providerShipmentId, "98765");
  assert.equal(result.trackingReference, "ABC123");
});

test("normalizes provider errors without exposing the bearer token", async () => {
  const client = createCourierGuyClient(config, {
    fetchImpl: async () =>
      jsonResponse(
        { message: "No service levels available" },
        {
          headers: { "ship-logic-request-id": "request-123" },
          status: 400,
        },
      ),
  });

  await assert.rejects(
    () =>
      client.getRates({
        collectionOrigin: pickupPointOrigin,
        deliveryAddress,
        parcels: [parcel],
      }),
    (error) => {
      assert.equal(error instanceof CourierGuyApiError, true);
      assert.equal(error.code, "provider_error");
      assert.equal(error.status, 400);
      assert.equal(error.requestId, "request-123");
      assert.equal(error.retryable, false);
      assert.match(error.message, /No service levels available/);
      assert.equal(error.message.includes(config.apiKey), false);
      return true;
    },
  );
});

test("normalizes timeouts", async () => {
  const client = createCourierGuyClient(
    { ...config, timeoutMs: 100 },
    {
      fetchImpl: async (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    },
  );

  await assert.rejects(
    () =>
      client.trackShipment({
        trackingReference: "ABC123",
      }),
    (error) => {
      assert.equal(error instanceof CourierGuyApiError, true);
      assert.equal(error.code, "timeout");
      assert.equal(error.retryable, true);
      return true;
    },
  );
});
