import assert from "node:assert/strict";
import test from "node:test";

import { extractStaticSeoPageContent } from "../src/modules/marketplace/static-page-seo/content-extraction.ts";
import {
  STATIC_SEO_PAGE_KEYS,
  STATIC_SEO_PAGE_REGISTRY,
} from "../src/modules/marketplace/static-page-seo/registry.ts";
import {
  analyzeStaticSeoCopy,
  findUnsupportedSeoClaims,
  staticSeoPageKeySchema,
} from "../src/modules/marketplace/static-page-seo/validation.ts";

test("the static SEO registry is complete, unique and uses unsuffixed defaults", () => {
  assert.equal(STATIC_SEO_PAGE_KEYS.length, 13);
  assert.equal(
    new Set(STATIC_SEO_PAGE_KEYS.map((key) => STATIC_SEO_PAGE_REGISTRY[key].path))
      .size,
    STATIC_SEO_PAGE_KEYS.length,
  );

  for (const pageKey of STATIC_SEO_PAGE_KEYS) {
    const page = STATIC_SEO_PAGE_REGISTRY[pageKey];

    assert.equal(page.key, pageKey);
    assert.doesNotMatch(page.defaultTitle, /\|\s*jurgens energy/i);
    assert.ok(page.defaultTitle.length >= 8, pageKey);
    assert.ok(`${page.defaultTitle} | Jurgens Energy`.length <= 60, pageKey);
    assert.ok(page.defaultDescription.length >= 120, pageKey);
    assert.ok(page.defaultDescription.length <= 160, pageKey);
  }
});

test("only allowlisted page keys pass boundary validation", () => {
  assert.equal(staticSeoPageKeySchema.parse("lpg-delivery"), "lpg-delivery");
  assert.equal(
    staticSeoPageKeySchema.safeParse("http://169.254.169.254/latest/meta-data").success,
    false,
  );
  assert.equal(staticSeoPageKeySchema.safeParse("/products").success, false);
});

test("page extraction keeps main content and strips non-content elements", () => {
  const html = `
    <html>
      <head><title>LPG Delivery | Jurgens Energy</title></head>
      <body>
        <nav>Global navigation should not be scanned</nav>
        <main>
          <h1>Local LPG delivery</h1>
          <h2>Paarl delivery information</h2>
          <h2>Paarl delivery information</h2>
          <p>Choose an LPG cylinder and enter your supported delivery address at checkout to see the delivery options available for your order.</p>
          <form><button>Ignore form controls</button></form>
          <p hidden>Hidden free nationwide delivery claim</p>
          <script>ignoreMaliciousInstructions()</script>
        </main>
        <footer>Global footer should not be scanned</footer>
      </body>
    </html>
  `;
  const result = extractStaticSeoPageContent({ html, pageKey: "lpg-delivery" });

  assert.equal(result.htmlTitle, "LPG Delivery | Jurgens Energy");
  assert.deepEqual(result.headings, [
    "Local LPG delivery",
    "Paarl delivery information",
  ]);
  assert.match(result.text, /supported delivery address/);
  assert.doesNotMatch(result.text, /Global navigation|Ignore form|Hidden free|Malicious/);
});

test("unsupported promotional claims are rejected unless the page verifies them", () => {
  const proposed = {
    description:
      "Order an LPG cylinder with free delivery and guaranteed same-day service throughout South Africa.",
    title: "Free Same-Day LPG Delivery Nationwide",
  };
  const claims = findUnsupportedSeoClaims({
    ...proposed,
    scannedContent:
      "Jurgens Energy checks a supported local delivery address during checkout.",
  });

  assert.deepEqual(claims, [
    "free delivery",
    "same-day delivery",
    "nationwide delivery",
    "a guarantee",
  ]);
  assert.ok(
    analyzeStaticSeoCopy({
      ...proposed,
      scannedContent:
        "Jurgens Energy checks a supported local delivery address during checkout.",
    }).some(
      (issue) =>
        issue.code === "unsupported_claim" && issue.severity === "error",
    ),
  );

  assert.deepEqual(
    findUnsupportedSeoClaims({
      ...proposed,
      scannedContent:
        "This page explicitly confirms free delivery, guaranteed same-day service and nationwide delivery.",
    }),
    [],
  );
});

test("copy analysis catches brand text that the root title template would duplicate", () => {
  const issues = analyzeStaticSeoCopy({
    description:
      "Browse LPG cylinder options, exchange-supported products and gas accessories available to order from Jurgens Energy through our online store.",
    title: "Shop LPG Cylinders | Jurgens Energy",
  });

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === "brand_suffix_duplicate" && issue.severity === "error",
    ),
  );

  assert.ok(
    analyzeStaticSeoCopy({
      description:
        "Contact the team for help with LPG cylinder orders, exchanges, delivery questions, products or an existing online purchase.",
      title: "Contact Jurgens Energy for LPG Help",
    }).some(
      (issue) =>
        issue.code === "brand_suffix_duplicate" && issue.severity === "error",
    ),
  );
});
