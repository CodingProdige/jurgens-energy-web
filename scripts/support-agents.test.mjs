import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { supportAgentInputSchema } from "../src/modules/support-agents/contracts.ts";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const publicServiceSource = read("src/modules/support-agents/server.ts");
const publicTeamSource = read("components/marketplace/public-support-team.tsx");
const supportAgentManagerSource = read(
  "app/(admin)/admin/(dashboard)/settings/platform/support-team/support-agent-manager.tsx",
);

function validAgentInput(overrides = {}) {
  return {
    availability: "Mon–Fri, 08:00–17:00 SAST",
    bio: "Helps customers with products and orders.",
    displayName: "Jurgens Support",
    isPublished: true,
    photoMediaId: null,
    publicEmail: " SUPPORT@EXAMPLE.COM ",
    publicPhone: "082 123 4567",
    publicWhatsapp: "082 765 4321",
    roleTitle: "Customer Support",
    showInFooter: true,
    showOnAbout: true,
    showOnSupport: true,
    ...overrides,
  };
}

test("normalizes explicit public contacts before they are persisted", () => {
  const parsed = supportAgentInputSchema.parse(validAgentInput());

  assert.equal(parsed.publicEmail, "support@example.com");
  assert.equal(parsed.publicPhone, "+27821234567");
  assert.equal(parsed.publicWhatsapp, "+27827654321");
});

test("requires an explicit contact for every published public placement", () => {
  const noContact = {
    publicEmail: null,
    publicPhone: null,
    publicWhatsapp: null,
  };

  assert.equal(
    supportAgentInputSchema.safeParse(validAgentInput(noContact)).success,
    false,
  );
  assert.equal(
    supportAgentInputSchema.safeParse(
      validAgentInput({ ...noContact, isPublished: false }),
    ).success,
    true,
  );
  assert.equal(
    supportAgentInputSchema.safeParse(
      validAgentInput({
        ...noContact,
        showInFooter: false,
        showOnAbout: false,
        showOnSupport: false,
      }),
    ).success,
    true,
  );
});

test("rejects malformed public phone and WhatsApp values", () => {
  for (const publicPhone of ["not a phone", "123", "javascript:alert(1)"]) {
    assert.equal(
      supportAgentInputSchema.safeParse(
        validAgentInput({ publicPhone, publicWhatsapp: null }),
      ).success,
      false,
    );
  }
});

test("public directory never reads internal user identity fields", () => {
  assert.doesNotMatch(publicServiceSource, /from\s+users|join\(users|users\.email/);
  assert.match(publicServiceSource, /publicEmail:\s*supportAgents\.publicEmail/);
  assert.match(publicServiceSource, /safePublicEmailSchema\.safeParse/);
  assert.match(publicServiceSource, /normalizePhoneNumber\(agent\.publicPhone/);
  assert.match(publicTeamSource, /normalizePhoneNumber\(phoneNumber/);
  assert.doesNotMatch(publicTeamSource, /dangerouslySetInnerHTML/);
});

test("support agent editor keeps its body scrollable and footer reachable", () => {
  assert.match(
    supportAgentManagerSource,
    /<form\s+action=\{formAction\}\s+className="flex min-h-0 flex-1 flex-col overflow-hidden"\s*>/,
  );
  assert.match(
    supportAgentManagerSource,
    /<DialogBody className="grid gap-5">[\s\S]*<DialogFooter>/,
  );
});
