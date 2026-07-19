export type SeoAdminPageView = {
  canonicalUrl: string;
  description: string;
  key: string;
  label: string;
  lastScannedAt: string | null;
  issues: Array<{
    code: string;
    message: string;
    severity: "error" | "warning";
  }>;
  path: string;
  source: "ai" | "default" | "manual" | "restore";
  title: string;
  updatedAt: string | null;
};

export type SeoSuggestionView = {
  contentGaps: string[];
  description: string;
  issues: Array<{
    code: string;
    message: string;
    severity: "error" | "warning";
  }>;
  primaryTopic: string;
  reasoning: string;
  scannedAt: string;
  supportingTerms: string[];
  title: string;
  unsupportedClaims: string[];
};

export type SeoRevisionView = {
  actorLabel: string;
  createdAt: string;
  description: string;
  id: string;
  source: "ai" | "default" | "manual" | "restore";
  title: string;
};

export type SeoActionResult<T = undefined> = {
  data?: T;
  message: string;
  ok: boolean;
};
