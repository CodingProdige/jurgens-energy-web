import { classifyWhatsappContextualProductRequest } from "./contextual-product-request.ts";

export type WhatsappPendingOfferFollowUpKind =
  | "image"
  | "image_and_price"
  | "price";

export type WhatsappPendingOfferSummary = {
  brandName: string | null;
  hasImage: boolean;
  priceLabel: string;
  purchaseType: "exchange" | "standard";
  quantity: number;
  title: string;
  totalLabel: string;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function classifyWhatsappPendingOfferFollowUp(
  message: string,
): WhatsappPendingOfferFollowUpKind | null {
  const text = normalizeText(message);

  if (!text) {
    return null;
  }

  const asksForImage =
    classifyWhatsappContextualProductRequest(message) === "product_image";
  const asksForPrice =
    (/\b(?:price|pricing|cost|costing|rate)\b/u.test(text) ||
      /\bhow\s+much\b/u.test(text)) &&
    !/\b(?:courier|deliver|delivery|ship|shipping)\b/u.test(text);

  if (asksForImage && asksForPrice) {
    return "image_and_price";
  }

  if (asksForImage) {
    return "image";
  }

  return asksForPrice ? "price" : null;
}

export function matchesWhatsappPendingOfferContext({
  message,
  offer,
}: {
  message: string;
  offer: Pick<
    WhatsappPendingOfferSummary,
    "brandName" | "purchaseType" | "title"
  >;
}) {
  const text = normalizeText(message);
  const offerText = normalizeText(
    [offer.brandName, offer.title].filter(Boolean).join(" "),
  );

  if (/\b(?:another|different|other)\b/u.test(text)) {
    return false;
  }

  const requestedSize = text.match(
    /\b(\d{1,2})\s*k(?:g|gs|ilo|ilos)\b/u,
  )?.[1];

  if (
    requestedSize &&
    !new RegExp(`\\b${requestedSize}\\s*k(?:g|gs|ilo|ilos)\\b`, "u").test(
      offerText,
    )
  ) {
    return false;
  }

  const explicitlyRequestsStandard =
    /\bfull(?:\s+(?:cylinder|bottle|option|one))?\b/u.test(text) ||
    /\bnew\s+(?:cylinder|bottle|option|one)\b/u.test(text);
  const explicitlyRequestsExchange =
    /\b(?:exchange|refill|replace|replacement|swap|top\s+up|topup)\b/u.test(
      text,
    );

  if (offer.purchaseType === "exchange" && explicitlyRequestsStandard) {
    return false;
  }

  return !(
    offer.purchaseType === "standard" && explicitlyRequestsExchange
  );
}

function getOfferTitle(offer: WhatsappPendingOfferSummary) {
  const brandName = offer.brandName?.trim();
  const title = offer.title.trim();

  if (
    !brandName ||
    title.toLocaleLowerCase().includes(brandName.toLocaleLowerCase())
  ) {
    return title;
  }

  return `${brandName} ${title}`;
}

export function buildWhatsappPendingOfferFollowUp({
  kind,
  offer,
}: {
  kind: WhatsappPendingOfferFollowUpKind;
  offer: WhatsappPendingOfferSummary;
}) {
  const offerTitle = getOfferTitle(offer);
  const typeLabel =
    offer.purchaseType === "exchange" ? "exchange" : "full/new";
  const includesImage = kind === "image" || kind === "image_and_price";
  const includesPrice = kind === "price" || kind === "image_and_price";
  const lines: string[] = [];

  if (includesImage) {
    lines.push(
      offer.hasImage
        ? `Here is the product image for ${offerTitle}.`
        : `I do not have a product image available for ${offerTitle}.`,
      `This is still your ${typeLabel} offer for ${offer.quantity} x ${offerTitle}.`,
    );
  }

  if (includesPrice) {
    lines.push(
      `The ${offerTitle} ${typeLabel} price is ${offer.priceLabel} each.`,
      `For ${offer.quantity} unit${offer.quantity === 1 ? "" : "s"}, the product subtotal is ${offer.totalLabel}.`,
    );
  }

  lines.push("Reply YES to confirm this offer, or tell me what to change.");

  return {
    attachImage: includesImage && offer.hasImage,
    reply: lines.join("\n"),
  };
}
