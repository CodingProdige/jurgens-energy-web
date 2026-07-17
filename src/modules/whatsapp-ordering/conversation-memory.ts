type NormalizedMemoryLimits = {
  maxFacts: number;
  maxRecentCharacters: number;
  maxSummaryCharacters: number;
  maxTurnCharacters: number;
  maxTurns: number;
};

const defaultLimits: NormalizedMemoryLimits = {
  maxFacts: 12,
  maxRecentCharacters: 6_000,
  maxSummaryCharacters: 2_000,
  maxTurnCharacters: 1_000,
  maxTurns: 12,
};

const purchaseTypes = new Set(["exchange", "standard"]);
const deliverySteps = new Set([
  "awaiting_product",
  "awaiting_product_choice",
  "awaiting_postal_code",
  "awaiting_address",
  "resolved",
]);
const rollingMemoryVersion = 1 as const;

export type WhatsappMemoryDirection = "inbound" | "outbound";

export type WhatsappMemoryTurn = {
  body: string;
  direction: WhatsappMemoryDirection;
};

export type WhatsappPendingAction =
  | "cancel_order"
  | "confirm_order"
  | "create_checkout"
  | "human_handover"
  | "issue_refund"
  | "send_payment_link";

export type WhatsappConfirmationSemantics =
  | "ambiguous"
  | "confirmed"
  | "declined"
  | "not_confirmation";

export type WhatsappRollingMemory = {
  facts: string[];
  summary: string;
  version: typeof rollingMemoryVersion;
};

export type WhatsappWorkflowMemory = {
  delivery: {
    destinationKnown: boolean;
    postalCodeKnown: boolean;
    quantity: number;
    selectedProductKnown: boolean;
    step: string | null;
  } | null;
  order: {
    pendingConfirmation: boolean;
    purchaseType: "exchange" | "standard" | null;
    quantity: number;
    sizeKg: number | null;
  } | null;
  pendingAction: WhatsappPendingAction | null;
};

export type WhatsappModelMemory = {
  currentInbound: string;
  recentTurns: WhatsappMemoryTurn[];
  rollingMemory: WhatsappRollingMemory;
  workflow: WhatsappWorkflowMemory;
  workflowSummary: string;
};

type MemoryLimits = Partial<NormalizedMemoryLimits>;

type PrivacyOptions = {
  knownNames?: Array<string | null | undefined>;
};

type BuildWhatsappModelMemoryInput = PrivacyOptions & {
  currentInbound: string;
  limits?: MemoryLimits;
  recentTurns: WhatsappMemoryTurn[];
  rollingMemory?: unknown;
  workflowState?: unknown;
};

export type WhatsappConversationEvaluationCase = {
  currentInbound: string;
  expectedConfirmation?: WhatsappConfirmationSemantics;
  expectedContext?: string[];
  forbiddenContext?: string[];
  knownNames?: string[];
  mustIncludeExactReplyFacts?: string[];
  mustNotIncludeReply?: string[];
  pendingAction?: WhatsappPendingAction | null;
  recentTurns: WhatsappMemoryTurn[];
  reply?: string;
  rollingMemory?: unknown;
  workflowState?: unknown;
};

export type WhatsappConversationEvaluationResult = {
  failures: string[];
  passed: boolean;
};

/**
 * Builds the only conversation-memory shape that should be supplied to a model.
 * Raw database rows and the full WhatsApp state object should remain server-side.
 */
export function buildWhatsappModelMemory({
  currentInbound,
  knownNames = [],
  limits: requestedLimits,
  recentTurns,
  rollingMemory,
  workflowState,
}: BuildWhatsappModelMemoryInput): WhatsappModelMemory {
  const limits = normalizeLimits(requestedLimits);
  const privacyOptions = { knownNames };
  const priorTurns = omitTrailingCurrentInbound(recentTurns, currentInbound);
  const sanitizedTurns = priorTurns
    .map((turn) => ({
      body: sliceUnicode(
        sanitizeWhatsappTextForModel(turn.body, privacyOptions),
        limits.maxTurnCharacters,
      ),
      direction: turn.direction,
    }))
    .filter((turn) => turn.body);
  const boundedTurns = boundRecentTurns(sanitizedTurns, limits);
  const normalizedRollingMemory = normalizeWhatsappRollingMemory(
    rollingMemory,
    privacyOptions,
    limits,
  );
  const workflow = normalizeWhatsappWorkflowMemory(workflowState);

  return {
    currentInbound: sliceUnicode(
      sanitizeWhatsappTextForModel(currentInbound, privacyOptions),
      limits.maxTurnCharacters,
    ),
    recentTurns: boundedTurns,
    rollingMemory: normalizedRollingMemory,
    workflow,
    workflowSummary: formatWhatsappWorkflowMemory(workflow),
  };
}

