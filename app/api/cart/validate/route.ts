import { getCurrencyContext } from "@/src/modules/currency/server";
import { cartValidationRequestSchema } from "@/src/modules/cart/contracts";
import { validateCartLines } from "@/src/modules/cart/server";
import {
  checkRateLimit,
  getClientIp,
} from "@/src/modules/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit({
    key: `cart-validation:${clientIp}`,
    limit: 120,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "rate_limited" },
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

  const parsed = cartValidationRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "invalid_cart", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const currencyContext = await getCurrencyContext();
  const result = await validateCartLines(parsed.data, currencyContext);

  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
