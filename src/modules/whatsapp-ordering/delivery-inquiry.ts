import { z } from "zod";

const deliveryInquiryStepSchema = z.enum([
  "awaiting_product",
  "awaiting_product_choice",
  "awaiting_postal_code",
  "awaiting_address",
  "resolved",
]);

const deliveryProductChoiceSchema = z.object({
  label: z.string().trim().min(1).max(320),
  variantId: z.string().uuid(),
});

const deliveryAddressDraftSchema = z.object({
  addressLine1: z.string().trim().min(1).max(240).optional(),
  addressLine2: z.string().trim().max(240).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  countryCode: z.literal("ZA").default("ZA"),
  postalCode: z.string().trim().regex(/^\d{4}$/).optional(),
  province: z.string().trim().min(1).max(120).optional(),
  suburb: z.string().trim().min(1).max(120).optional(),
});

const completeDeliveryAddressSchema = deliveryAddressDraftSchema.required({
  addressLine1: true,
  city: true,
  countryCode: true,
  postalCode: true,
  province: true,
  suburb: true,
});

const deliveryInquiryResultSchema = z.object({
  checkedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable().default(null),
  reply: z.string().trim().min(1).max(4000),
});

export const whatsappDeliveryInquirySchema = z.object({
  address: deliveryAddressDraftSchema.optional(),
  choices: z.array(deliveryProductChoiceSchema).max(3).default([]),
  customerPrompt: z.string().trim().max(1500).default(""),
  destinationHint: z.string().trim().max(240).nullable().default(null),
  lastProbeAt: z.string().datetime().nullable().default(null),
  lastResult: deliveryInquiryResultSchema.nullable().default(null),
  postalCode: z.string().trim().regex(/^\d{4}$/).nullable().default(null),
  quantity: z.coerce.number().int().min(1).max(12).default(1),
  selectedVariantId: z.string().uuid().nullable().default(null),
  step: deliveryInquiryStepSchema,
  updatedAt: z.string().datetime(),
});

export type WhatsappDeliveryAddress = z.infer<
  typeof completeDeliveryAddressSchema
>;
export type WhatsappDeliveryAddressDraft = z.infer<
  typeof deliveryAddressDraftSchema
>;
export type WhatsappDeliveryInquiry = z.infer<
  typeof whatsappDeliveryInquirySchema
>;
export type WhatsappDeliveryProductChoice = z.infer<
  typeof deliveryProductChoiceSchema
>;

const deliveryInquiryTtlMs = 30 * 60 * 1000;

export function parseWhatsappDeliveryInquiry(
  value: unknown,
): WhatsappDeliveryInquiry | null {
  const parsed = whatsappDeliveryInquirySchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  const updatedAt = new Date(parsed.data.updatedAt).getTime();

  if (
    !Number.isFinite(updatedAt) ||
    Date.now() - updatedAt >= deliveryInquiryTtlMs
  ) {
    return null;
  }

  return parsed.data;
}

export function isDeliveryCoverageQuestion(message: string) {
  const text = normalizeMessage(message);
  const hasDeliveryTerm =
    /\b(deliver|delivered|delivering|delivers|delivery|ship|shipped|ships|shipping|courier)\b/.test(
      text,
    );
  const hasCoverageTerm =
    /\b(area|available|availability|cost|fee|in|postal|postcode|rate|rates|to|where)\b/.test(
      text,
    );

  return hasDeliveryTerm && hasCoverageTerm;
}

export function extractDeliveryDestinationHint(message: string) {
  const match = message.match(
    /\b(?:deliver(?:ed|ing|s|y)?|ship(?:ped|ping|s)?|courier)\b.*\b(?:to|in)\s+(.+?)(?:[?.!]|$)/i,
  );
  const hint = match?.[1]
    ?.replace(/\b(?:please|thanks|thank you)\b.*$/i, "")
    .trim();

  return hint ? hint.slice(0, 240) : null;
}