/**
 * Removes identity and delivery-address data while retaining authoritative
 * commerce facts such as amounts, order references and usable URLs verbatim.
 */
export function sanitizeWhatsappTextForModel(
  input: string,
  { knownNames = [] }: PrivacyOptions = {},
) {
  if (!input.trim()) {
    return "";
  }

  const protectedValues: string[] = [];
  const protect = (value: string) => {
    const token = `⟦PROTECTED_${protectedValues.length}⟧`;
    protectedValues.push(value);
    return token;
  };
  let safe = input.normalize("NFKC");

  // A checkout/product URL and an order number are operational facts. Protect
  // them before the generic UUID/phone filters run so they are not corrupted.
  safe = safe.replace(/https?:\/\/[^\s<>()]+/giu, protect);
  safe = safe.replace(
    /\b(?:JE-\d{8}-[A-Z0-9]+|INV-?\d+)\b/giu,
    protect,
  );
  safe = safe
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
      "[email omitted]",
    )
    .replace(/(?:\+?\d[\d \t().-]{6,}\d)/gu, redactPhoneCandidate);

  const names = [...new Set(knownNames)]
    .filter((name): name is string => Boolean(name?.trim()))
    .map((name) => name.normalize("NFKC").replace(/\s+/gu, " ").trim())
    .filter((name) => Array.from(name).length >= 2)
    .sort((first, second) => second.length - first.length);

  for (const name of names) {
    safe = safe.replace(
      new RegExp(
        `(?<![\\p{L}\\p{M}])${escapeRegExp(name)}(?![\\p{L}\\p{M}])`,
        "giu",
      ),
      "[customer name omitted]",
    );
  }

  safe = safe
    .replace(
      /\b(?:my name is|the name is|my naam is|ek heet)\s+(?:\p{Lu}[\p{L}\p{M}'’.-]*)(?:\s+\p{Lu}[\p{L}\p{M}'’.-]*){0,3}/gu,
      "Customer name: [omitted]",
    )
    .replace(
      /\b(?:i am|i'm|ek is)\s+(?:\p{Lu}[\p{L}\p{M}'’.-]*)(?:\s+\p{Lu}[\p{L}\p{M}'’.-]*){0,3}/gu,
      "Customer name: [omitted]",
    )
    .replace(
      /\b(?:customer|account|full)\s+name\s*:\s*[^\n]+/giu,
      "Customer name: [omitted]",
    )
    .replace(
      /\b(?:street\s+address|delivery\s+address|address(?:\s+line\s+[12])?|suburb|city|province|postal\s+code|postcode)\s*:\s*[^\n]+/giu,
      "Delivery detail: [omitted]",
    )
    .replace(
      /\b\d{1,6}\s+[\p{L}\p{M}0-9'’.-]+(?:\s+[\p{L}\p{M}0-9'’.-]+){0,6}\s+(?:street|straat|road|rd|avenue|ave|lane|ln|drive|dr|close|crescent|way|boulevard|blvd)\b[^\n]*/giu,
      "[street address omitted]",
    )
    .replace(
      /\b(?:customer|account|user|conversation|product|variant|draft)\s+id\s*:\s*[^\s,;]+/giu,
      "[internal ID omitted]",
    )
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu,
      "[internal ID omitted]",
    )
    .replace(
      /\b(?:postal\s+code|postcode)\s*(?:is|=|:|-)?\s*\d{4}\b/giu,
      "[postal code omitted]",
    )
    .replace(/\b\d{4}\b/gu, "[postal code omitted]");

  safe = protectedValues.reduce(
    (result, value, index) =>
      result.replace(`⟦PROTECTED_${index}⟧`, value),
    safe,
  );

  return safe.replace(/[ \t]+/gu, " ").replace(/ *\n */gu, "\n").trim();
}

