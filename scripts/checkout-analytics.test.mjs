import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  advanceCheckoutAnalyticsLifecycle,
  checkoutAnalyticsEventInputSchema,
  checkoutAnalyticsEventNames,
  checkoutAnalyticsPublicEventInputSchema,
  checkoutAnalyticsSessionStatuses,
  classifyCheckoutDevice,
  isSameOriginCheckoutAnalyticsRequest,
} from "../src/modules/analytics/checkout-contracts.ts";

const sessionId = "32f2842a-bb8e-44c4-886d-a23b295d45ea";
const eventId = "67074af3-6c01-4f63-84a1-f43ad4f6314a";

test("defines the complete first-party checkout funnel without a stored abandoned status", () => {
  assert.deepEqual(checkoutAnalyticsEventNames, [
    "add_to_cart",
    "started",
    "address_completed",
    "shipping_completed",
    "payment_reached",
    "payment_attempted",
    "payfast_redirected",
    "order_created",
    "payment_confirmed",
    "checkout_failed",
    "payment_cancelled",
  ]);
  assert.deepEqual(checkoutAnalyticsSessionStatuses, [
    "active",
    "completed",
    "failed",
  ]);
  assert.equal(checkoutAnalyticsSessionStatuses.includes("abandoned"), false);
});

test("normalizes privacy-minimal checkout event context", () => {
  const parsed = checkoutAnalyticsPublicEventInputSchema.parse({
    cart: {
      currency: " zar ",
      itemCount: 2,
      totalQuantity: 3,
      value: 1234.567,
    },
    event: "started",
    eventId,
    landingPath: "/checkout",
    referrerHost: " GOOGLE.COM ",
    sessionId,
  });

  assert.deepEqual(parsed.cart, {
    currency: "ZAR",
    itemCount: 2,
    totalQuantity: 3,
    value: 1234.57,
  });
  assert.equal(parsed.referrerHost, "google.com");
});

test("strict public validation rejects server linkage, PII extras, and unsafe values", () => {
  assert.equal(
    checkoutAnalyticsPublicEventInputSchema.safeParse({
      customerEmail: "customer@example.com",
      event: "started",
      eventId,
      sessionId,
    }).success,
    false,
  );
  assert.equal(
    checkoutAnalyticsPublicEventInputSchema.safeParse({
      event: "payfast_redirected",
      eventId,
      orderId: "b0e89b2d-546c-42f7-b605-9899db1bc88c",
      sessionId,
    }).success,
    false,
  );
  assert.equal(
    checkoutAnalyticsPublicEventInputSchema.safeParse({
      deviceCategory: "desktop",
      event: "started",
      eventId,
      sessionId,
      userId: "158c3663-4f89-428c-b9c7-8bb463f49a72",
    }).success,
    false,
  );
  assert.equal(
    checkoutAnalyticsPublicEventInputSchema.safeParse({
      event: "started",
      eventId,
      landingPath: "/checkout?email=customer@example.com",
      sessionId,
    }).success,
    false,
  );
  assert.equal(
    checkoutAnalyticsPublicEventInputSchema.safeParse({
      event: "checkout_failed",
      eventId,
      sessionId,
    }).success,
    false,
  );
  assert.equal(
    checkoutAnalyticsPublicEventInputSchema.safeParse({
      errorCode: "payment_failed",
      event: "payment_reached",
      eventId,
      sessionId,
    }).success,
    false,
  );
  assert.equal(
    checkoutAnalyticsEventInputSchema.safeParse({
      event: "order_created",
      eventId,
      orderId: "b0e89b2d-546c-42f7-b605-9899db1bc88c",
      sessionId,
    }).success,
    true,
    "the server-only service contract still accepts an order link",
  );
});

