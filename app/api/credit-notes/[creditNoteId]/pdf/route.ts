import { cookies } from "next/headers";

import { auth } from "@/auth";
import { hasAdminCapability } from "@/src/modules/admin/staff";
import { canAccessCapability } from "@/src/modules/auth/service";
import {
  getSurfaceAccessCookieName,
  verifySurfaceAccessToken,
} from "@/src/modules/auth/surface-access";
import {
  getCreditNotePdfAccessRecord,
  hasValidCreditNoteAccessToken,
  readReadyCreditNotePdf,
} from "@/src/modules/invoices/credit-note-access";

export const runtime = "nodejs";

function notFoundResponse() {
  return Response.json(
    { message: "Credit note not found.", ok: false },
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
  { params }: { params: Promise<{ creditNoteId: string }> },
) {
  const { creditNoteId } = await params;
  const creditNote = await getCreditNotePdfAccessRecord(creditNoteId);

  if (!creditNote) {
    return notFoundResponse();
  }

  const session = await auth();
  const isOwner = Boolean(
    session?.user?.id && session.user.id === creditNote.ownerUserId,
  );
  const isAdmin = session?.user
    ? await hasVerifiedAdminAccess(session.user)
    : false;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const hasToken = token
    ? await hasValidCreditNoteAccessToken({ creditNoteId: creditNote.id, token })
    : false;

  if (!isOwner && !isAdmin && !hasToken) {
    return notFoundResponse();
  }

  const pdf = await readReadyCreditNotePdf(creditNote);

  if (!pdf) {
    return Response.json(
      {
        message: "This credit-note PDF is still being prepared.",
        ok: false,
      },
      {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
        status: 409,
      },
    );
  }

  const filename = `${creditNote.creditNoteNumber}.pdf`;

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