export function omitTrailingCurrentInbound(
  turns: WhatsappMemoryTurn[],
  currentInbound: string,
) {
  const lastTurn = turns.at(-1);

  if (
    lastTurn?.direction === "inbound" &&
    normalizeComparableText(lastTurn.body) ===
      normalizeComparableText(currentInbound)
  ) {
    return turns.slice(0, -1);
  }

  return [...turns];
}

export function normalizeWhatsappRollingMemory(
  value: unknown,
  privacyOptions: PrivacyOptions = {},
  requestedLimits?: MemoryLimits,
): WhatsappRollingMemory {
  const limits = normalizeLimits(requestedLimits);
  const record = asRecord(value);
  const rawFacts = Array.isArray(record?.facts) ? record.facts : [];
  const facts = rawFacts
    .filter((fact): fact is string => typeof fact === "string")
    .map((fact) =>
      sliceUnicode(
        sanitizeWhatsappTextForModel(fact, privacyOptions),
        limits.maxTurnCharacters,
      ),
    )
    .filter(Boolean)
    .slice(-limits.maxFacts);
  const summary =
    typeof record?.summary === "string"
      ? sliceUnicode(
          sanitizeWhatsappTextForModel(record.summary, privacyOptions),
          limits.maxSummaryCharacters,
        )
      : "";

  return { facts, summary, version: rollingMemoryVersion };
}

export function updateWhatsappRollingMemory({
  current,
  knownNames = [],
  limits: requestedLimits,
  summary,
  verifiedFacts = [],
}: PrivacyOptions & {
  current?: unknown;
  limits?: MemoryLimits;
  summary?: string;
  verifiedFacts?: string[];
}): WhatsappRollingMemory {
  const limits = normalizeLimits(requestedLimits);
  const privacyOptions = { knownNames };
  const previous = normalizeWhatsappRollingMemory(
    current,
    privacyOptions,
    limits,
  );
  const nextFacts = [...previous.facts, ...verifiedFacts]
    .map((fact) =>
      sliceUnicode(
        sanitizeWhatsappTextForModel(fact, privacyOptions),
        limits.maxTurnCharacters,
      ),
    )
    .filter(Boolean);
  const deduplicatedFacts = [...new Set(nextFacts)].slice(-limits.maxFacts);

  return {
    facts: deduplicatedFacts,
    summary: sliceUnicode(
      sanitizeWhatsappTextForModel(summary ?? previous.summary, privacyOptions),
      limits.maxSummaryCharacters,
    ),
    version: rollingMemoryVersion,
  };
}

/**
 * Converts the existing jsonb workflow state to a deliberately identity-free
 * model view. Product, variant, draft and customer IDs never leave the server.
 */
export function normalizeWhatsappWorkflowMemory(
  value: unknown,
): WhatsappWorkflowMemory {
  const state = asRecord(value);
  const partialOrder = asRecord(state?.partialOrder);
  const pendingOrder = asRecord(state?.pendingOrder);
  const pendingCandidate = asRecord(pendingOrder?.candidate);
  const deliveryInquiry = asRecord(state?.deliveryInquiry);
  const orderSource = pendingCandidate ?? partialOrder;
  const purchaseType =
    typeof orderSource?.purchaseType === "string" &&
    purchaseTypes.has(orderSource.purchaseType)
    ? (orderSource?.purchaseType as "exchange" | "standard")
    : null;
  const sizeKg = normalizeNullableNumber(partialOrder?.sizeKg, 1, 48);
  const order = orderSource
    ? {
        pendingConfirmation: Boolean(pendingCandidate),
        purchaseType,
        quantity: normalizeInteger(orderSource.quantity, 1, 12, 1),
        sizeKg,
      }
    : null;
  const deliveryStep =
    typeof deliveryInquiry?.step === "string" &&
    deliverySteps.has(deliveryInquiry.step)
      ? deliveryInquiry.step
      : null;
  const delivery = deliveryInquiry
    ? {
        destinationKnown: Boolean(
          typeof deliveryInquiry.destinationHint === "string" ||
            asRecord(deliveryInquiry.address),
        ),
        postalCodeKnown: Boolean(
          deliveryInquiry.postalCode ||
            asRecord(deliveryInquiry.address)?.postalCode,
        ),
        quantity: normalizeInteger(deliveryInquiry.quantity, 1, 12, 1),
        selectedProductKnown: Boolean(deliveryInquiry.selectedVariantId),
        step: deliveryStep,
      }
    : null;

  return {
    delivery,
    order,
    pendingAction: pendingCandidate ? "confirm_order" : null,
  };
}