test("add-to-cart accepts only product identifiers and a positive quantity", () => {
  assert.equal(
    checkoutAnalyticsPublicEventInputSchema.safeParse({
      event: "add_to_cart",
      eventId,
      landingPath: "/products/example",
      product: {
        productId: "158c3663-4f89-428c-b9c7-8bb463f49a72",
        quantity: 2,
        variantId: "b0e89b2d-546c-42f7-b605-9899db1bc88c",
      },
      sessionId,
    }).success,
    true,
  );
  assert.equal(
    checkoutAnalyticsPublicEventInputSchema.safeParse({
      event: "add_to_cart",
      eventId,
      sessionId,
    }).success,
    false,
  );
  assert.equal(
    checkoutAnalyticsPublicEventInputSchema.safeParse({
      event: "started",
      eventId,
      product: {
        productId: "158c3663-4f89-428c-b9c7-8bb463f49a72",
        quantity: 1,
        variantId: "b0e89b2d-546c-42f7-b605-9899db1bc88c",
      },
      sessionId,
    }).success,
    false,
  );
});

test("advances failed sessions through retry and keeps completion terminal", () => {
  const startedAt = new Date("2026-08-09T08:00:00.000Z");
  const failedAt = new Date("2026-08-09T08:03:00.000Z");
  const completedAt = new Date("2026-08-09T08:08:00.000Z");
  const initial = {
    completedAt: null,
    failedAt: null,
    latestStep: "started",
    status: "active",
  };
  const failed = advanceCheckoutAnalyticsLifecycle({
    current: initial,
    event: "checkout_failed",
    occurredAt: failedAt,
  });
  const retried = advanceCheckoutAnalyticsLifecycle({
    current: failed,
    event: "payment_attempted",
    occurredAt: new Date("2026-08-09T08:05:00.000Z"),
  });
  const completed = advanceCheckoutAnalyticsLifecycle({
    current: retried,
    event: "payment_confirmed",
    occurredAt: completedAt,
  });
  const lateFailure = advanceCheckoutAnalyticsLifecycle({
    current: completed,
    event: "checkout_failed",
    occurredAt: new Date("2026-08-09T08:09:00.000Z"),
  });

  assert.equal(startedAt < failedAt, true);
  assert.equal(failed.status, "failed");
  assert.equal(failed.failedAt, failedAt);
  assert.equal(retried.status, "active");
  assert.equal(retried.failedAt, failedAt);
  assert.equal(completed.status, "completed");
  assert.equal(completed.completedAt, completedAt);
  assert.deepEqual(lateFailure, completed);
});

test("keeps active funnel progress monotonic when browser events arrive late", () => {
  const orderCreated = {
    completedAt: null,
    failedAt: null,
    latestStep: "order_created",
    status: "active",
  };
  const delayedRedirect = advanceCheckoutAnalyticsLifecycle({
    current: orderCreated,
    event: "payfast_redirected",
    occurredAt: new Date("2026-08-09T08:01:00.000Z"),
  });
  const delayedStart = advanceCheckoutAnalyticsLifecycle({
    current: delayedRedirect,
    event: "started",
    occurredAt: new Date("2026-08-09T08:02:00.000Z"),
  });
  const delayedCartAdd = advanceCheckoutAnalyticsLifecycle({
    current: delayedStart,
    event: "add_to_cart",
    occurredAt: new Date("2026-08-09T08:03:00.000Z"),
  });

  assert.deepEqual(delayedRedirect, orderCreated);
  assert.deepEqual(delayedStart, orderCreated);
  assert.deepEqual(delayedCartAdd, orderCreated);
});

test("classifies only a coarse device category", () => {
  assert.equal(
    classifyCheckoutDevice(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148",
    ),
    "mobile",
  );
  assert.equal(
    classifyCheckoutDevice("Mozilla/5.0 (Linux; Android 14; Pixel Tablet)"),
    "tablet",
  );
  assert.equal(
    classifyCheckoutDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)"),
    "desktop",
  );
  assert.equal(classifyCheckoutDevice(null), "unknown");
});

