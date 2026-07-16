import {
  PayFastItnError,
  processPayFastItn,
} from "@/src/modules/checkout/payfast-itn";
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
      cfConnectingIp: request.headers.get("cf-connecting-ip"),
      clientIp: await getClientIp(),
      formData,
      xForwardedFor: request.headers.get("x-forwarded-for"),
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const payFastError =
      error instanceof PayFastItnError
        ? error
        : new PayFastItnError({
            cause: error,
            code: "processing_failed",
            httpStatus: 503,
            message: "The PayFast notification could not be processed.",
            stage: "received",
          });

    return Response.json(
      {
        ok: false,
        auditEventId: payFastError.auditEventId,
        error: payFastError.code,
        message: payFastError.message,
        stage: payFastError.stage,
      },
      { status: payFastError.httpStatus },
    );
  }
}
