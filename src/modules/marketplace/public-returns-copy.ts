import type {
  MarketplaceReturnAcceptance,
  MarketplaceReturnLabelResponsibility,
  MarketplaceReturnMethod,
  MarketplaceReturnProductCondition,
  MarketplaceReturnRestockingFee,
  MarketplaceSettings,
} from "./settings.ts";

type PublicReturnsSettings = Pick<
  MarketplaceSettings,
  | "returnsAcceptance"
  | "returnsCurrencyCode"
  | "returnsExchangesEnabled"
  | "returnsHazardousGoodsNoteEnabled"
  | "returnsLabelResponsibility"
  | "returnsMethodCodes"
  | "returnsProductCondition"
  | "returnsRefundProcessingDays"
  | "returnsRestockingFeeAmount"
  | "returnsRestockingFeePercent"
  | "returnsRestockingFeeType"
  | "returnsWindowDays"
>;

export function getPublicReturnWindowLabel(settings: PublicReturnsSettings) {
  const days = normalizeDays(settings.returnsWindowDays, 7, 1, 365);

  return `${days} calendar ${days === 1 ? "day" : "days"}`;
}

export function getPublicRefundProcessingLabel(
  settings: PublicReturnsSettings,
) {
  const days = normalizeDays(settings.returnsRefundProcessingDays, 7, 0, 60);

  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function getPublicReturnsConditionLabel(
  condition: MarketplaceReturnProductCondition,
) {
  return condition === "new_and_slightly_used"
    ? "new or slightly used products"
    : "new and unused products";
}

export function getPublicReturnsAcceptanceLabel(
  acceptance: MarketplaceReturnAcceptance,
) {
  if (acceptance === "defective_and_non_defective") {
    return "defective and non-defective products";
  }

  if (acceptance === "defective_only") {
    return "defective products only";
  }

  return "statutory returns only";
}

export function getPublicReturnMethodLabel(method: MarketplaceReturnMethod) {
  if (method === "dropoff") {
    return "approved drop-off location";
  }

  if (method === "in_store") {
    return "in-store return";
  }

  return "approved courier or post";
}

export function getPublicReturnMethodsLabel(settings: PublicReturnsSettings) {
  const methods =
    settings.returnsMethodCodes.length > 0
      ? settings.returnsMethodCodes
      : (["by_post"] satisfies MarketplaceReturnMethod[]);

  return methods.map(getPublicReturnMethodLabel).join(", ");
}

export function getPublicReturnLabelResponsibilityLabel(
  responsibility: MarketplaceReturnLabelResponsibility,
) {
  return responsibility === "merchant"
    ? "Jurgens Energy provides the return label for approved returns"
    : "the customer arranges and pays the return label or courier for change-of-mind returns";
}

export function getPublicRestockingFeeLabel(
  settings: PublicReturnsSettings,
) {
  if (settings.returnsRestockingFeeType === "fixed") {
    return `A fixed restocking fee of ${formatCurrency(
      settings.returnsRestockingFeeAmount ?? 0,
      settings.returnsCurrencyCode,
    )} applies when disclosed and lawful.`;
  }

  if (settings.returnsRestockingFeeType === "percentage") {
    const percent = Math.max(0, settings.returnsRestockingFeePercent ?? 0);

    return `A restocking fee of ${formatPercent(percent)} of the product price applies when disclosed and lawful.`;
  }

  return "No restocking fee applies.";
}

export function getPublicReturnsSummary(settings: PublicReturnsSettings) {
  const windowLabel = getPublicReturnWindowLabel(settings);
  const conditionLabel = getPublicReturnsConditionLabel(
    settings.returnsProductCondition,
  );

  if (settings.returnsAcceptance === "none") {
    return `Returns are handled where required by law. Incorrect, damaged, unsafe, or defective goods remain protected by statutory remedies. ${getPublicRestockingFeeLabel(settings)}`;
  }

  if (settings.returnsAcceptance === "defective_only") {
    return `Defective, damaged, unsafe, or incorrect goods can be returned under applicable law. Change-of-mind returns are not accepted unless required by law. ${getPublicRestockingFeeLabel(settings)}`;
  }

  return `Qualifying ${conditionLabel} can be returned within ${windowLabel} after delivery. The customer pays the return courier for change-of-mind returns. ${getPublicRestockingFeeLabel(settings)}`;
}

export function getPublicReturnsFaqAnswer(settings: PublicReturnsSettings) {
  const summary = getPublicReturnsSummary(settings);
  const refundLabel = getPublicRefundProcessingLabel(settings);
  const exchangeCopy = settings.returnsExchangesEnabled
    ? "Exchanges are accepted when the product and safety rules allow it."
    : "Exchanges are not currently offered unless required by law.";
  const hazardousCopy = settings.returnsHazardousGoodsNoteEnabled
    ? " Contact us before returning anything, and never send LPG or a filled cylinder through an ordinary parcel service."
    : " Contact us before returning anything.";

  return `${summary} Jurgens Energy covers qualifying return transport for verified incorrect, damaged, unsafe or defective goods where required by law. Approved refunds are processed within ${refundLabel} after approval or inspection. ${exchangeCopy}${hazardousCopy}`;
}

export function getMerchantCenterReturnPolicyRows(
  settings: PublicReturnsSettings & Pick<MarketplaceSettings, "returnsPolicyUrl">,
) {
  return [
    ["Return policy URL", settings.returnsPolicyUrl],
    ["Country", "South Africa"],
    ["Returns", getMerchantCenterReturnsAcceptance(settings.returnsAcceptance)],
    [
      "Exchanges",
      settings.returnsExchangesEnabled
        ? "Yes, accept exchanges"
        : "No, do not accept exchanges",
    ],
    [
      "Product condition",
      settings.returnsProductCondition === "new_and_slightly_used"
        ? "New and slightly used products"
        : "Only new products",
    ],
    ["Return window", `Within ${getPublicReturnWindowLabel(settings)}`],
    ["Return method", getMerchantCenterReturnMethods(settings.returnsMethodCodes)],
    ["Currency", settings.returnsCurrencyCode],
    [
      "Return label",
      settings.returnsLabelResponsibility === "merchant"
        ? "Merchant's responsibility"
        : "Customer's responsibility",
    ],
    [
      "Restocking fee",
      getMerchantCenterRestockingFee(settings.returnsRestockingFeeType),
    ],
    ["Refund processing time", getPublicRefundProcessingLabel(settings)],
  ] as const;
}

function getMerchantCenterReturnsAcceptance(
  acceptance: MarketplaceReturnAcceptance,
) {
  if (acceptance === "defective_and_non_defective") {
    return "Yes, accept returns for defective and non-defective products";
  }

  if (acceptance === "defective_only") {
    return "I accept returns for defective products only";
  }

  return "No, I don't accept returns";
}

function getMerchantCenterReturnMethods(methods: MarketplaceReturnMethod[]) {
  const activeMethods = methods.length > 0 ? methods : ["by_post"];
  const labels = activeMethods.map((method) => {
    if (method === "dropoff") {
      return "At a drop-off location";
    }

    if (method === "in_store") {
      return "In-store";
    }

    return "By post";
  });

  return labels.join(", ");
}

function getMerchantCenterRestockingFee(
  feeType: MarketplaceReturnRestockingFee,
) {
  if (feeType === "fixed") {
    return "Fixed cost";
  }

  if (feeType === "percentage") {
    return "Percentage of product price";
  }

  return "No cost";
}

function normalizeDays(
  value: number,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  return Number.isInteger(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-ZA", {
    currency: currencyCode || "ZAR",
    currencyDisplay: "narrowSymbol",
    style: "currency",
  }).format(Math.max(0, value));
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    style: "percent",
  }).format(Math.max(0, Math.min(100, value)) / 100);
}
