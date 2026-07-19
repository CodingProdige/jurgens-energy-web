export type JurgensDeliveryPostalZoneLike = {
  id: string;
  name: string;
  postalCodes: string[];
};

export type JurgensDeliveryPostalCodeConflict = {
  candidateRule: string;
  existingRule: string;
  existingZoneId: string;
  existingZoneName: string;
  postalCode: string;
};

export type JurgensDeliveryPostalZoneResolution<
  TZone extends JurgensDeliveryPostalZoneLike,
> =
  | { status: "none" }
  | { status: "matched"; zone: TZone }
  | { status: "conflict"; zones: TZone[] };

type ParsedPostalCodeRule =
  | { kind: "exact"; value: string }
  | { kind: "prefix"; prefix: string }
  | { end: number; kind: "range"; start: number };

export function normalizeJurgensDeliveryPostalCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizeJurgensDeliveryPostalCodeRules(
  values: unknown,
): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) =>
          normalizeJurgensDeliveryPostalCode(String(value)),
        )
        .filter(Boolean),
    ),
  );
}

export function jurgensDeliveryPostalCodeMatchesRule(
  postalCode: string,
  rule: string,
) {
  const normalizedPostalCode = normalizeJurgensDeliveryPostalCode(postalCode);
  const normalizedRule = normalizeJurgensDeliveryPostalCode(rule);

  if (!normalizedPostalCode || !normalizedRule) {
    return false;
  }

  if (normalizedRule.endsWith("*")) {
    return normalizedPostalCode.startsWith(normalizedRule.slice(0, -1));
  }

  const rangeMatch = normalizedRule.match(/^(\d+)-(\d+)$/);

  if (rangeMatch) {
    const current = Number(normalizedPostalCode);
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);

    return (
      Number.isFinite(current) &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      current >= Math.min(start, end) &&
      current <= Math.max(start, end)
    );
  }

  return normalizedPostalCode === normalizedRule;
}

export function resolveJurgensDeliveryPostalZone<
  TZone extends JurgensDeliveryPostalZoneLike,
>(
  postalCode: string,
  zones: TZone[],
): JurgensDeliveryPostalZoneResolution<TZone> {
  const normalizedPostalCode = normalizeJurgensDeliveryPostalCode(postalCode);
  const matches = zones
    .filter((zone) =>
      normalizeJurgensDeliveryPostalCodeRules(zone.postalCodes).some((rule) =>
        jurgensDeliveryPostalCodeMatchesRule(normalizedPostalCode, rule),
      ),
    )
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
    );

  if (matches.length === 0) {
    return { status: "none" };
  }

  if (matches.length > 1) {
    return { status: "conflict", zones: matches };
  }

  return { status: "matched", zone: matches[0]! };
}

export function findJurgensDeliveryPostalCodeConflicts({
  candidatePostalCodes,
  existingZones,
}: {
  candidatePostalCodes: string[];
  existingZones: JurgensDeliveryPostalZoneLike[];
}): JurgensDeliveryPostalCodeConflict[] {
  const candidateRules = normalizeJurgensDeliveryPostalCodeRules(
    candidatePostalCodes,
  );
  const conflicts: JurgensDeliveryPostalCodeConflict[] = [];

  for (const zone of existingZones) {
    const existingRules = normalizeJurgensDeliveryPostalCodeRules(
      zone.postalCodes,
    );

    for (const candidateRule of candidateRules) {
      for (const existingRule of existingRules) {
        const postalCode = findPostalCodeRuleOverlap(
          candidateRule,
          existingRule,
        );

        if (postalCode === null) {
          continue;
        }

        conflicts.push({
          candidateRule,
          existingRule,
          existingZoneId: zone.id,
          existingZoneName: zone.name,
          postalCode,
        });
      }
    }
  }

  return conflicts.sort(
    (left, right) =>
      comparePostalCodes(left.postalCode, right.postalCode) ||
      left.existingZoneName.localeCompare(right.existingZoneName) ||
      left.existingZoneId.localeCompare(right.existingZoneId) ||
      left.candidateRule.localeCompare(right.candidateRule) ||
      left.existingRule.localeCompare(right.existingRule),
  );
}

