import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const schemaSource = read("src/db/schema/marketplace-settings.ts");
const migrationSource = read(
  "src/db/migrations/0099_whatsapp_automated_responses_toggle.sql",
);
const settingsSource = read("src/modules/marketplace/settings.ts");
const serviceSource = read("src/modules/whatsapp-ordering/service.ts");
const adminWhatsappSource = read("src/modules/admin/whatsapp.ts");
const webhookRouteSource = read("app/api/webhooks/whatsapp/route.ts");
const adminActionsSource = read(
  "app/(admin)/admin/(dashboard)/whatsapp/actions.ts",
);
const managerSource = read(
  "app/(admin)/admin/(dashboard)/whatsapp/whatsapp-manager.tsx",
);

test("persists a backward-compatible global automated-response setting", () => {
  assert.match(
    schemaSource,
    /whatsappAutomatedResponsesEnabled: boolean\([\s\S]*?\.default\(true\)/,
  );
  assert.match(
    migrationSource,
    /"whatsapp_automated_responses_enabled" boolean DEFAULT true NOT NULL/,
  );
  assert.match(settingsSource, /whatsappAutomatedResponsesEnabled: true/);
  assert.match(
    settingsSource,
    /settings\.whatsappAutomatedResponsesEnabled \?\? true/,
  );
});

test("uses an authorized, validated, and audited global admin mutation", () => {
  assert.match(
    adminActionsSource,
    /setWhatsappAutomatedResponsesEnabled[\s\S]*?requireAdminCapability\("admin\.settings\.manage"\)/,
  );
  assert.match(
    adminActionsSource,
    /automatedResponsesSchema = z\.object\([\s\S]*?enabled: z\.boolean\(\)/,
  );
  assert.match(
    settingsSource,
    /updateWhatsappAutomatedResponsesSetting[\s\S]*?marketplace\.whatsapp_automated_responses\.updated/,
  );
  assert.match(
    managerSource,
    /<Switch[\s\S]*?checked=\{automatedResponsesEnabled\}[\s\S]*?onCheckedChange=\{updateAutomatedResponses\}/,
  );
});

test("records accepted inbound messages before globally skipping assistant work", () => {
  const acceptedCallbackIndex = serviceSource.indexOf(
    "options.onInboundAccepted?.",
  );
  const profilePersistenceIndex = serviceSource.indexOf(
    "providerProfileName !== conversation.state.providerProfileName",
  );
  const globalGateIndex = serviceSource.indexOf(
    "if (!options.automatedResponsesEnabled)",
    acceptedCallbackIndex,
  );
  const automatedWorkIndex = serviceSource.indexOf(
    "let conversationState = updateRepeatedMessageState",
  );

  assert.ok(acceptedCallbackIndex >= 0);
  assert.ok(profilePersistenceIndex > acceptedCallbackIndex);
  assert.ok(globalGateIndex > profilePersistenceIndex);
  assert.ok(automatedWorkIndex > globalGateIndex);

  const globalGate = serviceSource.slice(globalGateIndex, automatedWorkIndex);
  assert.match(globalGate, /updateConversationAfterMessage/);
  assert.match(globalGate, /intent: "automation_disabled"/);
  assert.match(globalGate, /reply: ""/);
  assert.match(globalGate, /skipReply: true/);
  assert.doesNotMatch(globalGate, /respond\(/);

  assert.match(
    webhookRouteSource,
    /automatedResponsesEnabled: config\.automatedResponsesEnabled/,
  );
  assert.match(
    webhookRouteSource,
    /provider === "twilio"[\s\S]*?<Response\/>[\s\S]*?text\/xml/,
  );
});

test("stops scheduled automation without disabling manual or transactional sends", () => {
  const followUpRunner = adminWhatsappSource.slice(
    adminWhatsappSource.indexOf("export async function runDueWhatsappFollowUps"),
    adminWhatsappSource.indexOf("async function getConversationState"),
  );
  const disabledGateIndex = followUpRunner.indexOf(
    "!automationState.enabled",
  );
  const conversationScanIndex = followUpRunner.indexOf(".from(whatsappConversations)");

  assert.ok(disabledGateIndex >= 0);
  assert.ok(conversationScanIndex > disabledGateIndex);
  assert.match(
    followUpRunner,
    /latestAutomationState = await getWhatsappAutomationState\(\)[\s\S]*?!latestAutomationState\.enabled/,
  );

  const integrationConfig = settingsSource.slice(
    settingsSource.indexOf("export async function getWhatsappIntegrationConfig"),
    settingsSource.indexOf("export type GooglePlacesIntegrationConfig"),
  );
  const configuredExpression = integrationConfig.match(
    /isConfigured: Boolean\(([\s\S]*?)\),/,
  );

  assert.match(
    integrationConfig,
    /automatedResponsesEnabled:[\s\S]*?whatsappOrderingEnabled[\s\S]*?whatsappAutomatedResponsesEnabled/,
  );
  assert.ok(configuredExpression);
  assert.doesNotMatch(
    configuredExpression[1],
    /whatsappAutomatedResponsesEnabled/,
  );

  const manualSend = adminWhatsappSource.slice(
    adminWhatsappSource.indexOf(
      "export async function sendAdminWhatsappConversationMessage",
    ),
    adminWhatsappSource.indexOf("export async function sendAdminWhatsappFollowUp"),
  );
  assert.doesNotMatch(manualSend, /whatsappAutomatedResponsesEnabled/);

  assert.match(
    serviceSource,
    /async function respond\([\s\S]*?await getWhatsappAutomationState\(\)[\s\S]*?skipReply: true/,
  );
});