export function formatWhatsappWorkflowMemory(
  workflow: WhatsappWorkflowMemory,
) {
  const lines: string[] = [];

  if (workflow.order) {
    lines.push(
      [
        workflow.order.pendingConfirmation
          ? "Order offer is waiting for explicit customer confirmation."
          : "A partial order request is active.",
        `Quantity: ${workflow.order.quantity}.`,
        `Cylinder size: ${workflow.order.sizeKg ? `${workflow.order.sizeKg}kg` : "not supplied"}.`,
        `Purchase type: ${workflow.order.purchaseType ?? "not supplied"}.`,
      ].join(" "),
    );
  }

  if (workflow.delivery) {
    lines.push(
      [
        `Delivery workflow: ${workflow.delivery.step ?? "active"}.`,
        `Product selected: ${workflow.delivery.selectedProductKnown ? "yes" : "no"}.`,
        `Destination supplied: ${workflow.delivery.destinationKnown ? "yes" : "no"}.`,
        `Postal code supplied: ${workflow.delivery.postalCodeKnown ? "yes" : "no"}.`,
        `Quantity: ${workflow.delivery.quantity}.`,
      ].join(" "),
    );
  }

  return lines.length > 0
    ? lines.join("\n")
    : "No product, order-confirmation, or delivery workflow is currently pending.";
}

/**
 * Confirmation words are actionable only when the server says an action is
 * pending. Questions, corrections and mixed yes/but messages stay ambiguous.
 */
export function classifyWhatsappConfirmation({
  message,
  pendingAction,
}: {
  message: string;
  pendingAction: WhatsappPendingAction | null;
}): WhatsappConfirmationSemantics {
  if (!pendingAction) {
    return "not_confirmation";
  }

  const normalized = normalizeComparableText(message);
  const asksQuestion = /\?/u.test(message) ||
    /^(?:are|can|could|did|do|does|how|is|what|when|where|why|will|would|het|hoe|is|kan|lewer|sal|wanneer|waar|waarom|wat)\b/u.test(
      normalized,
    );
  const hasCorrection =
    /\b(?:but|change|instead|make it|not that|rather|wrong|maar|verander|eerder|maak dit|nie daai|verkeerd)\b/u.test(
      normalized,
    );
  const affirmative = /^(?:yes|yes please|yes correct|yes that s correct|yep|yeah|that s correct|that s right|looks good|correct|confirmed|confirm|go ahead|please proceed|send it|send the link|okay|ok|ja|ja asseblief|ja dit is reg|ja dis reg|ja stuur dit|ja stuur die link|jip|dit is reg|dis reg|korrek|reg|bevestig|gaan voort|stuur dit|stuur die link|doen dit)(?: asseblief| please)?$/u.test(
    normalized,
  );
  const negative = /^(?:no|no thanks|cancel|cancel it|wrong|never mind|nevermind|nee|nee dankie|kanselleer|los dit|verkeerd)$/u.test(
    normalized,
  );

  if (hasCorrection || asksQuestion) {
    return affirmative || negative || /^(?:yes|ja|no|nee)\b/u.test(normalized)
      ? "ambiguous"
      : "not_confirmation";
  }

  if (negative) {
    return "declined";
  }

  if (/^(?:yes|ja|no|nee)\b/u.test(normalized)) {
    return affirmative ? "confirmed" : "ambiguous";
  }

  return affirmative ? "confirmed" : "not_confirmation";
}

/**
 * Deterministic guardrail/evaluation helper. It is intentionally suitable for
 * committed regression fixtures and does not make a paid model request.
 */
