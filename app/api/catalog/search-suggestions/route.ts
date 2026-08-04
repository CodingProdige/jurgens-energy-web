import type { NextRequest } from "next/server";
import { z } from "zod";

import { getCurrencyContext } from "@/src/modules/currency/server";
import { getMarketplaceSearchSuggestions } from "@/src/modules/marketplace/catalog";

const searchSuggestionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).catch(6),
  q: z.string().trim().max(120).catch(""),
});

export async function GET(request: NextRequest) {
  const parsed = searchSuggestionsSchema.parse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    q: request.nextUrl.searchParams.get("q") ?? "",
  });
  const currencyContext = await getCurrencyContext();
  const data = await getMarketplaceSearchSuggestions({
    currencyContext,
    limit: parsed.limit,
    query: parsed.q,
  });

  return Response.json(data, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
