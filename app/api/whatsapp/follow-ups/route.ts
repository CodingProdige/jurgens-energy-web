import { NextResponse } from "next/server";

import { env } from "@/src/config/env";
import { runDueWhatsappFollowUps } from "@/src/modules/admin/whatsapp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = authorizeAutomationRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 25);
  const result = await runDueWhatsappFollowUps({
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 25,
  });

  return NextResponse.json(
    { ok: true, result },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

function authorizeAutomationRequest(request: Request) {
  if (!env.WHATSAPP_AUTOMATION_SECRET) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "whatsapp_automation_secret_not_configured" },
        { status: 503 },
      );
    }

    return null;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  const headerToken = request.headers.get("x-whatsapp-automation-secret");

  if (
    bearerToken === env.WHATSAPP_AUTOMATION_SECRET ||
    headerToken === env.WHATSAPP_AUTOMATION_SECRET
  ) {
    return null;
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
