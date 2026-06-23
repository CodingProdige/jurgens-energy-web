import {
  recordBobGoWebhookEvent,
  verifyBobGoWebhookSignature,
} from "@/src/modules/shipping/bobgo-webhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();

  if (!(await verifyBobGoWebhookSignature({ body, headers: request.headers }))) {
    return Response.json(
      { ok: false, error: "invalid_signature" },
      { status: 401 },
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const result = await recordBobGoWebhookEvent(payload, body);

  return Response.json(result, { status: result.ok ? 200 : 400 });
}
