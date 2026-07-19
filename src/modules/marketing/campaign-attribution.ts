import { z } from "zod";

export const CAMPAIGN_ATTRIBUTION_COOKIE_NAME = "je_campaign_attribution";
export const CAMPAIGN_ATTRIBUTION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

const campaignValue = (maximumLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximumLength)
    .refine(
      (value) => !/[\u0000-\u001f\u007f]/u.test(value),
      "Campaign values cannot contain control characters.",
    );

const campaignAttributionFields = {
  gbraid: campaignValue(512).optional(),
  gclid: campaignValue(512).optional(),
  utmCampaign: campaignValue(200).optional(),
  utmContent: campaignValue(200).optional(),
  utmId: campaignValue(200).optional(),
  utmMedium: campaignValue(200).optional(),
  utmSource: campaignValue(200).optional(),
  utmTerm: campaignValue(200).optional(),
  wbraid: campaignValue(512).optional(),
};

function hasCampaignValue(value: Record<string, unknown>) {
  return Object.keys(campaignAttributionFields).some(
    (key) => typeof value[key] === "string" && value[key].length > 0,
  );
}

export const campaignAttributionInputSchema = z
  .object(campaignAttributionFields)
  .strict()
  .refine(hasCampaignValue, "Provide at least one campaign attribution value.");

export const campaignAttributionSnapshotSchema = z
  .object({
    ...campaignAttributionFields,
    capturedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine(
    hasCampaignValue,
    "Provide at least one campaign attribution value.",
  );

export type CampaignAttributionInput = z.infer<
  typeof campaignAttributionInputSchema
>;
export type CampaignAttributionSnapshot = z.infer<
  typeof campaignAttributionSnapshotSchema
>;

export function createCampaignAttributionSnapshot(
  input: CampaignAttributionInput,
  capturedAt = new Date(),
): CampaignAttributionSnapshot {
  const attribution = campaignAttributionInputSchema.parse(input);

  return campaignAttributionSnapshotSchema.parse({
    ...attribution,
    capturedAt: capturedAt.toISOString(),
  });
}

export function serializeCampaignAttributionCookie(
  snapshot: CampaignAttributionSnapshot,
) {
  const parsed = campaignAttributionSnapshotSchema.parse(snapshot);

  return Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url");
}

export function parseCampaignAttributionCookie(
  value: string | null | undefined,
): CampaignAttributionSnapshot | null {
  if (!value || value.length > 4096) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    const parsed = campaignAttributionSnapshotSchema.safeParse(decoded);

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
