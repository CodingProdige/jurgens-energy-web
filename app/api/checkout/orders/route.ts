import { createCheckoutOrderRequestSchema } from "@/src/modules/checkout/contracts";
import { createHostedCheckoutOrder } from "@/src/modules/checkout/orders";
import {
  checkRateLimit,
  getClientIp,
} from "@/src/modules/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit({
    key: `checkout-create:${clientIp}`,
    limit: 10,
    windowSeconds: 600,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "rate_limited", message: "Please wait before trying again." },
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

  const parsed = createCheckoutOrderRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "invalid_checkout", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await createHostedCheckoutOrder(parsed.data);

    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error: "checkout_creation_failed",
        message:
          error instanceof Error ? error.message : "Checkout could not be started.",
      },
      { status: 400 },
    );
  }
}
