import { auth } from "@/auth";
import {
  consumeWhatsappOrderDraft,
  getWhatsappOrderDraftByToken,
} from "@/src/modules/whatsapp-ordering/service";
import { WhatsappNumberLinkedToAnotherUserError } from "@/src/modules/whatsapp-ordering/customer-links";
import { whatsappDraftTokenSchema } from "@/src/modules/whatsapp-ordering/draft-tokens";
import {
  checkRateLimit,
  getClientIp,
} from "@/src/modules/security/rate-limit";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/whatsapp/drafts/[token]">,
) {
  const clientIp = await getClientIp();
  const rateLimit = await checkRateLimit({
    key: `whatsapp-draft-read:${clientIp}`,
    limit: 60,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "rate_limited" },
      {
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        status: 429,
      },
    );
  }

  const { token } = await context.params;
  const parsed = whatsappDraftTokenSchema.safeParse(token);

  if (!parsed.success) {
    return Response.json({ error: "invalid_draft" }, { status: 400 });
  }

  const draft = await getWhatsappOrderDraftByToken(parsed.data);

  if (!draft) {
    return Response.json({ error: "draft_not_found" }, { status: 404 });
  }

  return Response.json(draft, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(
  _request: Request,
  context: RouteContext<"/api/whatsapp/drafts/[token]">,
) {
  const { token } = await context.params;
  const parsed = whatsappDraftTokenSchema.safeParse(token);

  if (!parsed.success) {
    return Response.json({ error: "invalid_draft" }, { status: 400 });
  }

  const session = await auth();

  try {
    await consumeWhatsappOrderDraft(parsed.data, session?.user?.id ?? null);
  } catch (error) {
    if (error instanceof WhatsappNumberLinkedToAnotherUserError) {
      return Response.json(
        {
          error: "whatsapp_number_linked_to_another_account",
          message:
            "This WhatsApp order link is already linked to another account.",
        },
        { status: 409 },
      );
    }

    throw error;
  }

  return Response.json({ ok: true }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
