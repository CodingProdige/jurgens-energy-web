export type PrivacyPolicyBusinessIdentity = {
  legalName: string | null;
  tradingName: string;
};

function normalizeBusinessName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-ZA");
}

function formatBusinessName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function createPrivacyResponsiblePartyStatement(
  identity: PrivacyPolicyBusinessIdentity,
) {
  const tradingName =
    formatBusinessName(identity.tradingName) || "Jurgens Energy";
  const legalName = formatBusinessName(identity.legalName ?? "");
  const operatorName =
    legalName &&
    normalizeBusinessName(legalName) !== normalizeBusinessName(tradingName)
      ? `${legalName}, trading as ${tradingName}`
      : legalName || tradingName;

  return `${operatorName} operates this online store and is the responsible party for personal information processed through the website, customer accounts, checkout, order support, and our direct communications with you.`;
}
