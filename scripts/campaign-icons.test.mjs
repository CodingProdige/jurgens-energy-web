import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { lucideCampaignIconNames } from "../src/generated/lucide-campaign-icon-names.ts";
import { lucideCampaignIconVersion } from "../src/generated/lucide-campaign-icon-version.ts";

const assetDirectory = path.join(
  process.cwd(),
  "public",
  "generated",
  "lucide",
  `v${lucideCampaignIconVersion}`,
);

test("generated campaign icon pack matches the installed Lucide version", async () => {
  const lucidePackage = JSON.parse(
    await readFile("node_modules/lucide-react/package.json", "utf8"),
  );
  const manifest = JSON.parse(
    await readFile(path.join(assetDirectory, "manifest.json"), "utf8"),
  );
  const generatedFiles = new Set(await readdir(assetDirectory));

  assert.equal(lucideCampaignIconVersion, lucidePackage.version);
  assert.equal(manifest.version, lucidePackage.version);
  assert.equal(manifest.count, lucideCampaignIconNames.length);
  assert.equal(new Set(lucideCampaignIconNames).size, lucideCampaignIconNames.length);
  assert.ok(lucideCampaignIconNames.length > 1_900);
  assert.ok(lucideCampaignIconNames.includes("badge-percent"));
  assert.ok(lucideCampaignIconNames.includes("flame"));

  for (const iconName of lucideCampaignIconNames) {
    assert.match(iconName, /^[a-z0-9-]+$/);
    assert.ok(generatedFiles.has(`${iconName}.svg`));
  }
});

test("shared campaign icon renderer does not import Lucide's dynamic graph", async () => {
  const rendererSource = await readFile(
    "components/marketplace/marketplace-campaign-icon.tsx",
    "utf8",
  );

  assert.doesNotMatch(rendererSource, /lucide-react\/(?:dynamic|dynamicIconImports)/);
  assert.match(rendererSource, /maskImage/);
});
