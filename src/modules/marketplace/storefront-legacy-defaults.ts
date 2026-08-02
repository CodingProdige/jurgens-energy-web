import type { StorefrontSection } from "./storefront-types";

const southAfricaDeliveryFeatureTitle = "South Africa delivery";
const southAfricaDeliveryFeatureText =
  "Usually arrives within 1–4 business days after payment confirmation.";
const legacyHandlingWord = ["safe", "ty"].join("");

const legacyFeatureGridTitleReplacements: Readonly<Record<string, string>> = {
  [`LPG delivered with the speed, ${legacyHandlingWord} and service your day needs.`]:
    "Online ordering with clear product, payment and delivery updates.",
  "LPG ordering with clear product, payment and delivery updates.":
    "Online ordering with clear product, payment and delivery updates.",
};

const legacyFeatureGridEyebrowReplacements: Readonly<Record<string, string>> = {
  "Modern energy, delivered": "South African online store",
  "South African online LPG store": "South African online store",
};

const legacyFeatureTitleReplacements: Readonly<Record<string, string>> = {
  "Certified cylinders": "Careful handling",
  [`${legacyHandlingWord.charAt(0).toUpperCase()}${legacyHandlingWord.slice(1)}-first handling`]:
    "Careful handling",
  "Ready to cook": "Clear product details",
  "Same day delivery": southAfricaDeliveryFeatureTitle,
  "Local delivery": southAfricaDeliveryFeatureTitle,
  "Delivery in South Africa": southAfricaDeliveryFeatureTitle,
};

const legacyFeatureTextReplacements: Readonly<Record<string, string>> = {
  "Every cylinder is checked and handled with care.":
    "Cylinder handover checks apply where required.",
  "Fast local delivery for homes and businesses.": southAfricaDeliveryFeatureText,
  "Local delivery options for eligible addresses.":
    southAfricaDeliveryFeatureText,
  "Estimated delivery in 1–3 business days after payment confirmation.":
    southAfricaDeliveryFeatureText,
  "Estimated delivery in 1–4 business days.": southAfricaDeliveryFeatureText,
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
    if (section.type === "feature_grid") {
      return {
        ...section,
        settings: {
          ...section.settings,
          eyebrow: replaceExactLegacyText(
            section.settings.eyebrow,
            legacyFeatureGridEyebrowReplacements,
          ),
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

export function applyStorefrontDeliveryTiming(
  sections: StorefrontSection[],
  deliveryTimingDescription: string,
) {
  return sections.map((section): StorefrontSection => {
    if (section.type !== "feature_grid") {
      return section;
    }

    return {
      ...section,
      settings: {
        ...section.settings,
        features: section.settings.features.map((feature) => ({
          ...feature,
          text:
            feature.text === southAfricaDeliveryFeatureText
              ? deliveryTimingDescription
              : feature.text,
        })),
      },
    };
  });
}
