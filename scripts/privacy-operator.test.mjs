import assert from "node:assert/strict";
import test from "node:test";

import { createPrivacyResponsiblePartyStatement } from "../src/modules/marketplace/policies/privacy-operator.ts";

test("privacy copy names the configured legal entity and trading name", () => {
  const statement = createPrivacyResponsiblePartyStatement({
    legalName: "Bevgo (Pty) Ltd",
    tradingName: "Jurgens Energy",
  });

  assert.match(statement, /^Bevgo \(Pty\) Ltd, trading as Jurgens Energy/);
  assert.match(statement, /is the responsible party/);
});

test("privacy copy does not duplicate equivalent legal and trading names", () => {
  const statement = createPrivacyResponsiblePartyStatement({
    legalName: " Jurgens   Energy ",
    tradingName: "Jurgens Energy",
  });

  assert.match(statement, /^Jurgens Energy operates/);
  assert.doesNotMatch(statement, /trading as/);
});

test("privacy copy has a safe public-name fallback while setup is incomplete", () => {
  const statement = createPrivacyResponsiblePartyStatement({
    legalName: null,
    tradingName: "",
  });

  assert.match(statement, /^Jurgens Energy operates/);
});
