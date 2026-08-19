import {
  getPublicDeliveryWindow,
  publicDeliveryWindowInputSchema,
} from "@/src/modules/shipping/public-product-delivery-estimate";
import {
  checkRateLimit,
  getClientIp,
} from "@/src/modules/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit({
    key: `delivery-window:${clientIp}`,
    limit: 10,
    windowSeconds: 300,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: "rate_limited",
        message: "Please wait before checking another delivery estimate.",
      },
      {
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        status: 429,
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = publicDeliveryWindowInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "invalid_delivery_address", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const estimate = await getPublicDeliveryWindow(parsed.data);

  return Response.json(estimate, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
