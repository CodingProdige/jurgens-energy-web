import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CHECKOUT_STEPS,
  getCheapestCheckoutShippingOption,
  getSingleOrderShippingTotal,
  isCheckoutAddressStepReady,
  isCheckoutShippingStepReady,
} from "../src/modules/checkout/flow.ts";
import { hasCourierGuySandboxCheckoutAccess } from "../src/modules/checkout/sandbox-access.ts";
import { calculateCheckoutIncludedVatCents } from "../src/modules/checkout/totals.ts";
import { getCheckoutTaxSummaryLabel } from "../src/modules/tax/vat-display.ts";
import {
  CHECKOUT_INVOICE_FAST_POLL_ATTEMPTS,
  CHECKOUT_PAYMENT_FAST_POLL_ATTEMPTS,
  getCheckoutStatusPollDelay,
  getConfirmedPurchasedVariantIds,
  isCheckoutPaymentConfirmed,
  selectCheckoutPaymentConfirmation,
} from "../src/modules/checkout/payment-confirmation.ts";

const checkoutExperienceSource = readFileSync(
  new URL(
    "../components/marketplace/checkout-experience.tsx",
    import.meta.url,
  ),
  "utf8",
);
const customerShippingQuoteSource = readFileSync(
  new URL(
    "../src/modules/shipping/customer-shipping-quote.ts",
    import.meta.url,
  ),
  "utf8",
);
const customerDeliveryEvaluationSource = readFileSync(
  new URL(
    "../src/modules/shipping/customer-delivery-evaluation.ts",
    import.meta.url,
  ),
  "utf8",
);
const orderReturnExperienceSource = readFileSync(
  new URL(
    "../components/marketplace/order-return-experience.tsx",
    import.meta.url,
  ),
  "utf8",
);
const payFastRedirectSource = readFileSync(
  new URL(
    "../components/marketplace/payfast-redirect-form.tsx",
    import.meta.url,
  ),
  "utf8",
);
const checkoutCancelSource = readFileSync(
  new URL(
    "../app/(marketplace)/checkout/cancel/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const checkoutOrdersSource = readFileSync(
  new URL("../src/modules/checkout/orders.ts", import.meta.url),
  "utf8",
);
const checkoutIdempotencyMigrationSource = readFileSync(
  new URL(
    "../src/db/migrations/0086_checkout_request_idempotency.sql",
    import.meta.url,
  ),
  "utf8",
);

test("defines the checkout steps in customer-facing order", () => {
  assert.deepEqual(CHECKOUT_STEPS, ["address", "shipping", "payment"]);
});

test("restricts Courier Guy sandbox checkout to settings-managing admins", () => {
  assert.equal(hasCourierGuySandboxCheckoutAccess(null), false);
  assert.equal(
    hasCourierGuySandboxCheckoutAccess({
      adminCapabilities: ["admin.settings.manage"],
      roles: ["customer"],
    }),
    false,
  );
  assert.equal(
    hasCourierGuySandboxCheckoutAccess({
      adminCapabilities: ["admin.settings.view"],
      roles: ["admin"],
    }),
    false,
  );
  assert.equal(
    hasCourierGuySandboxCheckoutAccess({
      adminCapabilities: ["admin.settings.manage"],
      roles: ["admin"],
    }),
    true,
  );
  assert.equal(
    hasCourierGuySandboxCheckoutAccess({
      adminCapabilities: ["admin.settings.manage"],
      roles: ["superadmin"],
    }),
    true,
  );
});

test("returns null when no checkout shipping options are available", () => {
  assert.equal(getCheapestCheckoutShippingOption([]), null);
});

test("selects the checkout shipping option with the lowest amount", () => {
  const options = [
    { amountZar: 149, quoteId: "standard" },
    { amountZar: 89, quoteId: "economy" },
    { amountZar: 199, quoteId: "express" },
  ];

  assert.strictEqual(getCheapestCheckoutShippingOption(options), options[1]);
});

test("keeps the first checkout shipping option when amounts are equal", () => {
  const options = [
    { amountZar: 99, quoteId: "first" },
    { amountZar: 99, quoteId: "second" },
  ];

  assert.strictEqual(getCheapestCheckoutShippingOption(options), options[0]);
});

test("charges exactly one order-level delivery fee", () => {
  const groups = [
    {
      groupKey: "delivery",
      options: [{ amountZar: 125, quoteId: "policy-quote" }],
    },
  ];

  assert.equal(
    getSingleOrderShippingTotal(groups, { delivery: "policy-quote" }),
    125,
  );
  assert.throws(
    () =>
      getSingleOrderShippingTotal(
        [
          ...groups,
          {
            groupKey: "legacy-second-group",
            options: [{ amountZar: 80, quoteId: "legacy-quote" }],
          },
        ],
        {
          delivery: "policy-quote",
          "legacy-second-group": "legacy-quote",
        },
      ),
    /exactly one order-level delivery group/,
  );
});

test("shows the VAT already included in products and delivery", () => {
  assert.equal(
    calculateCheckoutIncludedVatCents({
      items: [
        {
          quantity: 1,
          taxRateBps: 1_500,
          unitPriceZar: 1_152.99,
        },
      ],
      shippingTotalZar: 120,
    }),
    16_604,
  );
});

test("calculates checkout VAT per line instead of applying one rate to the total", () => {
  assert.equal(
    calculateCheckoutIncludedVatCents({
      items: [
        {
          quantity: 2,
          taxRateBps: 1_500,
          unitPriceZar: 57.5,
        },
        {
          quantity: 1,
          taxRateBps: 0,
          unitPriceZar: 230,
        },
      ],
      shippingTotalZar: 0,
    }),
    1_500,
  );
});

test("matches invoice line rounding and adds no VAT for free delivery", () => {
  assert.equal(
    calculateCheckoutIncludedVatCents({
      items: [
        {
          quantity: 3,
          taxRateBps: 1_500,
          unitPriceZar: 0.05,
        },
      ],
      shippingTotalZar: 0,
    }),
    2,
  );
});

test("keeps private courier costs out of customer-facing checkout copy", () => {
  const publicCheckoutSource = [
    checkoutExperienceSource,
    customerDeliveryEvaluationSource,
    customerShippingQuoteSource,
  ].join("\n");

  assert.match(
    publicCheckoutSource,
    /deliveryInformation: getPublicDeliveryTimingDescription\(settings\)/,
  );
  assert.doesNotMatch(
    publicCheckoutSource,
    /carrier costs|courier charges are reconciled|handled privately/i,
  );
});

test("labels checkout tax accurately without adding it to total", () => {
  assert.match(checkoutExperienceSource, /<span>\{taxSummaryLabel\}<\/span>/);
  assert.equal(getCheckoutTaxSummaryLabel(true), "Included VAT");
  assert.equal(getCheckoutTaxSummaryLabel(false), "No VAT charged");
  assert.equal(
    (checkoutExperienceSource.match(/const grandTotal = subtotal \+ shippingTotal;/g) ??
      []).length,
    1,
  );
});

test("preserves the cart until PayFast and the local payment are both confirmed", () => {
  const unconfirmedStates = [
    {
      paymentStatus: "pending",
      providerStatus: null,
      status: "pending",
    },
    {
      paymentStatus: "failed",
      providerStatus: "FAILED",
      status: "cancelled",
    },
    {
      paymentStatus: "failed",
      providerStatus: "FAILED",
      status: "paid",
    },
    {
      paymentStatus: "captured",
      providerStatus: null,
      status: "paid",
    },
    {
      paymentStatus: "pending",
      providerStatus: "COMPLETE",
      status: "paid",
    },
  ];

  for (const state of unconfirmedStates) {
    assert.equal(isCheckoutPaymentConfirmed(state), false);
    assert.deepEqual(
      getConfirmedPurchasedVariantIds({
        ...state,
        purchasedVariantIds: ["variant-1"],
      }),
      [],
    );
  }
});

test("removes only purchased variants after a fully captured PayFast payment", () => {
  const confirmation = {
    paymentStatus: "captured",
    providerStatus: "complete",
    purchasedVariantIds: ["variant-1", "variant-2", "variant-1", " "],
    status: "paid",
  };

  assert.equal(isCheckoutPaymentConfirmed(confirmation), true);
  assert.deepEqual(getConfirmedPurchasedVariantIds(confirmation), [
    "variant-1",
    "variant-2",
  ]);
  assert.equal(
    isCheckoutPaymentConfirmed({
      ...confirmation,
      status: "fulfilled",
    }),
    true,
  );
});

test("keeps polling with backoff after payment or invoice confirmation is delayed", () => {
  assert.equal(CHECKOUT_PAYMENT_FAST_POLL_ATTEMPTS, 30);
  assert.equal(CHECKOUT_INVOICE_FAST_POLL_ATTEMPTS, 8);

  assert.equal(
    getCheckoutStatusPollDelay({
      completedAttempts: 29,
      paymentConfirmed: false,
    }),
    2_000,
  );
  assert.equal(
    getCheckoutStatusPollDelay({
      completedAttempts: 30,
      paymentConfirmed: false,
    }),
    10_000,
  );
  assert.equal(
    getCheckoutStatusPollDelay({
      completedAttempts: 54,
      paymentConfirmed: false,
    }),
    30_000,
  );
  assert.equal(
    getCheckoutStatusPollDelay({
      completedAttempts: 8,
      paymentConfirmed: true,
    }),
    10_000,
  );
});

test("prefers a captured PayFast attempt when a paid order has a newer retry", () => {
  assert.deepEqual(
    selectCheckoutPaymentConfirmation({
      orderStatus: "paid",
      payments: [
        { providerStatus: null, status: "pending" },
        { providerStatus: "COMPLETE", status: "captured" },
      ],
    }),
    {
      paymentStatus: "captured",
      providerStatus: "COMPLETE",
      status: "paid",
    },
  );
});

test("never mutates the cart during PayFast handoff, cancellation, or failure", () => {
  for (const source of [
    checkoutExperienceSource,
    payFastRedirectSource,
    checkoutCancelSource,
  ]) {
    assert.doesNotMatch(
      source,
      /removeLocalCart|localStorage\.(?:clear|removeItem)/,
    );
  }

  assert.match(
    orderReturnExperienceSource,
    /getConfirmedPurchasedVariantIds\(order\)/,
  );
  assert.match(
    orderReturnExperienceSource,
    /removeLocalCartItems\(confirmedPurchasedVariantIds\)/,
  );
  assert.match(
    orderReturnExperienceSource,
    /PAID_ORDER_CART_CLEANUP_STORAGE_PREFIX/,
  );
});

test("rechecks the saved cart after browser-back restoration and bounds validation", () => {
  assert.match(
    checkoutExperienceSource,
    /window\.addEventListener\("pageshow", handlePageShow\)/,
  );
  assert.match(checkoutExperienceSource, /10_000/);
  assert.match(checkoutExperienceSource, /Reload checkout/);
});

test("replays one hosted order for the same checkout submission", () => {
  assert.match(checkoutExperienceSource, /getStableCheckoutRequestId/);
  assert.match(checkoutExperienceSource, /window\.sessionStorage\.setItem/);
  assert.match(checkoutOrdersSource, /createStableCheckoutToken/);
  assert.match(checkoutOrdersSource, /pg_advisory_xact_lock/);
  assert.match(
    checkoutOrdersSource,
    /eq\(orders\.checkoutRequestId, parsed\.checkoutRequestId\)/,
  );
  assert.ok(
    checkoutOrdersSource.indexOf(
      "const replay = await getIdempotentCheckoutReplay",
    ) <
      checkoutOrdersSource.indexOf(
        "const cart = await validateCartLines",
      ),
    "an existing checkout must be replayed before its reserved stock is revalidated",
  );
  assert.match(
    checkoutIdempotencyMigrationSource,
    /CREATE UNIQUE INDEX IF NOT EXISTS "orders_checkout_request_id_unique"/,
  );
});

test("allows the address step to continue when every requirement is complete", () => {
  assert.equal(
    isCheckoutAddressStepReady({
      addressBookChoiceComplete: true,
      addressComplete: true,
      customerComplete: true,
    }),
    true,
  );
});

test("keeps the address step blocked for each incomplete requirement", () => {
  const ready = {
    addressBookChoiceComplete: true,
    addressComplete: true,
    customerComplete: true,
  };

  for (const field of Object.keys(ready)) {
    assert.equal(
      isCheckoutAddressStepReady({ ...ready, [field]: false }),
      false,
      `${field} should block the address step`,
    );
  }
});

test("allows the shipping step to continue when quotes and schedule are valid", () => {
  assert.equal(
    isCheckoutShippingStepReady({
      allGroupsAvailable: true,
      hasQuoteError: false,
      isLoadingQuotes: false,
      scheduleValid: true,
    }),
    true,
  );
});

test("keeps the shipping step blocked while rates are incomplete or invalid", () => {
  assert.equal(
    isCheckoutShippingStepReady({
      allGroupsAvailable: false,
      hasQuoteError: false,
      isLoadingQuotes: false,
      scheduleValid: true,
    }),
    false,
  );
  assert.equal(
    isCheckoutShippingStepReady({
      allGroupsAvailable: true,
      hasQuoteError: false,
      isLoadingQuotes: true,
      scheduleValid: true,
    }),
    false,
  );
  assert.equal(
    isCheckoutShippingStepReady({
      allGroupsAvailable: true,
      hasQuoteError: true,
      isLoadingQuotes: false,
      scheduleValid: true,
    }),
    false,
  );
  assert.equal(
    isCheckoutShippingStepReady({
      allGroupsAvailable: true,
      hasQuoteError: false,
      isLoadingQuotes: false,
      scheduleValid: false,
    }),
    false,
  );
});