export function evaluateWhatsappConversationCase(
  scenario: WhatsappConversationEvaluationCase,
): WhatsappConversationEvaluationResult {
  const failures: string[] = [];
  const memory = buildWhatsappModelMemory({
    currentInbound: scenario.currentInbound,
    knownNames: scenario.knownNames,
    recentTurns: scenario.recentTurns,
    rollingMemory: scenario.rollingMemory,
    workflowState: scenario.workflowState,
  });
  const context = [
    memory.rollingMemory.summary,
    ...memory.rollingMemory.facts,
    memory.workflowSummary,
    ...memory.recentTurns.map((turn) => turn.body),
    memory.currentInbound,
  ].join("\n");

  for (const expected of scenario.expectedContext ?? []) {
    if (!context.includes(expected)) {
      failures.push(`Model context is missing expected text: ${expected}`);
    }
  }

  for (const forbidden of scenario.forbiddenContext ?? []) {
    if (
      context
        .toLocaleLowerCase("en-ZA")
        .includes(forbidden.toLocaleLowerCase("en-ZA"))
    ) {
      failures.push(`Model context contains forbidden text: ${forbidden}`);
    }
  }

  if (scenario.expectedConfirmation) {
    const actual = classifyWhatsappConfirmation({
      message: scenario.currentInbound,
      pendingAction: scenario.pendingAction ?? memory.workflow.pendingAction,
    });

    if (actual !== scenario.expectedConfirmation) {
      failures.push(
        `Expected confirmation ${scenario.expectedConfirmation}, received ${actual}`,
      );
    }
  }

  if (scenario.reply !== undefined) {
    for (const exactFact of scenario.mustIncludeExactReplyFacts ?? []) {
      if (!scenario.reply.includes(exactFact)) {
        failures.push(`Reply changed or omitted exact fact: ${exactFact}`);
      }
    }

    for (const forbidden of scenario.mustNotIncludeReply ?? []) {
      if (
        scenario.reply
          .toLocaleLowerCase("en-ZA")
          .includes(forbidden.toLocaleLowerCase("en-ZA"))
      ) {
        failures.push(`Reply contains forbidden text: ${forbidden}`);
      }
    }

    if (/\/media\/admin-media(?:-thumbs)?\//u.test(scenario.reply)) {
      failures.push("Reply exposes an internal media path instead of provider media");
    }

    if (countQuestions(scenario.reply) > 1) {
      failures.push("Reply asks more than one question");
    }
  }

  return { failures, passed: failures.length === 0 };
}

function boundRecentTurns(
  turns: WhatsappMemoryTurn[],
  limits: NormalizedMemoryLimits,
) {
  const newest = turns.slice(-limits.maxTurns);
  const selected: WhatsappMemoryTurn[] = [];
  let characterCount = 0;

  for (let index = newest.length - 1; index >= 0; index -= 1) {
    const turn = newest[index]!;
    const remaining = limits.maxRecentCharacters - characterCount;

    if (remaining <= 0) {
      break;
    }

    const body = sliceUnicode(turn.body, remaining);

    if (body) {
      selected.unshift({ ...turn, body });
      characterCount += Array.from(body).length;
    }
  }

  return selected;
}

function normalizeLimits(limits: MemoryLimits = {}) {
  return {
    maxFacts: normalizeInteger(limits.maxFacts, 1, 40, defaultLimits.maxFacts),
    maxRecentCharacters: normalizeInteger(
      limits.maxRecentCharacters,
      500,
      20_000,
      defaultLimits.maxRecentCharacters,
    ),
    maxSummaryCharacters: normalizeInteger(
      limits.maxSummaryCharacters,
      100,
      8_000,
      defaultLimits.maxSummaryCharacters,
    ),
    maxTurnCharacters: normalizeInteger(
      limits.maxTurnCharacters,
      100,
      4_000,
      defaultLimits.maxTurnCharacters,
    ),
    maxTurns: normalizeInteger(limits.maxTurns, 2, 30, defaultLimits.maxTurns),
  };
}

function normalizeComparableText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-ZA")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? Math.max(minimum, Math.min(maximum, Math.trunc(number)))
    : fallback;
}

function normalizeNullableNumber(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  const number = Number(value);

  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

function sliceUnicode(value: string, maximumLength: number) {
  return Array.from(value).slice(0, maximumLength).join("");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countQuestions(value: string) {
  return value.replace(/https?:\/\/[^\s<>()]+/gu, "").match(/\?/gu)?.length ?? 0;
}

function redactPhoneCandidate(candidate: string) {
  const digitCount = candidate.replace(/\D/gu, "").length;

  return digitCount >= 9 ? "[phone omitted]" : candidate;
}
