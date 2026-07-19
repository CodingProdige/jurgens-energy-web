import { cookies } from "next/headers";

import {
  CAMPAIGN_ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
  CAMPAIGN_ATTRIBUTION_COOKIE_NAME,
  campaignAttributionInputSchema,
  createCampaignAttributionSnapshot,
  serializeCampaignAttributionCookie,
} from "@/src/modules/marketing/campaign-attribution";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = campaignAttributionInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "invalid_campaign_attribution",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const snapshot = createCampaignAttributionSnapshot(parsed.data);
  const cookieStore = await cookies();

  cookieStore.set(
    CAMPAIGN_ATTRIBUTION_COOKIE_NAME,
    serializeCampaignAttributionCookie(snapshot),
    {
      httpOnly: true,
      maxAge: CAMPAIGN_ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      priority: "medium",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );

  return Response.json(
    { captured: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function DELETE() {
  const cookieStore = await cookies();

  cookieStore.set(CAMPAIGN_ATTRIBUTION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    priority: "medium",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return new Response(null, {
    headers: { "Cache-Control": "private, no-store" },
    status: 204,
  });
}
