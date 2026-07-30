import { z } from "zod";

import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getBusinessInformation } from "@/src/modules/business-information";
import { getCourierGuyPickupPointLookupConfig } from "@/src/modules/marketplace/settings";
import {
  CourierGuyApiError,
  createCourierGuyClient,
} from "@/src/modules/shipping/courier-guy-client";

const pickupPointSearchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).default(20),
  mode: z.enum(["live", "sandbox"]),
  query: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || value.length >= 2,
      "Enter at least two characters to search pickup points.",
    ),
  type: z
    .enum(["locker", "counter", "point"])
    .optional(),
});

export async function GET(request: Request) {
  const access = await requireAdminCapability("admin.settings.manage");

  if (!access.ok) {
    return Response.json(
      {
        message: "You do not have permission to search pickup points.",
        ok: false,
      },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const parsed = pickupPointSearchQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    mode: url.searchParams.get("mode"),
    query: url.searchParams.get("q") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      {
        message:
          "Choose a valid API environment and use a valid pickup-point search.",
        ok: false,
      },
      { status: 400 },
    );
  }

  let pickupPointSearch = parsed.data.query;
  let suggestionContext: string | null = null;

  if (!pickupPointSearch) {
    const businessInformation = await getBusinessInformation();
    const collectionCity = businessInformation.collectionAddressSameAsRegistered
      ? businessInformation.city.trim()
      : businessInformation.collectionCity?.trim() || "";
    const collectionPostalCode =
      businessInformation.collectionAddressSameAsRegistered
        ? businessInformation.postalCode.trim()
        : businessInformation.collectionPostalCode?.trim() || "";

    pickupPointSearch = collectionCity || collectionPostalCode || undefined;
    suggestionContext = pickupPointSearch ?? null;
  }

  if (!pickupPointSearch) {
    return Response.json(
      {
        message:
          "Add the Jurgens collection city or postcode in Business Information before loading nearby pickup points.",
        ok: false,
      },
      { status: 409 },
    );
  }

  const config = await getCourierGuyPickupPointLookupConfig(parsed.data.mode);

  if (!config.apiKey) {
    return Response.json(
      {
        message: `Save the ${parsed.data.mode} Courier Guy bearer token before searching.`,
        ok: false,
      },
      { status: 409 },
    );
  }

  try {
    const client = createCourierGuyClient({
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
      timeoutMs: 10_000,
    });
    const result = await client.getPickupPoints({
      limit: parsed.data.limit,
      orderClosest: true,
      search: pickupPointSearch,
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
    });

    return Response.json({
      count: result.count,
      directoryNotice:
        parsed.data.mode === "sandbox" && result.pickupPoints.length === 0
          ? "Sandbox returned no Courier Guy pickup points. Use “Any staffed Courier Guy kiosk” for sandbox checkout tests, or switch to Live to search the real Courier Guy directory."
          : null,
      ok: true,
      pickupPoints: result.pickupPoints,
      suggestionContext,
    });
  } catch (error) {
    const credentialsRejected =
      error instanceof CourierGuyApiError &&
      (error.status === 401 || error.status === 403);

    return Response.json(
      {
        message: credentialsRejected
          ? `Courier Guy rejected the saved ${parsed.data.mode} bearer token. Save a valid token and try again.`
          : "Courier Guy pickup points are temporarily unavailable. Try again.",
        ok: false,
      },
      { status: credentialsRejected ? 409 : 502 },
    );
  }
}
