import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const scannedRoots = [
  "app/(marketplace)",
  "components/marketplace",
  "src/modules/marketplace/content",
  "src/modules/marketplace/policies",
  "src/modules/marketplace/static-page-seo",
  "src/modules/marketplace/public-returns-copy.ts",
];

const excludedPaths = new Set([
  "app/(marketplace)/(content)/lpg-safety/page.tsx",
]);

const blockedStorefrontTerms =
  /\b(?:emergency|hazardous?|flammable|leaks?|leaking|gas leak|smell gas|product safety|lpg-safety|lpg safety|safety-first|urgent safety|unsafe|combustible)\b/i;

function collectFiles(path) {
  if (excludedPaths.has(path)) {
    return [];
  }

  const stats = statSync(path);

  if (stats.isFile()) {
    return /\.(?:tsx?|jsx?)$/.test(path) ? [path] : [];
  }

  return readdirSync(path).flatMap((entry) => collectFiles(join(path, entry)));
}

test("public storefront copy avoids emergency and hazardous-goods language", () => {
  const offenders = scannedRoots
    .flatMap(collectFiles)
    .flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, index) => ({ file, line, lineNumber: index + 1 }))
        .filter(({ line }) => blockedStorefrontTerms.test(line)),
    );

  assert.deepEqual(offenders, []);
});
