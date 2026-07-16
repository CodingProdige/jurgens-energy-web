import { renderGoogleMerchantFeed } from "@/src/modules/marketplace/google-merchant-feed";

export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await renderGoogleMerchantFeed();

  return new Response(feed, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=300",
      "Content-Disposition": 'inline; filename="google-merchant.xml"',
      "Content-Type": "application/xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
