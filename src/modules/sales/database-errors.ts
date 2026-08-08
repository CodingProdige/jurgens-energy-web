type DbErrorLike = {
  cause?: unknown;
  code?: string;
  detail?: string;
  message?: string;
};

function getDbErrorInfo(error: unknown) {
  const messages: string[] = [];
  const codes = new Set<string>();
  const seen = new Set<unknown>();

  let cursor: DbErrorLike | null =
    error && typeof error === "object" ? (error as DbErrorLike) : null;

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);

    if (typeof cursor.code === "string") {
      codes.add(cursor.code);
    }

    if (typeof cursor.message === "string") {
      messages.push(cursor.message);
    }

    if (typeof cursor.detail === "string") {
      messages.push(cursor.detail);
    }

    cursor =
      cursor.cause && typeof cursor.cause === "object"
        ? (cursor.cause as DbErrorLike)
        : null;
  }

  return {
    codes: Array.from(codes),
    messages: messages.map((message) => message.toLowerCase()),
  };
}

export function isMissingSalesSchemaError(error: unknown) {
  const { codes, messages } = getDbErrorInfo(error);
  const recoveryCodes = new Set(["42P01", "42703", "3F000", "3D000"]);
  const hasRecoveryCode = codes.some((code) => recoveryCodes.has(code));
  const hasSaleCampaignText = messages.some((message) =>
    message.includes("sale_campaign"),
  );

  if (hasRecoveryCode) {
    return true;
  }

  if (!hasSaleCampaignText) {
    return false;
  }

  return messages.some(
    (message) =>
      message.includes("does not exist") ||
      message.includes("relation") ||
      message.includes("column") ||
      message.includes("syntax error") ||
      message.includes("failed query") ||
      message.includes("no schema") ||
      message.includes("undefined table"),
  );
}

export function getFriendlySalesErrorMessage(
  action: "create" | "delete" | "end" | "read",
  error: unknown,
) {
  const { codes, messages } = getDbErrorInfo(error);
  const code = codes[0];
  const firstMessage = messages[0] ?? "an unknown database error";
  const includesSchemaText =
    messages.some(
      (message) =>
        message.includes("relation") ||
        message.includes("does not exist") ||
        message.includes("column") ||
        message.includes("no schema") ||
        message.includes("undefined table") ||
        message.includes("failed query"),
    ) && messages.some((message) => message.includes("sale_campaign"));

  if (
    code === "42P01" ||
    code === "42703" ||
    code === "3F000" ||
    code === "3D000"
  ) {
    return `Sales tables are not fully available yet for this environment. Run "npm run db:migrate" and redeploy, then try to ${action} again.`;
  }

  if (includesSchemaText) {
    return "Sales campaign storage is not available in this environment. Run migrations and redeploy first.";
  }

  if (code === "23505") {
    return "Some selected variants are already on an active sale campaign.";
  }

  if (
    code === "42501" ||
    messages.some((message) => message.includes("permission denied"))
  ) {
    return `You do not have database permission to ${action} a sale campaign.`;
  }

  return `Could not ${action} sale campaign: ${firstMessage}.`;
}
