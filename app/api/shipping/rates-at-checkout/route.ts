import { auth } from "@/auth";

export const runtime = "nodejs";

/**
 * Legacy provider-rate endpoint retained as a non-leaking compatibility
 * boundary. Customer checkout now uses /api/checkout/quotes, which returns the
 * configured order-level policy price and never exposes carrier costs.
 */
export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return Response.json(
    {
      error: "provider_rates_are_internal",
      message:
        "Carrier rates are no longer available at checkout. Use the customer delivery quote endpoint.",
      ok: false,
    },
    { status: 410 },
  );
}
