import { z } from "zod";

import { getCheckoutOrderSummary } from "@/src/modules/checkout/orders";

const tokenSchema = z.string().min(20).max(200);

export async function GET(
  request: Request,
  context: RouteContext<"/api/checkout/orders/[orderId]">,
) {
  const { orderId } = await context.params;
  const url = new URL(request.url);
  const tokenResult = tokenSchema.safeParse(url.searchParams.get("token"));
  const orderIdResult = z.string().uuid().safeParse(orderId);

  if (!tokenResult.success || !orderIdResult.success) {
    return Response.json({ error: "invalid_order" }, { status: 400 });
  }

  const order = await getCheckoutOrderSummary(
    orderIdResult.data,
    tokenResult.data,
  );

  if (!order) {
    return Response.json({ error: "order_not_found" }, { status: 404 });
  }

  return Response.json(order, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
