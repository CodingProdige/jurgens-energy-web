import { auth } from "@/auth";
import {
  bobGoCheckoutRatesInputSchema,
  getBobGoCheckoutRates,
} from "@/src/modules/shipping/bobgo-client";
import {
  getJurgensDeliveryCheckoutRates,
  jurgensDeliveryCheckoutRatesInputSchema,
} from "@/src/modules/shipping/jurgens-delivery";
import { z } from "zod";

export const runtime = "nodejs";

const shippingRatesInputSchema = z.preprocess(
  (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? { deliveryMethod: "bobgo_courier", ...value }
      : value,
  z.discriminatedUnion("deliveryMethod", [
    bobGoCheckoutRatesInputSchema.extend({
      deliveryMethod: z.literal("bobgo_courier"),
    }),
    jurgensDeliveryCheckoutRatesInputSchema.extend({
      deliveryMethod: z.literal("jurgens_delivery"),
    }),
  ]),
);

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = shippingRatesInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "invalid_shipping_quote_request",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const result =
      parsed.data.deliveryMethod === "jurgens_delivery"
        ? await getJurgensDeliveryCheckoutRates(parsed.data)
        : await getBobGoCheckoutRates(parsed.data);

    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "shipping_quote_failed",
        message:
          error instanceof Error
            ? error.message
            : "Unable to fetch shipping rates.",
      },
      { status: 400 },
    );
  }
}
