import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  new URL(
    "../app/(admin)/admin/(dashboard)/settings/platform/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const formSource = readFileSync(
  new URL(
    "../app/(admin)/admin/(dashboard)/settings/platform/settings-form.tsx",
    import.meta.url,
  ),
  "utf8",
);
const settingsSource = readFileSync(
  new URL("../src/modules/marketplace/settings.ts", import.meta.url),
  "utf8",
);
const actionsSource = readFileSync(
  new URL(
    "../app/(admin)/admin/(dashboard)/settings/platform/actions.ts",
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

function withoutWhitespace(source) {
  return source.replace(/\s+/g, "").replaceAll(",)", ")");
}

test("shipping administrators receive all saved Courier Guy secrets", () => {
  const secretLoad = withoutWhitespace(
    sourceBetween(pageSource, "const secrets =", "const notificationSettings ="),
  );
  const secretType = withoutWhitespace(
    sourceBetween(
      settingsSource,
      "export type MarketplaceAdminSecrets",
      "const defaultSettings",
    ),
  );
  const secretRead = withoutWhitespace(
    sourceBetween(
      settingsSource,
      "export async function getMarketplaceAdminSecrets",
      "async function getRawMarketplaceSettings",
    ),
  );

  assert.ok(secretLoad.includes('selectedSection==="shipping"'));

  for (const secretName of [
    "courierGuyLiveApiKey",
    "courierGuySandboxApiKey",
    "courierGuyWebhookToken",
  ]) {
    assert.ok(
      secretType.includes(`${secretName}:string|null;`),
      `${secretName} must be part of MarketplaceAdminSecrets`,
    );
    assert.ok(
      secretRead.includes(
        `${secretName}:decryptOptionalSecret(rawSettings?.${secretName}Encrypted)`,
      ),
      `${secretName} must be decrypted for authorized settings administrators`,
    );
  }
});

test("the shipping form receives and restores all three Courier Guy secrets", () => {
  const shippingSection = withoutWhitespace(
    sourceBetween(
      pageSource,
      'if (section === "shipping")',
      'if (section === "whatsapp-ordering")',
    ),
  );
  const shippingForm = withoutWhitespace(
    sourceBetween(
      formSource,
      "type NationwideShippingSettingsFormProps",
      "const courierGuyWebhookSubscriptionUrl",
    ),
  );

  for (const secretName of [
    "courierGuyLiveApiKey",
    "courierGuySandboxApiKey",
    "courierGuyWebhookToken",
  ]) {
    assert.ok(
      shippingSection.includes(
        `${secretName}={secrets?.${secretName}??null}`,
      ),
      `${secretName} must be passed to the shipping form`,
    );
    assert.ok(
      shippingForm.includes(`${secretName}:string|null;`),
      `${secretName} must be accepted by the shipping form`,
    );
    assert.ok(
      shippingForm.includes(
        `useState(${secretName}??"")`,
      ),
      `${secretName} must initialize its editable input after a reload`,
    );
  }
});

test("saving Courier Guy credentials does not discard the visible values", () => {
  const shippingForm = withoutWhitespace(
    sourceBetween(
      formSource,
      "export function NationwideShippingSettingsForm",
      "function JurgensDeliveryZoneDialog",
    ),
  );

  assert.ok(!shippingForm.includes('setCourierGuyLiveApiKeyValue("")'));
  assert.ok(!shippingForm.includes('setCourierGuySandboxApiKeyValue("")'));
  assert.ok(!shippingForm.includes('setCourierGuyWebhookTokenValue("")'));
});

test("secret visibility toggles the populated input between password and text", () => {
  const secretInput = withoutWhitespace(
    sourceBetween(formSource, "function SecretTextInput", "const initialState"),
  );

  assert.ok(secretInput.includes("constinputValue=value??internalValue;"));
  assert.ok(secretInput.includes('type={isVisible?"text":"password"}'));
  assert.ok(secretInput.includes("value={inputValue}"));
  assert.ok(
    secretInput.includes(
      'aria-label={isVisible?"Hidevalue":"Showvalue"}',
    ),
  );
  assert.ok(
    secretInput.includes(
      "onClick={()=>setIsVisible((current)=>!current)}",
    ),
  );
});

test("delivery timing settings persist through the shipping admin contract", () => {
  const shippingSection = withoutWhitespace(
    sourceBetween(
      pageSource,
      'if (section === "shipping")',
      'if (section === "whatsapp-ordering")',
    ),
  );
  const shippingForm = withoutWhitespace(
    sourceBetween(
      formSource,
      "type NationwideShippingSettingsFormProps",
      "function JurgensDeliveryZoneDialog",
    ),
  );
  const shippingAction = withoutWhitespace(
    sourceBetween(
      actionsSource,
      "const shippingSettingsBaseSchema",
      "const whatsappOptionalTimeSchema",
    ),
  );
  const shippingSubmit = withoutWhitespace(
    sourceBetween(
      actionsSource,
      "export async function updateShippingIntegrationSettings",
      "export async function updateCourierGuyCredentialSettings",
    ),
  );
  const timingDefaults = {
    shippingHandlingMaxBusinessDays: 1,
    shippingHandlingMinBusinessDays: 0,
    shippingTransitMaxBusinessDays: 3,
    shippingTransitMinBusinessDays: 1,
  };
  const normalizedSettings = withoutWhitespace(settingsSource);

  for (const [field, defaultValue] of Object.entries(timingDefaults)) {
    assert.ok(
      normalizedSettings.includes(`${field}:${defaultValue},`),
      `${field} must have its delivery-policy default`,
    );
    assert.ok(
      normalizedSettings.includes(`${field}:marketplaceSettings.${field}`),
      `${field} must load from persisted marketplace settings`,
    );
    assert.ok(
      shippingSection.includes(`${field}={settings.${field}}`),
      `${field} must be passed to the shipping form`,
    );
    assert.ok(
      shippingForm.includes(`${field}:number;`),
      `${field} must be accepted by the shipping form`,
    );
    assert.ok(
      shippingForm.includes(`name="${field}"`),
      `${field} must have a submitted number input`,
    );
    assert.ok(
      shippingSubmit.includes(`formData.get("${field}")`),
      `${field} must be read by the shipping action`,
    );
  }

  assert.ok(shippingAction.includes(".int().min(0).max(30)"));
  assert.ok(shippingAction.includes(".int().min(0).max(60)"));
  assert.ok(
    shippingAction.includes(
      "shippingHandlingMinBusinessDays<=settings.shippingHandlingMaxBusinessDays",
    ),
  );
  assert.ok(
    shippingAction.includes(
      "shippingTransitMinBusinessDays<=settings.shippingTransitMaxBusinessDays",
    ),
  );
});
