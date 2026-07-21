import assert from "node:assert/strict";
import test from "node:test";

import { replaceLegacyDefaultStorefrontClaims } from "../src/modules/marketplace/storefront-legacy-defaults.ts";

test("historical default storefront claims are replaced exactly", () => {
  const sections = [
    {
      enabled: true,
      id: "hero",
      settings: {
        actions: [],
        accentText: "",
        copy: "Safe, certified and delivered to your home or business.",
        heading: "LPG",
        headingSize: 52,
        headingTag: "h1",
        imageAlt: "Cylinder",
        imageUrl: "/cylinder.webp",
      },
      type: "hero",
    },
    {
      componentCode: "CYLINDER-EXCHANGE-01",
      enabled: true,
      id: "cylinder-showcase",
      settings: {
        actions: [],
        exchangeTitle: "How Cylinder Exchange Works",
        exchangeTitleSize: 20,
        exchangeTitleTag: "h2",
        steps: [
          {
            description: "Our driver collects your empty cylinder.",
            icon: "exchange",
            title: "Hand Over Empty",
          },
        ],
      },
      type: "cylinder_showcase",
    },
    {
      enabled: true,
      id: "features",
      settings: {
        eyebrow: "Modern energy, delivered",
        features: [
          {
            icon: "delivery",
            text: "Fast local delivery for homes and businesses.",
            title: "Same day delivery",
          },
          {
            icon: "certified",
            text: "Every cylinder is checked and handled with care.",
            title: "Certified cylinders",
          },
          {
            icon: "flame",
            text: "Full cylinders arrive ready for safe connection.",
            title: "Ready to cook",
          },
        ],
        title: "LPG delivered with the speed, safety and service your day needs.",
        titleSize: 30,
        titleTag: "h2",
      },
      type: "feature_grid",
    },
  ];

  const result = replaceLegacyDefaultStorefrontClaims(sections);

  assert.equal(
    result[0].settings.copy,
    "JurgensEnergy.com is a South African online store for LPG cylinders, exchange options and gas accessories, with delivery within South Africa.",
  );
  assert.equal(
    result[1].settings.steps[0].description,
    "A delivery representative collects your empty cylinder.",
  );
  assert.deepEqual(
    result[2].settings.features.map(({ text, title }) => ({ text, title })),
    [
      {
        text: "Estimated delivery in 1–4 business days.",
        title: "Delivery in South Africa",
      },
      {
        text: "Cylinder eligibility and handover checks apply where required.",
        title: "Safety-first handling",
      },
      {
        text: "Review the product details and connection requirements before use.",
        title: "Clear product details",
      },
    ],
  );
  assert.equal(
    result[2].settings.eyebrow,
    "South African online LPG store",
  );
  assert.equal(
    result[2].settings.title,
    "LPG ordering with clear product, payment and delivery updates.",
  );
  assert.equal(
    sections[0].settings.copy,
    "Safe, certified and delivered to your home or business.",
  );
});

test("similar admin-authored storefront copy is preserved", () => {
  const sections = [
    {
      enabled: true,
      id: "hero",
      settings: {
        actions: [],
        accentText: "",
        copy: "Safe LPG options delivered to approved local addresses.",
        heading: "LPG",
        headingSize: 52,
        headingTag: "h1",
        imageAlt: "Cylinder",
        imageUrl: "/cylinder.webp",
      },
      type: "hero",
    },
  ];

  const result = replaceLegacyDefaultStorefrontClaims(sections);

  assert.equal(
    result[0].settings.copy,
    "Safe LPG options delivered to approved local addresses.",
  );
});

test("the previous neutral defaults are upgraded to the South Africa store copy", () => {
  const sections = [
    {
      enabled: true,
      id: "hero",
      settings: {
        actions: [],
        accentText: "",
        copy: "LPG cylinders, exchange options and local delivery where available.",
        heading: "LPG",
        headingSize: 52,
        headingTag: "h1",
        imageAlt: "Cylinder",
        imageUrl: "/cylinder.webp",
      },
      type: "hero",
    },
    {
      enabled: true,
      id: "features",
      settings: {
        eyebrow: "Modern energy, delivered",
        features: [
          {
            icon: "delivery",
            text: "Local delivery options for eligible addresses.",
            title: "Local delivery",
          },
        ],
        title: "LPG ordering with clear product, payment and delivery updates.",
        titleSize: 30,
        titleTag: "h2",
      },
      type: "feature_grid",
    },
  ];

  const result = replaceLegacyDefaultStorefrontClaims(sections);

  assert.equal(
    result[0].settings.copy,
    "JurgensEnergy.com is a South African online store for LPG cylinders, exchange options and gas accessories, with delivery within South Africa.",
  );
  assert.deepEqual(result[1].settings.features[0], {
    icon: "delivery",
    text: "Estimated delivery in 1–4 business days.",
    title: "Delivery in South Africa",
  });
  assert.equal(
    result[1].settings.eyebrow,
    "South African online LPG store",
  );
});
