import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProductDescriptionGenerationPrompt,
  generatedProductDescriptionTextToHtml,
  parseProductDescription,
} from "../src/modules/products/product-description.ts";

test("keeps short-description generation concise and unstructured", () => {
  const prompt = buildProductDescriptionGenerationPrompt({
    kind: "short",
    productName: "9kg LPG Cylinder",
    shortDescription: "This should not be included.",
  });

  assert.match(prompt.input, /one sentence under 240 characters/);
  assert.doesNotMatch(prompt.input, /Existing short description/);
  assert.doesNotMatch(prompt.input, /Key features/);
  assert.equal(prompt.maxOutputTokens, 240);
});

test("long-description generation requests headings and useful bullets", () => {
  const prompt = buildProductDescriptionGenerationPrompt({
    brandName: "Jurgens Energy",
    categoryName: "Gas Cylinders",
    kind: "long",
    productName: "9kg LPG Cylinder",
    shortDescription: "A compact cylinder for compatible LPG appliances.",
  });

  assert.match(prompt.input, /Existing short description:/);
  assert.match(prompt.input, /## Key features/);
  assert.match(prompt.input, /3 to 6 useful bullet points/);
  assert.match(prompt.input, /Do not use HTML/);
  assert.equal(prompt.maxOutputTokens, 900);
});

test("turns generated lightweight Markdown into semantic escaped HTML", () => {
  const html = generatedProductDescriptionTextToHtml(`A practical <script>safe</script> option.

## Key features
- Compact format
- Compatible with suitable LPG appliances

## Good to know
1. Review the selected variant
2. Follow the supplied safety guidance`);

  assert.equal(
    html,
    "<p>A practical &lt;script&gt;safe&lt;/script&gt; option.</p>" +
      "<h2>Key features</h2>" +
      "<ul><li>Compact format</li><li>Compatible with suitable LPG appliances</li></ul>" +
      "<h2>Good to know</h2>" +
      "<ol><li>Review the selected variant</li><li>Follow the supplied safety guidance</li></ol>",
  );
});

test("preserves stored rich-text headings, paragraphs, and lists as safe blocks", () => {
  const blocks = parseProductDescription(
    '<p>Intro <strong>copy</strong>.</p><h2>Key features</h2><ul><li>First</li><li>Second<script>alert(1)</script></li></ul><blockquote>Check compatibility.</blockquote>',
  );

  assert.deepEqual(blocks, [
    { text: "Intro copy.", type: "paragraph" },
    { level: 2, text: "Key features", type: "heading" },
    { items: ["First", "Second"], type: "unordered-list" },
    { text: "Check compatibility.", type: "blockquote" },
  ]);
});

test("supports legacy plain descriptions and lightweight Markdown", () => {
  assert.deepEqual(
    parseProductDescription(`Opening paragraph.

## Details
- One
- Two`),
    [
      { text: "Opening paragraph.", type: "paragraph" },
      { level: 2, text: "Details", type: "heading" },
      { items: ["One", "Two"], type: "unordered-list" },
    ],
  );
});
