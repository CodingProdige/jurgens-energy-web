import { z } from "zod";

import { auth } from "@/auth";
import {
  inAppNotificationSurfaces,
  type InAppNotificationSurface,
} from "@/src/db/schema";
import {
  revokePushSubscription,
  savePushSubscription,
} from "@/src/modules/notifications/push";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
  surface: z.enum(inAppNotificationSurfaces).default("marketplace"),
});

const revokeSubscriptionSchema = z.object({
  endpoint: z.string().url(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json(
      { ok: false, message: "Sign in to enable push notifications." },
      { status: 401 },
    );
  }

  const parsed = pushSubscriptionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json(
      { ok: false, message: "Invalid push subscription." },
      { status: 400 },
    );
  }

  const result = await savePushSubscription({
    subscription: {
      auth: parsed.data.keys.auth,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
    },
    surface: parsed.data.surface as InAppNotificationSurface,
    userAgent: request.headers.get("user-agent"),
    userId: session.user.id,
  });

  return Response.json(result);
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const parsed = revokeSubscriptionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json(
      { ok: false, message: "Invalid push subscription." },
      { status: 400 },
    );
  }

  const result = await revokePushSubscription({
    endpoint: parsed.data.endpoint,
    userId: session.user.id,
  });

  return Response.json(result);
}
