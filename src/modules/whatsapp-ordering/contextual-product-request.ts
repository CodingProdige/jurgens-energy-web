export type WhatsappContextualProductRequest = "product_image";

const visualNounPattern =
  /\b(?:image|images|photo|photos|photograph|photographs|picture|pictures|pic|pics|foto|fotos)\b/u;
const explicitVisualRequestPattern =
  /\b(?:send|show|share|forward|attach|see|view|get|want|need|any|please|stuur|wys|deel|sien|asseblief)\b/u;
const visualAvailabilityQuestionPattern =
  /\b(?:do\s+you\s+have|have\s+you\s+got|is\s+there|are\s+there)\b/u;
const visualShorthandPattern =
  /^(?:(?:the|a|an|any|product|actual)\s+)?(?:image|images|photo|photos|photograph|photographs|picture|pictures|pic|pics|foto|fotos)(?:\s+(?:please|pls|asseblief))?$/u;
const contextualShowPattern =
  /^(?:(?:please|pls)\s+)?(?:(?:can|could|would|will)\s+you\s+)?show\s+me(?:\s+(?:it|that|this|the\s+(?:product|item|cylinder|bottle|one)))?(?:\s+(?:please|pls))?$/u;
const contextualSeePattern =
  /^(?:(?:please|pls)\s+)?(?:(?:can|could|may)\s+i\s+)?see\s+(?:it|that|this|the\s+(?:product|item|cylinder|bottle|one))(?:\s+(?:please|pls))?$/u;

/**
 * Classifies short follow-up requests for media belonging to the product that
 * is already grounded in conversation state. Product resolution deliberately
 * remains outside this pure classifier.
 */
export function classifyWhatsappContextualProductRequest(
  message: string,
): WhatsappContextualProductRequest | null {
  const normalized = normalizeMessage(message);

  if (!normalized || /^picture\s+this\b/u.test(normalized)) {
    return null;
  }

  if (
    contextualShowPattern.test(normalized) ||
    contextualSeePattern.test(normalized)
  ) {
    return "product_image";
  }

  if (!visualNounPattern.test(normalized)) {
    return null;
  }

  return visualShorthandPattern.test(normalized) ||
    explicitVisualRequestPattern.test(normalized) ||
    visualAvailabilityQuestionPattern.test(normalized)
    ? "product_image"
    : null;
}

function normalizeMessage(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-ZA")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
