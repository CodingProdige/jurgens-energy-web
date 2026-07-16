import assert from "node:assert/strict";
import test from "node:test";

import {
  createPayFastItnParameterString,
  createPayFastItnSignature,
  createPayFastParameterString,
  createPayFastSignature,
} from "../src/modules/checkout/payfast-signature.ts";

const fields = [
  { name: "merchant_id", value: "10000100" },
  { name: "m_payment_id", value: "payment-123" },
  { name: "payment_status", value: "COMPLETE" },
  { name: "amount_gross", value: "1152.99" },
  { name: "custom_str1", value: "order-123" },
  { name: "custom_str2", value: "" },
  { name: "custom_int1", value: "" },
  { name: "signature", value: "provider-signature" },
];
const passphrase = "safe-test-passphrase";

test("checkout signing omits empty optional fields", () => {
  assert.equal(
    createPayFastParameterString(fields, passphrase),
    "merchant_id=10000100&m_payment_id=payment-123&payment_status=COMPLETE&amount_gross=1152.99&custom_str1=order-123&passphrase=safe-test-passphrase",
  );
  assert.equal(createPayFastSignature(fields, passphrase), "fa212fdb1bb386550585ba45d2a2a3af");
});

test("ITN signing and validation retain empty callback fields", () => {
  assert.equal(
    createPayFastItnParameterString(fields, passphrase),
    "merchant_id=10000100&m_payment_id=payment-123&payment_status=COMPLETE&amount_gross=1152.99&custom_str1=order-123&custom_str2=&custom_int1=&passphrase=safe-test-passphrase",
  );
  assert.equal(createPayFastItnSignature(fields, passphrase), "bf1377911128d11df772c4f3bf60bc71");
});
