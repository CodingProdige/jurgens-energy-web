import { cookies } from "next/headers";

import { createCheckoutOrderRequestSchema } from "@/src/modules/checkout/contracts";
import { createHostedCheckoutOrder } from "@/src/modules/checkout/orders";
import { getHostedPayFastForm } from "@/src/modules/checkout/payfast";
import {
  CAMPAIGN_ATTRIBUTION_COOKIE_NAME,
  parseCampaignAttributionCookie,
} from "@/src/modules/marketing/campaign-attribution";
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
      {
        error: "invalid_checkout",
        issues: parsed.error.issues,
        message:
          parsed.error.issues[0]?.message ??
          "Review the checkout details and try again.",
      },
      { status: 400 },
    );
  }

  try {
    const cookieStore = await cookies();
    const campaignAttribution = parseCampaignAttributionCookie(
      cookieStore.get(CAMPAIGN_ATTRIBUTION_COOKIE_NAME)?.value,
    );
    const result = await createHostedCheckoutOrder(parsed.data, {
      campaignAttribution,
    });
    const paymentForm = await getHostedPayFastForm(
      result.orderId,
      result.checkoutToken,
    );

    if (!paymentForm) {
      throw new Error(
        "Secure PayFast checkout could not be opened. Please try again.",
      );
    }

    return Response.json(
      {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        paymentForm: {
          fields: paymentForm.fields,
          processUrl: paymentForm.processUrl,
        },
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
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
