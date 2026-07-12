import {
  checkoutQuoteRequestSchema,
} from "@/src/modules/checkout/contracts";
import { getCheckoutDeliveryQuotes } from "@/src/modules/checkout/delivery";
import {
  checkRateLimit,
  getClientIp,
} from "@/src/modules/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit({
    key: `checkout-quotes:${clientIp}`,
    limit: 30,
    windowSeconds: 300,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "rate_limited", message: "Please wait before requesting new rates." },
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

  const parsed = checkoutQuoteRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "invalid_checkout", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await getCheckoutDeliveryQuotes(parsed.data);

    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error: "delivery_quote_failed",
        message:
          error instanceof Error
            ? error.message
            : "Delivery rates could not be calculated.",
      },
      { status: 400 },
    );
  }
}
