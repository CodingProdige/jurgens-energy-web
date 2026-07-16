import { cookies } from "next/headers";

import { auth } from "@/auth";
import { hasAdminCapability } from "@/src/modules/admin/staff";
import { canAccessCapability } from "@/src/modules/auth/service";
import {
  getSurfaceAccessCookieName,
  verifySurfaceAccessToken,
} from "@/src/modules/auth/surface-access";
import {
  getInvoicePdfAccessRecord,
  hasValidInvoiceAccessToken,
  readReadyInvoicePdf,
} from "@/src/modules/invoices/access";
import { getCheckoutOrderWithToken } from "@/src/modules/checkout/orders";

export const runtime = "nodejs";

function notFoundResponse() {
  return Response.json(
    { ok: false, message: "Invoice not found." },
    { status: 404 },
  );
}

async function hasVerifiedAdminAccess(user: {
  adminCapabilities: Parameters<typeof hasAdminCapability>[0];
  id: string;
  roles: NonNullable<Parameters<typeof canAccessCapability>[0]>["roles"];
}) {
  if (
    !canAccessCapability({ roles: user.roles }, "admin") ||
    !hasAdminCapability(user.adminCapabilities, "admin.orders.view")
  ) {
    return false;
  }

  const cookieStore = await cookies();
  const surfaceAccessToken = cookieStore.get(
    getSurfaceAccessCookieName("admin"),
  )?.value;

  return verifySurfaceAccessToken({
    surface: "admin",
    token: surfaceAccessToken,
    userId: user.id,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;
  const invoice = await getInvoicePdfAccessRecord(invoiceId);

  if (!invoice) {
    return notFoundResponse();
  }

  const session = await auth();
  const isOwner = Boolean(
    session?.user?.id && session.user.id === invoice.ownerUserId,
  );
  const isAdmin = session?.user
    ? await hasVerifiedAdminAccess(session.user)
    : false;
  const token = new URL(request.url).searchParams.get("token");
  const checkoutToken = new URL(request.url).searchParams.get("checkoutToken");
  const hasToken = token
    ? await hasValidInvoiceAccessToken({ invoiceId: invoice.id, token })
    : false;
  const hasCheckoutAccess = checkoutToken
    ? Boolean(await getCheckoutOrderWithToken(invoice.orderId, checkoutToken))
    : false;

  if (!isOwner && !isAdmin && !hasToken && !hasCheckoutAccess) {
    return notFoundResponse();
  }

  const pdf = await readReadyInvoicePdf(invoice);

  if (!pdf) {
    return Response.json(
      {
        ok: false,
        message: "This invoice PDF is still being prepared.",
      },
      {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
        status: 409,
      },
    );
  }

  const filename = `${invoice.invoiceNumber}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
      "Content-Type": "application/pdf",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
