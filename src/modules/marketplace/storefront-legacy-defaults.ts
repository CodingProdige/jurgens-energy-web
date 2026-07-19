import type { StorefrontSection } from "./storefront-types";

const legacyHeroCopyReplacements: Readonly<Record<string, string>> = {
  "Safe, certified and delivered to your home or business.":
    "LPG cylinders, exchange options and local delivery where available.",
};

const legacyFeatureGridTitleReplacements: Readonly<Record<string, string>> = {
  "LPG delivered with the speed, safety and service your day needs.":
    "LPG ordering with clear product, payment and delivery updates.",
};

const legacyFeatureTitleReplacements: Readonly<Record<string, string>> = {
  "Certified cylinders": "Safety-first handling",
  "Ready to cook": "Clear product details",
  "Same day delivery": "Local delivery",
};

const legacyFeatureTextReplacements: Readonly<Record<string, string>> = {
  "Every cylinder is checked and handled with care.":
    "Cylinder eligibility and handover checks apply where required.",
  "Fast local delivery for homes and businesses.":
    "Local delivery options for eligible addresses.",
  "Full cylinders arrive ready for safe connection.":
    "Review the product details and connection requirements before use.",
};

const legacyCylinderStepReplacements: Readonly<Record<string, string>> = {
  "Our driver collects your empty cylinder.":
    "A delivery representative collects your empty cylinder.",
};

function replaceExactLegacyText(
  value: string,
  replacements: Readonly<Record<string, string>>,
) {
  return replacements[value] ?? value;
}

/**
 * Neutralizes only historical default storefront copy. Admin-authored content
 * that is not an exact match is deliberately preserved.
 */
export function replaceLegacyDefaultStorefrontClaims(
  sections: StorefrontSection[],
) {
  return sections.map((section): StorefrontSection => {
    if (section.type === "hero") {
      return {
        ...section,
        settings: {
          ...section.settings,
          copy: replaceExactLegacyText(
            section.settings.copy,
            legacyHeroCopyReplacements,
          ),
        },
      };
    }

    if (section.type === "feature_grid") {
      return {
        ...section,
        settings: {
          ...section.settings,
          features: section.settings.features.map((feature) => ({
            ...feature,
            text: replaceExactLegacyText(
              feature.text,
              legacyFeatureTextReplacements,
            ),
            title: replaceExactLegacyText(
              feature.title,
              legacyFeatureTitleReplacements,
            ),
          })),
          title: replaceExactLegacyText(
            section.settings.title,
            legacyFeatureGridTitleReplacements,
          ),
        },
      };
    }

    if (section.type === "cylinder_showcase") {
      return {
        ...section,
        settings: {
          ...section.settings,
          steps: section.settings.steps.map((step) => ({
            ...step,
            description: replaceExactLegacyText(
              step.description,
              legacyCylinderStepReplacements,
            ),
          })),
        },
      };
    }

    return section;
  });
}
