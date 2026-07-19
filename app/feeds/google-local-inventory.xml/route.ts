import { renderGoogleLocalInventoryFeed } from "@/src/modules/marketplace/google-local-inventory-feed";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await renderGoogleLocalInventoryFeed();

  return new Response(result.feed, {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=300, stale-while-revalidate=300",
      "Content-Disposition":
        'inline; filename="google-local-inventory.xml"',
      "Content-Type": "application/xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Jurgens-Feed-Item-Count": String(result.itemCount),
      "X-Jurgens-Feed-State": result.state,
    },
  });
}
