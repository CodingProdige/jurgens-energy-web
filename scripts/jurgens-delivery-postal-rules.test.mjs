import assert from "node:assert/strict";
import test from "node:test";

import {
  findJurgensDeliveryPostalCodeConflicts,
  jurgensDeliveryPostalCodeMatchesRule,
  normalizeJurgensDeliveryPostalCodeRules,
  resolveJurgensDeliveryPostalZone,
} from "../src/modules/shipping/jurgens-delivery-postal-rules.ts";

test("normalizes and deduplicates delivery postal-code rules", () => {
  assert.deepEqual(
    normalizeJurgensDeliveryPostalCodeRules([
      " 7646 ",
      "76 *",
      "7646",
      " 7600 - 7699 ",
    ]),
    ["7646", "76*", "7600-7699"],
  );
});

test("matches exact, range, and prefix wildcard rules", () => {
  assert.equal(jurgensDeliveryPostalCodeMatchesRule("7646", "7646"), true);
  assert.equal(
    jurgensDeliveryPostalCodeMatchesRule("7646", "7600-7699"),
    true,
  );
  assert.equal(jurgensDeliveryPostalCodeMatchesRule("7646", "76*"), true);
  assert.equal(jurgensDeliveryPostalCodeMatchesRule("7700", "76*"), false);
});

test("detects exact codes that overlap existing ranges", () => {
  const conflicts = findJurgensDeliveryPostalCodeConflicts({
    candidatePostalCodes: ["7599", "7625"],
    existingZones: [
      {
        id: "greater-cape-town",
        name: "Greater Cape Town",
        postalCodes: ["7400-7599"],
      },
      {
        id: "paarl",
        name: "Paarl, Wellington and Franschhoek",
        postalCodes: ["7620-7626"],
      },
    ],
  });

  assert.deepEqual(
    conflicts.map((conflict) => ({
      existingZoneName: conflict.existingZoneName,
      postalCode: conflict.postalCode,
    })),
    [
      { existingZoneName: "Greater Cape Town", postalCode: "7599" },
      {
        existingZoneName: "Paarl, Wellington and Franschhoek",
        postalCode: "7625",
      },
    ],
  );
});

test("detects range, wildcard, and reversed-range overlaps", () => {
  const conflicts = findJurgensDeliveryPostalCodeConflicts({
    candidatePostalCodes: ["7600-7699", "80*"],
    existingZones: [
      {
        id: "one",
        name: "One",
        postalCodes: ["7650-7550"],
      },
      {
        id: "two",
        name: "Two",
        postalCodes: ["8000-8099"],
      },
    ],
  });

  assert.deepEqual(
    conflicts.map((conflict) => conflict.postalCode),
    ["7600", "8000"],
  );
});

test("detects nested wildcard overlaps and returns a concrete postal code", () => {
  const conflicts = findJurgensDeliveryPostalCodeConflicts({
    candidatePostalCodes: ["76*"],
    existingZones: [
      { id: "stellenbosch", name: "Stellenbosch", postalCodes: ["760*"] },
    ],
  });

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.postalCode, "7600");
});

test("does not report disjoint postal-code rules", () => {
  assert.deepEqual(
    findJurgensDeliveryPostalCodeConflicts({
      candidatePostalCodes: ["7600-7699", "80*"],
      existingZones: [
        { id: "one", name: "One", postalCodes: ["7400-7599"] },
        { id: "two", name: "Two", postalCodes: ["81*"] },
      ],
    }),
    [],
  );
});

test("fails closed instead of silently selecting an overlapping active zone", () => {
  const zones = [
    {
      id: "greater-cape-town",
      name: "Greater Cape Town",
      postalCodes: ["7400-7599"],
    },
    {
      id: "stellenbosch",
      name: "Stellenbosch",
      postalCodes: ["7599"],
    },
  ];

  assert.deepEqual(resolveJurgensDeliveryPostalZone("7500", zones), {
    status: "matched",
    zone: zones[0],
  });
  assert.deepEqual(resolveJurgensDeliveryPostalZone("9999", zones), {
    status: "none",
  });
  assert.deepEqual(resolveJurgensDeliveryPostalZone("7599", zones), {
    status: "conflict",
    zones,
  });
});
