import { z } from "zod";

import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getCourierGuyPickupPointLookupConfig } from "@/src/modules/marketplace/settings";
import {
  CourierGuyApiError,
  createCourierGuyClient,
} from "@/src/modules/shipping/courier-guy-client";

const pickupPointSearchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).default(20),
  mode: z.enum(["live", "sandbox"]),
  query: z.string().trim().min(2).max(120),
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
    query: url.searchParams.get("q"),
    type: url.searchParams.get("type") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      {
        message:
          "Enter at least two characters and choose a valid API environment.",
        ok: false,
      },
      { status: 400 },
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
      search: parsed.data.query,
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
    });

    return Response.json({
      count: result.count,
      ok: true,
      pickupPoints: result.pickupPoints,
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
