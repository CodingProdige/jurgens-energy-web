import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wizardSource = readFileSync(
  new URL(
    "../app/(seller)/seller/(dashboard)/products/new/product-create-wizard.tsx",
    import.meta.url,
  ),
  "utf8",
);
const draftActionsSource = readFileSync(
  new URL(
    "../app/(seller)/seller/(dashboard)/products/new/actions.ts",
    import.meta.url,
  ),
  "utf8",
);
const editActionsSource = readFileSync(
  new URL(
    "../app/(seller)/seller/(dashboard)/products/actions.ts",
    import.meta.url,
  ),
  "utf8",
);
const editableProductSource = readFileSync(
  new URL("../src/modules/sellers/product-create.ts", import.meta.url),
  "utf8",
);

test("single-variant low stock alert is controlled and submitted", () => {
  assert.match(
    wizardSource,
    /const \[lowStockAlert, setLowStockAlert\] = useState\(\s*initialProduct\?\.lowStockAlert \?\? "5",\s*\)/,
  );
  assert.match(
    wizardSource,
    /setLowStockAlert\(sanitizeStockInput\(event\.target\.value\)\)/,
  );
  assert.match(wizardSource, /value=\{lowStockAlert\}/);
  assert.match(wizardSource, /\n\s+lowStockAlert,\n\s+variants: hasVariants/);
});

test("single-variant draft saves persist the configured low stock alert", () => {
  assert.match(
    draftActionsSource,
    /lowStockAlert: z\.string\(\)\.trim\(\)\.max\(20\)\.optional\(\)/,
  );
  assert.match(
    draftActionsSource,
    /lowStockAlert: parseLowStockAlert\(\s*input\.lowStockAlert,\s*existingVariant\?\.lowStockAlert \?\? existingSingleVariant\?\.lowStockAlert \?\? 5,\s*\)/,
  );
  assert.doesNotMatch(draftActionsSource, /lowStockAlert:\s*5,/);
});

test("editing hydrates and preserves existing low stock alerts", () => {
  assert.match(
    editableProductSource,
    /lowStockAlert: String\(firstVariant\?\.lowStockAlert \?\? 5\)/,
  );
  assert.match(editableProductSource, /lowStockAlert: String\(variant\.lowStockAlert\)/);
  assert.match(
    editActionsSource,
    /existingLowStockAlertById\.get\(variant\.id\) \?\? 5/,
  );
});
