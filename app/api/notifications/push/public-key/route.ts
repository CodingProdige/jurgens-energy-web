import { getWebPushPublicKey } from "@/src/modules/notifications/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey = getWebPushPublicKey();

  return Response.json({
    configured: Boolean(publicKey),
    publicKey,
  });
}