test("requires an explicitly allowed same-origin analytics request", () => {
  const allowedOrigins = new Set(["https://jurgensenergy.com"]);

  assert.equal(
    isSameOriginCheckoutAnalyticsRequest({
      allowedOrigins,
      origin: "https://jurgensenergy.com",
      requestHost: "jurgensenergy.com",
    }),
    true,
  );
  assert.equal(
    isSameOriginCheckoutAnalyticsRequest({
      allowedOrigins,
      origin: "https://attacker.example",
      requestHost: "jurgensenergy.com",
    }),
    false,
  );
  assert.equal(
    isSameOriginCheckoutAnalyticsRequest({
      allowedOrigins,
      origin: null,
      requestHost: "jurgensenergy.com",
    }),
    false,
  );
});

test("migration stores no raw IP, user agent, or customer contact fields", async () => {
  const [migration, cartMigration, service] = await Promise.all([
    readFile(
      new URL("../src/db/migrations/0103_checkout_analytics.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/db/migrations/0105_cart_journey_analytics.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/modules/analytics/checkout.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(migration, /checkout_analytics_sessions_status_last_seen_at_idx/);
  assert.match(migration, /checkout_analytics_events_event_name_occurred_at_idx/);
  assert.match(migration, /"id" uuid PRIMARY KEY NOT NULL/);
  assert.doesNotMatch(migration, /ip_address|user_agent|customer_email|customer_phone/);
  assert.match(service, /pg_advisory_xact_lock\(hashtext/);
  assert.match(service, /onConflictDoNothing\(\{ target: checkoutAnalyticsEvents\.id \}\)/);
  assert.match(cartMigration, /'add_to_cart' BEFORE 'started'/);
  assert.match(cartMigration, /"cart_started_at" timestamp/);
  assert.match(cartMigration, /"checkout_started_at" timestamp/);
  assert.match(cartMigration, /"last_cart_activity_at" timestamp/);
  assert.match(cartMigration, /"quantity_delta" integer/);
  assert.doesNotMatch(
    cartMigration,
    /ip_address|user_agent|customer_email|customer_phone/,
  );
});

test("cart additions use a stable commerce journey and trusted server snapshots", async () => {
  const [client, cart, service] = await Promise.all([
    readFile(
      new URL("../src/modules/analytics/checkout-client.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/modules/cart/local-cart.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/modules/analytics/checkout.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(client, /jurgens:analytics:commerce-session:v2/);
  assert.match(client, /LEGACY_CHECKOUT_ANALYTICS_SESSION_STORAGE_KEY/);
  assert.doesNotMatch(client, /existing\.cartSignature === cartSignature/);
  assert.match(cart, /recordAddToCartAnalyticsEvent/);
  assert.match(
    cart,
    /recordLocalCartAddition\(item, nextQuantity - item\.quantity\)/,
  );
  assert.match(service, /innerJoin\(products/);
  assert.match(service, /linkedProduct\.productId !== parsed\.product\.productId/);
  assert.match(service, /productTitleSnapshot: productSnapshot\?\.productTitle/);
  assert.match(service, /brandNameSnapshot: productSnapshot\?\.brandName/);
  assert.match(service, /CheckoutAnalyticsCompletedSessionError/);
  assert.match(client, /analytics_session_completed/);
});

test("commerce session survives cart signature changes and migrates legacy checkout state", async () => {
  const storage = new Map();
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  globalThis.window = {
    location: {
      origin: "https://jurgensenergy.com",
      pathname: "/products/example",
    },
    sessionStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      removeItem(key) {
        storage.delete(key);
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
  };
  globalThis.document = { referrer: "" };

  try {
    const {
      completeCheckoutAnalyticsSession,
      getOrCreateCheckoutAnalyticsSession,
    } = await import("../src/modules/analytics/checkout-client.ts");
    const first = getOrCreateCheckoutAnalyticsSession("cart-a", 1_000);
    const changedCart = getOrCreateCheckoutAnalyticsSession("cart-b", 2_000);
    const expired = getOrCreateCheckoutAnalyticsSession(
      "cart-b",
      2_000 + 30 * 60 * 1_000 + 1,
    );

    assert.ok(first);
    assert.equal(changedCart, first);
    assert.notEqual(expired, first);

    completeCheckoutAnalyticsSession();
    storage.set(
      "jurgens:analytics:checkout-session:v1",
      JSON.stringify({
        cartSignature: "legacy-cart",
        lastActivityAt: 4_000,
        sessionId,
        version: 1,
      }),
    );

    assert.equal(
      getOrCreateCheckoutAnalyticsSession("changed-legacy-cart", 5_000),
      sessionId,
    );
    assert.equal(
      storage.has("jurgens:analytics:checkout-session:v1"),
      false,
    );
    assert.equal(
      storage.has("jurgens:analytics:commerce-session:v2"),
      true,
    );
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }

    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  }
});

test("a completed session rotates once before recording a new cart addition", async () => {
  const requests = [];
  const storage = new Map();
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  let finishSecondRequest;
  const secondRequest = new Promise((resolve) => {
    finishSecondRequest = resolve;
  });

  globalThis.window = {
    location: {
      origin: "https://jurgensenergy.com",
      pathname: "/products/example",
    },
    sessionStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      removeItem(key) {
        storage.delete(key);
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
  };
  globalThis.document = { referrer: "" };
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));

    if (requests.length === 1) {
      return Response.json(
        { error: "analytics_session_completed" },
        { status: 409 },
      );
    }

    finishSecondRequest();
    return Response.json({ ok: true }, { status: 201 });
  };

  try {
    const { recordAddToCartAnalyticsEvent } = await import(
      "../src/modules/analytics/checkout-client.ts"
    );

    recordAddToCartAnalyticsEvent({
      productId: "158c3663-4f89-428c-b9c7-8bb463f49a72",
      quantity: 1,
      variantId: "b0e89b2d-546c-42f7-b605-9899db1bc88c",
    });
    await secondRequest;

    assert.equal(requests.length, 2);
    assert.notEqual(requests[0].sessionId, requests[1].sessionId);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }

    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }

    if (originalFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }
  }
});

test("checkout and PayFast lifecycle are wired to first-party telemetry", async () => {
  const [checkout, contracts, orders, payfastItn, cancellation] =
    await Promise.all([
      readFile(
        new URL(
          "../components/marketplace/checkout-experience.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../src/modules/checkout/contracts.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/modules/checkout/orders.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/modules/checkout/payfast-itn.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/(marketplace)/checkout/cancel/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  assert.match(checkout, /getOrCreateCheckoutAnalyticsSession/);
  assert.match(checkout, /recordInternalCheckoutEvent\("started"\)/);
  assert.match(checkout, /recordInternalCheckoutEvent\("address_completed"\)/);
  assert.match(checkout, /recordInternalCheckoutEvent\("shipping_completed"\)/);
  assert.match(checkout, /recordInternalCheckoutEvent\("payment_reached"\)/);
  assert.match(checkout, /recordInternalCheckoutEvent\("payment_attempted"/);
  assert.match(checkout, /recordInternalCheckoutEvent\("payfast_redirected"\)/);
  assert.match(checkout, /recordInternalCheckoutEvent\("checkout_failed"/);
  assert.match(contracts, /checkoutAnalyticsSessionId: z\.string\(\)\.uuid\(\)\.optional\(\)/);
  assert.match(orders, /event: "order_created"/);
  assert.match(payfastItn, /event: "payment_confirmed"/);
  assert.match(payfastItn, /errorCode: "payfast_payment_failed"/);
  assert.match(cancellation, /event: "payment_cancelled"/);
});