function findPostalCodeRuleOverlap(leftRule: string, rightRule: string) {
  const normalizedLeft = normalizeJurgensDeliveryPostalCode(leftRule);
  const normalizedRight = normalizeJurgensDeliveryPostalCode(rightRule);
  const left = parsePostalCodeRule(normalizedLeft);
  const right = parsePostalCodeRule(normalizedRight);

  if (!left || !right) {
    return null;
  }

  if (left.kind === "exact") {
    return jurgensDeliveryPostalCodeMatchesRule(left.value, normalizedRight)
      ? left.value
      : null;
  }

  if (right.kind === "exact") {
    return jurgensDeliveryPostalCodeMatchesRule(right.value, normalizedLeft)
      ? right.value
      : null;
  }

  if (left.kind === "range" && right.kind === "range") {
    const start = Math.max(left.start, right.start);
    const end = Math.min(left.end, right.end);

    return start <= end ? String(start) : null;
  }

  if (left.kind === "prefix" && right.kind === "prefix") {
    if (left.prefix.startsWith(right.prefix)) {
      return createPostalCodeForPrefix(left.prefix);
    }

    if (right.prefix.startsWith(left.prefix)) {
      return createPostalCodeForPrefix(right.prefix);
    }

    return null;
  }

  if (left.kind === "prefix" && right.kind === "range") {
    return findPrefixRangeOverlap(left.prefix, right.start, right.end);
  }

  if (left.kind === "range" && right.kind === "prefix") {
    return findPrefixRangeOverlap(right.prefix, left.start, left.end);
  }

  return null;
}

function parsePostalCodeRule(rule: string): ParsedPostalCodeRule | null {
  if (!rule) {
    return null;
  }

  if (rule.endsWith("*")) {
    return { kind: "prefix", prefix: rule.slice(0, -1) };
  }

  const rangeMatch = rule.match(/^(\d+)-(\d+)$/);

  if (rangeMatch) {
    const first = Number(rangeMatch[1]);
    const second = Number(rangeMatch[2]);

    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      return null;
    }

    return {
      end: Math.max(first, second),
      kind: "range",
      start: Math.min(first, second),
    };
  }

  return { kind: "exact", value: rule };
}

function findPrefixRangeOverlap(prefix: string, start: number, end: number) {
  if (!/^\d*$/.test(prefix)) {
    return null;
  }

  if (!prefix) {
    return String(start);
  }

  const prefixNumber = Number(prefix);
  const maximumSuffixLength = Math.min(
    12,
    Math.max(1, String(Math.trunc(end)).length - prefix.length + 1),
  );

  for (let suffixLength = 0; suffixLength <= maximumSuffixLength; suffixLength += 1) {
    const multiplier = 10 ** suffixLength;
    const prefixMinimum = prefixNumber * multiplier;
    const prefixMaximum = prefixMinimum + multiplier - 1;
    const overlapStart = Math.max(start, prefixMinimum);
    const overlapEnd = Math.min(end, prefixMaximum);

    if (overlapStart > overlapEnd) {
      continue;
    }

    const suffix = suffixLength === 0
      ? ""
      : String(overlapStart - prefixMinimum).padStart(suffixLength, "0");
    const candidate = `${prefix}${suffix}`;

    if (
      jurgensDeliveryPostalCodeMatchesRule(candidate, `${prefix}*`) &&
      jurgensDeliveryPostalCodeMatchesRule(candidate, `${start}-${end}`)
    ) {
      return candidate;
    }
  }

  return null;
}

function createPostalCodeForPrefix(prefix: string) {
  if (!prefix) {
    return "0000";
  }

  return /^\d+$/.test(prefix) && prefix.length < 4
    ? prefix.padEnd(4, "0")
    : prefix;
}

function comparePostalCodes(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber || left.localeCompare(right);
  }

  return left.localeCompare(right);
}
