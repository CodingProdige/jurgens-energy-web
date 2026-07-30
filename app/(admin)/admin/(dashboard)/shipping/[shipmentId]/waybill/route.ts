import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminCapability } from "@/src/modules/auth/permissions";
import { getFreshCourierGuyWaybillUrl } from "@/src/modules/shipping/courier-guy-shipments";

const shipmentIdSchema = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shipmentId: string }> },
) {
  const access = await requireAdminCapability("admin.orders.manage");

  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsedShipmentId = shipmentIdSchema.safeParse(
    (await params).shipmentId,
  );

  if (!parsedShipmentId.success) {
    return NextResponse.json(
      { error: "Invalid shipment identifier." },
      { status: 400 },
    );
  }

  try {
    const waybillUrl = await getFreshCourierGuyWaybillUrl(
      parsedShipmentId.data,
    );

    return NextResponse.redirect(waybillUrl, 307);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Courier Guy waybill generation failed.",
      },
      { status: 502 },
    );
  }
}