export function extractSouthAfricanPostalCode(
  message: string,
  { allowBare = false }: { allowBare?: boolean } = {},
) {
  const labelled = message.match(
    /\b(?:postal\s*code|postcode|zip\s*code)\s*[:#-]?\s*(\d{4})\b/i,
  );

  if (labelled?.[1]) {
    return labelled[1];
  }

  const trimmed = message.trim();

  if (allowBare) {
    const bareMatch = trimmed.match(
      /^(?:(?:what\s+about|try|use|postcode|postal\s+code)\s*[:#-]?\s*)?(\d{4})[?.!]?$/i,
    );

    if (bareMatch?.[1]) {
      return bareMatch[1];
    }
  }

  if (isDeliveryCoverageQuestion(message)) {
    const hint = extractDeliveryDestinationHint(message);
    const hintedPostalCode = hint?.match(/\b(\d{4})\b/)?.[1];

    if (hintedPostalCode) {
      return hintedPostalCode;
    }

    const postalCodes = Array.from(message.matchAll(/\b(\d{4})\b/g)).map(
      (match) => match[1],
    );

    return postalCodes.length === 1 ? postalCodes[0]! : null;
  }

  return null;
}

export function parseDeliveryProductChoice(message: string, choiceCount: number) {
  const match = message.trim().match(/^(?:option\s*)?(\d)[.)]?[!.]?$/i);

  if (!match?.[1]) {
    return null;
  }

  const index = Number(match[1]) - 1;

  return index >= 0 && index < choiceCount ? index : null;
}

export function mergeDeliveryAddressDraft({
  current,
  message,
}: {
  current?: WhatsappDeliveryAddressDraft;
  message: string;
}) {
  const next: WhatsappDeliveryAddressDraft = {
    ...current,
    countryCode: "ZA",
  };
  let matched = false;
  const pipeParts = message
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (pipeParts.length === 5 || pipeParts.length === 6) {
    const [addressLine1, suburb, city, province, postalCode, addressLine2] =
      pipeParts;

    if (/^\d{4}$/.test(postalCode ?? "")) {
      Object.assign(next, {
        addressLine1,
        ...(addressLine2 ? { addressLine2 } : {}),
        city,
        postalCode,
        province,
        suburb,
      });
      matched = true;
    }
  }

  for (const rawLine of message.split(/\r?\n/)) {
    const line = rawLine.trim();
    const separatorIndex = line.search(/[:=-]/);

    if (separatorIndex <= 0) {
      continue;
    }

    const label = normalizeMessage(line.slice(0, separatorIndex));
    const value = line.slice(separatorIndex + 1).trim();

    if (!value) {
      continue;
    }

    if (/^(street|street address|address|address line 1)$/.test(label)) {
      next.addressLine1 = value.slice(0, 240);
      matched = true;
    } else if (/^(address line 2|unit|complex)$/.test(label)) {
      next.addressLine2 = value.slice(0, 240);
      matched = true;
    } else if (/^(suburb|local area|area)$/.test(label)) {
      next.suburb = value.slice(0, 120);
      matched = true;
    } else if (/^(city|town)$/.test(label)) {
      next.city = value.slice(0, 120);
      matched = true;
    } else if (/^(province|state)$/.test(label)) {
      next.province = value.slice(0, 120);
      matched = true;
    } else if (/^(postal code|postcode|zip code)$/.test(label)) {
      const postalCode = value.match(/\b(\d{4})\b/)?.[1];

      if (postalCode) {
        next.postalCode = postalCode;
        matched = true;
      }
    }
  }

  const barePostalCode = extractSouthAfricanPostalCode(message, {
    allowBare: true,
  });

  if (barePostalCode) {
    next.postalCode = barePostalCode;
    matched = true;
  }

  const parsed = deliveryAddressDraftSchema.safeParse(next);

  return {
    address: parsed.success ? parsed.data : current,
    matched,
  };
}

export function getCompleteDeliveryAddress(
  address: WhatsappDeliveryAddressDraft | undefined,
): WhatsappDeliveryAddress | null {
  const parsed = completeDeliveryAddressSchema.safeParse(address);

  return parsed.success ? parsed.data : null;
}

export function getMissingDeliveryAddressFields(
  address: WhatsappDeliveryAddressDraft | undefined,
) {
  const fields: string[] = [];

  if (!address?.addressLine1) {
    fields.push("street address");
  }

  if (!address?.suburb) {
    fields.push("suburb");
  }

  if (!address?.city) {
    fields.push("city");
  }

  if (!address?.province) {
    fields.push("province");
  }

  if (!address?.postalCode) {
    fields.push("postal code");
  }

  return fields;
}

export function deliveryAddressDraftsEqual(
  first: WhatsappDeliveryAddressDraft | undefined,
  second: WhatsappDeliveryAddressDraft | undefined,
) {
  const fields: Array<keyof WhatsappDeliveryAddressDraft> = [
    "addressLine1",
    "addressLine2",
    "suburb",
    "city",
    "province",
    "postalCode",
    "countryCode",
  ];

  return fields.every(
    (field) =>
      (first?.[field] ?? "").trim().toLowerCase() ===
      (second?.[field] ?? "").trim().toLowerCase(),
  );
}

function normalizeMessage(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
