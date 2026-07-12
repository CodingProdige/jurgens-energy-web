import { processPayFastItn } from "@/src/modules/checkout/payfast-itn";
import { getClientIp } from "@/src/modules/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "invalid_form_data" }, { status: 400 });
  }

  try {
    const result = await processPayFastItn({
      clientIp: await getClientIp(),
      formData,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "invalid_payfast_notification",
        message:
          error instanceof Error ? error.message : "The notification was rejected.",
      },
      { status: 400 },
    );
  }
}
