export type VatDisplaySource =
  | boolean
  | {
      isVatRegistered?: boolean | null;
      vatNumber?: string | null;
      vatRegistrationNumber?: string | null;
    }
  | null
  | undefined;

export const VAT_PRICE_TAX_DISCLOSURE = "Includes VAT";
export const NON_VAT_PRICE_TAX_DISCLOSURE = "Final price";

export const VAT_CHECKOUT_TAX_SUMMARY_LABEL = "Included VAT";
export const NON_VAT_CHECKOUT_TAX_SUMMARY_LABEL = "No VAT charged";

export const VAT_CHECKOUT_TAX_HELP_TEXT =
  "Product and delivery prices include VAT.";
export const NON_VAT_CHECKOUT_TAX_HELP_TEXT =
  "No VAT is charged on this order.";

export function hasVatRegistrationForDisplay(source: VatDisplaySource) {
  if (typeof source === "boolean") {
    return source;
  }

  if (!source) {
    return false;
  }

  if (typeof source.isVatRegistered === "boolean") {
    return source.isVatRegistered;
  }

  return Boolean(
    (source.vatRegistrationNumber ?? source.vatNumber ?? "").trim(),
  );
}

export function getPriceTaxDisclosure(source: VatDisplaySource) {
  return hasVatRegistrationForDisplay(source)
    ? VAT_PRICE_TAX_DISCLOSURE
    : NON_VAT_PRICE_TAX_DISCLOSURE;
}

export function getCheckoutTaxSummaryLabel(source: VatDisplaySource) {
  return hasVatRegistrationForDisplay(source)
    ? VAT_CHECKOUT_TAX_SUMMARY_LABEL
    : NON_VAT_CHECKOUT_TAX_SUMMARY_LABEL;
}

export function getCheckoutTaxHelpText(source: VatDisplaySource) {
  return hasVatRegistrationForDisplay(source)
    ? VAT_CHECKOUT_TAX_HELP_TEXT
    : NON_VAT_CHECKOUT_TAX_HELP_TEXT;
}

